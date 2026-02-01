"""
Model validation service for LLMShield
Migrated from llmshield-backend-modelconfig
"""

import asyncio
import httpx
import time
import logging
import re
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from aiolimiter import AsyncLimiter

logger = logging.getLogger(__name__)

# Custom exceptions for retry logic
class RetryableError(Exception):
    """Error that should be retried (429, 500, 502, 503, 504, network errors)"""
    pass

class NonRetryableError(Exception):
    """Error that should NOT be retried (400, 401, 403, etc.)"""
    pass

class ValidationResult(BaseModel):
    """Result of parameter validation"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    normalized_params: Optional[Dict[str, Any]] = None

class ConnectionTestResult(BaseModel):
    """Result of connection testing"""
    connected: bool
    response_time_ms: float
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ModelValidator:
    """Service for validating model configurations and testing connections"""
    
    def __init__(self):
        # Smart Rate Limiting: Provider-aware rate limiters
        # Cloud APIs have limits, local models don't
        self.rate_limiters = {
            "openai": AsyncLimiter(max_rate=60, time_period=60),      # 60 requests/minute
            "anthropic": AsyncLimiter(max_rate=50, time_period=60),   # 50 requests/minute
            "google": AsyncLimiter(max_rate=60, time_period=60),      # 60 requests/minute
            "custom": AsyncLimiter(max_rate=60, time_period=60),      # Default: 60/min for custom APIs
            "ollama": None,  # No rate limiting for local Ollama
            "local": None,   # No rate limiting for local models
        }
        
        self.supported_providers = {
            "openai": {
                "base_url": "https://api.openai.com/v1",
                "models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "o1-preview", "o1-mini", "gpt-5.1", "gpt-5.2", "gpt-5.2-nano"],
                "required_params": ["api_key"],
                "optional_params": ["temperature", "max_tokens", "max_completion_tokens", "top_p", "frequency_penalty", "presence_penalty"],
                # Models that use max_completion_tokens instead of max_tokens
                # Newer OpenAI models (o1 series, gpt-4o series, gpt-5 series) require max_completion_tokens
                "max_completion_tokens_models": [
                    "o1-preview", "o1-mini", "o1", 
                    "gpt-4o", "gpt-4o-2024-08-06", "gpt-4o-mini", "gpt-4o-2024-11-20",
                    "gpt-5.1", "gpt-5.2", "gpt-5.2-nano",
                    "gpt-3.5-turbo"  # Some newer versions may require it
                ],
                # Pattern matching for model names (e.g., "gpt-4o-*" matches all gpt-4o variants)
                "max_completion_tokens_patterns": [
                    r"^o1",  # All o1 models
                    r"^gpt-4o",  # All gpt-4o models
                    r"^gpt-5",  # All gpt-5 models (5.1, 5.2, 5.2-nano, etc.)
                    r"gpt-3\.5-turbo-\d{4}",  # Newer gpt-3.5-turbo versions with dates
                ]
            },
            "anthropic": {
                "base_url": "https://api.anthropic.com/v1",
                "models": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
                "required_params": ["api_key"],
                "optional_params": ["temperature", "max_tokens", "top_p", "top_k"]
            },
            "google": {
                "base_url": "https://generativelanguage.googleapis.com/v1beta",
                "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
                "required_params": ["api_key"],
                "optional_params": ["temperature", "max_output_tokens", "top_p", "top_k"]
            },
            "ollama": {
                "base_url": "http://localhost:11434",
                "models": ["llama2", "llama3", "mistral", "codellama", "phi", "gemma"],
                "required_params": ["base_url"],
                "optional_params": ["temperature", "max_tokens", "top_p", "top_k"]
            },
            "custom": {
                "base_url": None,  # Custom providers can have any base URL
                "models": [],  # Custom providers can use any model
                "required_params": ["api_key", "base_url"],
                "optional_params": ["temperature", "max_tokens", "top_p", "top_k", "frequency_penalty", "presence_penalty"]
            },
            "local": {
                "base_url": "http://localhost:8080",  # Default for local models
                "models": [],  # Local models can be any model
                "required_params": ["base_url"],
                "optional_params": ["temperature", "max_tokens", "top_p", "top_k"]
            }
        }
    
    async def validate_model_type(self, model_type: str) -> ValidationResult:
        """Validate and normalize the selected model type"""
        logger.info(f"Validating model type: {model_type}")
        
        supported_types = ["openai", "anthropic", "google", "custom", "local", "ollama"]
        errors = []
        
        if not model_type:
            errors.append("Model type is required")
        elif model_type.lower() not in supported_types:
            errors.append(f"Unsupported model type: {model_type}. Supported types: {supported_types}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            normalized_params={"model_type": model_type.lower()} if model_type else None
        )
    
    async def validate_parameters(self, params: Dict[str, Any]) -> ValidationResult:
        """Validate model parameters"""
        errors = []
        warnings = []
        normalized_params = params.copy()
        
        provider = params.get("model_type", "").lower()
        if provider not in self.supported_providers:
            errors.append(f"Unsupported provider: {provider}")
            return ValidationResult(valid=False, errors=errors)
        
        provider_config = self.supported_providers[provider]
        
        # Check required parameters
        credentials = params.get("credentials", {})
        parameters = params.get("parameters", {})
        
        for required_param in provider_config["required_params"]:
            # For Ollama and Local providers, check base_url in parameters instead of credentials
            if provider in ["ollama", "local"] and required_param == "base_url":
                if required_param not in parameters and required_param not in params:
                    errors.append(f"Missing required parameter: {required_param}")
            # For Custom providers, check both credentials and parameters for required params
            elif provider == "custom":
                if required_param == "base_url":
                    if required_param not in parameters and required_param not in params:
                        errors.append(f"Missing required parameter: {required_param}")
                elif required_param not in credentials:
                    errors.append(f"Missing required parameter: {required_param}")
            else:
                if required_param not in credentials:
                    errors.append(f"Missing required parameter: {required_param}")
        
        # Validate model name - skip validation for custom and local providers
        model_name = params.get("model_name")
        if model_name and provider not in ["custom", "local"] and model_name not in provider_config["models"]:
            warnings.append(f"Model {model_name} not in known models list")
        
        # Validate optional parameters
        model_params = params.get("parameters", {})
        
        # Temperature validation
        if "temperature" in model_params:
            temp = model_params["temperature"]
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 2:
                errors.append("Temperature must be between 0 and 2")
            elif temp > 1:
                warnings.append("Temperature > 1 may produce unpredictable results")
        
        # Max tokens validation
        max_tokens_key = "max_tokens" if provider != "google" else "max_output_tokens"
        if max_tokens_key in model_params:
            max_tokens = model_params[max_tokens_key]
            if not isinstance(max_tokens, int) or max_tokens < 1:
                errors.append(f"{max_tokens_key} must be a positive integer")
            elif max_tokens > 4096:
                warnings.append(f"{max_tokens_key} > 4096 may be expensive")
        
        # Top-p validation
        if "top_p" in model_params:
            top_p = model_params["top_p"]
            if not isinstance(top_p, (int, float)) or top_p <= 0 or top_p > 1:
                errors.append("top_p must be between 0 and 1")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            normalized_params=normalized_params
        )
    
    async def test_connection(self, config: Dict[str, Any]) -> ConnectionTestResult:
        """Test connection to model provider"""
        start_time = time.time()
        
        try:
            provider = config.get("model_type", "").lower()
            if provider not in self.supported_providers:
                return ConnectionTestResult(
                    connected=False,
                    response_time_ms=0,
                    error_message=f"Unsupported provider: {provider}"
                )
            
            provider_config = self.supported_providers[provider]
            
            # For Ollama, we don't need API key, just check base_url
            if provider == "ollama":
                base_url = config.get("base_url") or config.get("parameters", {}).get("base_url", "http://localhost:11434")
                test_endpoint = f"{base_url}/api/tags"
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(test_endpoint)
                    
                response_time = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    return ConnectionTestResult(
                        connected=True,
                        response_time_ms=response_time,
                        metadata={"status_code": response.status_code}
                    )
                else:
                    return ConnectionTestResult(
                        connected=False,
                        response_time_ms=response_time,
                        error_message=f"Connection failed: {response.status_code}"
                    )
            
            # For other providers, use API key
            api_key = config.get("credentials", {}).get("api_key")
            
            if not api_key:
                return ConnectionTestResult(
                    connected=False,
                    response_time_ms=0,
                    error_message="API key is required"
                )
            
            # Test with a simple request
            headers = self._get_headers(provider, api_key)
            test_endpoint = self._get_test_endpoint(provider)
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(test_endpoint, headers=headers)
                
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code in [200, 401, 403]:  # 401/403 means we reached the API
                if response.status_code == 200:
                    return ConnectionTestResult(
                        connected=True,
                        response_time_ms=response_time,
                        metadata={"status_code": response.status_code}
                    )
                else:
                    return ConnectionTestResult(
                        connected=False,
                        response_time_ms=response_time,
                        error_message=f"Authentication failed: Invalid API key",
                        metadata={"status_code": response.status_code}
                    )
            else:
                return ConnectionTestResult(
                    connected=False,
                    response_time_ms=response_time,
                    error_message=f"Connection failed: {response.status_code}"
                )
                
        except httpx.TimeoutException:
            return ConnectionTestResult(
                connected=False,
                response_time_ms=(time.time() - start_time) * 1000,
                error_message="Connection timeout"
            )
        except Exception as e:
            return ConnectionTestResult(
                connected=False,
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Connection error: {str(e)}"
            )
    
    async def make_request(self, config: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """
        Make a request to the model with smart rate limiting and retry logic.
        Rate limiting is applied first, then retry logic handles transient failures.
        """
        try:
            provider = config.get("model_type", "").lower()
            logger.debug(f"Making request to provider: {provider}")
            
            if provider not in self.supported_providers:
                return {
                    "success": False,
                    "error": f"Unsupported provider: {provider}"
                }
            
            # Apply rate limiting for cloud providers only
            # Retry logic is handled inside _make_api_request
            rate_limiter = self.rate_limiters.get(provider)
            if rate_limiter is not None:
                # Cloud API - apply rate limiting, then retry logic
                async with rate_limiter:
                    logger.debug(f"Rate limiting applied for {provider}")
                    return await self._make_api_request(config, prompt, provider)
            else:
                # Local model (Ollama/local) - no rate limiting, but still has retry logic
                logger.debug(f"No rate limiting for local provider: {provider}")
                return await self._make_api_request(config, prompt, provider)
                
        except Exception as e:
            # This should rarely happen as _make_api_request handles most errors
            logger.error(f"Unexpected error in make_request: {str(e)}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
    
    async def _make_api_request(self, config: Dict[str, Any], prompt: str, provider: str) -> Dict[str, Any]:
        """
        Internal method to make the actual API request with retry logic.
        Retries on transient failures (429, 500, 502, 503, 504, network errors).
        Uses exponential backoff for retries.
        """
        max_retries = 3
        base_delay = 1.0  # Start with 1 second
        
        for attempt in range(max_retries):
            try:
                return await self._execute_api_request(config, prompt, provider)
            except RetryableError as e:
                if attempt < max_retries - 1:
                    # Calculate exponential backoff: 1s, 2s, 4s
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        f"Retryable error on attempt {attempt + 1}/{max_retries} for {provider}: {str(e)}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    # Final attempt failed
                    logger.error(f"All {max_retries} retry attempts failed for {provider}: {str(e)}")
                    return {
                        "success": False,
                        "error": f"Request failed after {max_retries} attempts: {str(e)}"
                    }
            except NonRetryableError as e:
                # Don't retry on client errors (400, 401, 403)
                logger.error(f"Non-retryable error for {provider}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }
            except Exception as e:
                # Unexpected errors - retry once
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        f"Unexpected error on attempt {attempt + 1}/{max_retries} for {provider}: {str(e)}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    logger.error(f"Request failed after {max_retries} attempts: {str(e)}")
                    return {
                        "success": False,
                        "error": f"Request failed: {str(e)}"
                    }
        
        # Should never reach here, but just in case
        return {
            "success": False,
            "error": "Request failed: Maximum retries exceeded"
        }
    
    async def _execute_api_request(self, config: Dict[str, Any], prompt: str, provider: str) -> Dict[str, Any]:
        """Execute a single API request attempt"""
        try:
            
            model_name = config.get("model_name", "")
            parameters = config.get("parameters", {})
            
            # Handle Ollama and Local providers differently
            if provider in ["ollama", "local"]:
                base_url = config.get("base_url") or config.get("parameters", {}).get("base_url")
                if provider == "ollama":
                    base_url = base_url or "http://localhost:11434"
                    endpoint = f"{base_url}/api/generate"
                elif provider == "local":
                    base_url = base_url or "http://localhost:8080"
                    endpoint = f"{base_url}/v1/chat/completions"  # Assume OpenAI-compatible API
                
                logger.debug(f"Using endpoint: {endpoint} for model: {model_name}")
                
                # Filter parameters for Ollama and Local providers
                provider_config = self.supported_providers[provider]
                supported_params = provider_config.get("optional_params", [])
                filtered_parameters = {k: v for k, v in parameters.items() if k in supported_params}
                
                if provider == "ollama":
                    payload = {
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        **filtered_parameters
                    }
                else:  # local
                    payload = {
                        "model": model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        **filtered_parameters
                    }
                
                logger.debug(f"Request payload prepared for {provider}")
                
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(endpoint, json=payload)
                        
                    # Handle HTTP status codes
                    if response.status_code == 200:
                        response_data = response.json()
                        if provider == "ollama":
                            text = response_data.get("response", "")
                        else:  # local
                            text = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        
                        return {
                            "success": True,
                            "response": text,
                            "metadata": {
                                "model": model_name,
                                "provider": provider
                            }
                        }
                    else:
                        # Raise appropriate exception based on status code
                        error_text = ""
                        try:
                            error_data = response.json()
                            error_text = f" - {error_data.get('error', error_data)}"
                        except:
                            try:
                                error_text = f" - {response.text}"
                            except:
                                pass
                        
                        error_msg = f"HTTP {response.status_code}{error_text}"
                        
                        # Retryable errors: 429 (rate limit), 500, 502, 503, 504 (server errors)
                        if response.status_code in [429, 500, 502, 503, 504]:
                            raise RetryableError(error_msg)
                        # Non-retryable errors: 400 (bad request), 401 (unauthorized), 403 (forbidden)
                        elif response.status_code in [400, 401, 403]:
                            raise NonRetryableError(error_msg)
                        # Other errors - treat as non-retryable
                        else:
                            raise NonRetryableError(error_msg)
                            
                except httpx.TimeoutException as e:
                    raise RetryableError(f"Request timeout: {str(e)}")
                except httpx.ConnectError as e:
                    raise RetryableError(f"Connection error: {str(e)}")
                except httpx.NetworkError as e:
                    raise RetryableError(f"Network error: {str(e)}")
                except RetryableError:
                    raise  # Re-raise retryable errors
                except NonRetryableError:
                    raise  # Re-raise non-retryable errors
            
            # For custom providers, handle flexible configuration
            if provider == "custom":
                base_url = config.get("base_url") or config.get("parameters", {}).get("base_url")
                api_key = config.get("credentials", {}).get("api_key")
                
                if not base_url:
                    return {
                        "success": False,
                        "error": "Base URL is required for custom providers"
                    }
                
                if not api_key:
                    return {
                        "success": False,
                        "error": "API key is required for custom providers"
                    }
                
                # Assume OpenAI-compatible API for custom providers
                endpoint = f"{base_url.rstrip('/')}/v1/chat/completions"
                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                
                # Filter parameters for Custom provider
                provider_config = self.supported_providers[provider]
                supported_params = provider_config.get("optional_params", [])
                filtered_parameters = {k: v for k, v in parameters.items() if k in supported_params}
                
                payload = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    **filtered_parameters
                }
                
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(endpoint, headers=headers, json=payload)
                        
                    if response.status_code == 200:
                        response_data = response.json()
                        text = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        
                        return {
                            "success": True,
                            "response": text,
                            "raw_response": response_data
                        }
                    else:
                        error_msg = f"HTTP {response.status_code} - {response.text[:200]}"
                        if response.status_code in [429, 500, 502, 503, 504]:
                            raise RetryableError(error_msg)
                        else:
                            raise NonRetryableError(error_msg)
                            
                except httpx.TimeoutException as e:
                    raise RetryableError(f"Request timeout: {str(e)}")
                except httpx.ConnectError as e:
                    raise RetryableError(f"Connection error: {str(e)}")
                except httpx.NetworkError as e:
                    raise RetryableError(f"Network error: {str(e)}")
                except RetryableError:
                    raise
                except NonRetryableError:
                    raise
            
            # For other standard providers, use API key
            api_key = config.get("credentials", {}).get("api_key")
            if not api_key:
                return {
                    "success": False,
                    "error": "API key is required"
                }
            
            headers = self._get_headers(provider, api_key)
            endpoint = self._get_chat_endpoint(provider)
            
            # Filter parameters based on provider's supported parameters
            provider_config = self.supported_providers[provider]
            supported_params = provider_config.get("optional_params", [])
            filtered_parameters = {k: v for k, v in parameters.items() if k in supported_params}
            
            # Prepare request payload based on provider
            if provider == "openai":
                # Handle max_tokens vs max_completion_tokens for different OpenAI models
                openai_config = self.supported_providers["openai"]
                max_completion_tokens_models = openai_config.get("max_completion_tokens_models", [])
                max_completion_tokens_patterns = openai_config.get("max_completion_tokens_patterns", [])
                
                # Check if this model requires max_completion_tokens
                requires_max_completion = False
                
                # Check exact match (case-insensitive)
                model_name_lower = model_name.lower()
                if model_name in max_completion_tokens_models or model_name_lower in [m.lower() for m in max_completion_tokens_models]:
                    requires_max_completion = True
                else:
                    # Check pattern matching
                    for pattern in max_completion_tokens_patterns:
                        if re.match(pattern, model_name, re.IGNORECASE):
                            requires_max_completion = True
                            logger.info(f"Model {model_name} matched pattern {pattern}, using max_completion_tokens")
                            break
                
                # Convert max_tokens to max_completion_tokens if needed
                if requires_max_completion:
                    # Use max_completion_tokens for newer models like o1, gpt-4o, gpt-5
                    if "max_tokens" in filtered_parameters:
                        max_tokens_value = filtered_parameters.pop("max_tokens")
                        filtered_parameters["max_completion_tokens"] = max_tokens_value
                        logger.debug(f"Converted max_tokens to max_completion_tokens for model {model_name}")
                    # Remove max_tokens if it somehow got in there
                    filtered_parameters.pop("max_tokens", None)
                    # Ensure max_completion_tokens is present (default to 1000 if not set)
                    if "max_completion_tokens" not in filtered_parameters:
                        filtered_parameters["max_completion_tokens"] = 1000
                else:
                    # Use max_tokens for older models, remove max_completion_tokens if present
                    if "max_completion_tokens" in filtered_parameters:
                        max_completion_value = filtered_parameters.pop("max_completion_tokens")
                        filtered_parameters["max_tokens"] = max_completion_value
                    # Ensure max_tokens is present (default to 1000 if not set)
                    if "max_tokens" not in filtered_parameters:
                        filtered_parameters["max_tokens"] = 1000
                
                payload = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    **filtered_parameters
                }
            elif provider == "anthropic":
                payload = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": filtered_parameters.get("max_tokens", 1000),
                    **{k: v for k, v in filtered_parameters.items() if k != "max_tokens"}
                }
            elif provider == "google":
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": filtered_parameters
                }
            
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(endpoint, headers=headers, json=payload)
                    
                if response.status_code == 200:
                    response_data = response.json()
                    
                    # Extract response text based on provider
                    if provider == "openai":
                        text = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    elif provider == "anthropic":
                        text = response_data.get("content", [{}])[0].get("text", "")
                    elif provider == "google":
                        text = response_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    
                    return {
                        "success": True,
                        "response": text,
                        "raw_response": response_data
                    }
                else:
                    # Handle special case: OpenAI 400 error about max_tokens
                    if provider == "openai" and response.status_code == 400:
                        try:
                            error_data = response.json()
                            error_obj = error_data.get('error', {})
                            error_message = error_obj.get('message', '') if isinstance(error_obj, dict) else str(error_obj)
                            
                            # Check if error is about max_tokens needing to be max_completion_tokens
                            # Very lenient check - if it's a 400 error mentioning max_tokens, try the fix
                            error_lower = error_message.lower()
                            error_text_lower = response.text.lower() if hasattr(response, 'text') else ''
                            full_error_text = (error_message + ' ' + error_text_lower).lower()
                            
                            is_max_tokens_error = (
                                'max_tokens' in full_error_text and 
                                ('max_completion_tokens' in full_error_text or 
                                 'max_completion' in full_error_text or
                                 'not supported' in full_error_text or
                                 'unsupported parameter' in full_error_text or
                                 'use' in full_error_text)  # "Use 'max_completion_tokens' instead"
                            )
                            
                            if is_max_tokens_error:
                                logger.info(f"Model {model_name} requires max_completion_tokens (detected from 400 error), retrying with corrected parameter")
                                logger.debug(f"Original error: {error_message[:200]}")
                                
                                # Fix the payload - remove max_tokens and add max_completion_tokens
                                max_tokens_value = payload.pop("max_tokens", 1000)  # Get value or use default
                                payload["max_completion_tokens"] = max_tokens_value
                                # Make absolutely sure max_tokens is removed
                                payload.pop("max_tokens", None)
                                logger.debug(f"Fixed payload: converted max_tokens={max_tokens_value} to max_completion_tokens. Payload keys: {list(payload.keys())}")
                                
                                # Retry the request with corrected parameter
                                retry_response = await client.post(endpoint, headers=headers, json=payload)
                                
                                if retry_response.status_code == 200:
                                    response_data = retry_response.json()
                                    text = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                                    logger.info(f"✅ Successfully retried with max_completion_tokens for model {model_name}")
                                    return {
                                        "success": True,
                                        "response": text,
                                        "raw_response": response_data
                                    }
                                else:
                                    try:
                                        retry_error_data = retry_response.json()
                                        retry_error_text = str(retry_error_data.get('error', retry_response.text[:200]))
                                    except:
                                        retry_error_text = retry_response.text[:200] if hasattr(retry_response, 'text') else str(retry_response.status_code)
                                    logger.warning(f"❌ Retry with max_completion_tokens still failed: HTTP {retry_response.status_code} - {retry_error_text}")
                        except Exception as retry_error:
                            logger.warning(f"Error during retry with max_completion_tokens: {retry_error}", exc_info=True)
                            # Fall through to normal error handling
                    
                    error_msg = f"HTTP {response.status_code} - {response.text[:200]}"
                    if response.status_code in [429, 500, 502, 503, 504]:
                        raise RetryableError(error_msg)
                    else:
                        raise NonRetryableError(error_msg)
                        
            except httpx.TimeoutException as e:
                raise RetryableError(f"Request timeout: {str(e)}")
            except httpx.ConnectError as e:
                raise RetryableError(f"Connection error: {str(e)}")
            except httpx.NetworkError as e:
                raise RetryableError(f"Network error: {str(e)}")
            except RetryableError:
                raise
            except NonRetryableError:
                raise
                
        except RetryableError:
            raise  # Re-raise to be handled by retry logic
        except NonRetryableError:
            raise  # Re-raise to be handled by retry logic
        except Exception as e:
            # Unexpected errors - wrap as retryable for one retry attempt
            logger.warning(f"Unexpected error in _execute_api_request for {provider}: {str(e)}")
            raise RetryableError(f"Unexpected error: {str(e)}")
    
    def _get_headers(self, provider: str, api_key: str) -> Dict[str, str]:
        """Get headers for API requests"""
        if provider == "openai":
            return {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        elif provider == "anthropic":
            return {
                "x-api-key": api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
        elif provider == "google":
            return {
                "Content-Type": "application/json"
            }
        elif provider == "ollama":
            return {
                "Content-Type": "application/json"
            }
        return {}
    
    def _get_test_endpoint(self, provider: str) -> str:
        """Get test endpoint for connectivity check"""
        base_url = self.supported_providers[provider]["base_url"]
        if provider == "openai":
            return f"{base_url}/models"
        elif provider == "anthropic":
            return f"{base_url}/messages"
        elif provider == "google":
            return f"{base_url}/models"
        elif provider == "ollama":
            return f"{base_url}/api/tags"
        return base_url
    
    def _get_chat_endpoint(self, provider: str) -> str:
        """Get chat endpoint for making requests"""
        base_url = self.supported_providers[provider]["base_url"]
        if provider == "openai":
            return f"{base_url}/chat/completions"
        elif provider == "anthropic":
            return f"{base_url}/messages"
        elif provider == "google":
            return f"{base_url}/models/gemini-pro:generateContent"
        elif provider == "ollama":
            return f"{base_url}/api/generate"
        return base_url

# Global instance
model_validator = ModelValidator()
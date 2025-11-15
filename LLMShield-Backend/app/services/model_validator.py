"""
Model validation service for LLMShield
Migrated from llmshield-backend-modelconfig
"""

import asyncio
import httpx
import time
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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
        self.supported_providers = {
            "openai": {
                "base_url": "https://api.openai.com/v1",
                "models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "o1-preview", "o1-mini"],
                "required_params": ["api_key"],
                "optional_params": ["temperature", "max_tokens", "max_completion_tokens", "top_p", "frequency_penalty", "presence_penalty"],
                # Models that use max_completion_tokens instead of max_tokens
                "max_completion_tokens_models": ["o1-preview", "o1-mini", "gpt-4o", "gpt-4o-2024-08-06", "gpt-4o-mini", "gpt-3.5-turbo"]
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
        """Make a request to the model"""
        try:
            provider = config.get("model_type", "").lower()
            print(f"DEBUG: Provider from config: {provider}")
            print(f"DEBUG: Full config: {config}")
            
            if provider not in self.supported_providers:
                return {
                    "success": False,
                    "error": f"Unsupported provider: {provider}"
                }
            
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
                
                print(f"DEBUG: Using endpoint: {endpoint}")
                print(f"DEBUG: Model name: {model_name}")
                
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
                
                print(f"DEBUG: Payload: {payload}")
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(endpoint, json=payload)
                    
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
                    error_text = ""
                    try:
                        error_data = response.json()
                        error_text = f" - {error_data.get('error', error_data)}"
                    except:
                        try:
                            error_text = f" - {response.text}"
                        except:
                            pass
                    
                    print(f"Model request failed for {model_name}: Status {response.status_code}{error_text}")
                    return {
                        "success": False,
                        "error": f"Request failed: {response.status_code}{error_text}"
                    }
            
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
                    return {
                        "success": False,
                        "error": f"API request failed: {response.status_code} - {response.text}"
                    }
            
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
                
                # Check if this model requires max_completion_tokens
                if model_name in max_completion_tokens_models:
                    # Use max_completion_tokens for newer models like o1
                    if "max_tokens" in filtered_parameters:
                        filtered_parameters["max_completion_tokens"] = filtered_parameters.pop("max_tokens")
                else:
                    # Use max_tokens for older models, remove max_completion_tokens if present
                    if "max_completion_tokens" in filtered_parameters:
                        filtered_parameters["max_tokens"] = filtered_parameters.pop("max_completion_tokens")
                
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
                return {
                    "success": False,
                    "error": f"API request failed: {response.status_code} - {response.text}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
    
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
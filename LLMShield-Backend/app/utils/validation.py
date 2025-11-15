"""
Validation utilities for model configurations
"""
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
import re


class ModelConfigValidator:
    """Validator for model configuration data"""
    
    # Supported model types and their required fields
    MODEL_TYPE_REQUIREMENTS = {
        "openai": {
            "required_credentials": ["api_key"],
            "optional_credentials": ["organization_id"],
            "required_parameters": [],
            "optional_parameters": ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"]
        },
        "anthropic": {
            "required_credentials": ["api_key"],
            "optional_credentials": [],
            "required_parameters": [],
            "optional_parameters": ["temperature", "max_tokens", "top_p", "top_k"]
        },
        "google": {
            "required_credentials": ["api_key"],
            "optional_credentials": ["project_id"],
            "required_parameters": [],
            "optional_parameters": ["temperature", "max_tokens", "top_p", "top_k"]
        },
        "custom": {
            "required_credentials": ["api_key", "base_url"],
            "optional_credentials": ["headers"],
            "required_parameters": [],
            "optional_parameters": ["temperature", "max_tokens"]
        },
        "opensource": {
            "required_credentials": ["base_url"],
            "optional_credentials": ["api_key", "headers"],
            "required_parameters": [],
            "optional_parameters": ["temperature", "max_tokens"]
        },
        "ollama": {
            "required_credentials": ["base_url"],
            "optional_credentials": [],
            "required_parameters": ["model"],
            "optional_parameters": ["temperature", "num_predict", "top_p", "top_k"]
        }
    }
    
    @classmethod
    def validate_config_name(cls, config_name: str) -> List[str]:
        """Validate configuration name"""
        errors = []
        
        if not config_name or not config_name.strip():
            errors.append("Configuration name is required")
        elif len(config_name.strip()) < 3:
            errors.append("Configuration name must be at least 3 characters long")
        elif len(config_name.strip()) > 100:
            errors.append("Configuration name must be less than 100 characters")
        elif not re.match(r'^[a-zA-Z0-9\s\-_\.]+$', config_name.strip()):
            errors.append("Configuration name can only contain letters, numbers, spaces, hyphens, underscores, and dots")
        
        return errors
    
    @classmethod
    def validate_model_type(cls, model_type: str) -> List[str]:
        """Validate model type"""
        errors = []
        
        if not model_type:
            errors.append("Model type is required")
        elif model_type not in cls.MODEL_TYPE_REQUIREMENTS:
            valid_types = ", ".join(cls.MODEL_TYPE_REQUIREMENTS.keys())
            errors.append(f"Invalid model type. Supported types: {valid_types}")
        
        return errors
    
    @classmethod
    def validate_model_name(cls, model_name: str, model_type: str) -> List[str]:
        """Validate model name"""
        errors = []
        
        if not model_name or not model_name.strip():
            errors.append("Model name is required")
        elif len(model_name.strip()) < 2:
            errors.append("Model name must be at least 2 characters long")
        elif len(model_name.strip()) > 100:
            errors.append("Model name must be less than 100 characters")
        
        # Model-specific validation
        if model_type == "openai":
            valid_models = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"]
            if model_name not in valid_models:
                errors.append(f"For OpenAI, model name should be one of: {', '.join(valid_models)}")
        elif model_type == "anthropic":
            if not model_name.startswith("claude-"):
                errors.append("For Anthropic, model name should start with 'claude-'")
        
        return errors
    
    @classmethod
    def validate_credentials(cls, credentials: Dict[str, Any], model_type: str) -> List[str]:
        """Validate credentials based on model type"""
        errors = []
        
        if model_type not in cls.MODEL_TYPE_REQUIREMENTS:
            return ["Invalid model type for credential validation"]
        
        requirements = cls.MODEL_TYPE_REQUIREMENTS[model_type]
        
        # Check required credentials
        for required_field in requirements["required_credentials"]:
            if required_field not in credentials or not credentials[required_field]:
                errors.append(f"Required credential '{required_field}' is missing or empty")
        
        # Validate API key format if present
        if "api_key" in credentials and credentials["api_key"]:
            api_key = credentials["api_key"]
            if len(api_key) < 10:
                errors.append("API key appears to be too short")
            elif len(api_key) > 200:
                errors.append("API key appears to be too long")
        
        # Validate base URL format if present
        if "base_url" in credentials and credentials["base_url"]:
            base_url = credentials["base_url"]
            if not re.match(r'^https?://', base_url):
                errors.append("Base URL must start with http:// or https://")
        
        return errors
    
    @classmethod
    def validate_parameters(cls, parameters: Dict[str, Any], model_type: str) -> List[str]:
        """Validate model parameters"""
        errors = []
        
        if model_type not in cls.MODEL_TYPE_REQUIREMENTS:
            return ["Invalid model type for parameter validation"]
        
        requirements = cls.MODEL_TYPE_REQUIREMENTS[model_type]
        
        # Check required parameters
        for required_param in requirements["required_parameters"]:
            if required_param not in parameters or parameters[required_param] is None:
                errors.append(f"Required parameter '{required_param}' is missing")
        
        # Validate parameter ranges
        if "temperature" in parameters:
            temp = parameters["temperature"]
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 2:
                errors.append("Temperature must be a number between 0 and 2")
        
        if "max_tokens" in parameters:
            max_tokens = parameters["max_tokens"]
            if not isinstance(max_tokens, int) or max_tokens < 1 or max_tokens > 100000:
                errors.append("Max tokens must be an integer between 1 and 100000")
        
        if "top_p" in parameters:
            top_p = parameters["top_p"]
            if not isinstance(top_p, (int, float)) or top_p < 0 or top_p > 1:
                errors.append("Top P must be a number between 0 and 1")
        
        return errors
    
    @classmethod
    def validate_tags(cls, tags: List[str]) -> List[str]:
        """Validate tags"""
        errors = []
        
        if len(tags) > 10:
            errors.append("Maximum 10 tags allowed")
        
        for tag in tags:
            if not isinstance(tag, str):
                errors.append("All tags must be strings")
            elif len(tag.strip()) < 1:
                errors.append("Tags cannot be empty")
            elif len(tag.strip()) > 50:
                errors.append("Tags must be less than 50 characters")
            elif not re.match(r'^[a-zA-Z0-9\-_]+$', tag.strip()):
                errors.append(f"Tag '{tag}' contains invalid characters. Use only letters, numbers, hyphens, and underscores")
        
        return errors
    
    @classmethod
    def validate_full_config(cls, config_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Validate a complete model configuration"""
        validation_errors = {}
        
        # Validate config name
        name_errors = cls.validate_config_name(config_data.get("config_name", ""))
        if name_errors:
            validation_errors["config_name"] = name_errors
        
        # Validate model type
        model_type = config_data.get("model_type", "")
        type_errors = cls.validate_model_type(model_type)
        if type_errors:
            validation_errors["model_type"] = type_errors
        
        # Validate model name
        model_name = config_data.get("model_name", "")
        name_errors = cls.validate_model_name(model_name, model_type)
        if name_errors:
            validation_errors["model_name"] = name_errors
        
        # Validate credentials
        credentials = config_data.get("credentials", {})
        cred_errors = cls.validate_credentials(credentials, model_type)
        if cred_errors:
            validation_errors["credentials"] = cred_errors
        
        # Validate parameters
        parameters = config_data.get("parameters", {})
        param_errors = cls.validate_parameters(parameters, model_type)
        if param_errors:
            validation_errors["parameters"] = param_errors
        
        # Validate tags
        tags = config_data.get("tags", [])
        tag_errors = cls.validate_tags(tags)
        if tag_errors:
            validation_errors["tags"] = tag_errors
        
        # Validate description length
        description = config_data.get("description", "")
        if description and len(description) > 500:
            validation_errors["description"] = ["Description must be less than 500 characters"]
        
        return validation_errors


# Global validator instance
model_config_validator = ModelConfigValidator()
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import HTTPException, status

from app.core.database import get_database
from app.models.model_config import ModelConfig, ModelConfigRequest, ModelConfigResponse, TestResult
from app.utils.encryption import encrypt_credentials, decrypt_credentials


class ModelConfigService:
    """Service for managing model configurations in MongoDB"""
    
    def __init__(self):
        self.collection_name = "model_configurations"
        self.test_results_collection = "test_results"
    
    async def get_collection(self):
        """Get model configurations collection"""
        db = await get_database()
        return db[self.collection_name]
    
    async def get_test_results_collection(self):
        """Get test results collection"""
        db = await get_database()
        return db[self.test_results_collection]
    
    async def create_model_config(self, user_id: str, config_request: ModelConfigRequest) -> ModelConfig:
        """Create a new model configuration"""
        collection = await self.get_collection()
        
        # Check if config name already exists for this user
        existing_config = await collection.find_one({
            "user_id": ObjectId(user_id),
            "config_name": config_request.config_name
        })
        
        if existing_config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration with name '{config_request.config_name}' already exists"
            )
        
        # Encrypt credentials before storing
        encrypted_credentials = encrypt_credentials(config_request.credentials)
        
        # Create model config document
        config_data = {
            "user_id": ObjectId(user_id),
            "config_name": config_request.config_name,
            "model_type": config_request.model_type,
            "model_name": config_request.model_name,
            "description": config_request.description,
            "tags": config_request.tags,
            "parameters": config_request.parameters,
            "credentials": encrypted_credentials,
            "endpoint_config": config_request.endpoint_config,
            "status": "draft",
            "validation_results": {},
            "last_tested": None,
            "is_shared": False,
            "shared_with": [],
            "usage_count": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert the configuration
        result = await collection.insert_one(config_data)
        config_data["_id"] = result.inserted_id
        
        return ModelConfig(**config_data)
    
    async def get_model_config(self, user_id: str, config_id: str) -> Optional[ModelConfig]:
        """Get a specific model configuration by ID"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return None
        
        config = await collection.find_one({
            "_id": ObjectId(config_id),
            "$or": [
                {"user_id": ObjectId(user_id)},
                {"is_shared": True, "shared_with": ObjectId(user_id)}
            ]
        })
        
        if not config:
            return None
        
        # Create ModelConfig instance with encrypted credentials
        return ModelConfig(**config)
    
    async def get_user_model_configs(self, user_id: str, include_shared: bool = True) -> List[ModelConfig]:
        """Get all model configurations for a user"""
        collection = await self.get_collection()
        
        query = {"user_id": ObjectId(user_id)}
        
        if include_shared:
            query = {
                "$or": [
                    {"user_id": ObjectId(user_id)},
                    {"is_shared": True, "shared_with": ObjectId(user_id)}
                ]
            }
        
        configs = await collection.find(query).to_list(length=None)
        
        # Return configs with encrypted credentials (don't decrypt for listing)
        return [ModelConfig(**config) for config in configs]
    
    async def update_model_config(self, user_id: str, config_id: str, config_request: ModelConfigRequest) -> Optional[ModelConfig]:
        """Update an existing model configuration"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return None
        
        # Check if user owns this config
        existing_config = await collection.find_one({
            "_id": ObjectId(config_id),
            "user_id": ObjectId(user_id)
        })
        
        if not existing_config:
            return None
        
        # Check if new name conflicts with existing configs (excluding current one)
        if config_request.config_name != existing_config["config_name"]:
            name_conflict = await collection.find_one({
                "user_id": ObjectId(user_id),
                "config_name": config_request.config_name,
                "_id": {"$ne": ObjectId(config_id)}
            })
            
            if name_conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Configuration with name '{config_request.config_name}' already exists"
                )
        
        # Encrypt credentials before storing
        encrypted_credentials = encrypt_credentials(config_request.credentials)
        
        # Update the configuration
        update_data = {
            "config_name": config_request.config_name,
            "model_type": config_request.model_type,
            "model_name": config_request.model_name,
            "description": config_request.description,
            "tags": config_request.tags,
            "parameters": config_request.parameters,
            "credentials": encrypt_credentials(config_request.credentials),
            "endpoint_config": config_request.endpoint_config,
            "updated_at": datetime.utcnow()
        }
        
        result = await collection.update_one(
            {"_id": ObjectId(config_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            return None
        
        # Return updated config
        return await self.get_model_config(user_id, config_id)
    
    async def delete_model_config(self, user_id: str, config_id: str) -> bool:
        """Delete a model configuration"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return False
        
        result = await collection.delete_one({
            "_id": ObjectId(config_id),
            "user_id": ObjectId(user_id)
        })
        
        return result.deleted_count > 0
    
    async def update_config_status(self, config_id: str, status: str, validation_results: Dict[str, Any] = None) -> bool:
        """Update configuration status and validation results"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return False
        
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if validation_results:
            update_data["validation_results"] = validation_results
            update_data["last_tested"] = datetime.utcnow()
        
        result = await collection.update_one(
            {"_id": ObjectId(config_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def increment_usage_count(self, config_id: str) -> bool:
        """Increment usage count for a configuration"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return False
        
        result = await collection.update_one(
            {"_id": ObjectId(config_id)},
            {"$inc": {"usage_count": 1}}
        )
        
        return result.modified_count > 0
    
    async def share_config(self, user_id: str, config_id: str, shared_with_users: List[str]) -> bool:
        """Share a configuration with other users"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return False
        
        # Validate all user IDs
        shared_with_object_ids = []
        for shared_user_id in shared_with_users:
            if ObjectId.is_valid(shared_user_id):
                shared_with_object_ids.append(ObjectId(shared_user_id))
        
        result = await collection.update_one(
            {
                "_id": ObjectId(config_id),
                "user_id": ObjectId(user_id)
            },
            {
                "$set": {
                    "is_shared": True,
                    "shared_with": shared_with_object_ids,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    
    async def unshare_config(self, user_id: str, config_id: str) -> bool:
        """Remove sharing from a configuration"""
        collection = await self.get_collection()
        
        if not ObjectId.is_valid(config_id):
            return False
        
        result = await collection.update_one(
            {
                "_id": ObjectId(config_id),
                "user_id": ObjectId(user_id)
            },
            {
                "$set": {
                    "is_shared": False,
                    "shared_with": [],
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    
    async def save_test_result(self, test_result: TestResult) -> TestResult:
        """Save test results for a model configuration"""
        collection = await self.get_test_results_collection()
        
        test_data = test_result.dict(by_alias=True)
        result = await collection.insert_one(test_data)
        test_data["_id"] = result.inserted_id
        
        return TestResult(**test_data)
    
    async def get_config_test_history(self, config_id: str, limit: int = 10) -> List[TestResult]:
        """Get test history for a configuration"""
        collection = await self.get_test_results_collection()
        
        if not ObjectId.is_valid(config_id):
            return []
        
        test_results = []
        async for test_doc in collection.find({
            "model_config_id": ObjectId(config_id)
        }).sort("started_at", -1).limit(limit):
            test_results.append(TestResult(**test_doc))
        
        return test_results


# Global service instance
model_config_service = ModelConfigService()
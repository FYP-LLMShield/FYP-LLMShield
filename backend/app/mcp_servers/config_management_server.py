import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.mcp_servers import BaseMCP, MCPResponse
# Temporarily comment out model imports until langchain is installed
# from app.models.model_config import ModelConfig, TestResult
from app.core.database import get_database
from app.core.security import encrypt_data, decrypt_data

logger = logging.getLogger(__name__)

class ConfigManagementMCPServer(BaseMCP):
    """MCP Server for handling configuration management operations"""
    
    def __init__(self, name: str = "config_management"):
        self.db: Optional[AsyncIOMotorDatabase] = None
        super().__init__(name)
    
    def _setup_tools(self):
        """Setup MCP tools for configuration management"""
        self.tools = {
            "save_config": self._save_config,
            "load_config": self._load_config,
            "list_configs": self._list_configs,
            "delete_config": self._delete_config,
            "save_test_result": self._save_test_result,
            "get_test_results": self._get_test_results,
            "encrypt_credentials": self._encrypt_credentials,
            "decrypt_credentials": self._decrypt_credentials
        }
    
    async def initialize(self):
        """Initialize the MCP server with database connection"""
        try:
            self.db = await get_database()
            logger.info("ConfigManagementMCPServer initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize ConfigManagementMCPServer: {e}")
            raise
    
    async def _save_config(self, config_data: Dict[str, Any]) -> MCPResponse:
        """Save a model configuration"""
        try:
            # Encrypt credentials if present
            if "credentials" in config_data and config_data["credentials"]:
                config_data["credentials"] = await self._encrypt_credentials(
                    config_data["credentials"]
                )
            
            # Save to database (temporarily without ModelConfig validation)
            result = await self.db.model_configs.insert_one(config_data)
            
            return MCPResponse(
                success=True,
                data={"config_id": str(result.inserted_id)}
            )
        except Exception as e:
            logger.error(f"Error saving config: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _load_config(self, config_id: str) -> MCPResponse:
        """Load a model configuration by ID"""
        try:
            from bson import ObjectId
            
            config_doc = await self.db.model_configs.find_one(
                {"_id": ObjectId(config_id)}
            )
            
            if not config_doc:
                return MCPResponse(success=False, error="Configuration not found")
            
            # Decrypt credentials if present
            if config_doc.get("credentials"):
                config_doc["credentials"] = await self._decrypt_credentials(
                    config_doc["credentials"]
                )
            
            return MCPResponse(success=True, data=config_doc)
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _list_configs(self, user_id: str, limit: int = 50) -> MCPResponse:
        """List model configurations for a user"""
        try:
            cursor = self.db.model_configs.find(
                {"user_id": user_id}
            ).limit(limit).sort("created_at", -1)
            
            configs = []
            async for config_doc in cursor:
                # Remove sensitive data for listing
                config_doc.pop("credentials", None)
                configs.append(config_doc)
            
            return MCPResponse(success=True, data={"configs": configs})
        except Exception as e:
            logger.error(f"Error listing configs: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _delete_config(self, config_id: str, user_id: str) -> MCPResponse:
        """Delete a model configuration"""
        try:
            from bson import ObjectId
            
            result = await self.db.model_configs.delete_one({
                "_id": ObjectId(config_id),
                "user_id": user_id
            })
            
            if result.deleted_count == 0:
                return MCPResponse(success=False, error="Configuration not found or unauthorized")
            
            return MCPResponse(success=True, data={"deleted": True})
        except Exception as e:
            logger.error(f"Error deleting config: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _save_test_result(self, test_data: Dict[str, Any]) -> MCPResponse:
        """Save a test result"""
        try:
            # Save without TestResult validation for now
            result = await self.db.test_results.insert_one(test_data)
            
            return MCPResponse(
                success=True,
                data={"test_result_id": str(result.inserted_id)}
            )
        except Exception as e:
            logger.error(f"Error saving test result: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _get_test_results(self, config_id: str, limit: int = 10) -> MCPResponse:
        """Get test results for a configuration"""
        try:
            cursor = self.db.test_results.find(
                {"config_id": config_id}
            ).limit(limit).sort("timestamp", -1)
            
            results = []
            async for result_doc in cursor:
                results.append(result_doc)
            
            return MCPResponse(success=True, data={"test_results": results})
        except Exception as e:
            logger.error(f"Error getting test results: {e}")
            return MCPResponse(success=False, error=str(e))
    
    async def _encrypt_credentials(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive credential data"""
        try:
            encrypted_creds = {}
            for key, value in credentials.items():
                if isinstance(value, str) and value:
                    encrypted_creds[key] = encrypt_data(value)
                else:
                    encrypted_creds[key] = value
            return encrypted_creds
        except Exception as e:
            logger.error(f"Error encrypting credentials: {e}")
            return credentials
    
    async def _decrypt_credentials(self, encrypted_credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt credential data"""
        try:
            decrypted_creds = {}
            for key, value in encrypted_credentials.items():
                if isinstance(value, str) and value:
                    try:
                        decrypted_creds[key] = decrypt_data(value)
                    except:
                        # If decryption fails, assume it's not encrypted
                        decrypted_creds[key] = value
                else:
                    decrypted_creds[key] = value
            return decrypted_creds
        except Exception as e:
            logger.error(f"Error decrypting credentials: {e}")
            return encrypted_credentials
    
    async def call_tool(self, tool_name: str, **kwargs) -> MCPResponse:
        """Call a specific tool"""
        if tool_name not in self.tools:
            return MCPResponse(success=False, error=f"Tool '{tool_name}' not found")
        
        try:
            return await self.tools[tool_name](**kwargs)
        except Exception as e:
            logger.error(f"Error calling tool {tool_name}: {e}")
            return MCPResponse(success=False, error=str(e))

# Global instance
config_management_server = ConfigManagementMCPServer()
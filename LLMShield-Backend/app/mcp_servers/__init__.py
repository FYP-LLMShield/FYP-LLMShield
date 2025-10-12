from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)

class MCPResponse:
    """Standard response format for MCP operations"""
    
    def __init__(self, success: bool, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
        self.success = success
        self.data = data or {}
        self.error = error
    
    def dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error
        }

class BaseMCP(ABC):
    """Base class for MCP servers"""
    
    def __init__(self, name: str):
        self.name = name
        self.mcp = None
        self._setup_tools()
    
    @abstractmethod
    def _setup_tools(self):
        """Setup MCP tools - to be implemented by subclasses"""
        pass
    
    @abstractmethod
    async def initialize(self):
        """Initialize the MCP server - to be implemented by subclasses"""
        pass

class ConfigManagementMCP(BaseMCP):
    """MCP server for configuration management"""
    
    def __init__(self, name: str = "config_management"):
        super().__init__(name)

class MCPRegistry:
    """Registry for managing MCP servers"""
    
    def __init__(self):
        self.servers: Dict[str, BaseMCP] = {}
        self.mcp_instances: Dict[str, Any] = {}
    
    def register(self, server: BaseMCP):
        """Register an MCP server"""
        self.servers[server.name] = server
        logger.info(f"Registered MCP server: {server.name}")
    
    async def initialize_all(self):
        """Initialize all registered MCP servers"""
        for name, server in self.servers.items():
            try:
                await server.initialize()
                logger.info(f"Initialized MCP server: {name}")
            except Exception as e:
                logger.error(f"Failed to initialize MCP server {name}: {e}")
    
    async def start_all(self):
        """Start all MCP servers"""
        # Mock implementation - in real scenario, this would start actual MCP servers
        for name, server in self.servers.items():
            self.mcp_instances[name] = MockMCPInstance(name)
            logger.info(f"Started MCP server: {name}")
    
    async def stop_all(self):
        """Stop all MCP servers"""
        for name in list(self.mcp_instances.keys()):
            del self.mcp_instances[name]
            logger.info(f"Stopped MCP server: {name}")
    
    def get_all_mcp_instances(self) -> Dict[str, Any]:
        """Get all MCP instances"""
        return self.mcp_instances

class MockMCPInstance:
    """Mock MCP instance for demonstration"""
    
    def __init__(self, name: str):
        self.name = name
    
    def get_app(self):
        """Return a mock FastAPI app"""
        from fastapi import FastAPI
        app = FastAPI(title=f"MCP Server: {self.name}")
        
        @app.get("/")
        async def root():
            return {"message": f"MCP Server {self.name} is running"}
        
        return app

# Global registry instance
mcp_registry = MCPRegistry()

async def initialize_mcp_servers():
    """Initialize all MCP servers"""
    from app.mcp_servers.config_management_server import ConfigManagementMCPServer
    
    # Register servers
    config_server = ConfigManagementMCPServer()
    mcp_registry.register(config_server)
    
    # Initialize all servers
    await mcp_registry.initialize_all()
"""
Vector Database Connectors
--------------------------
Unified interface for connecting to various vector databases.
Supports both local (JSON) and cloud (Pinecone, Qdrant, etc.) vector stores.

This enables LLMShield to detect weak vector embedding threats across
different vector database providers.
"""

from __future__ import annotations

import os
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import logging

import numpy as np

logger = logging.getLogger(__name__)


class VectorDBType(str, Enum):
    """Supported vector database types."""
    JSON_UPLOAD = "json_upload"
    PINECONE = "pinecone"
    QDRANT = "qdrant"  # Future
    WEAVIATE = "weaviate"  # Future
    CHROMA = "chroma"  # Future


@dataclass
class VectorRecord:
    """Standardized vector record from any source."""
    vector_id: str
    embedding: np.ndarray
    metadata: Dict[str, Any]
    source_db: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "vector_id": self.vector_id,
            "embedding": self.embedding.tolist() if isinstance(self.embedding, np.ndarray) else self.embedding,
            "metadata": self.metadata,
            "source_db": self.source_db
        }


@dataclass
class ConnectionResult:
    """Result of a database connection attempt."""
    success: bool
    message: str
    total_vectors: int = 0
    index_info: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.index_info is None:
            self.index_info = {}


@dataclass
class FetchResult:
    """Result of fetching vectors from a database."""
    success: bool
    vectors: List[VectorRecord]
    total_available: int
    fetched_count: int
    message: str
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class VectorDBConnector(ABC):
    """Abstract base class for vector database connectors."""
    
    @abstractmethod
    async def test_connection(self) -> ConnectionResult:
        """Test connection to the vector database."""
        pass
    
    @abstractmethod
    async def fetch_vectors(
        self, 
        limit: int = 1000,
        namespace: Optional[str] = None,
        include_metadata: bool = True
    ) -> FetchResult:
        """Fetch vectors from the database."""
        pass
    
    @abstractmethod
    def get_db_type(self) -> VectorDBType:
        """Return the database type."""
        pass


class JSONUploadConnector(VectorDBConnector):
    """Connector for JSON file uploads (local analysis)."""
    
    def __init__(self, json_data: Dict[str, Any]):
        self.data = json_data
        self.vectors = json_data.get("vectors", [])
    
    async def test_connection(self) -> ConnectionResult:
        try:
            if not self.vectors:
                return ConnectionResult(
                    success=False,
                    message="No vectors found in JSON data"
                )
            
            # Validate structure
            sample = self.vectors[0]
            if "embedding" not in sample:
                return ConnectionResult(
                    success=False,
                    message="Invalid format: vectors must have 'embedding' field"
                )
            
            dim = len(sample["embedding"])
            
            return ConnectionResult(
                success=True,
                message=f"JSON data loaded successfully",
                total_vectors=len(self.vectors),
                index_info={
                    "dimension": dim,
                    "source": "json_upload",
                    "has_metadata": "metadata" in sample
                }
            )
        except Exception as e:
            return ConnectionResult(
                success=False,
                message=f"Error parsing JSON: {str(e)}"
            )
    
    async def fetch_vectors(
        self, 
        limit: int = 1000,
        namespace: Optional[str] = None,
        include_metadata: bool = True
    ) -> FetchResult:
        try:
            vectors = []
            for vec_data in self.vectors[:limit]:
                if "embedding" not in vec_data:
                    continue
                
                embedding = np.array(vec_data["embedding"], dtype=np.float32)
                if embedding.ndim != 1 or len(embedding) == 0:
                    continue
                
                vector_id = str(vec_data.get("vector_id", f"vec_{len(vectors)}"))
                metadata = vec_data.get("metadata", {}) if include_metadata else {}
                
                vectors.append(VectorRecord(
                    vector_id=vector_id,
                    embedding=embedding,
                    metadata=metadata,
                    source_db="json_upload"
                ))
            
            return FetchResult(
                success=True,
                vectors=vectors,
                total_available=len(self.vectors),
                fetched_count=len(vectors),
                message=f"Fetched {len(vectors)} vectors from JSON"
            )
        except Exception as e:
            return FetchResult(
                success=False,
                vectors=[],
                total_available=0,
                fetched_count=0,
                message=f"Error fetching vectors: {str(e)}"
            )
    
    def get_db_type(self) -> VectorDBType:
        return VectorDBType.JSON_UPLOAD


class PineconeConnector(VectorDBConnector):
    """
    Connector for Pinecone vector database.
    
    Supports both legacy (environment-based) and new (host-based) Pinecone APIs.
    """
    
    def __init__(
        self,
        api_key: str,
        index_name: str,
        environment: Optional[str] = None,
        host: Optional[str] = None,
        namespace: Optional[str] = None
    ):
        self.api_key = api_key
        self.index_name = index_name
        self.environment = environment
        self.host = host
        self.namespace = namespace or ""
        self.index = None
        self._pc = None
        self._initialized = False
    
    def _initialize(self):
        """Initialize Pinecone client."""
        if self._initialized:
            return
        
        try:
            from pinecone import Pinecone
            
            # New Pinecone client (v3+)
            self._pc = Pinecone(api_key=self.api_key)
            
            # Get the index
            if self.host:
                # Use host directly if provided
                self.index = self._pc.Index(host=self.host)
            else:
                # Use index name (Pinecone will resolve the host)
                self.index = self._pc.Index(self.index_name)
            
            self._initialized = True
            logger.info(f"Pinecone initialized for index: {self.index_name}")
            
        except ImportError:
            raise RuntimeError("Pinecone client not installed. Run: pip install pinecone-client")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Pinecone: {str(e)}")
    
    async def test_connection(self) -> ConnectionResult:
        """Test connection to Pinecone index."""
        try:
            self._initialize()
            
            # Get index stats
            stats = self.index.describe_index_stats()
            
            total_vectors = stats.get("total_vector_count", 0)
            namespaces = stats.get("namespaces", {})
            dimension = stats.get("dimension", 0)
            
            return ConnectionResult(
                success=True,
                message=f"Connected to Pinecone index '{self.index_name}'",
                total_vectors=total_vectors,
                index_info={
                    "dimension": dimension,
                    "namespaces": list(namespaces.keys()) if namespaces else [],
                    "namespace_stats": {k: v.get("vector_count", 0) for k, v in namespaces.items()} if namespaces else {},
                    "index_name": self.index_name,
                    "source": "pinecone"
                }
            )
        except Exception as e:
            logger.error(f"Pinecone connection test failed: {str(e)}")
            return ConnectionResult(
                success=False,
                message=f"Connection failed: {str(e)}"
            )
    
    async def fetch_vectors(
        self, 
        limit: int = 1000,
        namespace: Optional[str] = None,
        include_metadata: bool = True
    ) -> FetchResult:
        """
        Fetch vectors from Pinecone.
        
        Note: Pinecone doesn't support direct "list all vectors" operation.
        We use describe_index_stats + query with dummy vectors to sample vectors.
        For a full scan, you would need to iterate through all IDs.
        """
        try:
            self._initialize()
            
            ns = namespace or self.namespace or ""
            
            # Get index stats first
            stats = self.index.describe_index_stats()
            total_vectors = stats.get("total_vector_count", 0)
            dimension = stats.get("dimension", 384)
            
            if total_vectors == 0:
                return FetchResult(
                    success=True,
                    vectors=[],
                    total_available=0,
                    fetched_count=0,
                    message="Index is empty - no vectors to fetch",
                    metadata={"dimension": dimension}
                )
            
            vectors = []
            
            # Method 1: Try to list vectors (newer Pinecone API)
            try:
                # Use list operation if available (Pinecone v3+)
                list_response = self.index.list(
                    namespace=ns,
                    limit=min(limit, 100)  # Pinecone limits list to 100
                )
                
                if list_response and hasattr(list_response, 'vectors'):
                    vector_ids = [v.id for v in list_response.vectors]
                    
                    if vector_ids:
                        # Fetch full vectors by IDs
                        fetch_response = self.index.fetch(
                            ids=vector_ids[:limit],
                            namespace=ns
                        )
                        
                        if fetch_response and fetch_response.vectors:
                            for vid, vec_data in fetch_response.vectors.items():
                                embedding = np.array(vec_data.values, dtype=np.float32)
                                metadata = vec_data.metadata or {} if include_metadata else {}
                                
                                vectors.append(VectorRecord(
                                    vector_id=str(vid),
                                    embedding=embedding,
                                    metadata=metadata,
                                    source_db="pinecone"
                                ))
            except Exception as list_error:
                logger.warning(f"List method failed, trying query method: {list_error}")
            
            # Method 2: Query with random vectors to sample the index
            if len(vectors) < limit:
                try:
                    # Generate random query vectors to sample the index
                    num_queries = min(10, (limit - len(vectors)) // 10 + 1)
                    
                    for i in range(num_queries):
                        # Create a random query vector
                        np.random.seed(42 + i)
                        query_vec = np.random.randn(dimension).astype(np.float32).tolist()
                        
                        query_response = self.index.query(
                            vector=query_vec,
                            top_k=min(100, limit - len(vectors)),
                            namespace=ns,
                            include_values=True,
                            include_metadata=include_metadata
                        )
                        
                        if query_response and query_response.matches:
                            existing_ids = {v.vector_id for v in vectors}
                            
                            for match in query_response.matches:
                                if match.id not in existing_ids and len(vectors) < limit:
                                    embedding = np.array(match.values, dtype=np.float32) if match.values else np.zeros(dimension)
                                    metadata = match.metadata or {} if include_metadata else {}
                                    
                                    vectors.append(VectorRecord(
                                        vector_id=str(match.id),
                                        embedding=embedding,
                                        metadata=metadata,
                                        source_db="pinecone"
                                    ))
                                    existing_ids.add(match.id)
                        
                        if len(vectors) >= limit:
                            break
                            
                except Exception as query_error:
                    logger.warning(f"Query sampling failed: {query_error}")
            
            return FetchResult(
                success=True,
                vectors=vectors,
                total_available=total_vectors,
                fetched_count=len(vectors),
                message=f"Fetched {len(vectors)} vectors from Pinecone (total available: {total_vectors})",
                metadata={
                    "dimension": dimension,
                    "namespace": ns,
                    "index_name": self.index_name
                }
            )
            
        except Exception as e:
            logger.error(f"Error fetching vectors from Pinecone: {str(e)}")
            return FetchResult(
                success=False,
                vectors=[],
                total_available=0,
                fetched_count=0,
                message=f"Error fetching vectors: {str(e)}"
            )
    
    def get_db_type(self) -> VectorDBType:
        return VectorDBType.PINECONE


class VectorDBConnectorFactory:
    """Factory for creating vector database connectors."""
    
    @staticmethod
    def create_connector(
        db_type: VectorDBType,
        **kwargs
    ) -> VectorDBConnector:
        """Create a connector based on database type."""
        
        if db_type == VectorDBType.JSON_UPLOAD:
            json_data = kwargs.get("json_data")
            if not json_data:
                raise ValueError("json_data is required for JSON_UPLOAD")
            return JSONUploadConnector(json_data)
        
        elif db_type == VectorDBType.PINECONE:
            api_key = kwargs.get("api_key")
            index_name = kwargs.get("index_name")
            
            if not api_key or not index_name:
                raise ValueError("api_key and index_name are required for Pinecone")
            
            return PineconeConnector(
                api_key=api_key,
                index_name=index_name,
                environment=kwargs.get("environment"),
                host=kwargs.get("host"),
                namespace=kwargs.get("namespace")
            )
        
        # Future connectors
        elif db_type == VectorDBType.QDRANT:
            raise NotImplementedError("Qdrant connector coming soon!")
        
        elif db_type == VectorDBType.WEAVIATE:
            raise NotImplementedError("Weaviate connector coming soon!")
        
        elif db_type == VectorDBType.CHROMA:
            raise NotImplementedError("Chroma connector coming soon!")
        
        else:
            raise ValueError(f"Unknown database type: {db_type}")
    
    @staticmethod
    def get_supported_types() -> List[Dict[str, Any]]:
        """Get list of supported database types with their requirements."""
        return [
            {
                "type": VectorDBType.JSON_UPLOAD,
                "name": "Upload JSON Snapshot",
                "description": "Upload a JSON file containing vector embeddings",
                "requires_auth": False,
                "fields": ["file"],
                "status": "available"
            },
            {
                "type": VectorDBType.PINECONE,
                "name": "Pinecone",
                "description": "Connect to Pinecone cloud vector database",
                "requires_auth": True,
                "fields": ["api_key", "index_name", "environment", "namespace"],
                "status": "available"
            },
            {
                "type": VectorDBType.QDRANT,
                "name": "Qdrant",
                "description": "Connect to Qdrant vector database",
                "requires_auth": True,
                "fields": ["url", "api_key", "collection_name"],
                "status": "coming_soon"
            },
            {
                "type": VectorDBType.WEAVIATE,
                "name": "Weaviate",
                "description": "Connect to Weaviate vector database",
                "requires_auth": True,
                "fields": ["url", "api_key", "class_name"],
                "status": "coming_soon"
            },
            {
                "type": VectorDBType.CHROMA,
                "name": "Chroma",
                "description": "Connect to Chroma vector database",
                "requires_auth": False,
                "fields": ["host", "port", "collection_name"],
                "status": "coming_soon"
            }
        ]


# Helper function to load from environment
def create_pinecone_connector_from_env() -> PineconeConnector:
    """Create Pinecone connector using environment variables."""
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME")
    environment = os.getenv("PINECONE_ENVIRONMENT")
    host = os.getenv("PINECONE_HOST")
    
    if not api_key:
        raise ValueError("PINECONE_API_KEY not set in environment")
    if not index_name:
        raise ValueError("PINECONE_INDEX_NAME not set in environment")
    
    return PineconeConnector(
        api_key=api_key,
        index_name=index_name,
        environment=environment,
        host=host
    )

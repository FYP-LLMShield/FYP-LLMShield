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
    CHROMA_LOCAL = "chroma_local"      # Local ChromaDB (localhost or persistent)
    CHROMA_CLOUD = "chroma_cloud"      # ChromaDB Cloud
    QDRANT_LOCAL = "qdrant_local"      # Local/Self-hosted Qdrant
    QDRANT_CLOUD = "qdrant_cloud"      # Qdrant Cloud
    WEAVIATE_LOCAL = "weaviate_local"  # Local/Self-hosted Weaviate
    WEAVIATE_CLOUD = "weaviate_cloud"  # Weaviate Cloud


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


class ChromaDBConnector(VectorDBConnector):
    """
    Connector for ChromaDB vector database.
    
    Supports:
    - Local HTTP client (connecting to a running ChromaDB server)
    - Persistent client (local file-based storage)
    - Cloud client (ChromaDB Cloud - requires API key)
    
    ChromaDB is popular among:
    - University students building RAG chatbots
    - Developers using Ollama/local LLMs
    - Researchers needing simple local vector storage
    """
    
    def __init__(
        self,
        # Local/HTTP mode
        host: Optional[str] = None,
        port: Optional[int] = None,
        # Persistent mode
        persist_directory: Optional[str] = None,
        # Cloud mode
        api_key: Optional[str] = None,
        tenant: Optional[str] = None,
        database: Optional[str] = None,
        # Common
        collection_name: str = "default",
        is_cloud: bool = False
    ):
        self.host = host or "localhost"
        self.port = port or 8000
        self.persist_directory = persist_directory
        self.api_key = api_key
        self.tenant = tenant or "default_tenant"
        self.database = database or "default_database"
        self.collection_name = collection_name
        self.is_cloud = is_cloud
        self._client = None
        self._collection = None
        self._initialized = False
    
    def _initialize(self):
        """Initialize ChromaDB client."""
        if self._initialized:
            return
        
        try:
            import chromadb
            from chromadb.config import Settings
            
            if self.is_cloud and self.api_key:
                # Cloud mode - ChromaDB Cloud
                try:
                    self._client = chromadb.HttpClient(
                        host="api.trychroma.com",
                        port=443,
                        ssl=True,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        tenant=self.tenant,
                        database=self.database
                    )
                    logger.info(f"ChromaDB Cloud client initialized for tenant: {self.tenant}")
                except Exception as cloud_err:
                    # Fallback: Try newer cloud client API
                    try:
                        self._client = chromadb.CloudClient(
                            api_key=self.api_key,
                            tenant=self.tenant,
                            database=self.database
                        )
                        logger.info(f"ChromaDB Cloud client (v2) initialized")
                    except Exception as cloud_v2_err:
                        raise RuntimeError(f"Failed to connect to ChromaDB Cloud: {cloud_err}, {cloud_v2_err}")
            
            elif self.persist_directory:
                # Persistent mode - local file storage
                self._client = chromadb.PersistentClient(
                    path=self.persist_directory
                )
                logger.info(f"ChromaDB persistent client initialized at: {self.persist_directory}")
            
            else:
                # HTTP mode - connect to running server
                self._client = chromadb.HttpClient(
                    host=self.host,
                    port=self.port
                )
                logger.info(f"ChromaDB HTTP client initialized for {self.host}:{self.port}")
            
            self._initialized = True
            
        except ImportError:
            raise RuntimeError("ChromaDB not installed. Run: pip install chromadb")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize ChromaDB: {str(e)}")
    
    def _get_collection(self):
        """Get or create the collection."""
        if self._collection is not None:
            return self._collection
        
        self._initialize()
        
        try:
            # Try to get existing collection
            self._collection = self._client.get_collection(name=self.collection_name)
            logger.info(f"Found existing collection: {self.collection_name}")
        except Exception:
            # Collection doesn't exist
            raise ValueError(f"Collection '{self.collection_name}' not found. Please check the collection name.")
        
        return self._collection
    
    async def test_connection(self) -> ConnectionResult:
        """Test connection to ChromaDB."""
        try:
            self._initialize()
            
            # Get list of collections
            collections = self._client.list_collections()
            collection_names = [c.name for c in collections] if collections else []
            
            # Try to get the specific collection
            if self.collection_name:
                try:
                    collection = self._client.get_collection(name=self.collection_name)
                    total_vectors = collection.count()
                    
                    # Get collection metadata
                    peek_result = collection.peek(limit=1)
                    dimension = 0
                    if peek_result and peek_result.get("embeddings") and len(peek_result["embeddings"]) > 0:
                        dimension = len(peek_result["embeddings"][0])
                    
                    return ConnectionResult(
                        success=True,
                        message=f"Connected to ChromaDB collection '{self.collection_name}'",
                        total_vectors=total_vectors,
                        index_info={
                            "dimension": dimension,
                            "collection_name": self.collection_name,
                            "all_collections": collection_names,
                            "source": "chroma_cloud" if self.is_cloud else "chroma_local",
                            "mode": "cloud" if self.is_cloud else ("persistent" if self.persist_directory else "http")
                        }
                    )
                except Exception as coll_err:
                    return ConnectionResult(
                        success=False,
                        message=f"Collection '{self.collection_name}' not found. Available: {collection_names}",
                        index_info={"available_collections": collection_names}
                    )
            
            return ConnectionResult(
                success=True,
                message=f"Connected to ChromaDB. Found {len(collection_names)} collections.",
                total_vectors=0,
                index_info={
                    "collections": collection_names,
                    "source": "chroma_cloud" if self.is_cloud else "chroma_local"
                }
            )
            
        except Exception as e:
            logger.error(f"ChromaDB connection test failed: {str(e)}")
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
        Fetch vectors from ChromaDB collection.
        
        ChromaDB makes this easy with the get() method.
        """
        try:
            collection = self._get_collection()
            total_vectors = collection.count()
            
            if total_vectors == 0:
                return FetchResult(
                    success=True,
                    vectors=[],
                    total_available=0,
                    fetched_count=0,
                    message="Collection is empty - no vectors to fetch"
                )
            
            # Fetch vectors with embeddings and metadata
            include_fields = ["embeddings", "documents"]
            if include_metadata:
                include_fields.append("metadatas")
            
            # ChromaDB get() returns all vectors, we limit it
            result = collection.get(
                limit=min(limit, total_vectors),
                include=include_fields
            )
            
            vectors = []
            ids = result.get("ids", [])
            embeddings = result.get("embeddings", [])
            metadatas = result.get("metadatas", []) if include_metadata else []
            documents = result.get("documents", [])
            
            for i, vec_id in enumerate(ids):
                if i >= len(embeddings) or embeddings[i] is None:
                    continue
                
                embedding = np.array(embeddings[i], dtype=np.float32)
                
                # Build metadata
                meta = {}
                if include_metadata and i < len(metadatas) and metadatas[i]:
                    meta = metadatas[i]
                if i < len(documents) and documents[i]:
                    meta["document"] = documents[i][:200]  # Truncate long docs
                
                vectors.append(VectorRecord(
                    vector_id=str(vec_id),
                    embedding=embedding,
                    metadata=meta,
                    source_db="chroma_cloud" if self.is_cloud else "chroma_local"
                ))
            
            # Get dimension from first vector
            dimension = len(vectors[0].embedding) if vectors else 0
            
            return FetchResult(
                success=True,
                vectors=vectors,
                total_available=total_vectors,
                fetched_count=len(vectors),
                message=f"Fetched {len(vectors)} vectors from ChromaDB (total available: {total_vectors})",
                metadata={
                    "dimension": dimension,
                    "collection_name": self.collection_name,
                    "mode": "cloud" if self.is_cloud else "local"
                }
            )
            
        except Exception as e:
            logger.error(f"Error fetching vectors from ChromaDB: {str(e)}")
            return FetchResult(
                success=False,
                vectors=[],
                total_available=0,
                fetched_count=0,
                message=f"Error fetching vectors: {str(e)}"
            )
    
    def get_db_type(self) -> VectorDBType:
        return VectorDBType.CHROMA_CLOUD if self.is_cloud else VectorDBType.CHROMA_LOCAL


class QdrantConnector(VectorDBConnector):
    """
    Connector for Qdrant vector database.
    
    Supports:
    - Local/Self-hosted Qdrant (HTTP)
    - Qdrant Cloud (with API key)
    
    Qdrant is popular for:
    - Production AI applications needing advanced filtering
    - Companies requiring on-premise deployment
    - Developers wanting powerful search capabilities
    """
    
    def __init__(
        self,
        # Connection
        host: Optional[str] = None,
        port: Optional[int] = None,
        url: Optional[str] = None,
        # Authentication
        api_key: Optional[str] = None,
        # Collection
        collection_name: str = "default",
        # Mode
        is_cloud: bool = False
    ):
        self.host = host or "localhost"
        self.port = port or 6333
        self.url = url  # Full URL for cloud (e.g., https://xxx.qdrant.io)
        self.api_key = api_key
        self.collection_name = collection_name
        self.is_cloud = is_cloud
        self._client = None
        self._initialized = False
    
    def _initialize(self):
        """Initialize Qdrant client."""
        if self._initialized:
            return
        
        try:
            from qdrant_client import QdrantClient
            
            if self.is_cloud and self.url:
                # Cloud mode with URL
                self._client = QdrantClient(
                    url=self.url,
                    api_key=self.api_key
                )
                logger.info(f"Qdrant Cloud client initialized for: {self.url}")
            elif self.api_key:
                # Self-hosted with API key
                self._client = QdrantClient(
                    host=self.host,
                    port=self.port,
                    api_key=self.api_key
                )
                logger.info(f"Qdrant client initialized for {self.host}:{self.port} with auth")
            else:
                # Local without auth
                self._client = QdrantClient(
                    host=self.host,
                    port=self.port
                )
                logger.info(f"Qdrant client initialized for {self.host}:{self.port}")
            
            self._initialized = True
            
        except ImportError:
            raise RuntimeError("Qdrant client not installed. Run: pip install qdrant-client")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Qdrant: {str(e)}")
    
    async def test_connection(self) -> ConnectionResult:
        """Test connection to Qdrant."""
        try:
            self._initialize()
            
            # Get collections
            collections = self._client.get_collections()
            collection_names = [c.name for c in collections.collections] if collections.collections else []
            
            # Try to get the specific collection
            if self.collection_name:
                try:
                    collection_info = self._client.get_collection(collection_name=self.collection_name)
                    total_vectors = collection_info.points_count or 0
                    dimension = collection_info.config.params.vectors.size if hasattr(collection_info.config.params.vectors, 'size') else 0
                    
                    return ConnectionResult(
                        success=True,
                        message=f"Connected to Qdrant collection '{self.collection_name}'",
                        total_vectors=total_vectors,
                        index_info={
                            "dimension": dimension,
                            "collection_name": self.collection_name,
                            "all_collections": collection_names,
                            "source": "qdrant_cloud" if self.is_cloud else "qdrant_local"
                        }
                    )
                except Exception as coll_err:
                    return ConnectionResult(
                        success=False,
                        message=f"Collection '{self.collection_name}' not found. Available: {collection_names}",
                        index_info={"available_collections": collection_names}
                    )
            
            return ConnectionResult(
                success=True,
                message=f"Connected to Qdrant. Found {len(collection_names)} collections.",
                total_vectors=0,
                index_info={
                    "collections": collection_names,
                    "source": "qdrant_cloud" if self.is_cloud else "qdrant_local"
                }
            )
            
        except Exception as e:
            logger.error(f"Qdrant connection test failed: {str(e)}")
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
        """Fetch vectors from Qdrant collection."""
        try:
            self._initialize()
            
            # Get collection info
            collection_info = self._client.get_collection(collection_name=self.collection_name)
            total_vectors = collection_info.points_count or 0
            
            if total_vectors == 0:
                return FetchResult(
                    success=True,
                    vectors=[],
                    total_available=0,
                    fetched_count=0,
                    message="Collection is empty - no vectors to fetch"
                )
            
            # Scroll through vectors
            records, _ = self._client.scroll(
                collection_name=self.collection_name,
                limit=min(limit, total_vectors),
                with_payload=include_metadata,
                with_vectors=True
            )
            
            vectors = []
            for record in records:
                vector_data = record.vector
                if isinstance(vector_data, dict):
                    # Named vectors - take the first one
                    vector_data = list(vector_data.values())[0] if vector_data else []
                
                if vector_data is None or len(vector_data) == 0:
                    continue
                
                embedding = np.array(vector_data, dtype=np.float32)
                metadata = dict(record.payload) if record.payload and include_metadata else {}
                
                vectors.append(VectorRecord(
                    vector_id=str(record.id),
                    embedding=embedding,
                    metadata=metadata,
                    source_db="qdrant_cloud" if self.is_cloud else "qdrant_local"
                ))
            
            dimension = len(vectors[0].embedding) if vectors else 0
            
            return FetchResult(
                success=True,
                vectors=vectors,
                total_available=total_vectors,
                fetched_count=len(vectors),
                message=f"Fetched {len(vectors)} vectors from Qdrant (total available: {total_vectors})",
                metadata={
                    "dimension": dimension,
                    "collection_name": self.collection_name
                }
            )
            
        except Exception as e:
            logger.error(f"Error fetching vectors from Qdrant: {str(e)}")
            return FetchResult(
                success=False,
                vectors=[],
                total_available=0,
                fetched_count=0,
                message=f"Error fetching vectors: {str(e)}"
            )
    
    def get_db_type(self) -> VectorDBType:
        return VectorDBType.QDRANT_CLOUD if self.is_cloud else VectorDBType.QDRANT_LOCAL


class WeaviateConnector(VectorDBConnector):
    """
    Connector for Weaviate vector database.
    
    Supports:
    - Local/Self-hosted Weaviate (HTTP)
    - Weaviate Cloud (WCS - Weaviate Cloud Services)
    
    Weaviate is popular for:
    - Semantic search applications
    - Knowledge graphs with vector search
    - Multi-modal applications (text + images)
    """
    
    def __init__(
        self,
        # Connection
        host: Optional[str] = None,
        port: Optional[int] = None,
        url: Optional[str] = None,
        # Authentication
        api_key: Optional[str] = None,
        # Class/Collection
        class_name: str = "Default",
        # Mode
        is_cloud: bool = False
    ):
        self.host = host or "localhost"
        self.port = port or 8080
        self.url = url  # Full URL for cloud (e.g., https://xxx.weaviate.network)
        self.api_key = api_key
        self.class_name = class_name
        self.is_cloud = is_cloud
        self._client = None
        self._initialized = False
    
    def _initialize(self):
        """Initialize Weaviate client."""
        if self._initialized:
            return
        
        try:
            import weaviate
            from weaviate.auth import AuthApiKey
            
            auth_config = AuthApiKey(api_key=self.api_key) if self.api_key else None
            
            if self.is_cloud and self.url:
                # Cloud mode
                self._client = weaviate.Client(
                    url=self.url,
                    auth_client_secret=auth_config
                )
                logger.info(f"Weaviate Cloud client initialized for: {self.url}")
            else:
                # Local mode
                url = f"http://{self.host}:{self.port}"
                self._client = weaviate.Client(
                    url=url,
                    auth_client_secret=auth_config
                )
                logger.info(f"Weaviate client initialized for {url}")
            
            # Test connection
            if not self._client.is_ready():
                raise RuntimeError("Weaviate server is not ready")
            
            self._initialized = True
            
        except ImportError:
            raise RuntimeError("Weaviate client not installed. Run: pip install weaviate-client")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Weaviate: {str(e)}")
    
    async def test_connection(self) -> ConnectionResult:
        """Test connection to Weaviate."""
        try:
            self._initialize()
            
            # Get schema (all classes)
            schema = self._client.schema.get()
            class_names = [c["class"] for c in schema.get("classes", [])]
            
            # Try to get the specific class
            if self.class_name:
                try:
                    class_schema = self._client.schema.get(self.class_name)
                    
                    # Get object count
                    result = self._client.query.aggregate(self.class_name).with_meta_count().do()
                    total_vectors = 0
                    if result and "data" in result and "Aggregate" in result["data"]:
                        agg_data = result["data"]["Aggregate"].get(self.class_name, [])
                        if agg_data and len(agg_data) > 0:
                            total_vectors = agg_data[0].get("meta", {}).get("count", 0)
                    
                    # Get vector dimension from schema
                    dimension = 0
                    vectorizer = class_schema.get("vectorizer", "none")
                    
                    return ConnectionResult(
                        success=True,
                        message=f"Connected to Weaviate class '{self.class_name}'",
                        total_vectors=total_vectors,
                        index_info={
                            "dimension": dimension,
                            "class_name": self.class_name,
                            "all_classes": class_names,
                            "vectorizer": vectorizer,
                            "source": "weaviate_cloud" if self.is_cloud else "weaviate_local"
                        }
                    )
                except Exception as class_err:
                    return ConnectionResult(
                        success=False,
                        message=f"Class '{self.class_name}' not found. Available: {class_names}",
                        index_info={"available_classes": class_names}
                    )
            
            return ConnectionResult(
                success=True,
                message=f"Connected to Weaviate. Found {len(class_names)} classes.",
                total_vectors=0,
                index_info={
                    "classes": class_names,
                    "source": "weaviate_cloud" if self.is_cloud else "weaviate_local"
                }
            )
            
        except Exception as e:
            logger.error(f"Weaviate connection test failed: {str(e)}")
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
        """Fetch vectors from Weaviate class."""
        try:
            self._initialize()
            
            # Get total count
            result = self._client.query.aggregate(self.class_name).with_meta_count().do()
            total_vectors = 0
            if result and "data" in result and "Aggregate" in result["data"]:
                agg_data = result["data"]["Aggregate"].get(self.class_name, [])
                if agg_data and len(agg_data) > 0:
                    total_vectors = agg_data[0].get("meta", {}).get("count", 0)
            
            if total_vectors == 0:
                return FetchResult(
                    success=True,
                    vectors=[],
                    total_available=0,
                    fetched_count=0,
                    message="Class is empty - no vectors to fetch"
                )
            
            # Get schema to find properties
            class_schema = self._client.schema.get(self.class_name)
            properties = [p["name"] for p in class_schema.get("properties", [])]
            
            # Query objects with vectors
            query = self._client.query.get(self.class_name, properties)
            query = query.with_additional(["id", "vector"])
            query = query.with_limit(min(limit, total_vectors))
            
            result = query.do()
            
            vectors = []
            if result and "data" in result and "Get" in result["data"]:
                objects = result["data"]["Get"].get(self.class_name, [])
                
                for obj in objects:
                    additional = obj.get("_additional", {})
                    vector_data = additional.get("vector", [])
                    
                    if not vector_data:
                        continue
                    
                    embedding = np.array(vector_data, dtype=np.float32)
                    
                    # Build metadata from properties
                    metadata = {}
                    if include_metadata:
                        for prop in properties:
                            if prop in obj and obj[prop] is not None:
                                # Truncate long text fields
                                value = obj[prop]
                                if isinstance(value, str) and len(value) > 200:
                                    value = value[:200] + "..."
                                metadata[prop] = value
                    
                    vectors.append(VectorRecord(
                        vector_id=str(additional.get("id", f"obj_{len(vectors)}")),
                        embedding=embedding,
                        metadata=metadata,
                        source_db="weaviate_cloud" if self.is_cloud else "weaviate_local"
                    ))
            
            dimension = len(vectors[0].embedding) if vectors else 0
            
            return FetchResult(
                success=True,
                vectors=vectors,
                total_available=total_vectors,
                fetched_count=len(vectors),
                message=f"Fetched {len(vectors)} vectors from Weaviate (total available: {total_vectors})",
                metadata={
                    "dimension": dimension,
                    "class_name": self.class_name
                }
            )
            
        except Exception as e:
            logger.error(f"Error fetching vectors from Weaviate: {str(e)}")
            return FetchResult(
                success=False,
                vectors=[],
                total_available=0,
                fetched_count=0,
                message=f"Error fetching vectors: {str(e)}"
            )
    
    def get_db_type(self) -> VectorDBType:
        return VectorDBType.WEAVIATE_CLOUD if self.is_cloud else VectorDBType.WEAVIATE_LOCAL


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
        
        elif db_type == VectorDBType.CHROMA_LOCAL:
            collection_name = kwargs.get("collection_name")
            if not collection_name:
                raise ValueError("collection_name is required for ChromaDB")
            
            return ChromaDBConnector(
                host=kwargs.get("host", "localhost"),
                port=kwargs.get("port", 8000),
                persist_directory=kwargs.get("persist_directory"),
                collection_name=collection_name,
                is_cloud=False
            )
        
        elif db_type == VectorDBType.CHROMA_CLOUD:
            api_key = kwargs.get("api_key")
            collection_name = kwargs.get("collection_name")
            
            if not api_key:
                raise ValueError("api_key is required for ChromaDB Cloud")
            if not collection_name:
                raise ValueError("collection_name is required for ChromaDB Cloud")
            
            return ChromaDBConnector(
                api_key=api_key,
                tenant=kwargs.get("tenant", "default_tenant"),
                database=kwargs.get("database", "default_database"),
                collection_name=collection_name,
                is_cloud=True
            )
        
        elif db_type == VectorDBType.QDRANT_LOCAL:
            collection_name = kwargs.get("collection_name")
            if not collection_name:
                raise ValueError("collection_name is required for Qdrant")
            
            return QdrantConnector(
                host=kwargs.get("host", "localhost"),
                port=kwargs.get("port", 6333),
                collection_name=collection_name,
                api_key=kwargs.get("api_key"),
                is_cloud=False
            )
        
        elif db_type == VectorDBType.QDRANT_CLOUD:
            url = kwargs.get("url")
            api_key = kwargs.get("api_key")
            collection_name = kwargs.get("collection_name")
            
            if not url:
                raise ValueError("url is required for Qdrant Cloud")
            if not api_key:
                raise ValueError("api_key is required for Qdrant Cloud")
            if not collection_name:
                raise ValueError("collection_name is required for Qdrant Cloud")
            
            return QdrantConnector(
                url=url,
                api_key=api_key,
                collection_name=collection_name,
                is_cloud=True
            )
        
        elif db_type == VectorDBType.WEAVIATE_LOCAL:
            class_name = kwargs.get("class_name")
            if not class_name:
                raise ValueError("class_name is required for Weaviate")
            
            return WeaviateConnector(
                host=kwargs.get("host", "localhost"),
                port=kwargs.get("port", 8080),
                class_name=class_name,
                api_key=kwargs.get("api_key"),
                is_cloud=False
            )
        
        elif db_type == VectorDBType.WEAVIATE_CLOUD:
            url = kwargs.get("url")
            api_key = kwargs.get("api_key")
            class_name = kwargs.get("class_name")
            
            if not url:
                raise ValueError("url is required for Weaviate Cloud")
            if not class_name:
                raise ValueError("class_name is required for Weaviate Cloud")
            
            return WeaviateConnector(
                url=url,
                api_key=api_key,
                class_name=class_name,
                is_cloud=True
            )
        
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
                "type": VectorDBType.CHROMA_LOCAL,
                "name": "ChromaDB (Local)",
                "description": "Connect to local ChromaDB server or persistent storage",
                "requires_auth": False,
                "fields": ["host", "port", "persist_directory", "collection_name"],
                "status": "available"
            },
            {
                "type": VectorDBType.CHROMA_CLOUD,
                "name": "ChromaDB (Cloud)",
                "description": "Connect to ChromaDB Cloud with API key",
                "requires_auth": True,
                "fields": ["api_key", "tenant", "database", "collection_name"],
                "status": "available"
            },
            {
                "type": VectorDBType.QDRANT_LOCAL,
                "name": "Qdrant (Local)",
                "description": "Connect to local/self-hosted Qdrant server",
                "requires_auth": False,
                "fields": ["host", "port", "collection_name", "api_key"],
                "status": "available"
            },
            {
                "type": VectorDBType.QDRANT_CLOUD,
                "name": "Qdrant (Cloud)",
                "description": "Connect to Qdrant Cloud with API key",
                "requires_auth": True,
                "fields": ["url", "api_key", "collection_name"],
                "status": "available"
            },
            {
                "type": VectorDBType.WEAVIATE_LOCAL,
                "name": "Weaviate (Local)",
                "description": "Connect to local/self-hosted Weaviate server",
                "requires_auth": False,
                "fields": ["host", "port", "class_name", "api_key"],
                "status": "available"
            },
            {
                "type": VectorDBType.WEAVIATE_CLOUD,
                "name": "Weaviate (Cloud)",
                "description": "Connect to Weaviate Cloud Services (WCS)",
                "requires_auth": True,
                "fields": ["url", "api_key", "class_name"],
                "status": "available"
            }
        ]


# Helper functions to load from environment

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


def create_chroma_local_connector_from_env() -> ChromaDBConnector:
    """
    Create ChromaDB local connector using environment variables.
    
    Environment variables:
    - CHROMA_HOST: Host address (default: localhost)
    - CHROMA_PORT: Port number (default: 8000)
    - CHROMA_PERSIST_DIRECTORY: Path to persistent storage (optional)
    - CHROMA_COLLECTION_NAME: Collection name (required)
    """
    host = os.getenv("CHROMA_HOST", "localhost")
    port = int(os.getenv("CHROMA_PORT", "8000"))
    persist_directory = os.getenv("CHROMA_PERSIST_DIRECTORY")
    collection_name = os.getenv("CHROMA_COLLECTION_NAME")
    
    if not collection_name:
        raise ValueError("CHROMA_COLLECTION_NAME not set in environment")
    
    return ChromaDBConnector(
        host=host,
        port=port,
        persist_directory=persist_directory,
        collection_name=collection_name,
        is_cloud=False
    )


def create_chroma_cloud_connector_from_env() -> ChromaDBConnector:
    """
    Create ChromaDB Cloud connector using environment variables.
    
    Environment variables:
    - CHROMA_CLOUD_API_KEY: API key for ChromaDB Cloud (required)
    - CHROMA_CLOUD_TENANT: Tenant name (default: default_tenant)
    - CHROMA_CLOUD_DATABASE: Database name (default: default_database)
    - CHROMA_COLLECTION_NAME: Collection name (required)
    """
    api_key = os.getenv("CHROMA_CLOUD_API_KEY")
    tenant = os.getenv("CHROMA_CLOUD_TENANT", "default_tenant")
    database = os.getenv("CHROMA_CLOUD_DATABASE", "default_database")
    collection_name = os.getenv("CHROMA_COLLECTION_NAME")
    
    if not api_key:
        raise ValueError("CHROMA_CLOUD_API_KEY not set in environment")
    if not collection_name:
        raise ValueError("CHROMA_COLLECTION_NAME not set in environment")
    
    return ChromaDBConnector(
        api_key=api_key,
        tenant=tenant,
        database=database,
        collection_name=collection_name,
        is_cloud=True
    )


def create_qdrant_local_connector_from_env() -> QdrantConnector:
    """
    Create Qdrant local connector using environment variables.
    
    Environment variables:
    - QDRANT_HOST: Host address (default: localhost)
    - QDRANT_PORT: Port number (default: 6333)
    - QDRANT_API_KEY: API key (optional for local)
    - QDRANT_COLLECTION_NAME: Collection name (required)
    """
    host = os.getenv("QDRANT_HOST", "localhost")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    api_key = os.getenv("QDRANT_API_KEY")
    collection_name = os.getenv("QDRANT_COLLECTION_NAME")
    
    if not collection_name:
        raise ValueError("QDRANT_COLLECTION_NAME not set in environment")
    
    return QdrantConnector(
        host=host,
        port=port,
        api_key=api_key,
        collection_name=collection_name,
        is_cloud=False
    )


def create_qdrant_cloud_connector_from_env() -> QdrantConnector:
    """
    Create Qdrant Cloud connector using environment variables.
    
    Environment variables:
    - QDRANT_CLOUD_URL: Full URL of Qdrant Cloud cluster (required)
    - QDRANT_CLOUD_API_KEY: API key (required)
    - QDRANT_COLLECTION_NAME: Collection name (required)
    """
    url = os.getenv("QDRANT_CLOUD_URL")
    api_key = os.getenv("QDRANT_CLOUD_API_KEY")
    collection_name = os.getenv("QDRANT_COLLECTION_NAME")
    
    if not url:
        raise ValueError("QDRANT_CLOUD_URL not set in environment")
    if not api_key:
        raise ValueError("QDRANT_CLOUD_API_KEY not set in environment")
    if not collection_name:
        raise ValueError("QDRANT_COLLECTION_NAME not set in environment")
    
    return QdrantConnector(
        url=url,
        api_key=api_key,
        collection_name=collection_name,
        is_cloud=True
    )


def create_weaviate_local_connector_from_env() -> WeaviateConnector:
    """
    Create Weaviate local connector using environment variables.
    
    Environment variables:
    - WEAVIATE_HOST: Host address (default: localhost)
    - WEAVIATE_PORT: Port number (default: 8080)
    - WEAVIATE_API_KEY: API key (optional for local)
    - WEAVIATE_CLASS_NAME: Class name (required)
    """
    host = os.getenv("WEAVIATE_HOST", "localhost")
    port = int(os.getenv("WEAVIATE_PORT", "8080"))
    api_key = os.getenv("WEAVIATE_API_KEY")
    class_name = os.getenv("WEAVIATE_CLASS_NAME")
    
    if not class_name:
        raise ValueError("WEAVIATE_CLASS_NAME not set in environment")
    
    return WeaviateConnector(
        host=host,
        port=port,
        api_key=api_key,
        class_name=class_name,
        is_cloud=False
    )


def create_weaviate_cloud_connector_from_env() -> WeaviateConnector:
    """
    Create Weaviate Cloud connector using environment variables.
    
    Environment variables:
    - WEAVIATE_CLOUD_URL: Full URL of Weaviate Cloud cluster (required)
    - WEAVIATE_CLOUD_API_KEY: API key (optional but recommended)
    - WEAVIATE_CLASS_NAME: Class name (required)
    """
    url = os.getenv("WEAVIATE_CLOUD_URL")
    api_key = os.getenv("WEAVIATE_CLOUD_API_KEY")
    class_name = os.getenv("WEAVIATE_CLASS_NAME")
    
    if not url:
        raise ValueError("WEAVIATE_CLOUD_URL not set in environment")
    if not class_name:
        raise ValueError("WEAVIATE_CLASS_NAME not set in environment")
    
    return WeaviateConnector(
        url=url,
        api_key=api_key,
        class_name=class_name,
        is_cloud=True
    )

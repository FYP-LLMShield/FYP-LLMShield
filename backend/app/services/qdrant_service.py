"""
Qdrant Service - Vector database operations for RAG
"""

import logging
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton instance
_qdrant_client = None


class QdrantService:
    """
    Manages Qdrant vector database operations
    - Stores embeddings of scan results
    - Stores chat history embeddings for long-term memory
    - Allows semantic search across user's data
    """

    def __init__(self):
        self.client = None
        self.vector_size = 1024  # Must match BAAI/bge-large-en-v1.5
        self.scan_collection = "scan_embeddings"
        self.chat_collection = "chat_embeddings"
        self.initialized = False

    def connect(self):
        """Connect to Qdrant and initialize collections"""
        if self.client is not None:
            return

        try:
            logger.info(f"🔄 Connecting to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")

            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                api_key=settings.QDRANT_API_KEY
            )

            # Check connection
            collection_info = self.client.get_collections()
            logger.info(f"✅ Connected to Qdrant")

            # Create collections if they don't exist
            self._ensure_collections()
            self.initialized = True

        except Exception as e:
            logger.error(f"❌ Failed to connect to Qdrant: {e}")
            logger.error("Make sure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant")
            raise

    def _ensure_collections(self):
        """Create collections if they don't exist"""
        try:
            # Check and create scan_embeddings collection
            try:
                self.client.get_collection(self.scan_collection)
                logger.info(f"✅ Collection '{self.scan_collection}' exists")
            except:
                logger.info(f"🔄 Creating collection '{self.scan_collection}'")
                self.client.create_collection(
                    collection_name=self.scan_collection,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )

            # Check and create chat_embeddings collection
            try:
                self.client.get_collection(self.chat_collection)
                logger.info(f"✅ Collection '{self.chat_collection}' exists")
            except:
                logger.info(f"🔄 Creating collection '{self.chat_collection}'")
                self.client.create_collection(
                    collection_name=self.chat_collection,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )

        except Exception as e:
            logger.error(f"❌ Error creating collections: {e}")
            raise

    def upsert_scan_embeddings(
        self,
        user_id: str,
        scan_id: str,
        scan_type: str,
        chunks: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Store scan result embeddings in Qdrant

        Args:
            user_id: User email for privacy filtering
            scan_id: Unique scan identifier
            scan_type: Type of scan (model_poisoning, dataset_poisoning, etc.)
            chunks: List of {"text": "...", "chunk_type": "..."} dicts

        Returns:
            List of point IDs stored
        """
        if not self.initialized:
            self.connect()

        try:
            from app.services.embedding_service import get_embedding_service
            embedding_service = get_embedding_service()

            # Extract texts and embed them
            texts = [chunk["text"] for chunk in chunks]
            embeddings = embedding_service.embed_batch(texts)

            # Create points
            points = []
            point_ids = []
            for i, (embedding, chunk) in enumerate(zip(embeddings, chunks)):
                point_id = int(uuid.uuid4().int % (2**63))  # Unique integer ID
                point_ids.append(str(point_id))

                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "user_id": user_id,
                        "scan_id": scan_id,
                        "scan_type": scan_type,
                        "chunk_text": chunk["text"],
                        "chunk_type": chunk.get("chunk_type", "general"),
                        "timestamp": chunk.get("timestamp", "")
                    }
                )
                points.append(point)

            # Upsert to Qdrant
            self.client.upsert(
                collection_name=self.scan_collection,
                points=points
            )

            logger.info(f"✅ Stored {len(points)} scan embeddings for scan {scan_id}")
            return point_ids

        except Exception as e:
            logger.error(f"❌ Error upserting scan embeddings: {e}")
            raise

    def upsert_chat_memory(
        self,
        user_id: str,
        session_id: str,
        question: str,
        answer: str
    ) -> str:
        """
        Store Q&A in long-term memory

        Args:
            user_id: User email
            session_id: Chat session ID
            question: User's question
            answer: Assistant's answer

        Returns:
            Point ID
        """
        if not self.initialized:
            self.connect()

        try:
            from app.services.embedding_service import get_embedding_service
            embedding_service = get_embedding_service()

            # Embed the question (for search)
            embedding = embedding_service.embed_text(question)

            # Create point
            point_id = int(uuid.uuid4().int % (2**63))
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "user_id": user_id,
                    "session_id": session_id,
                    "question": question,
                    "answer": answer,
                    "timestamp": str(uuid.uuid4())
                }
            )

            # Upsert
            self.client.upsert(
                collection_name=self.chat_collection,
                points=[point]
            )

            logger.info(f"✅ Stored chat memory for user {user_id}")
            return str(point_id)

        except Exception as e:
            logger.error(f"❌ Error storing chat memory: {e}")
            raise

    def search_scan_results(
        self,
        user_id: str,
        query_vector: List[float],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant scan results

        Args:
            user_id: User email (for privacy)
            query_vector: Embedding of user's question
            limit: Number of results

        Returns:
            List of relevant scan chunks
        """
        if not self.initialized:
            self.connect()

        try:
            results = self.client.search(
                collection_name=self.scan_collection,
                query_vector=query_vector,
                query_filter={
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}}
                    ]
                },
                limit=limit
            )

            # Convert to dict format
            found_chunks = []
            for result in results:
                found_chunks.append({
                    "score": result.score,
                    "scan_id": result.payload.get("scan_id"),
                    "scan_type": result.payload.get("scan_type"),
                    "chunk_text": result.payload.get("chunk_text"),
                    "chunk_type": result.payload.get("chunk_type")
                })

            logger.info(f"✅ Found {len(found_chunks)} relevant scan chunks")
            return found_chunks

        except Exception as e:
            logger.error(f"❌ Error searching scan results: {e}")
            raise

    def search_chat_history(
        self,
        user_id: str,
        query_vector: List[float],
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Search past Q&As for context

        Args:
            user_id: User email (for privacy)
            query_vector: Embedding of user's current question
            limit: Number of past Q&As to retrieve

        Returns:
            List of similar past Q&As
        """
        if not self.initialized:
            self.connect()

        try:
            results = self.client.search(
                collection_name=self.chat_collection,
                query_vector=query_vector,
                query_filter={
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}}
                    ]
                },
                limit=limit
            )

            past_qas = []
            for result in results:
                past_qas.append({
                    "score": result.score,
                    "question": result.payload.get("question"),
                    "answer": result.payload.get("answer")
                })

            logger.info(f"✅ Found {len(past_qas)} similar past Q&As")
            return past_qas

        except Exception as e:
            logger.error(f"❌ Error searching chat history: {e}")
            raise

    def delete_user_data(self, user_id: str):
        """Delete all of user's data from Qdrant"""
        if not self.initialized:
            self.connect()

        try:
            # Delete from both collections
            for collection in [self.scan_collection, self.chat_collection]:
                self.client.delete(
                    collection_name=collection,
                    points_selector={
                        "filter": {
                            "must": [
                                {"key": "user_id", "match": {"value": user_id}}
                            ]
                        }
                    }
                )

            logger.info(f"✅ Deleted all data for user {user_id}")

        except Exception as e:
            logger.error(f"❌ Error deleting user data: {e}")
            raise


def get_qdrant_service() -> QdrantService:
    """Get singleton Qdrant service instance"""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantService()
        _qdrant_client.connect()
    return _qdrant_client

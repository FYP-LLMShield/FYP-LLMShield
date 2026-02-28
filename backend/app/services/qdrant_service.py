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

    def _ensure_connected(self):
        """Ensure Qdrant is connected (lazy connection on first use)"""
        if self.client is not None:
            return
        self.connect()

    def connect(self):
        """Connect to Qdrant and initialize collections"""
        if self.client is not None:
            return

        try:
            logger.info(f"🔄 Connecting to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")

            # Support both local and Qdrant Cloud
            # If host contains a dot (domain), treat as cloud URL
            if "." in settings.QDRANT_HOST or settings.QDRANT_HOST.startswith("http"):
                # Qdrant Cloud: use URL-based connection
                url = settings.QDRANT_HOST if settings.QDRANT_HOST.startswith("http") else f"https://{settings.QDRANT_HOST}:6333"
                self.client = QdrantClient(
                    url=url,
                    api_key=settings.QDRANT_API_KEY,
                    prefer_grpc=False
                )
                logger.info(f"🌐 Connected to Qdrant Cloud: {url}")
            else:
                # Local Qdrant: use host/port
                self.client = QdrantClient(
                    host=settings.QDRANT_HOST,
                    port=settings.QDRANT_PORT,
                    api_key=settings.QDRANT_API_KEY
                )
                logger.info(f"🏠 Connected to Local Qdrant: {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")

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

        Lazy connects to Qdrant on first use

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
            results = self.client.query_points(
                collection_name=self.scan_collection,
                query=query_vector,
                query_filter={
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}}
                    ]
                },
                limit=limit
            )

            # Handle response object - extract points
            if hasattr(results, 'points'):
                points = results.points
            else:
                points = results if isinstance(results, list) else []

            # Convert to dict format
            found_chunks = []
            for result in points:
                try:
                    found_chunks.append({
                        "score": float(result.score) if hasattr(result, 'score') else 0.0,
                        "scan_id": result.payload.get("scan_id") if hasattr(result, 'payload') else None,
                        "scan_type": result.payload.get("scan_type") if hasattr(result, 'payload') else None,
                        "chunk_text": result.payload.get("chunk_text") if hasattr(result, 'payload') else str(result),
                        "chunk_type": result.payload.get("chunk_type") if hasattr(result, 'payload') else "general"
                    })
                except Exception as e:
                    logger.warning(f"Error processing result: {e}")

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
            results = self.client.query_points(
                collection_name=self.chat_collection,
                query=query_vector,
                query_filter={
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}}
                    ]
                },
                limit=limit
            )

            # Handle response object - extract points
            if hasattr(results, 'points'):
                points = results.points
            else:
                points = results if isinstance(results, list) else []

            past_qas = []
            for result in points:
                try:
                    past_qas.append({
                        "score": float(result.score) if hasattr(result, 'score') else 0.0,
                        "question": result.payload.get("question") if hasattr(result, 'payload') else "",
                        "answer": result.payload.get("answer") if hasattr(result, 'payload') else ""
                    })
                except Exception as e:
                    logger.warning(f"Error processing result: {e}")

            logger.info(f"✅ Found {len(past_qas)} similar past Q&As")
            return past_qas

        except Exception as e:
            logger.error(f"❌ Error searching chat history: {e}")
            raise

    def search_knowledge_base(
        self,
        query_vector: List[float],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search shared knowledge base documents"""
        print(f"[QDRANT] search_knowledge_base called with limit={limit}", flush=True)

        if not self.initialized or self.client is None:
            print("[QDRANT] NOT initialized, connecting...", flush=True)
            self.connect()
        else:
            print(f"[QDRANT] Already initialized, client={self.client is not None}", flush=True)

        try:
            # Check if knowledge_base collection exists
            try:
                coll = self.client.get_collection("knowledge_base")
                print(f"[QDRANT] Collection found: {coll.points_count} points", flush=True)
            except Exception as e:
                print(f"[QDRANT] ERROR getting collection: {e}", flush=True)
                return []

            print(f"[QDRANT] Calling query_points...", flush=True)
            results = self.client.query_points(
                collection_name="knowledge_base",
                query=query_vector,
                limit=limit
            )

            # Extract points from response
            if hasattr(results, 'points'):
                points = results.points
            else:
                points = results if isinstance(results, list) else []

            print(f"[QDRANT] Extracted {len(points)} points from response", flush=True)

            knowledge_chunks = []
            for i, result in enumerate(points):
                try:
                    # Support multiple payload key formats
                    chunk_text = result.payload.get("chunk_text") or result.payload.get("text") or ""
                    doc_name = result.payload.get("doc_name") or "Unknown"
                    
                    if not chunk_text:
                        print(f"[QDRANT] Skipping result {i} - no text in payload keys: {list(result.payload.keys())}", flush=True)
                        continue

                    chunk = {
                        "score": float(result.score) if hasattr(result, 'score') else 0.0,
                        "doc_name": doc_name,
                        "chunk_text": chunk_text,
                        "doc_type": result.payload.get("doc_type") or "general"
                    }
                    knowledge_chunks.append(chunk)
                    print(f"[QDRANT] [{i+1}] {chunk['doc_name']} (Score: {chunk['score']:.3f})", flush=True)
                except Exception as e:
                    print(f"[QDRANT] Error processing result {i}: {e}", flush=True)

            print(f"[QDRANT] Returning {len(knowledge_chunks)} chunks", flush=True)
            return knowledge_chunks

        except Exception as e:
            print(f"[QDRANT ERROR] {e}", flush=True)
            return []

    def delete_user_data(self, user_id: str):
        """Delete all of user's data from Qdrant"""
        if not self.initialized:
            self.connect()

        try:
            # Delete from all collections
            for collection in [self.scan_collection, self.chat_collection, "knowledge_base"]:
                try:
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
                except:
                    pass  # Collection might not exist

            logger.info(f"✅ Deleted all data for user {user_id}")

        except Exception as e:
            logger.error(f"❌ Error deleting user data: {e}")
            raise


def get_qdrant_service() -> QdrantService:
    """Get singleton Qdrant service instance (connects on first use, not startup)"""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantService()
        # Don't connect yet - will connect on first use (lazy initialization)
        # This allows app to start even if Qdrant is unavailable
    return _qdrant_client

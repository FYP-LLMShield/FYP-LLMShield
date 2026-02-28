"""
RAG Chatbot Service using Qdrant Cloud and Groq LLM
Retrieves context from Qdrant and generates responses using Groq API
"""

import logging
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from groq import Groq
from app.core.config import settings
from app.services.user_memory_service import UserMemoryService
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class ChatbotService:
    """RAG Chatbot service combining Qdrant retrieval and Groq generation"""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.embedding_model = None
        self.qdrant_client = None
        self.groq_client = None
        self.model_name = "BAAI/bge-large-en-v1.5"
        self.vector_size = 1024
        self.collection_name = "knowledge_base"  # Your knowledge base collection
        self.groq_model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.initialized = False
        self.db = db
        self.memory_service = UserMemoryService(db) if db is not None else None

    def initialize(self):
        """Initialize embedding model, Qdrant client, and Groq client"""
        if self.initialized:
            return

        try:
            # Initialize embedding model
            logger.info(f"🔄 Loading embedding model: {self.model_name}")
            self.embedding_model = SentenceTransformer(self.model_name)
            logger.info(f"✅ Embedding model loaded: {self.model_name} ({self.vector_size}D)")

            # Initialize Qdrant client
            logger.info(f"🔄 Connecting to Qdrant...")
            if settings.QDRANT_USE_HTTPS or settings.QDRANT_HOST.startswith("http"):
                # Qdrant Cloud
                self.qdrant_client = QdrantClient(
                    url=settings.QDRANT_HOST,
                    api_key=settings.QDRANT_API_KEY,
                    prefer_grpc=False
                )
            else:
                # Local Qdrant
                self.qdrant_client = QdrantClient(
                    host=settings.QDRANT_HOST,
                    port=settings.QDRANT_PORT,
                    api_key=settings.QDRANT_API_KEY
                )
            logger.info(f"✅ Connected to Qdrant")

            # Initialize Groq client
            logger.info(f"🔄 Initializing Groq client with model: {self.groq_model}")
            self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
            logger.info(f"✅ Groq client initialized")

            self.initialized = True
        except Exception as e:
            logger.error(f"❌ Failed to initialize ChatbotService: {e}")
            raise

    def embed_query(self, text: str) -> List[float]:
        """
        Convert query text to embedding vector

        Args:
            text: Query text to embed

        Returns:
            List of floats representing the embedding
        """
        if self.embedding_model is None:
            self.initialize()

        try:
            embedding = self.embedding_model.encode(text, convert_to_numpy=False)
            return embedding.tolist() if hasattr(embedding, 'tolist') else embedding
        except Exception as e:
            logger.error(f"❌ Embedding failed: {e}")
            raise

    def search_context(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Search Qdrant for relevant context chunks

        Args:
            query: User query text
            limit: Max number of chunks to retrieve

        Returns:
            List of relevant context chunks
        """
        if self.qdrant_client is None:
            self.initialize()

        try:
            # Try vector search first
            try:
                query_embedding = self.embed_query(query)
                search_results = self.qdrant_client.query_points(
                    collection_name=self.collection_name,
                    query=query_embedding,
                    limit=limit
                )

                contexts = []
                if search_results.points:
                    for result in search_results.points:
                        payload = result.payload
                        contexts.append({
                            "text": payload.get("chunk_text", payload.get("text", "")),
                            "score": result.score if hasattr(result, 'score') else 0.0,
                            "doc_name": payload.get("doc_name", "Unknown"),
                            "source": payload.get("file_path", payload.get("source", ""))
                        })

                if contexts:
                    logger.info(f"✅ Retrieved {len(contexts)} context chunks via vector search")
                    return contexts
            except Exception as e:
                logger.warning(f"Vector search failed: {e}, falling back to keyword search")

            # Fallback: keyword search through all points
            query_lower = query.lower()
            query_words = set(query_lower.split())

            all_points, _ = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                limit=100
            )

            # Score points based on keyword matches
            scored_points = []
            for point in all_points:
                payload = point.payload
                text = (payload.get("chunk_text") or payload.get("text") or "").lower()
                doc_name = (payload.get("doc_name") or "").lower()

                # Calculate match score
                matches = sum(1 for word in query_words if word in text or word in doc_name)
                if matches > 0:
                    scored_points.append({
                        "text": payload.get("chunk_text", payload.get("text", "")),
                        "score": matches / len(query_words),
                        "doc_name": payload.get("doc_name", "Unknown"),
                        "source": payload.get("file_path", payload.get("source", "")),
                        "matches": matches
                    })

            # Sort by match count and return top results
            scored_points.sort(key=lambda x: x["matches"], reverse=True)
            contexts = scored_points[:limit]

            logger.info(f"✅ Retrieved {len(contexts)} context chunks via keyword search")
            return contexts

        except Exception as e:
            logger.error(f"❌ Context search failed: {e}")
            import traceback
            traceback.print_exc()
            return []

    def generate_response(
        self,
        user_message: str,
        contexts: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        user_memories: Optional[Dict[str, str]] = None,
        newly_extracted_memories: Optional[List[tuple]] = None
    ) -> str:
        """
        Generate response using Groq with retrieved context

        Args:
            user_message: Current user message
            contexts: Retrieved context chunks
            conversation_history: Previous messages (optional)
            user_memories: User's stored personal information (optional)
            newly_extracted_memories: Memories just extracted from this message (optional)

        Returns:
            Generated response text
        """
        if self.groq_client is None:
            self.initialize()

        try:
            # Build context string
            context_str = "\n".join([
                f"Source: {ctx['doc_name']}\n{ctx['text']}"
                for ctx in contexts
            ])

            # Build user memory string
            memory_str = ""
            if user_memories and self.memory_service:
                memory_str = self.memory_service.format_memories_for_prompt(user_memories)

            # Build newly extracted memories info
            extracted_info = ""
            if newly_extracted_memories:
                extracted_items = []
                for key, value in newly_extracted_memories:
                    extracted_items.append(f"- {key.replace('_', ' ').title()}: {value}")
                extracted_info = f"\n\nNEW INFORMATION: The user just shared the following information. Acknowledge it naturally in your response:\n" + "\n".join(extracted_items)
                logger.info(f"Including newly extracted memories in prompt: {newly_extracted_memories}")

            # Build message history with system prompt
            messages = []

            # Add system prompt as first message
            system_content = f"""You are a helpful and friendly assistant that remembers personal information about users.

Guidelines:
- For simple greetings (hello, hi, hey, etc.), respond warmly and naturally WITHOUT referencing context
- For actual questions and requests, provide helpful answers based on the provided context
- If asked a question but don't have relevant context, be honest and helpful anyway
- Keep responses conversational and natural
- Don't mention or discuss the context unless it's directly relevant to answering the user's question
- When the user tells you personal information (preferences, orders, requests to remember), explicitly acknowledge it naturally in your response showing you understand and will remember it
- Use natural language like "Got it!", "I'll remember that", "Perfect, I've noted that", etc.

Context (use when relevant):
{context_str}{extracted_info}"""

            # Add user memories to system prompt if available
            if memory_str:
                system_content += f"\n\n{memory_str}"

            messages.append({
                "role": "system",
                "content": system_content
            })

            # Add conversation history
            if conversation_history:
                messages.extend(conversation_history[-4:])  # Last 4 messages for context

            # Add current user message
            messages.append({"role": "user", "content": user_message})

            # Generate response with Groq
            response = self.groq_client.chat.completions.create(
                model=self.groq_model,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                top_p=0.9
            )

            answer = response.choices[0].message.content
            logger.info(f"✅ Generated response from Groq")
            return answer

        except Exception as e:
            logger.error(f"❌ Response generation failed: {e}")
            raise

    async def chat(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main chat method: retrieve context and generate response

        Args:
            user_message: User's message
            conversation_history: Previous messages
            user_id: User ID for memory extraction and retrieval

        Returns:
            Dict with response and context
        """
        try:
            # Extract and save user memories if user_id provided
            user_memories = {}
            extracted_memories = []
            if user_id and self.memory_service is not None:
                try:
                    logger.info(f"🔄 Processing memories for user {user_id}")
                    # Extract any new memories from user message
                    extracted_memories = await self.memory_service.extract_and_save_memories(
                        user_id,
                        user_message,
                        source="conversation"
                    )
                    if extracted_memories:
                        logger.info(f"✨ Extracted {len(extracted_memories)} new memories: {extracted_memories}")

                    # Get all user memories
                    user_memories = await self.memory_service.get_user_memories(user_id)
                    logger.info(f"📚 Loaded {len(user_memories)} total memories for user {user_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to load user memories: {e}", exc_info=True)

            # Retrieve relevant context
            contexts = self.search_context(user_message, limit=5)

            # Generate response with user memories and extracted memories
            response = self.generate_response(
                user_message,
                contexts,
                conversation_history,
                user_memories,
                extracted_memories if extracted_memories else None
            )

            return {
                "response": response,
                "contexts": contexts,
                "success": True,
                "extracted_memories": extracted_memories
            }

        except Exception as e:
            logger.error(f"❌ Chat failed: {e}", exc_info=True)
            return {
                "response": f"Error: {str(e)}",
                "contexts": [],
                "success": False
            }


# Global singleton instance
_chatbot_service = None


def get_chatbot_service(db: Optional[AsyncIOMotorDatabase] = None) -> ChatbotService:
    """Get or create chatbot service singleton"""
    global _chatbot_service
    if _chatbot_service is None:
        _chatbot_service = ChatbotService(db)
        _chatbot_service.initialize()
    elif db is not None and _chatbot_service.db is None:
        # If database is now available and wasn't before, update it
        _chatbot_service.db = db
        _chatbot_service.memory_service = UserMemoryService(db)
    return _chatbot_service

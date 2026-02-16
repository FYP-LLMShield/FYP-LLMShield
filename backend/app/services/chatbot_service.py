"""
Chatbot Service - RAG pipeline with Groq LLM
Combines short-term + long-term memory for intelligent responses
"""

import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from groq import Groq
from app.core.config import settings
from app.services.embedding_service import get_embedding_service
from app.services.qdrant_service import get_qdrant_service

logger = logging.getLogger(__name__)


class ChatbotService:
    """
    RAG Chatbot that explains security scan results to users

    Memory hierarchy:
    1. User Profile (long-term): preferred_name, language, expertise
    2. Short-term (current session): last 10 messages
    3. Long-term (Qdrant): past Q&As + scan results
    """

    def __init__(self):
        self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
        self.groq_model = "llama-3.3-70b-versatile"
        self.embedding_service = get_embedding_service()
        self.qdrant_service = get_qdrant_service()

        # Short-term memory: {session_id: [messages]}
        self.short_term_memory: Dict[str, List[Dict[str, Any]]] = {}
        self.max_short_term = 10

    def _get_system_prompt(self, user_prefs: Optional[Dict[str, Any]] = None) -> str:
        """Build system prompt with user context"""
        base_prompt = """You are LLMShield Security Assistant - an expert at explaining security scan results.

Your role:
- Explain scan findings in simple, non-technical language
- Help users understand security risks
- Provide actionable recommendations
- Reference specific findings when relevant
- Adapt to user's expertise level

Tone:
- Professional but friendly
- Urdu-friendly (use English technical terms, simple Urdu for explanation)
- Clear and concise (2-4 sentences usually)
- No jargon unless necessary

When explaining findings:
- Start with severity (SAFE/SUSPICIOUS/UNSAFE)
- Explain what it means in simple terms
- Give practical implications
- Suggest next steps if needed"""

        # Add user preferences if available
        if user_prefs:
            if user_prefs.get("preferred_name"):
                base_prompt += f"\n\nThe user prefers to be called '{user_prefs['preferred_name']}'."
            if user_prefs.get("language_preference"):
                base_prompt += f"\nUser's language preference: {user_prefs['language_preference']}"
            if user_prefs.get("expertise_level"):
                base_prompt += f"\nUser expertise level: {user_prefs['expertise_level']} - adjust explanations accordingly"

        return base_prompt

    def _get_short_term_context(self, session_id: str) -> List[Dict[str, str]]:
        """Get last 10 messages from current session"""
        messages = self.short_term_memory.get(session_id, [])

        # Convert to Groq format
        context = []
        for msg in messages[-self.max_short_term:]:
            context.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        return context

    def _update_short_term_memory(self, session_id: str, role: str, content: str):
        """Add message to short-term memory (sliding window)"""
        if session_id not in self.short_term_memory:
            self.short_term_memory[session_id] = []

        self.short_term_memory[session_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow()
        })

        # Keep only last 10
        if len(self.short_term_memory[session_id]) > self.max_short_term:
            self.short_term_memory[session_id] = self.short_term_memory[session_id][-self.max_short_term:]

    def _build_rag_context(
        self,
        user_id: str,
        question: str,
        scan_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Build context from:
        1. Scan results (if scan_id provided or search for similar)
        2. Past Q&As (similar questions)
        """
        context_parts = []
        sources = []

        try:
            # Embed the question
            question_embedding = self.embedding_service.embed_text(question)

            # Search for relevant scan results
            if scan_id:
                # If specific scan provided, search within that scan
                scan_chunks = self.qdrant_service.search_scan_results(
                    user_id=user_id,
                    query_vector=question_embedding,
                    limit=5
                )

                for chunk in scan_chunks:
                    if chunk["scan_id"] == scan_id:
                        context_parts.append(f"[{chunk['chunk_type']}]: {chunk['chunk_text']}")
                        if chunk["scan_id"] not in sources:
                            sources.append(chunk["scan_id"])
            else:
                # Search all user's scans
                scan_chunks = self.qdrant_service.search_scan_results(
                    user_id=user_id,
                    query_vector=question_embedding,
                    limit=3
                )

                for chunk in scan_chunks:
                    context_parts.append(f"[{chunk['chunk_type']}]: {chunk['chunk_text']}")
                    if chunk["scan_id"] not in sources:
                        sources.append(chunk["scan_id"])

            # Search for similar past Q&As (context)
            past_qas = self.qdrant_service.search_chat_history(
                user_id=user_id,
                query_vector=question_embedding,
                limit=2
            )

            for past_qa in past_qas:
                context_parts.append(f"[Similar question]: Q: {past_qa['question']}\nA: {past_qa['answer']}")

        except Exception as e:
            logger.warning(f"⚠️ Could not retrieve RAG context: {e}")
            logger.info("Continuing with short-term memory only")

        return {
            "context": "\n\n".join(context_parts) if context_parts else "",
            "sources": sources
        }

    def _detect_user_preferences(self, message: str) -> Dict[str, str]:
        """Auto-detect if user is sharing preferences"""
        preferences = {}

        # Check for name changes
        if "call me" in message.lower():
            # Extract name after "call me"
            parts = message.lower().split("call me")
            if len(parts) > 1:
                name = parts[1].strip().split()[0]
                preferences["preferred_name"] = name

        # Check for language preference
        if "urdu" in message.lower():
            preferences["language_preference"] = "urdu"
        elif "english" in message.lower():
            preferences["language_preference"] = "english"

        # Check for expertise level
        if "beginner" in message.lower():
            preferences["expertise_level"] = "beginner"
        elif "expert" in message.lower():
            preferences["expertise_level"] = "expert"
        elif "intermediate" in message.lower():
            preferences["expertise_level"] = "intermediate"

        return preferences

    async def chat(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        scan_id: Optional[str] = None,
        user_prefs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main chat endpoint - RAG pipeline

        Args:
            user_id: User email
            message: User's message
            session_id: Chat session ID (new if None)
            scan_id: Optional scan context
            user_prefs: User preferences from MongoDB

        Returns:
            Dict with response, session_id, sources
        """

        # Create session if new
        if not session_id:
            session_id = str(uuid.uuid4())
            logger.info(f"🆕 New session: {session_id}")

        try:
            # Step 1: Build RAG context
            logger.info("📚 Building RAG context...")
            rag_context = self._build_rag_context(user_id, message, scan_id)

            # Step 2: Get short-term memory
            logger.info("📝 Retrieving short-term memory...")
            short_term = self._get_short_term_context(session_id)

            # Step 3: Build system prompt with preferences
            logger.info("🎯 Building system prompt...")
            system_prompt = self._get_system_prompt(user_prefs)

            # Step 4: Build messages for Groq
            messages = short_term.copy()

            # Add context if available
            if rag_context["context"]:
                messages.append({
                    "role": "user",
                    "content": f"[Context from your past scans]:\n{rag_context['context']}\n\n[Your question]: {message}"
                })
            else:
                messages.append({
                    "role": "user",
                    "content": message
                })

            # Step 5: Call Groq API
            logger.info("🤖 Calling Groq API...")
            response = self.groq_client.chat.completions.create(
                model=self.groq_model,
                messages=[{"role": "system", "content": system_prompt}] + messages,
                temperature=0.7,
                max_tokens=1024
            )

            assistant_message = response.choices[0].message.content

            # Step 6: Store in memories
            logger.info("💾 Storing in memories...")
            # Short-term
            self._update_short_term_memory(session_id, "user", message)
            self._update_short_term_memory(session_id, "assistant", assistant_message)

            # Long-term (MongoDB + Qdrant will be handled by route)

            # Detect user preferences to save
            detected_prefs = self._detect_user_preferences(message)

            logger.info("✅ Chat response generated")
            return {
                "session_id": session_id,
                "response": assistant_message,
                "sources": rag_context["sources"],
                "timestamp": datetime.utcnow().isoformat(),
                "detected_preferences": detected_prefs
            }

        except Exception as e:
            logger.error(f"❌ Error in chat pipeline: {e}", exc_info=True)
            raise

    def clear_session(self, session_id: str):
        """Clear a session from short-term memory"""
        if session_id in self.short_term_memory:
            del self.short_term_memory[session_id]
            logger.info(f"🗑️ Cleared session {session_id}")

    def get_session_preview(self, session_id: str) -> List[Dict[str, Any]]:
        """Get short preview of a session"""
        return self.short_term_memory.get(session_id, [])


# Singleton
_chatbot_instance = None


def get_chatbot_service() -> ChatbotService:
    """Get singleton chatbot service"""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = ChatbotService()
    return _chatbot_instance

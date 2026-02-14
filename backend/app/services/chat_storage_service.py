"""
Chat Storage Service - MongoDB operations for chat history and user preferences
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from app.core.database import get_database

logger = logging.getLogger(__name__)


class ChatStorageService:
    """Handles MongoDB operations for chat history and preferences"""

    # Collection names
    CHAT_SESSIONS = "chat_sessions"
    CHAT_MESSAGES = "chat_messages"
    USER_CHAT_PREFS = "user_chat_preferences"

    @staticmethod
    async def create_session(
        user_id: str,
        session_id: str,
        scan_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new chat session"""
        db = await get_database()

        session_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "started_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "message_count": 0,
            "context_scan_id": scan_id
        }

        result = await db[ChatStorageService.CHAT_SESSIONS].insert_one(session_doc)
        logger.info(f"✅ Created session {session_id}")
        return session_doc

    @staticmethod
    async def store_message(
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        sources: List[str] = None
    ) -> str:
        """Store chat message"""
        db = await get_database()

        message_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow(),
            "sources": sources or []
        }

        result = await db[ChatStorageService.CHAT_MESSAGES].insert_one(message_doc)
        logger.info(f"✅ Stored message in session {session_id}")

        # Update session last_activity and message_count
        await db[ChatStorageService.CHAT_SESSIONS].update_one(
            {"session_id": session_id},
            {
                "$set": {"last_activity": datetime.utcnow()},
                "$inc": {"message_count": 1}
            }
        )

        return str(result.inserted_id)

    @staticmethod
    async def get_session_history(
        user_id: str,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """Get all messages in a session"""
        db = await get_database()

        messages = await db[ChatStorageService.CHAT_MESSAGES].find({
            "user_id": user_id,
            "session_id": session_id
        }).sort("timestamp", 1).to_list(length=None)

        # Convert ObjectId to string
        for msg in messages:
            msg["_id"] = str(msg["_id"])

        return messages

    @staticmethod
    async def list_user_sessions(
        user_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> tuple[List[Dict[str, Any]], int]:
        """List user's chat sessions"""
        db = await get_database()

        total = await db[ChatStorageService.CHAT_SESSIONS].count_documents(
            {"user_id": user_id}
        )

        sessions = await db[ChatStorageService.CHAT_SESSIONS].find(
            {"user_id": user_id}
        ).sort("last_activity", -1).skip(offset).limit(limit).to_list(length=None)

        # Convert ObjectId to string
        for session in sessions:
            session["_id"] = str(session["_id"])

        return sessions, total

    @staticmethod
    async def delete_session(user_id: str, session_id: str):
        """Delete entire session and its messages"""
        db = await get_database()

        # Delete messages
        await db[ChatStorageService.CHAT_MESSAGES].delete_many({
            "user_id": user_id,
            "session_id": session_id
        })

        # Delete session
        await db[ChatStorageService.CHAT_SESSIONS].delete_one({
            "user_id": user_id,
            "session_id": session_id
        })

        logger.info(f"✅ Deleted session {session_id}")

    @staticmethod
    async def update_user_preferences(
        user_id: str,
        preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update user chat preferences"""
        db = await get_database()

        # Merge with existing
        existing = await db[ChatStorageService.USER_CHAT_PREFS].find_one(
            {"user_id": user_id}
        )

        if existing:
            # Update
            update_doc = {
                **existing,
                **preferences,
                "user_id": user_id,
                "last_updated": datetime.utcnow()
            }
            await db[ChatStorageService.USER_CHAT_PREFS].replace_one(
                {"user_id": user_id},
                update_doc
            )
        else:
            # Create
            update_doc = {
                "user_id": user_id,
                **preferences,
                "custom_facts": [],
                "last_updated": datetime.utcnow()
            }
            await db[ChatStorageService.USER_CHAT_PREFS].insert_one(update_doc)

        logger.info(f"✅ Updated preferences for {user_id}")
        return update_doc

    @staticmethod
    async def get_user_preferences(user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's chat preferences"""
        db = await get_database()

        prefs = await db[ChatStorageService.USER_CHAT_PREFS].find_one(
            {"user_id": user_id}
        )

        if prefs:
            prefs["_id"] = str(prefs["_id"])
            return prefs
        return None

    @staticmethod
    async def add_custom_fact(user_id: str, fact: str):
        """Add a fact to user's profile"""
        db = await get_database()

        await db[ChatStorageService.USER_CHAT_PREFS].update_one(
            {"user_id": user_id},
            {"$addToSet": {"custom_facts": fact}},
            upsert=True
        )

        logger.info(f"✅ Added fact for {user_id}: {fact}")

    @staticmethod
    async def delete_all_user_data(user_id: str):
        """Delete ALL user's chat data (GDPR)"""
        db = await get_database()

        # Delete sessions
        await db[ChatStorageService.CHAT_SESSIONS].delete_many({"user_id": user_id})

        # Delete messages
        await db[ChatStorageService.CHAT_MESSAGES].delete_many({"user_id": user_id})

        # Delete preferences
        await db[ChatStorageService.USER_CHAT_PREFS].delete_one({"user_id": user_id})

        logger.info(f"✅ Deleted all chat data for {user_id}")


def get_chat_storage_service() -> type:
    """Get chat storage service class"""
    return ChatStorageService

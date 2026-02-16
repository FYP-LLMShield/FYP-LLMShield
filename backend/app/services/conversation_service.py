"""
Conversation Service for managing chat history
"""

import logging
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.conversation import (
    ConversationInDB,
    ConversationResponse,
    ConversationListItem,
    MessageInDB
)

logger = logging.getLogger(__name__)


class ConversationService:
    """Service for managing chat conversations"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["conversations"]

    async def create_conversation(
        self,
        user_id: str,
        title: Optional[str] = None
    ) -> ConversationResponse:
        """Create a new conversation"""
        try:
            conversation = {
                "user_id": user_id,
                "title": title or "New Chat",
                "messages": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            result = await self.collection.insert_one(conversation)
            conversation["_id"] = result.inserted_id

            logger.info(f"Created conversation {result.inserted_id} for user {user_id}")
            return self._to_response(conversation)

        except Exception as e:
            logger.error(f"Failed to create conversation: {e}")
            raise

    async def get_user_conversations(self, user_id: str) -> List[ConversationListItem]:
        """Get all conversations for a user"""
        try:
            conversations = await self.collection.find(
                {"user_id": user_id}
            ).sort("updated_at", -1).to_list(100)

            return [
                ConversationListItem(
                    id=str(conv["_id"]),
                    title=conv.get("title", "Untitled"),
                    created_at=conv.get("created_at"),
                    updated_at=conv.get("updated_at"),
                    message_count=len(conv.get("messages", []))
                )
                for conv in conversations
            ]

        except Exception as e:
            logger.error(f"Failed to get conversations for user {user_id}: {e}")
            raise

    async def get_conversation(
        self,
        conversation_id: str,
        user_id: str
    ) -> Optional[ConversationResponse]:
        """Get a specific conversation (verify ownership)"""
        try:
            conv = await self.collection.find_one({
                "_id": ObjectId(conversation_id),
                "user_id": user_id
            })

            if not conv:
                logger.warning(f"Conversation {conversation_id} not found for user {user_id}")
                return None

            return self._to_response(conv)

        except Exception as e:
            logger.error(f"Failed to get conversation {conversation_id}: {e}")
            raise

    async def add_message(
        self,
        conversation_id: str,
        user_id: str,
        role: str,
        content: str
    ) -> ConversationResponse:
        """Add a message to a conversation"""
        try:
            message = MessageInDB(
                role=role,
                content=content,
                timestamp=datetime.utcnow()
            )

            result = await self.collection.find_one_and_update(
                {
                    "_id": ObjectId(conversation_id),
                    "user_id": user_id
                },
                {
                    "$push": {"messages": message.dict()},
                    "$set": {"updated_at": datetime.utcnow()}
                },
                return_document=True
            )

            if not result:
                raise ValueError("Conversation not found or unauthorized")

            logger.info(f"Added message to conversation {conversation_id}")
            return self._to_response(result)

        except Exception as e:
            logger.error(f"Failed to add message: {e}")
            raise

    async def update_conversation_title(
        self,
        conversation_id: str,
        user_id: str,
        title: str
    ) -> ConversationResponse:
        """Update conversation title"""
        try:
            result = await self.collection.find_one_and_update(
                {
                    "_id": ObjectId(conversation_id),
                    "user_id": user_id
                },
                {
                    "$set": {
                        "title": title,
                        "updated_at": datetime.utcnow()
                    }
                },
                return_document=True
            )

            if not result:
                raise ValueError("Conversation not found or unauthorized")

            logger.info(f"Updated title for conversation {conversation_id}")
            return self._to_response(result)

        except Exception as e:
            logger.error(f"Failed to update conversation title: {e}")
            raise

    async def delete_conversation(
        self,
        conversation_id: str,
        user_id: str
    ) -> bool:
        """Delete a conversation"""
        try:
            result = await self.collection.delete_one({
                "_id": ObjectId(conversation_id),
                "user_id": user_id
            })

            if result.deleted_count == 0:
                logger.warning(f"Conversation {conversation_id} not found for deletion")
                return False

            logger.info(f"Deleted conversation {conversation_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete conversation: {e}")
            raise

    def _to_response(self, conv: dict) -> ConversationResponse:
        """Convert database document to response"""
        return ConversationResponse(
            id=str(conv.get("_id")),
            user_id=conv.get("user_id"),
            title=conv.get("title", "Untitled"),
            messages=conv.get("messages", []),
            created_at=conv.get("created_at"),
            updated_at=conv.get("updated_at")
        )


# Global instance
_conversation_service: Optional[ConversationService] = None


def get_conversation_service(db: Optional[AsyncIOMotorDatabase] = None) -> ConversationService:
    """Get or create conversation service"""
    global _conversation_service
    if _conversation_service is None and db:
        _conversation_service = ConversationService(db)
    return _conversation_service

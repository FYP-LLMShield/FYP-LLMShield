"""
User Memory Service for storing and extracting personal information
"""

import logging
import re
from datetime import datetime
from typing import Dict, Optional, List, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.user_memory import (
    UserMemoryInDB,
    UserMemoryResponse,
    MemoryItem
)

logger = logging.getLogger(__name__)


class UserMemoryService:
    """Service for managing user long-term memory"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["user_memories"]

    # Memory extraction patterns
    MEMORY_PATTERNS = {
        "name": [
            r"(?:my name is|call me|i'm|im|i am|you can call me)\s+([a-zA-Z\s]+?)(?:\s|\.|\,|$)",
            r"(?:name's?|name is)\s+([a-zA-Z\s]+?)(?:\s|\.|\,|$)",
        ],
        "favorite_color": [
            r"(?:my )?(?:favorite|fav)\s+color\s+(?:is\s+)?(\w+)",
            r"(?:my favorite color is|favorite color is)\s+(\w+)",
            r"i (?:like|prefer|love)\s+(?:the color\s+)?(\w+)(?:\s+color)?",
        ],
        "favorite_food": [
            r"(?:my favorite food is|favorite food|i like|love)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
            r"(?:my )?(?:favorite|fav)\s+(?:food|dish)\s+(?:is\s+)?([a-zA-Z\s]+?)(?:\.|,|$)",
        ],
        "occupation": [
            r"(?:i'm|im|i am)\s+a\s+([a-zA-Z\s]+?)(?:\.|,|$)",
            r"(?:i work as|i'm a|i'm an)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
            r"(?:my job is|occupation is)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
        ],
        "hobby": [
            r"(?:my hobby is|hobby|i enjoy|i like|i love)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
            r"(?:in my free time|i enjoy)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
        ],
        "location": [
            r"(?:i'm from|i'm in|i live in|from|i'm located in)\s+([a-zA-Z\s]+?)(?:\.|,|$)",
            r"(?:location|city|country)\s+(?:is\s+)?([a-zA-Z\s]+?)(?:\.|,|$)",
        ],
        "remember": [
            r"(?:remember|remember that|remember to remember)\s+(.+?)(?:\.|,|$)",
            r"(?:please remember|can you remember)\s+(.+?)(?:\.|,|$)",
        ],
        "note": [
            r"(?:note|note that|save|save that|please save)\s+(.+?)(?:\.|,|$)",
            r"(?:write down|make a note)\s+(.+?)(?:\.|,|$)",
        ],
        "order": [
            r"(?:order|i want|i need|can i get|can you order)\s+(.+?)(?:\.|,|$)",
            r"(?:order me|get me|bring me)\s+(.+?)(?:\.|,|$)",
        ],
    }

    async def get_or_create_memory(self, user_id: str) -> UserMemoryResponse:
        """Get or create user memory"""
        try:
            memory = await self.collection.find_one({"user_id": user_id})

            if not memory:
                # Create new memory document
                memory_doc = {
                    "user_id": user_id,
                    "memories": {},
                    "last_updated": datetime.utcnow()
                }
                result = await self.collection.insert_one(memory_doc)
                memory_doc["_id"] = result.inserted_id
                logger.info(f"Created memory for user {user_id}")

            return self._to_response(memory)
        except Exception as e:
            logger.error(f"Failed to get/create memory: {e}")
            raise

    async def extract_and_save_memories(
        self,
        user_id: str,
        text: str,
        source: str = "conversation"
    ) -> List[Tuple[str, str]]:
        """Extract personal information from text and save to memory"""
        try:
            extracted = self._extract_memories(text)

            if not extracted:
                return []

            # Update memories in database
            memory = await self.collection.find_one({"user_id": user_id})

            if not memory:
                await self.get_or_create_memory(user_id)
                memory = await self.collection.find_one({"user_id": user_id})

            # Add/update memories
            updates = {}
            for key, value in extracted:
                updates[f"memories.{key}"] = MemoryItem(
                    key=key,
                    value=value,
                    source=source,
                    learned_at=datetime.utcnow()
                ).dict()

            updates["last_updated"] = datetime.utcnow()

            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": updates}
            )

            logger.info(f"Extracted and saved {len(extracted)} memories for user {user_id}")
            return extracted

        except Exception as e:
            logger.error(f"Failed to extract/save memories: {e}")
            return []

    async def get_user_memories(self, user_id: str) -> Dict[str, str]:
        """Get all user memories as a simple dict"""
        try:
            memory = await self.collection.find_one({"user_id": user_id})

            if not memory:
                return {}

            # Convert to simple dict format
            result = {}
            for key, item in memory.get("memories", {}).items():
                if isinstance(item, dict):
                    result[key] = item.get("value", "")
                else:
                    result[key] = str(item)

            return result
        except Exception as e:
            logger.error(f"Failed to get user memories: {e}")
            return {}

    async def add_memory(
        self,
        user_id: str,
        key: str,
        value: str,
        source: str = "manual"
    ) -> Optional[UserMemoryResponse]:
        """Manually add a memory"""
        try:
            memory = await self.collection.find_one({"user_id": user_id})

            if not memory:
                await self.get_or_create_memory(user_id)

            await self.collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        f"memories.{key}": MemoryItem(
                            key=key,
                            value=value,
                            source=source,
                            learned_at=datetime.utcnow()
                        ).dict(),
                        "last_updated": datetime.utcnow()
                    }
                }
            )

            logger.info(f"Added memory '{key}' for user {user_id}")
            memory = await self.collection.find_one({"user_id": user_id})
            return self._to_response(memory)

        except Exception as e:
            logger.error(f"Failed to add memory: {e}")
            raise

    async def delete_memory(self, user_id: str, key: str) -> bool:
        """Delete a specific memory"""
        try:
            result = await self.collection.update_one(
                {"user_id": user_id},
                {
                    "$unset": {f"memories.{key}": 1},
                    "$set": {"last_updated": datetime.utcnow()}
                }
            )

            logger.info(f"Deleted memory '{key}' for user {user_id}")
            return result.modified_count > 0

        except Exception as e:
            logger.error(f"Failed to delete memory: {e}")
            raise

    def _extract_memories(self, text: str) -> List[Tuple[str, str]]:
        """Extract memories from text using regex patterns"""
        extracted = []
        text_lower = text.lower()
        logger.debug(f"🔍 Extracting memories from: '{text}'")

        for key, patterns in self.MEMORY_PATTERNS.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text_lower, re.IGNORECASE)
                for match in matches:
                    if match.groups():
                        value = match.group(1).strip()
                        if value and len(value) > 1:
                            logger.info(f"✅ Extracted {key}: {value}")
                            extracted.append((key, value))
                            break

            if any(k == key for k, v in extracted):
                break

        if not extracted:
            logger.debug(f"⚠️ No memories extracted from text")
        return extracted

    def _to_response(self, memory: dict) -> UserMemoryResponse:
        """Convert database document to response"""
        memories = {}
        for key, item in memory.get("memories", {}).items():
            if isinstance(item, dict):
                memories[key] = MemoryItem(**item)
            else:
                memories[key] = item

        return UserMemoryResponse(
            id=str(memory.get("_id")),
            user_id=memory.get("user_id"),
            memories=memories,
            last_updated=memory.get("last_updated")
        )

    def format_memories_for_prompt(self, memories: Dict[str, str]) -> str:
        """Format memories for inclusion in system prompt"""
        if not memories:
            return ""

        lines = ["Known about user:"]
        for key, value in memories.items():
            lines.append(f"- {key.replace('_', ' ').title()}: {value}")

        return "\n".join(lines)


# Global instance
_memory_service: Optional[UserMemoryService] = None


def get_memory_service(db: Optional[AsyncIOMotorDatabase] = None) -> UserMemoryService:
    """Get or create memory service"""
    global _memory_service
    if _memory_service is None and db is not None:
        _memory_service = UserMemoryService(db)
    return _memory_service

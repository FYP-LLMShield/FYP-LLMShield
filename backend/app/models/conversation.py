"""
Chat Conversation Model for storing user conversations
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class MessageInDB(BaseModel):
    """Message in a conversation"""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class ConversationInDB(BaseModel):
    """Conversation document in MongoDB"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="User ID (email)")
    title: str = Field(..., description="Conversation title/name")
    messages: List[MessageInDB] = Field(default_factory=list, description="List of messages")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "user_id": "user@example.com",
                "title": "FYP Project Discussion",
                "messages": [
                    {"role": "user", "content": "What is the FYP?"},
                    {"role": "assistant", "content": "The FYP is..."}
                ],
                "created_at": "2025-02-15T00:00:00",
                "updated_at": "2025-02-15T00:10:00"
            }
        }


class ConversationResponse(BaseModel):
    """Response model for conversation"""
    id: str = Field(..., description="Conversation ID")
    user_id: str = Field(..., description="User ID")
    title: str = Field(..., description="Conversation title")
    messages: List[MessageInDB] = Field(..., description="Messages")
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "user_id": "user@example.com",
                "title": "FYP Project Discussion",
                "messages": [],
                "created_at": "2025-02-15T00:00:00",
                "updated_at": "2025-02-15T00:10:00"
            }
        }


class ConversationListItem(BaseModel):
    """Lightweight conversation item for list"""
    id: str = Field(..., description="Conversation ID")
    title: str = Field(..., description="Conversation title")
    created_at: datetime
    updated_at: datetime
    message_count: int = Field(default=0, description="Number of messages")


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation"""
    title: Optional[str] = Field(None, description="Optional title (auto-generated if not provided)")


class UpdateConversationRequest(BaseModel):
    """Request to update conversation title"""
    title: str = Field(..., description="New conversation title")


class AddMessageRequest(BaseModel):
    """Request to add a message to conversation"""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")

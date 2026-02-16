"""
Chatbot Models for RAG-based LLM assistant
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sources: List[str] = Field(default_factory=list, description="References to scan_ids used")


class ChatSession(BaseModel):
    """Chat session metadata"""
    session_id: str = Field(..., description="Unique session ID")
    user_id: str = Field(..., description="User email")
    started_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    message_count: int = Field(default=0)
    context_scan_id: Optional[str] = Field(None, description="Which scan this session is about")


class UserChatPreferences(BaseModel):
    """User profile memory - persists across sessions"""
    user_id: str = Field(..., description="User email")
    preferred_name: Optional[str] = Field(None, description="What to call user by")
    language_preference: Optional[str] = Field(None, description="urdu, english, or mixed")
    expertise_level: Optional[str] = Field(None, description="beginner, intermediate, or expert")
    custom_facts: List[str] = Field(default_factory=list, description="Facts user shared")
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    """Chat API request"""
    message: str = Field(..., description="User's message")
    session_id: Optional[str] = Field(None, description="Session ID (new if not provided)")
    scan_id: Optional[str] = Field(None, description="Optional context: which scan to reference")


class ChatResponse(BaseModel):
    """Chat API response"""
    session_id: str = Field(..., description="Session ID")
    response: str = Field(..., description="Assistant's response")
    sources: List[str] = Field(default_factory=list, description="Which scan results were referenced")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatHistoryItem(BaseModel):
    """Item in chat history"""
    role: str
    content: str
    timestamp: datetime
    sources: List[str] = Field(default_factory=list)


class SessionListResponse(BaseModel):
    """List of user's chat sessions"""
    sessions: List[Dict[str, Any]] = Field(default_factory=list)
    total: int = Field(default=0)

"""
User Memory Model for storing personal information across conversations
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class MemoryItem(BaseModel):
    """Single memory item"""
    key: str = Field(..., description="Memory key (e.g., 'name', 'favorite_color')")
    value: str = Field(..., description="Memory value (e.g., 'Ghost', 'blue')")
    source: str = Field(..., description="Where this was learned from")
    learned_at: datetime = Field(default_factory=datetime.utcnow)


class UserMemoryInDB(BaseModel):
    """User memory document in MongoDB"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="User ID (email)")
    memories: Dict[str, MemoryItem] = Field(default_factory=dict, description="User memories")
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class UserMemoryResponse(BaseModel):
    """Response model for user memory"""
    id: str = Field(..., description="Memory ID")
    user_id: str = Field(..., description="User ID")
    memories: Dict[str, MemoryItem] = Field(..., description="User memories")
    last_updated: datetime


class AddMemoryRequest(BaseModel):
    """Request to add a memory"""
    key: str = Field(..., description="Memory key (e.g., 'name', 'favorite_color')")
    value: str = Field(..., description="Memory value")
    source: str = Field(..., description="Where this memory came from")


class UpdateMemoryRequest(BaseModel):
    """Request to update a memory"""
    value: str = Field(..., description="New memory value")

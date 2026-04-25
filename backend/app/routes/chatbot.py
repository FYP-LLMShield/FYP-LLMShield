"""
RAG Chatbot API Routes
Simple chat endpoint using Qdrant + Groq for Q&A with conversation history
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from app.services.chatbot_service import get_chatbot_service
from app.services.conversation_service import ConversationService
from app.services.user_memory_service import get_memory_service
from app.services.pdf_service import PDFService
from qdrant_client.http import models
from app.models.conversation import (
    ConversationResponse,
    ConversationListItem,
    CreateConversationRequest,
    UpdateConversationRequest
)
from app.models.user_memory import UserMemoryResponse, AddMemoryRequest
from app.core.database import get_database, mongodb

logger = logging.getLogger(__name__)
router = APIRouter()

# Optional auth for development
security = HTTPBearer(auto_error=False)


def get_user_id_from_token(credentials: Optional[HTTPAuthorizationCredentials]) -> str:
    """Extract user ID from token"""
    if not credentials or not credentials.credentials:
        return "anonymous_user"

    try:
        # Try to decode JWT token to get user ID
        from jose import jwt
        from app.core.config import settings

        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub") or payload.get("email") or "anonymous_user"
        return user_id
    except Exception as e:
        logger.warning(f"Failed to extract user ID from token: {e}")
        return "anonymous_user"


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Chat request with message and history"""
    message: str = Field(..., description="User message")
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous conversation messages"
    )


class ContextChunk(BaseModel):
    """Retrieved context chunk"""
    text: str
    score: float
    doc_name: str
    source: str


class ChatResponse(BaseModel):
    """Chat response with answer and context"""
    response: str = Field(..., description="Generated response")
    contexts: List[ContextChunk] = Field(default=[], description="Retrieved context chunks")
    success: bool = Field(default=True, description="Whether the request was successful")
    memories_saved: List[Dict[str, str]] = Field(default=[], description="Newly saved memories")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    RAG Chatbot endpoint

    Retrieves relevant context from knowledge base and generates response using Groq

    Args:
        request: Chat request with message and optional history
        credentials: Optional authentication token

    Returns:
        ChatResponse with generated answer and source chunks
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # Get user ID from token
        user_id = get_user_id_from_token(credentials)

        # Get chatbot service with database
        try:
            db = mongodb.database
            chatbot = get_chatbot_service(db)
        except Exception as e:
            logger.error(f"❌ Failed to get chatbot service: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Service initialization failed: {str(e)}")

        # Convert history format
        history = None
        if request.history:
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.history
            ]

        # Get response from chatbot with user_id for memory tracking
        result = await chatbot.chat(request.message, history, user_id)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["response"])

        # Convert contexts to response model
        contexts = [
            ContextChunk(
                text=ctx["text"],
                score=ctx["score"],
                doc_name=ctx["doc_name"],
                source=ctx["source"]
            )
            for ctx in result["contexts"]
        ]

        # Convert extracted memories to list of dicts for response
        memories_saved = []
        if "extracted_memories" in result and result["extracted_memories"]:
            for key, value in result["extracted_memories"]:
                memories_saved.append({
                    "type": key.replace('_', ' ').title(),
                    "value": value
                })

        logger.info(f"✅ Chat successful")

        return ChatResponse(
            response=result["response"],
            contexts=contexts,
            success=True,
            memories_saved=memories_saved
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ==================== PDF Upload Endpoints ====================

@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Upload a PDF file for RAG processing

    Args:
        file: PDF file to upload
        credentials: Optional authentication token

    Returns:
        Processing results with chunks
    """
    try:
        user_id = get_user_id_from_token(credentials)

        # Validate file type
        if file.content_type not in ["application/pdf", "application/octet-stream"]:
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed"
            )

        if not file.filename or not file.filename.endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="File must be a PDF"
            )

        # Read file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="File is empty"
            )

        # Process PDF
        db = mongodb.database
        pdf_service = PDFService(db)

        result = await pdf_service.process_pdf(
            file_content,
            file.filename,
            user_id
        )

        if result["success"]:
            logger.info(f"✅ PDF uploaded: {file.filename} - {result['total_chunks']} chunks")

            # Now add chunks to Qdrant for RAG
            try:
                chatbot = get_chatbot_service(db)
                added_count = 0

                for chunk in result["chunks"]:
                    try:
                        # Create a point in Qdrant with PDF chunk
                        embedding = chatbot.embed_query(chunk["text"])

                        # Store in Qdrant with metadata
                        from qdrant_client.http import models
                        point = models.PointStruct(
                            id=hash(f"{file.filename}_{chunk['chunk_id']}") % (2**63),
                            vector=embedding,
                            payload={
                                "text": chunk["text"],
                                "filename": chunk["filename"],
                                "page": chunk["page"],
                                "chunk_id": chunk["chunk_id"],
                                "user_id": user_id,
                                "source": "pdf"
                            }
                        )

                        chatbot.qdrant_client.upsert(
                            collection_name=chatbot.collection_name,
                            points=[point]
                        )
                        added_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to add chunk to Qdrant: {e}")

                logger.info(f"📦 Added {added_count} chunks to Qdrant")

            except Exception as e:
                logger.warning(f"⚠️ Failed to add chunks to Qdrant: {e}")
                # Don't fail the upload if Qdrant fails

            return {
                "success": True,
                "message": f"PDF uploaded successfully",
                "filename": result["filename"],
                "total_chunks": result["total_chunks"],
                "total_pages": result["total_pages"],
                "pdf_id": str(result["metadata"].get("_id", ""))
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to process PDF"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ PDF upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF upload failed: {str(e)}")


@router.get("/pdfs")
async def get_user_pdfs(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get all PDFs uploaded by user"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        pdf_service = PDFService(db)

        pdfs = await pdf_service.get_user_pdfs(user_id)
        logger.info(f"✅ Retrieved {len(pdfs)} PDFs for user {user_id}")

        return {
            "success": True,
            "pdfs": pdfs
        }
    except Exception as e:
        logger.error(f"❌ Failed to get PDFs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-pdf/{pdf_id}")
async def delete_pdf(
    pdf_id: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Delete a PDF and all its chunks from Qdrant

    Args:
        pdf_id: PDF document ID
        credentials: Optional authentication token

    Returns:
        Success message
    """
    try:
        from bson import ObjectId

        user_id = get_user_id_from_token(credentials)
        db = mongodb.database

        # Convert string ID to ObjectId
        try:
            pdf_id_obj = ObjectId(pdf_id)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF ID format"
            )

        # Get PDF metadata
        pdf_metadata = await db["pdf_documents"].find_one({"_id": pdf_id_obj})
        if not pdf_metadata:
            raise HTTPException(
                status_code=404,
                detail="PDF not found"
            )

        # Verify ownership
        if pdf_metadata.get("user_id") != user_id:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized - this PDF belongs to another user"
            )

        filename = pdf_metadata.get("filename", "Unknown")
        total_chunks = pdf_metadata.get("total_chunks", 0)

        # Delete from Qdrant
        try:
            chatbot = get_chatbot_service(db)

            # Delete all chunks belonging to this PDF from Qdrant
            # We use a filter to delete chunks with matching filename and user_id
            chatbot.qdrant_client.delete(
                collection_name=chatbot.collection_name,
                points_selector=models.HasIdCondition(
                    has_id=[
                        hash(f"{filename}_{i}") % (2**63)
                        for i in range(total_chunks)
                    ]
                )
            )
            logger.info(f"📦 Deleted {total_chunks} chunks from Qdrant")
        except Exception as e:
            logger.warning(f"⚠️ Failed to delete chunks from Qdrant: {e}")
            # Continue with MongoDB deletion even if Qdrant fails

        # Delete from MongoDB
        result = await db["pdf_documents"].delete_one({"_id": pdf_id_obj})

        if result.deleted_count > 0:
            logger.info(f"✅ Deleted PDF: {filename} ({total_chunks} chunks)")
            return {
                "success": True,
                "message": f"PDF '{filename}' deleted successfully",
                "chunks_removed": total_chunks
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete PDF from database"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF deletion failed: {str(e)}")


# ==================== Conversation History Endpoints ====================

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    request: CreateConversationRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Create a new conversation"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        conversation = await service.create_conversation(user_id, request.title)
        logger.info(f"✅ Created conversation for user {user_id}")
        return conversation
    except Exception as e:
        logger.error(f"❌ Failed to create conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=List[ConversationListItem])
async def get_conversations(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get all conversations for user"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        conversations = await service.get_user_conversations(user_id)
        logger.info(f"✅ Retrieved {len(conversations)} conversations for user {user_id}")
        return conversations
    except Exception as e:
        logger.error(f"❌ Failed to get conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get a specific conversation"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        conversation = await service.get_conversation(conversation_id, user_id)

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationResponse)
async def add_message_to_conversation(
    conversation_id: str,
    role: str = "user",
    content: str = "",
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Add a message to conversation"""
    try:
        if not content:
            raise HTTPException(status_code=400, detail="Content cannot be empty")

        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        conversation = await service.add_message(conversation_id, user_id, role, content)
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to add message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Update conversation title"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        conversation = await service.update_conversation_title(conversation_id, user_id, request.title)
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Delete a conversation"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        service = ConversationService(db)
        success = await service.delete_conversation(conversation_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return {"success": True, "message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== User Memory Endpoints ====================


@router.get("/memories", response_model=UserMemoryResponse)
async def get_user_memories(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Get user's stored memories"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        memory_service = get_memory_service(db)
        memory = await memory_service.get_or_create_memory(user_id)
        logger.info(f"✅ Retrieved memories for user {user_id}")
        return memory
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get user memories: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories", response_model=UserMemoryResponse)
async def add_user_memory(
    request: AddMemoryRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Manually add a memory for user"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        memory_service = get_memory_service(db)
        memory = await memory_service.add_memory(
            user_id,
            request.key,
            request.value,
            request.source
        )
        logger.info(f"✅ Added memory '{request.key}' for user {user_id}")
        return memory
    except Exception as e:
        logger.error(f"❌ Failed to add memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/memories/{memory_key}")
async def delete_user_memory(
    memory_key: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Delete a specific memory"""
    try:
        user_id = get_user_id_from_token(credentials)
        db = mongodb.database
        memory_service = get_memory_service(db)
        success = await memory_service.delete_memory(user_id, memory_key)

        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")

        logger.info(f"✅ Deleted memory '{memory_key}' for user {user_id}")
        return {"success": True, "message": f"Memory '{memory_key}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

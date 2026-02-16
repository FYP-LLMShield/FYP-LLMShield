"""
Chatbot Routes - API endpoints for RAG chatbot
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from app.models.chatbot import (
    ChatRequest,
    ChatResponse,
    SessionListResponse,
    ChatMessage
)
from app.services.chatbot_service import get_chatbot_service
from app.services.chat_storage_service import ChatStorageService
from app.services.qdrant_service import get_qdrant_service
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chatbot"])


@router.post("/chat", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a message and get response from RAG chatbot

    The chatbot:
    - Searches for relevant scan results (Qdrant)
    - Retrieves similar past Q&As
    - Uses short-term memory (last 10 messages)
    - Calls Groq API for response
    - Stores message in MongoDB + Qdrant
    """
    try:
        user_id = current_user.get("email")
        if not user_id:
            raise HTTPException(status_code=401, detail="User email not found")

        logger.info(f"💬 Chat request from {user_id}")

        # Get user preferences
        storage = ChatStorageService()
        user_prefs = await storage.get_user_preferences(user_id)

        # Get chatbot service and run RAG pipeline
        chatbot = get_chatbot_service()
        result = await chatbot.chat(
            user_id=user_id,
            message=request.message,
            session_id=request.session_id,
            scan_id=request.scan_id,
            user_prefs=user_prefs
        )

        # Store message in MongoDB
        session_id = result["session_id"]

        # Create session if new
        if not request.session_id:
            await storage.create_session(
                user_id=user_id,
                session_id=session_id,
                scan_id=request.scan_id
            )

        # Store user message
        await storage.store_message(
            user_id=user_id,
            session_id=session_id,
            role="user",
            content=request.message,
            sources=[]
        )

        # Store assistant message
        await storage.store_message(
            user_id=user_id,
            session_id=session_id,
            role="assistant",
            content=result["response"],
            sources=result["sources"]
        )

        # Store in Qdrant for long-term memory (similar Q&As)
        try:
            qdrant = get_qdrant_service()
            qdrant.upsert_chat_memory(
                user_id=user_id,
                session_id=session_id,
                question=request.message,
                answer=result["response"]
            )
        except Exception as e:
            logger.warning(f"⚠️ Could not store in Qdrant: {e}")

        # Update user preferences if detected
        if result.get("detected_preferences"):
            await storage.update_user_preferences(
                user_id=user_id,
                preferences=result["detected_preferences"]
            )

        return ChatResponse(
            session_id=session_id,
            response=result["response"],
            sources=result["sources"]
        )

    except Exception as e:
        logger.error(f"❌ Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/session")
async def create_session(
    scan_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat session"""
    try:
        user_id = current_user.get("email")
        import uuid
        session_id = str(uuid.uuid4())

        storage = ChatStorageService()
        session = await storage.create_session(
            user_id=user_id,
            session_id=session_id,
            scan_id=scan_id
        )

        return {
            "session_id": session_id,
            "started_at": session["started_at"].isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions", response_model=SessionListResponse)
async def list_sessions(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get list of user's chat sessions"""
    try:
        user_id = current_user.get("email")

        storage = ChatStorageService()
        sessions, total = await storage.list_user_sessions(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        return SessionListResponse(
            sessions=sessions,
            total=total,
            limit=limit,
            offset=offset
        )

    except Exception as e:
        logger.error(f"❌ List sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/history/{session_id}")
async def get_session_history(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get full conversation history of a session"""
    try:
        user_id = current_user.get("email")

        storage = ChatStorageService()
        messages = await storage.get_session_history(
            user_id=user_id,
            session_id=session_id
        )

        return {
            "session_id": session_id,
            "messages": messages,
            "total": len(messages)
        }

    except Exception as e:
        logger.error(f"❌ Get history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/chat/session/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chat session"""
    try:
        user_id = current_user.get("email")

        storage = ChatStorageService()
        await storage.delete_session(
            user_id=user_id,
            session_id=session_id
        )

        # Also clear from short-term memory
        chatbot = get_chatbot_service()
        chatbot.clear_session(session_id)

        return {"message": f"Session {session_id} deleted"}

    except Exception as e:
        logger.error(f"❌ Delete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's chat preferences"""
    try:
        user_id = current_user.get("email")

        storage = ChatStorageService()
        prefs = await storage.get_user_preferences(user_id)

        return prefs or {
            "user_id": user_id,
            "preferred_name": None,
            "language_preference": None,
            "expertise_level": None,
            "custom_facts": []
        }

    except Exception as e:
        logger.error(f"❌ Get preferences error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/embed-scan")
async def embed_scan_result(
    scan_id: str,
    scan_type: str,
    findings: list,
    current_user: dict = Depends(get_current_user)
):
    """
    Called when a scan completes to embed findings in Qdrant

    Args:
        scan_id: Scan identifier
        scan_type: Type of scan (model_poisoning, dataset_poisoning, etc.)
        findings: List of finding chunks to embed
    """
    try:
        user_id = current_user.get("email")

        # Convert findings to chunks
        chunks = []
        for finding in findings:
            if isinstance(finding, str):
                chunks.append({
                    "text": finding,
                    "chunk_type": "finding"
                })
            elif isinstance(finding, dict):
                chunks.append({
                    "text": finding.get("text", str(finding)),
                    "chunk_type": finding.get("type", "finding")
                })

        # Embed in Qdrant
        qdrant = get_qdrant_service()
        point_ids = qdrant.upsert_scan_embeddings(
            user_id=user_id,
            scan_id=scan_id,
            scan_type=scan_type,
            chunks=chunks
        )

        logger.info(f"✅ Embedded {len(point_ids)} chunks for scan {scan_id}")

        return {
            "scan_id": scan_id,
            "points_stored": len(point_ids),
            "message": "Scan results embedded successfully"
        }

    except Exception as e:
        logger.error(f"❌ Embed scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/clear-all")
async def clear_all_user_data(current_user: dict = Depends(get_current_user)):
    """
    DELETE ALL user's chat data (GDPR compliance)
    This includes MongoDB chat history + Qdrant embeddings
    """
    try:
        user_id = current_user.get("email")
        logger.warning(f"🗑️ Clearing ALL chat data for {user_id}")

        # Clear from MongoDB
        storage = ChatStorageService()
        await storage.delete_all_user_data(user_id)

        # Clear from Qdrant
        qdrant = get_qdrant_service()
        qdrant.delete_user_data(user_id)

        # Clear from short-term memory
        chatbot = get_chatbot_service()
        for session_id in list(chatbot.short_term_memory.keys()):
            if any(
                msg.get("user_id") == user_id
                for msg in chatbot.short_term_memory[session_id]
            ):
                chatbot.clear_session(session_id)

        return {"message": "All chat data cleared"}

    except Exception as e:
        logger.error(f"❌ Clear data error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

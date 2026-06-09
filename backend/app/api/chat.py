import json
import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.models.document import Document
from app.schemas.conversation import ChatRequest, ChatResponse, ConversationHistory, SourceReference
from app.core.security import get_current_user
from app.services.vector_store import vector_store
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ask a question about uploaded documents."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Validate requested document IDs belong to user
    if request.document_ids:
        valid_docs = (
            db.query(Document)
            .filter(
                Document.id.in_(request.document_ids),
                Document.owner_id == current_user.id,
                Document.status == "ready",
            )
            .all()
        )
        if not valid_docs:
            raise HTTPException(status_code=400, detail="No valid documents found")

    # Search vector store
    search_results = vector_store.search(
        user_id=current_user.id,
        query=request.question,
        n_results=5,
        document_ids=request.document_ids,
    )

    # Generate answer
    ai_response = await ai_service.answer_question(
        question=request.question,
        search_results=search_results,
    )

    # Build source references
    sources = [
        {
            "document_id": r["document_id"],
            "document_name": r["document_name"],
            "chunk_text": r["chunk_text"][:300],  # Truncate for storage
            "relevance_score": r["relevance_score"],
        }
        for r in search_results[:3]  # Top 3 sources
    ]

    # Save conversation
    conversation = Conversation(
        user_id=current_user.id,
        question=request.question,
        answer=ai_response["answer"],
        sources=sources,
        model_used=ai_response.get("model"),
        tokens_used=ai_response.get("tokens_used"),
        response_time_ms=ai_response.get("response_time_ms"),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.post("/ask/stream")
async def ask_question_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ask a question with streaming response."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Search
    search_results = vector_store.search(
        user_id=current_user.id,
        query=request.question,
        n_results=5,
        document_ids=request.document_ids,
    )

    sources = [
        {
            "document_id": r["document_id"],
            "document_name": r["document_name"],
            "chunk_text": r["chunk_text"][:300],
            "relevance_score": r["relevance_score"],
        }
        for r in search_results[:3]
    ]

    full_answer = []
    start_time = time.time()

    async def generate():
        nonlocal full_answer

        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Stream answer
        async for token in ai_service.stream_answer(request.question, search_results):
            full_answer.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Save to DB
        answer_text = "".join(full_answer)
        response_time = int((time.time() - start_time) * 1000)

        conversation = Conversation(
            user_id=current_user.id,
            question=request.question,
            answer=answer_text,
            sources=sources,
            model_used="gpt-4o-mini",
            response_time_ms=response_time,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/history", response_model=ConversationHistory)
async def get_history(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get conversation history for current user."""
    offset = (page - 1) * limit
    total = db.query(Conversation).filter(Conversation.user_id == current_user.id).count()
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"conversations": conversations, "total": total}


@router.delete("/history/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a conversation."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted", "id": conversation_id}

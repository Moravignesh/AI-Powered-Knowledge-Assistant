from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ChatRequest(BaseModel):
    question: str
    document_ids: Optional[List[int]] = None  # Filter by specific docs, or None for all


class SourceReference(BaseModel):
    document_id: int
    document_name: str
    chunk_text: str
    relevance_score: float


class ChatResponse(BaseModel):
    id: int
    question: str
    answer: str
    sources: Optional[List[SourceReference]]
    model_used: Optional[str]
    tokens_used: Optional[int]
    response_time_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationHistory(BaseModel):
    conversations: List[ChatResponse]
    total: int

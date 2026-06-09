from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.conversation import Conversation
from app.core.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("")
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get analytics dashboard data."""
    # User's own stats
    user_docs = db.query(func.count(Document.id)).filter(Document.owner_id == current_user.id).scalar()
    user_questions = db.query(func.count(Conversation.id)).filter(Conversation.user_id == current_user.id).scalar()

    # Recent conversations
    recent_conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(desc(Conversation.created_at))
        .limit(5)
        .all()
    )

    # Document breakdown by type
    doc_by_type = (
        db.query(Document.file_type, func.count(Document.id).label("count"))
        .filter(Document.owner_id == current_user.id)
        .group_by(Document.file_type)
        .all()
    )

    # Global stats (admin view)
    total_users = db.query(func.count(User.id)).scalar()
    total_docs_global = db.query(func.count(Document.id)).scalar()
    total_questions_global = db.query(func.count(Conversation.id)).scalar()

    # Most active users
    active_users = (
        db.query(
            User.username,
            func.count(Conversation.id).label("question_count"),
        )
        .join(Conversation, Conversation.user_id == User.id)
        .group_by(User.id, User.username)
        .order_by(desc("question_count"))
        .limit(5)
        .all()
    )

    # Average response time
    avg_response = (
        db.query(func.avg(Conversation.response_time_ms))
        .filter(Conversation.user_id == current_user.id)
        .scalar()
    )

    return {
        "user_stats": {
            "total_documents": user_docs,
            "total_questions": user_questions,
            "avg_response_time_ms": round(avg_response or 0, 2),
        },
        "recent_conversations": [
            {
                "id": c.id,
                "question": c.question[:100],
                "created_at": c.created_at.isoformat(),
            }
            for c in recent_conversations
        ],
        "documents_by_type": {row.file_type: row.count for row in doc_by_type},
        "global_stats": {
            "total_users": total_users,
            "total_documents": total_docs_global,
            "total_questions": total_questions_global,
        },
        "most_active_users": [
            {"username": row.username, "question_count": row.question_count}
            for row in active_users
        ],
    }

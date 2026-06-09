import os
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.core.security import get_current_user
from app.core.config import settings
from app.services.document_processor import extract_text, chunk_text
from app.services.vector_store import vector_store
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def process_document_background(document_id: int, file_path: str, file_type: str, db_url: str):
    """Background task: extract text, chunk it, index in ChromaDB."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        # Step 1: Extract text from file
        logger.info(f"Extracting text from document {document_id} ({file_type})")
        text = extract_text(file_path, file_type)

        if not text or len(text.strip()) < 10:
            doc.status = "error"
            doc.error_message = "Could not extract readable text from this document. If it's a scanned PDF, ensure Tesseract OCR is installed."
            db.commit()
            return

        # Step 2: Save extracted text
        doc.content_text = text[:16000000]  # MySQL MEDIUMTEXT limit

        # Step 3: Chunk text
        chunks = chunk_text(text)
        logger.info(f"Document {document_id}: {len(chunks)} chunks created")

        if not chunks:
            doc.status = "error"
            doc.error_message = "Document text too short to process."
            db.commit()
            return

        # Step 4: Index in ChromaDB (uses local embeddings — no API key needed)
        chunk_count = vector_store.add_document_chunks(
            user_id=doc.owner_id,
            document_id=doc.id,
            document_name=doc.original_filename,
            chunks=chunks,
        )

        doc.chunk_count = chunk_count
        doc.status = "ready"
        db.commit()
        logger.info(f"Document {document_id} ready: {chunk_count} chunks indexed")

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}")
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                error_msg = str(e)
                # Give a friendlier message for common errors
                if "401" in error_msg or "api_key" in error_msg.lower():
                    error_msg = "API key error during embedding. Check your OPENAI_API_KEY in .env"
                elif "memory" in error_msg.lower():
                    error_msg = "File too large to process in memory. Try a smaller file."
                doc.status = "error"
                doc.error_message = error_msg[:490]
                db.commit()
        except Exception as inner_e:
            logger.error(f"Could not update error status: {inner_e}")
    finally:
        db.close()
        engine.dispose()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document (PDF, DOCX, or TXT). Processing happens in the background."""
    # Validate file extension
    ext = get_file_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT",
        )

    file_type = ext.lstrip(".")

    # Read and size-check
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {settings.MAX_FILE_SIZE_MB}MB.",
        )

    # Save file to disk
    unique_name = f"{uuid.uuid4()}{ext}"
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    file_path = os.path.join(user_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record with status=processing
    document = Document(
        filename=unique_name,
        original_filename=file.filename,
        file_type=file_type,
        file_size=len(content),
        file_path=file_path,
        status="processing",
        owner_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Kick off background processing
    background_tasks.add_task(
        process_document_background,
        document.id,
        file_path,
        file_type,
        settings.DATABASE_URL,
    )

    return document


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all documents belonging to the current user."""
    documents = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return {"documents": documents, "total": len(documents)}


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific document."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document, its file, and its vector embeddings."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from ChromaDB
    try:
        vector_store.delete_document(current_user.id, document_id)
    except Exception as e:
        logger.warning(f"Vector store delete failed: {e}")

    # Remove file from disk
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception as e:
        logger.warning(f"File delete failed: {e}")

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully", "id": document_id}


@router.get("/{document_id}/summarize")
async def summarize_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI summary of a document (requires OpenAI API key)."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail=f"Document is not ready (status: {doc.status})")
    if not doc.content_text:
        raise HTTPException(status_code=400, detail="No text content available for this document")

    summary = await ai_service.summarize_document(doc.content_text, doc.original_filename)
    return {
        "document_id": document_id,
        "document_name": doc.original_filename,
        "summary": summary,
    }

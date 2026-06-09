import logging
from typing import List, Dict, Any, Optional
import chromadb
from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """ChromaDB-based vector store using local sentence-transformers embeddings."""

    def __init__(self):
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self._embedding_fn = None

    def _get_embedding_fn(self):
        """Load local sentence-transformers embedding model (free, no API key needed)."""
        if self._embedding_fn is None:
            try:
                from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
                self._embedding_fn = SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
                logger.info("Using local SentenceTransformer embeddings (all-MiniLM-L6-v2)")
            except Exception as e:
                logger.error(f"Failed to load SentenceTransformer: {e}")
                self._embedding_fn = None
        return self._embedding_fn

    def _get_collection(self, user_id: int):
        """Get or create a ChromaDB collection for a user."""
        collection_name = f"user_{user_id}_docs"
        ef = self._get_embedding_fn()
        if ef:
            return self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=ef,
                metadata={"hnsw:space": "cosine"},
            )
        else:
            return self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )

    def add_document_chunks(
        self,
        user_id: int,
        document_id: int,
        document_name: str,
        chunks: List[str],
    ) -> int:
        """Add document chunks to the vector store."""
        try:
            collection = self._get_collection(user_id)

            # Remove existing chunks for this document first
            self.delete_document(user_id, document_id)

            if not chunks:
                return 0

            ids = [f"doc_{document_id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "document_id": document_id,
                    "document_name": document_name,
                    "chunk_index": i,
                    "user_id": user_id,
                }
                for i in range(len(chunks))
            ]

            # Batch insert to avoid memory issues with large docs
            batch_size = 50
            for i in range(0, len(chunks), batch_size):
                collection.add(
                    ids=ids[i: i + batch_size],
                    documents=chunks[i: i + batch_size],
                    metadatas=metadatas[i: i + batch_size],
                )

            logger.info(f"Added {len(chunks)} chunks for document {document_id}")
            return len(chunks)

        except Exception as e:
            logger.error(f"Error adding chunks to vector store: {e}")
            raise

    def search(
        self,
        user_id: int,
        query: str,
        n_results: int = 5,
        document_ids: Optional[List[int]] = None,
    ) -> List[Dict[str, Any]]:
        """Search for relevant chunks by semantic similarity."""
        try:
            collection = self._get_collection(user_id)
            count = collection.count()

            if count == 0:
                return []

            # ── FIXED: Correct ChromaDB where filter syntax ──────
            if document_ids and len(document_ids) > 0:
                if len(document_ids) == 1:
                    # Single document filter — use $eq operator
                    where_filter = {
                        "$and": [
                            {"user_id": {"$eq": user_id}},
                            {"document_id": {"$eq": document_ids[0]}},
                        ]
                    }
                else:
                    # Multiple documents — use $or with $eq for each
                    where_filter = {
                        "$and": [
                            {"user_id": {"$eq": user_id}},
                            {
                                "$or": [
                                    {"document_id": {"$eq": did}}
                                    for did in document_ids
                                ]
                            },
                        ]
                    }
            else:
                # No document filter — search all docs for this user
                where_filter = {"user_id": {"$eq": user_id}}
            # ─────────────────────────────────────────────────────

            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            output = []
            if results and results["documents"] and results["documents"][0]:
                for doc, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    output.append({
                        "chunk_text": doc,
                        "document_id": meta.get("document_id"),
                        "document_name": meta.get("document_name"),
                        "chunk_index": meta.get("chunk_index"),
                        "relevance_score": round(max(0.0, 1 - dist), 4),
                    })
            return output

        except Exception as e:
            logger.error(f"Vector search error: {e}")
            # Fallback: search without filter if filter fails
            try:
                logger.info("Retrying search without document filter...")
                results = collection.query(
                    query_texts=[query],
                    n_results=min(n_results, count),
                    include=["documents", "metadatas", "distances"],
                )
                output = []
                if results and results["documents"] and results["documents"][0]:
                    for doc, meta, dist in zip(
                        results["documents"][0],
                        results["metadatas"][0],
                        results["distances"][0],
                    ):
                        # Manually filter by document_ids if needed
                        doc_id = meta.get("document_id")
                        if document_ids and doc_id not in document_ids:
                            continue
                        if meta.get("user_id") != user_id:
                            continue
                        output.append({
                            "chunk_text": doc,
                            "document_id": doc_id,
                            "document_name": meta.get("document_name"),
                            "chunk_index": meta.get("chunk_index"),
                            "relevance_score": round(max(0.0, 1 - dist), 4),
                        })
                return output
            except Exception as e2:
                logger.error(f"Fallback search also failed: {e2}")
                return []

    def delete_document(self, user_id: int, document_id: int):
        """Remove all chunks for a specific document."""
        try:
            collection = self._get_collection(user_id)
            results = collection.get(where={"document_id": document_id})
            if results and results["ids"]:
                collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for document {document_id}")
        except Exception as e:
            logger.warning(f"Could not delete document chunks: {e}")


vector_store = VectorStoreService()
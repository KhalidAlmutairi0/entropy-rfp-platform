"""Celery tasks for knowledge base document indexing."""

import asyncio

import structlog

from core.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(bind=True, name="tasks.indexing_tasks.index_knowledge_doc_task", max_retries=3)
def index_knowledge_doc_task(self, doc_id: str) -> dict:
    """Index a knowledge base document into Qdrant."""
    return asyncio.run(_index_doc_async(doc_id))


async def _index_doc_async(doc_id: str) -> dict:
    from datetime import UTC, datetime
    from core.database import AsyncSessionLocal
    from models.knowledge_doc import KnowledgeDoc
    from services.storage import StorageService
    from services.vector_store import VectorStoreService, COLLECTIONS
    from sqlalchemy import select
    from tasks.ingestion_tasks import _extract_text, _chunk_text, _embed_chunks

    storage = StorageService.get_instance()
    vector_store = VectorStoreService.get_instance()

    async with AsyncSessionLocal() as db:
        doc = (await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.id == doc_id))).scalar_one_or_none()
        if not doc:
            logger.error("Knowledge doc not found", doc_id=doc_id)
            return {"error": "Document not found"}

        try:
            content = await storage.download_file(doc.storage_path)
            text = await _extract_text(content, "application/pdf", doc.storage_path)
            chunks = _chunk_text(text, doc_id, [])

            # Map doc_type to Qdrant collection
            collection_map = {
                "PAST_PROPOSAL": COLLECTIONS["past_proposals"],
                "CAPABILITY": COLLECTIONS["capabilities"],
                "CASE_STUDY": COLLECTIONS["case_studies"],
                "COMPLIANCE": COLLECTIONS["compliance"],
            }
            collection = collection_map.get(doc.doc_type, COLLECTIONS["capabilities"])

            embeddings = await _embed_chunks(chunks)
            points = [
                {
                    "id": hash(f"{doc_id}_{i}") % (2**63),
                    "vector": emb,
                    "payload": {
                        "doc_id": doc_id,
                        "title": doc.title,
                        "doc_type": doc.doc_type,
                        "language": doc.language,
                        "outcome": doc.outcome,
                        "chunk_index": i,
                        "text": chunks[i]["text"],
                    },
                }
                for i, emb in enumerate(embeddings)
            ]

            if points:
                await vector_store.upsert_points(collection, points)

            doc.is_indexed = True
            doc.indexed_at = datetime.now(UTC)
            from core.config import settings
            doc.embedding_model = settings.embedding_model
            await db.commit()

            logger.info("Knowledge doc indexed", doc_id=doc_id, chunks=len(chunks))
            return {"doc_id": doc_id, "chunks": len(chunks)}

        except Exception as exc:
            logger.error("Indexing failed", doc_id=doc_id, error=str(exc))
            doc.is_indexed = False
            await db.commit()
            raise

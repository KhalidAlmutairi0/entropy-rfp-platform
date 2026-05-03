"""Qdrant vector store service — graceful no-op fallback when Qdrant is unavailable."""

from typing import Any

from core.config import settings

EMBEDDING_DIM = 1024

COLLECTIONS = {
    "rfp_chunks": "rfp_chunks",
    "past_proposals": "past_proposals",
    "capabilities": "capabilities",
    "case_studies": "case_studies",
    "compliance": "compliance",
}


class _NoopVectorStore:
    """Silent no-op used when Qdrant is not reachable in dev."""

    async def ensure_collection(self, name: str) -> None:
        pass

    async def upsert_points(self, collection: str, points: list[dict[str, Any]]) -> None:
        pass

    async def search(self, collection: str, query_vector: list[float], top_k: int = 20, filters: dict | None = None) -> list:
        return []

    async def delete_by_rfp(self, rfp_id: str) -> None:
        pass


class _QdrantBackend:
    def __init__(self) -> None:
        from qdrant_client import AsyncQdrantClient
        self.client = AsyncQdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

    async def ensure_collection(self, name: str) -> None:
        from qdrant_client.http.models import Distance, VectorParams
        collections = await self.client.get_collections()
        existing = [c.name for c in collections.collections]
        if name not in existing:
            await self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )

    async def upsert_points(self, collection: str, points: list[dict[str, Any]]) -> None:
        from qdrant_client.http.models import PointStruct
        await self.ensure_collection(collection)
        qdrant_points = [
            PointStruct(id=p["id"], vector=p["vector"], payload=p.get("payload", {}))
            for p in points
        ]
        await self.client.upsert(collection_name=collection, points=qdrant_points)

    async def search(self, collection: str, query_vector: list[float], top_k: int = 20, filters: dict | None = None) -> list:
        from qdrant_client.http.models import FieldCondition, Filter, MatchValue
        qdrant_filter = None
        if filters:
            must = [FieldCondition(key=k, match=MatchValue(value=v)) for k, v in filters.items()]
            qdrant_filter = Filter(must=must)
        return await self.client.search(
            collection_name=collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=qdrant_filter,
            with_payload=True,
        )

    async def delete_by_rfp(self, rfp_id: str) -> None:
        from qdrant_client.http.models import FieldCondition, Filter, FilterSelector, MatchValue
        await self.client.delete(
            collection_name=COLLECTIONS["rfp_chunks"],
            points_selector=FilterSelector(
                filter=Filter(must=[FieldCondition(key="rfp_id", match=MatchValue(value=rfp_id))])
            ),
        )


class VectorStoreService:
    _instance: "VectorStoreService | None" = None

    def __init__(self) -> None:
        self._backend, self.is_enabled = self._build_backend()

    def _build_backend(self):
        try:
            import socket
            sock = socket.create_connection((settings.qdrant_host, settings.qdrant_port), timeout=2)
            sock.close()
            import structlog
            structlog.get_logger().info("VectorStore: connected to Qdrant", host=settings.qdrant_host)
            return _QdrantBackend(), True
        except Exception as e:
            import structlog
            structlog.get_logger().warning(
                "VectorStore: Qdrant not reachable — vector search disabled in this session",
                error=str(e),
            )
            return _NoopVectorStore(), False

    async def ensure_collection(self, name: str) -> None:
        await self._backend.ensure_collection(name)

    async def upsert_points(self, collection: str, points: list[dict[str, Any]]) -> None:
        await self._backend.upsert_points(collection, points)

    async def search(self, collection: str, query_vector: list[float], top_k: int = 20, filters: dict | None = None) -> list:
        return await self._backend.search(collection, query_vector, top_k, filters)

    async def delete_by_rfp(self, rfp_id: str) -> None:
        await self._backend.delete_by_rfp(rfp_id)

    @classmethod
    def get_instance(cls) -> "VectorStoreService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

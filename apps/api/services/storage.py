"""Object storage service — MinIO in production, local filesystem fallback in dev."""

import asyncio
from io import BytesIO
from pathlib import Path

from core.config import settings

# Local dev storage root (created automatically when MinIO is unavailable)
_LOCAL_ROOT = Path(__file__).parent.parent / "dev_storage"


class _LocalStorageBackend:
    """Filesystem-based storage used when MinIO is not reachable."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    async def upload_file(self, content: bytes, path: str, content_type: str = "application/octet-stream") -> str:
        # Fix Bug #11: use asyncio.to_thread so filesystem I/O doesn't block the event loop
        def _write() -> None:
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)

        await asyncio.to_thread(_write)
        return path

    async def download_file(self, path: str) -> bytes:
        # Fix Bug #11: same — read_bytes is synchronous blocking I/O
        return await asyncio.to_thread((self.root / path).read_bytes)

    async def delete_file(self, path: str) -> None:
        def _delete() -> None:
            p = self.root / path
            if p.exists():
                p.unlink()

        await asyncio.to_thread(_delete)

    def get_presigned_url(self, path: str, expiry_hours: int = 2) -> str:
        return f"/dev/storage/{path}"


class _MinioBackend:
    """Production MinIO backend."""

    def __init__(self) -> None:
        from minio import Minio
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket_name
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        from minio.error import S3Error
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error:
            pass

    async def upload_file(self, content: bytes, path: str, content_type: str = "application/octet-stream") -> str:
        # Fix Bug #11: MinIO SDK is synchronous — wrap in to_thread to avoid blocking the event loop
        def _put() -> None:
            self.client.put_object(
                self.bucket, path, BytesIO(content), length=len(content), content_type=content_type
            )

        await asyncio.to_thread(_put)
        return path

    async def download_file(self, path: str) -> bytes:
        # Fix Bug #11: same issue — get_object blocks
        def _get() -> bytes:
            response = self.client.get_object(self.bucket, path)
            try:
                return response.read()
            finally:
                response.close()

        return await asyncio.to_thread(_get)

    async def delete_file(self, path: str) -> None:
        await asyncio.to_thread(self.client.remove_object, self.bucket, path)

    def get_presigned_url(self, path: str, expiry_hours: int = 2) -> str:
        from datetime import timedelta
        return self.client.presigned_get_object(self.bucket, path, expires=timedelta(hours=expiry_hours))


def _minio_reachable() -> bool:
    """Quick TCP probe — returns False immediately if MinIO port is closed."""
    import socket
    host = settings.minio_endpoint.split(":")[0]
    try:
        port = int(settings.minio_endpoint.split(":")[1])
    except (IndexError, ValueError):
        port = 9000
    try:
        with socket.create_connection((host, port), timeout=1.0):
            return True
    except OSError:
        return False


def _build_backend():
    """Return MinIO backend if reachable, otherwise local filesystem."""
    import structlog
    log = structlog.get_logger()

    if not _minio_reachable():
        log.warning(
            "Storage: MinIO not reachable (TCP probe failed) — using local filesystem fallback",
            endpoint=settings.minio_endpoint,
            path=str(_LOCAL_ROOT),
        )
        return _LocalStorageBackend(_LOCAL_ROOT)

    try:
        backend = _MinioBackend()
        log.info("Storage: connected to MinIO", endpoint=settings.minio_endpoint)
        return backend
    except Exception as e:
        log.warning(
            "Storage: MinIO not reachable — using local filesystem fallback",
            error=str(e),
            path=str(_LOCAL_ROOT),
        )
        return _LocalStorageBackend(_LOCAL_ROOT)


class StorageService:
    _instance: "StorageService | None" = None

    def __init__(self) -> None:
        self._backend = _build_backend()

    async def upload_file(self, content: bytes, path: str, content_type: str = "application/octet-stream") -> str:
        return await self._backend.upload_file(content, path, content_type)

    async def download_file(self, path: str) -> bytes:
        return await self._backend.download_file(path)

    async def delete_file(self, path: str) -> None:
        await self._backend.delete_file(path)

    def get_presigned_url(self, path: str, expiry_hours: int = 2) -> str:
        return self._backend.get_presigned_url(path, expiry_hours)

    @classmethod
    def get_instance(cls) -> "StorageService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

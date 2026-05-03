"""Redis cache service — falls back to in-memory dict when Redis is unavailable."""

import json
from typing import Any

from core.config import settings

_redis = None
_mem_cache: dict[str, str] = {}
_use_memory = False


async def get_redis():
    global _redis, _use_memory
    if _use_memory:
        return None
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2)
            await client.ping()
            _redis = client
            import structlog
            structlog.get_logger().info("Cache: connected to Redis", url=settings.redis_url)
        except Exception as e:
            import structlog
            structlog.get_logger().warning("Cache: Redis not reachable — using in-memory fallback", error=str(e))
            _use_memory = True
            return None
    return _redis


async def cache_get(key: str) -> Any | None:
    redis = await get_redis()
    if redis is None:
        value = _mem_cache.get(key)
        return json.loads(value) if value else None
    value = await redis.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    redis = await get_redis()
    if redis is None:
        _mem_cache[key] = json.dumps(value)
        return
    await redis.setex(key, ttl_seconds, json.dumps(value))


async def cache_delete(key: str) -> None:
    redis = await get_redis()
    if redis is None:
        _mem_cache.pop(key, None)
        return
    await redis.delete(key)


async def publish_event(channel: str, event: dict) -> None:
    """Publish to Redis pub/sub. No-ops gracefully when Redis is unavailable."""
    redis = await get_redis()
    if redis is None:
        return  # SSE streaming not available without Redis — silently skip
    await redis.publish(channel, json.dumps(event))

"""Celery application for async background tasks."""

from celery import Celery

from core.config import settings

celery_app = Celery(
    "entropy_rfp",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["tasks.ingestion_tasks", "tasks.indexing_tasks", "tasks.export_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Riyadh",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "tasks.ingestion_tasks.*": {"queue": "ingestion"},
        "tasks.indexing_tasks.*": {"queue": "indexing"},
        "tasks.export_tasks.*": {"queue": "export"},
    },
)

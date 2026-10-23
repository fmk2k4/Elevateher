"""Celery application for ElevateHer async tasks.

Run:
    celery -A tasks.celery_app worker --loglevel=info -Q safety -c 4
    celery -A tasks.celery_app worker --loglevel=info -Q default,sms,agent -c 2
    celery -A tasks.celery_app beat --loglevel=info
"""

from __future__ import annotations

import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

# ── Ensure proper import paths ─────────────────────────────────────────────────
# This MUST be done before importing any other elevateher modules
import services.path  # noqa: F401, E402

BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
BACKEND_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "elevateher",
    broker=BROKER_URL,
    backend=BACKEND_URL,
    include=[
        "services.api.tasks.embedding_tasks",
        "services.api.tasks.safety_tasks",
        "services.api.tasks.sms_tasks",
        "services.api.tasks.agent_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    task_soft_time_limit=280,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    task_acks_late=True,
    task_acks_on_failure_or_timeout=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
)

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_queues = {
    "default": {"exchange": "default", "routing_key": "default"},
    "safety": {"exchange": "safety", "routing_key": "safety"},
    "sms": {"exchange": "sms", "routing_key": "sms"},
    "agent": {"exchange": "agent", "routing_key": "agent"},
}

# Beat schedules (requires django-celery-beat or manual setup; kept for reference)
celery_app.conf.beat_schedule = {
    "snapshot-temporal-risks": {
        "task": "services.api.tasks.safety_tasks.snapshot_temporal_risks",
        "schedule": crontab(minute="*/5"),
    },
    "check-pending-scans": {
        "task": "services.api.tasks.safety_tasks.check_pending_scans",
        "schedule": crontab(minute="*/15"),
    },
    "generate-weekly-brief": {
        "task": "services.api.tasks.agent_tasks.generate_weekly_brief",
        "schedule": crontab(hour=9, minute=0, day_of_week="mon"),
    },
}

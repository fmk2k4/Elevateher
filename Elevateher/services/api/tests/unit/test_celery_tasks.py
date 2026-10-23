"""Unit tests for Celery tasks — task registration, names, retry config."""


def test_sms_tasks_registered():
    """SMS Celery tasks are registered with correct names."""
    from tasks.sms_tasks import notify_mentor_approved, send_match_confirmed_sms, send_sms_task

    assert send_sms_task.name == "tasks.sms_tasks.send_sms"
    assert send_match_confirmed_sms.name == "tasks.sms_tasks.send_match_confirmed_sms"
    assert notify_mentor_approved.name == "tasks.sms_tasks.notify_mentor_approved"


def test_sms_task_has_auto_retry():
    """send_sms_task has autoretry_for and retry_backoff."""
    from tasks.sms_tasks import send_sms_task

    assert send_sms_task.autoretry_for == (Exception,)
    assert send_sms_task.retry_backoff is True


def test_sms_task_max_retries():
    """send_sms_task has max_retries=3."""
    from tasks.sms_tasks import send_sms_task

    assert send_sms_task.retry_kwargs.get("max_retries") == 3


def test_notify_mentor_approved_alias():
    """notify_mentor_approved_task is an alias for notify_mentor_approved."""
    from tasks.sms_tasks import notify_mentor_approved, notify_mentor_approved_task

    assert notify_mentor_approved_task is notify_mentor_approved


def test_notify_mentor_of_match_registered():
    """notify_mentor_of_match task is registered."""
    from tasks.sms_tasks import notify_mentor_of_match

    assert notify_mentor_of_match.name == "tasks.sms_tasks.notify_mentor_of_match"


def test_agent_tasks_registered():
    """Agent Celery tasks are registered with correct names."""
    from tasks.agent_tasks import generate_weekly_brief_task, summarise_session_task

    assert summarise_session_task.name == "tasks.agent_tasks.summarise_session"
    assert generate_weekly_brief_task.name == "tasks.agent_tasks.generate_weekly_brief"


def test_embedding_tasks_registered():
    """Embedding Celery tasks are registered."""
    from tasks.embedding_tasks import generate_mentee_embedding_task, generate_mentor_embedding_task

    assert generate_mentee_embedding_task.name == "tasks.embedding_tasks.generate_mentee_embedding"
    assert generate_mentor_embedding_task.name == "tasks.embedding_tasks.generate_mentor_embedding"


def test_embedding_reembed_aliases():
    """Re-embed task aliases point to correct tasks."""
    from tasks.embedding_tasks import (
        generate_mentee_embedding_task,
        generate_mentor_embedding_task,
        reembed_mentee_task,
        reembed_mentor_task,
    )

    assert reembed_mentee_task is generate_mentee_embedding_task
    assert reembed_mentor_task is generate_mentor_embedding_task


def test_safety_tasks_registered():
    """Safety Celery tasks are registered with correct names."""
    from tasks.safety_tasks import (
        handle_critical_safety_flag,
        notify_admin_bio_failure_task,
        scan_bio_task,
        scan_mentor_bio_task,
        scan_message_task,
        snapshot_temporal_risks_task,
    )

    assert scan_bio_task.name == "tasks.safety_tasks.scan_bio"
    assert scan_message_task.name == "tasks.safety_tasks.scan_message"
    assert scan_mentor_bio_task.name == "tasks.safety_tasks.scan_mentor_bio"
    assert handle_critical_safety_flag.name == "tasks.safety_tasks.handle_critical_safety_flag"
    assert snapshot_temporal_risks_task.name == "tasks.safety_tasks.snapshot_temporal_risks"
    assert notify_admin_bio_failure_task.name == "tasks.safety_tasks.notify_admin_bio_failure"


def test_check_pending_scans_registered():
    """check_pending_scans task is registered."""
    from tasks.safety_tasks import check_pending_scans

    assert check_pending_scans.name == "tasks.safety_tasks.check_pending_scans"


def test_celery_app_configured():
    """Celery app has broker and backend configured."""
    from tasks.celery_app import celery_app

    assert celery_app.conf.broker_url is not None or celery_app.conf.result_backend is not None

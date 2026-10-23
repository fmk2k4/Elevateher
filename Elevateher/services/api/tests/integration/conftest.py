import sys
from pathlib import Path

import pytest

_api_root = str(Path(__file__).resolve().parents[1])
if _api_root not in sys.path:
    sys.path.insert(0, _api_root)
_project_root = str(Path(__file__).resolve().parents[3])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class _FakeAsyncResult:
    def __init__(self, task_id="fake-task-id"):
        self.id = task_id


class _FakeCeleryTask:
    def apply_async(self, *a, **kw):
        return _FakeAsyncResult()

    def delay(self, *a, **kw):
        return _FakeAsyncResult()


@pytest.fixture(autouse=True)
def _mock_celery_tasks(monkeypatch):
    fake = _FakeCeleryTask()
    try:
        import tasks.sms_tasks

        monkeypatch.setattr(tasks.sms_tasks, "send_sms_task", fake)
        monkeypatch.setattr(tasks.sms_tasks, "send_match_confirmed_sms", fake)
        monkeypatch.setattr(tasks.sms_tasks, "notify_mentor_approved", fake)
        monkeypatch.setattr(tasks.sms_tasks, "notify_mentor_of_match", fake)
    except ImportError:
        pass
    try:
        import tasks.safety_tasks

        monkeypatch.setattr(tasks.safety_tasks, "scan_bio", fake)
        monkeypatch.setattr(tasks.safety_tasks, "scan_message", fake)
        monkeypatch.setattr(tasks.safety_tasks, "scan_mentor_bio_task", fake)
        monkeypatch.setattr(tasks.safety_tasks, "handle_critical_safety_flag", fake)
    except ImportError:
        pass
    try:
        import tasks.embedding_tasks

        monkeypatch.setattr(tasks.embedding_tasks, "reembed_mentor_task", fake)
        monkeypatch.setattr(tasks.embedding_tasks, "reembed_mentee_task", fake)
    except ImportError:
        pass
    try:
        import tasks.agent_tasks

        monkeypatch.setattr(tasks.agent_tasks, "generate_weekly_brief_task", fake)
        monkeypatch.setattr(tasks.agent_tasks, "summarise_session_task", fake)
    except ImportError:
        pass

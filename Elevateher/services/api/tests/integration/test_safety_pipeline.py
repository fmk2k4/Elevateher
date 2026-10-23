"""Integration tests — safety pipeline: bio scan → temporal alert → suspension."""

import json

import pytest


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.store[key] = value


@pytest.mark.asyncio
async def test_bio_scan_clean():
    """Clean bio passes safety scan without flags."""
    from services.safety.bio_classifier import scan_bio

    result = scan_bio(
        "I am a software engineer with 10 years of experience in technology. "
        "I enjoy mentoring young women in STEM fields and have volunteered "
        "with multiple youth organisations across Southeast Asia."
    )
    assert result.safe_score > 0
    assert "off_platform_solicitation" not in result.flags


@pytest.mark.asyncio
async def test_bio_scan_off_platform_detected():
    """Bio with off-platform contact triggers flag and blocks approval."""
    from services.safety.bio_classifier import scan_bio

    result = scan_bio(
        "Add me on WhatsApp for private mentoring sessions. "
        "Don't tell anyone about our special arrangement."
    )
    assert result.approved is False
    assert "off_platform_solicitation" in result.flags or result.safe_score < 0.75


@pytest.mark.asyncio
async def test_bio_scan_intimacy_escalation():
    """Bio with intimacy escalation triggers flag."""
    from services.safety.bio_classifier import scan_bio

    result = scan_bio(
        "I love working with young girls. Our secret mentoring relationship "
        "will be very special. Keep this between us."
    )
    assert result.requires_human_review is True
    assert "off_platform_solicitation" in result.flags or "intimacy_escalation" in result.flags


@pytest.mark.asyncio
async def test_bio_too_short():
    """Very short bio triggers review flag."""
    from services.safety.bio_classifier import scan_bio

    result = scan_bio("Hi")
    assert result.approved is False
    assert "bio_too_short" in result.flags


@pytest.mark.asyncio
async def test_temporal_message_recording():
    """Temporal detector records message and tracks risk over time."""
    from services.safety.temporal_detector import record_message_event

    redis = _FakeRedis()
    profile = await record_message_event(
        redis_client=redis,
        match_id="match-temp-1",
        sender_role="mentor",
        sender_id="mentor-1",
        message_text="How is your project going?",
        mentor_id="mentor-1",
    )
    assert profile.risk_score == 0.0
    assert profile.off_platform_count == 0


@pytest.mark.asyncio
async def test_temporal_off_platform_escalation():
    """Off-platform contact in messages triggers risk escalation."""
    from services.safety.temporal_detector import record_message_event

    redis = _FakeRedis()

    profile = await record_message_event(
        redis_client=redis,
        match_id="match-temp-2",
        sender_role="mentor",
        sender_id="mentor-2",
        message_text="Message me on WhatsApp for faster help",
        mentor_id="mentor-2",
    )
    assert profile.off_platform_count == 1
    assert profile.risk_score >= 0.4

    alert_key = "temporal_alert:match-temp-2"
    alert_raw = await redis.get(alert_key)
    assert alert_raw is not None
    alert = json.loads(alert_raw)
    assert alert["severity"] in ("medium", "high", "critical")


@pytest.mark.asyncio
async def test_temporal_critical_suspension():
    """Two off-platform attempts trigger critical alert with immediate_suspend."""
    from services.safety.temporal_detector import record_message_event

    redis = _FakeRedis()
    match_id = "match-temp-3"

    await record_message_event(
        redis_client=redis,
        match_id=match_id,
        sender_role="mentor",
        sender_id="mentor-3",
        message_text="Add me on WhatsApp",
        mentor_id="mentor-3",
    )
    profile = await record_message_event(
        redis_client=redis,
        match_id=match_id,
        sender_role="mentor",
        sender_id="mentor-3",
        message_text="Contact me on Telegram too, it's our secret",
        mentor_id="mentor-3",
    )
    assert profile.off_platform_count >= 2

    alert_key = f"temporal_alert:{match_id}"
    alert_raw = await redis.get(alert_key)
    assert alert_raw is not None
    alert = json.loads(alert_raw)
    assert alert["severity"] == "critical"
    assert alert["action"] == "immediate_suspend"


@pytest.mark.asyncio
async def test_temporal_get_risk_profile():
    """get_risk_profile returns profile from Redis."""
    from services.safety.temporal_detector import get_risk_profile

    redis = _FakeRedis()
    redis.store["temporal:match-x"] = json.dumps(
        {
            "match_id": "match-x",
            "events": [],
            "risk_score": 0.3,
            "off_platform_count": 0,
            "intimacy_count": 1,
            "last_updated": "2025-01-01T00:00:00+00:00",
        }
    )
    profile = await get_risk_profile(redis, "match-x")
    assert profile is not None
    assert profile.risk_score == 0.3

    missing = await get_risk_profile(redis, "nonexistent")
    assert missing is None

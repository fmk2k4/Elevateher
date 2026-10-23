import pytest

from services.api.services.temporal_safety import record_and_analyse_message


class AsyncRedisMock:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def setex(self, key, ttl, value):
        self.values[key] = value
        return True


@pytest.mark.asyncio
async def test_off_platform_triggers_critical_alert():
    redis = AsyncRedisMock()
    await record_and_analyse_message(
        redis=redis,
        match_id="test-match-001",
        sender_role="mentor",
        sender_id="mentor-id-001",
        message_text="Let's continue on WhatsApp, it's more private there",
    )
    result = await record_and_analyse_message(
        redis=redis,
        match_id="test-match-001",
        sender_role="mentor",
        sender_id="mentor-id-001",
        message_text="Share your Telegram username too",
    )
    assert "off_platform_attempt" in result["current_flags"]
    assert result["alert"] is not None
    assert result["alert"]["level"] == "CRITICAL"


@pytest.mark.asyncio
async def test_safe_message_no_alert():
    redis = AsyncRedisMock()
    result = await record_and_analyse_message(
        redis=redis,
        match_id="test-match-002",
        sender_role="mentor",
        sender_id="mentor-id-002",
        message_text="Great work on your Python project. See you next week!",
    )
    assert result["current_flags"] == []
    assert result["alert"] is None
    assert result["risk_score"] == 0.0

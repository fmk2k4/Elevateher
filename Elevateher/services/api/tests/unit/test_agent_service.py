"""Agent service unit tests.

Tests session summary generation, prompt construction, and fallback behaviour.
"""

import pytest


def _import_agent():
    import sys
    from pathlib import Path

    _root = Path(__file__).resolve().parents[3]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    try:
        from services.agent import summariser

        return summariser
    except ImportError:
        return None


def test_agent_module_exists():
    mod = _import_agent()
    assert mod is not None, "services.agent.summariser should import"


def test_agent_has_generate_summary():
    mod = _import_agent()
    assert hasattr(mod, "generate_summary"), "summariser must expose generate_summary"


def test_agent_summary_fallback(monkeypatch):
    mod = _import_agent()
    if mod is None:
        pytest.skip("agent module not available")

    monkeypatch.setenv("ENABLE_AGENTIC_LAYER", "false")

    result = mod.generate_summary(
        messages=[{"sender_role": "mentee", "content": "Hello mentor"}],
        session_goal="Introduction",
    )
    assert isinstance(result, str)
    assert len(result) > 0


def test_summarise_session_async():
    mod = _import_agent()
    if mod is None:
        pytest.skip("agent module not available")

    import asyncio

    summary = asyncio.run(
        mod.summarise_session(
            messages=[{"sender_role": "mentee", "content": "Hello mentor"}],
            track="STEM",
            session_num=1,
        )
    )
    assert isinstance(summary.summary, str)
    assert len(summary.questions) >= 1


def test_suggest_mentor_questions():
    mod = _import_agent()
    if mod is None:
        pytest.skip("agent module not available")

    questions = mod.suggest_mentor_questions(track="STEM", session_num=2)
    assert len(questions) == 3
    for q in questions:
        assert isinstance(q, str) and len(q) > 10


def test_generate_mentee_nudge():
    mod = _import_agent()
    if mod is None:
        pytest.skip("agent module not available")

    nudge = mod.generate_mentee_nudge(
        mentee_name="Aisha",
        days_since_last_session=7,
        track="STEM",
        next_milestone="Python basics",
        language="en",
    )
    assert len(nudge) <= 160


def test_generate_weekly_mentor_brief():
    mod = _import_agent()
    if mod is None:
        pytest.skip("agent module not available")

    brief = mod.generate_weekly_mentor_brief(
        track="Business",
        active_mentee_count=3,
        upcoming_sessions=[{"milestone_title": "Client pitch"}],
    )
    assert isinstance(brief, str)
    assert len(brief) > 20

"""Additional agent service unit tests — fallback paths, parsing, edge cases."""


def test_parse_json_response_valid_json():
    """_parse_json_response handles valid JSON."""
    from services.agent.summariser import _parse_json_response

    result = _parse_json_response('{"summary": "test", "questions": ["q1"]}')
    assert result["summary"] == "test"
    assert result["questions"] == ["q1"]


def test_parse_json_response_markdown_block():
    """_parse_json_response extracts JSON from markdown code blocks."""
    from services.agent.summariser import _parse_json_response

    raw = '```json\n{"summary": "test", "questions": ["q1"]}\n```'
    result = _parse_json_response(raw)
    assert result["summary"] == "test"


def test_parse_json_response_code_block_no_language():
    """_parse_json_response handles ``` blocks without language tag."""
    from services.agent.summariser import _parse_json_response

    raw = '```\n{"summary": "hello", "questions": []}\n```'
    result = _parse_json_response(raw)
    assert result["summary"] == "hello"


def test_parse_json_response_invalid_json():
    """_parse_json_response returns empty dict for unparseable content."""
    from services.agent.summariser import _parse_json_response

    result = _parse_json_response("not json at all {{{")
    assert result == {}


def test_parse_json_response_embedded_json():
    """_parse_json_response finds JSON embedded in text."""
    from services.agent.summariser import _parse_json_response

    raw = 'Here is the result: {"summary": "embedded", "questions": []} and trailing text'
    result = _parse_json_response(raw)
    assert result["summary"] == "embedded"


def test_default_summary_structure():
    """_default_summary returns all required keys."""
    from services.agent.summariser import _default_summary

    result = _default_summary("STEM", 3)
    assert "summary" in result
    assert "questions" in result
    assert "milestone_reached" in result
    assert "sdg_goals_covered" in result
    assert "mentee_sentiment" in result
    assert result["mentee_sentiment"] in ("positive", "neutral", "needs_support")
    assert isinstance(result["questions"], list)
    assert len(result["questions"]) >= 1


def test_default_summary_session_num_included():
    """_default_summary includes session number in summary text."""
    from services.agent.summariser import _default_summary

    result = _default_summary("Business", 7)
    assert "7" in result["summary"]
    assert "Business" in result["summary"]


def test_build_system_prompt_contains_track():
    """System prompt includes track and session number."""
    from services.agent.summariser import _build_system_prompt

    prompt = _build_system_prompt("STEM", 5)
    assert "STEM" in prompt
    assert "5" in prompt


def test_session_summary_empty_messages():
    """summarise_session with no messages returns placeholder summary."""
    import asyncio

    from services.agent.summariser import summarise_session

    result = asyncio.run(summarise_session(messages=[], track="STEM", session_num=1))
    assert "no messages" in result.summary.lower() or "session" in result.summary.lower()
    assert isinstance(result.questions, list)


def test_detect_milestone_reached_in_range():
    """detect_milestone_reached returns milestone for valid session."""
    from services.agent.summariser import detect_milestone_reached

    reached, title = detect_milestone_reached(session_num=1, track="STEM", summary_text="")
    assert reached is True
    assert title is not None
    assert isinstance(title, str)


def test_detect_milestone_reached_out_of_range():
    """detect_milestone_reached for session beyond milestone list."""
    from services.agent.summariser import detect_milestone_reached

    reached, title = detect_milestone_reached(
        session_num=999,
        track="STEM",
        summary_text="random text no milestone keywords",
    )
    assert reached is False
    assert title is None


def test_generate_mentee_nudge_en():
    """English nudge fits in 160 chars."""
    from services.agent.summariser import generate_mentee_nudge

    nudge = generate_mentee_nudge("Aisha", 7, "STEM", "Python basics", "en")
    assert len(nudge) <= 160
    assert "Aisha" in nudge


def test_generate_mentee_nudge_ms():
    """Malay nudge uses Malay text."""
    from services.agent.summariser import generate_mentee_nudge

    nudge = generate_mentee_nudge("Aisha", 7, "STEM", "Python basics", "ms")
    assert len(nudge) <= 160
    assert "Aisha" in nudge


def test_generate_mentee_nudge_id():
    """Indonesian nudge uses Indonesian text."""
    from services.agent.summariser import generate_mentee_nudge

    nudge = generate_mentee_nudge("Aisha", 7, "STEM", "Python basics", "id")
    assert len(nudge) <= 160


def test_generate_mentee_nudge_unknown_lang_falls_back():
    """Unknown language falls back to English."""
    from services.agent.summariser import generate_mentee_nudge

    nudge = generate_mentee_nudge("Aisha", 7, "STEM", "Python basics", "fr")
    assert "Aisha" in nudge
    assert len(nudge) <= 160


def test_generate_weekly_mentor_brief():
    """Weekly mentor brief includes mentee count and session count."""
    from services.agent.summariser import generate_weekly_mentor_brief

    brief = generate_weekly_mentor_brief(
        track="STEM",
        active_mentee_count=5,
        upcoming_sessions=[{"milestone_title": "Python"}, {"milestone_title": "Data"}],
    )
    assert "5" in brief
    assert "2" in brief


def test_suggest_mentor_questions_returns_three():
    """suggest_mentor_questions returns exactly 3 questions."""
    from services.agent.summariser import suggest_mentor_questions

    questions = suggest_mentor_questions(track="STEM", session_num=3)
    assert len(questions) == 3


def test_session_summary_to_dict():
    """SessionSummary.to_dict serialises correctly."""
    from services.agent.summariser import SessionSummary

    s = SessionSummary(
        summary="Test summary",
        questions=["Q1", "Q2"],
        milestone_reached=True,
        sdg_goals_covered=["4.4"],
        mentee_sentiment="positive",
    )
    d = s.to_dict()
    assert d["summary"] == "Test summary"
    assert d["milestone_reached"] is True
    assert d["mentee_sentiment"] == "positive"

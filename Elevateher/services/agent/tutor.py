"""
services/agent/tutor.py
========================
AI Tutor (Ela) Implementation for ElevateHer.

Implements a Socratic career coach that answers mentee questions intelligently
using a 3-tier inference strategy:
  Tier 1: DeepSeek-R1 Distill (Local GGUF via llama-cpp) - No API cost
  Tier 2: DeepSeek API (api.deepseek.com) - Cheap, fast
  Tier 3: Gemini API - Fallback (already existing)
"""
import json
import logging
import asyncio
import httpx
from pydantic import BaseModel, Field

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class TutorResponse(BaseModel):
    message: str = Field(description="The tutor's reply")
    coaching_type: str = Field(description="One of: question, encouragement, reframe, resource")
    should_nudge_mentor: bool = Field(description="True if mentee expresses distress, overwhelming struggle, or explicitly asks for human help")
    sdg_connections: list[str] = Field(default_factory=list, description="Which SDGs this message touches")
    reasoning: str | None = Field(default=None, description="The reasoning or chain-of-thought process of the AI")


def build_tutor_prompt(
    mentee_name: str,
    career_goal: str,
    sdg_track: str,
    session_num: int,
    context_text: str,
    transcript: str,
) -> str:
    """Builds the system prompt for Ela Socratic coaching."""
    return f"""You are Ela, an AI career mentor for {mentee_name} on their {sdg_track} journey.
This is session {session_num}/12. 
Their ultimate career goal: {career_goal}

{context_text}

COACHING RULES:
1. Socratic method ONLY: Never give direct answers or write code for them. Ask ONE powerful guiding question that helps them discover the answer themselves.
2. Empathy first: Acknowledge feelings and effort before addressing facts.
3. Keep it short: Maximum 3 sentences. You must be SMS-friendly.
4. If they share a win, celebrate specifically, then gently push forward.
5. If they express distress ("overwhelmed", "can't", "failing"), shift entirely to support mode and validate their feelings.

Output your response in strict JSON format matching this schema:
{{
  "message": "Your short coaching response here.",
  "coaching_type": "question" | "encouragement" | "reframe" | "resource",
  "should_nudge_mentor": boolean,
  "sdg_connections": ["List", "of", "SDG", "targets"]
}}

RECENT TRANSCRIPT:
{transcript}
"""


async def _infer_deepseek_api(prompt: str) -> TutorResponse | None:
    """Tier 2: DeepSeek HTTP API"""
    if not settings.deepseek_api_key:
        return None
        
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                settings.deepseek_api_url or "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.deepseek_model or "deepseek-reasoner",
                    "messages": [{"role": "system", "content": prompt}]
                }
            )
            resp.raise_for_status()
            data = resp.json()
            message_data = data["choices"][0]["message"]
            content = message_data["content"]
            reasoning_content = message_data.get("reasoning_content")

            # deepseek-reasoner does not support response_format: json_object
            # It may output markdown code blocks. We need to extract the JSON.
            import re
            json_str = content
            match = re.search(r'```(?:json)?(.*?)```', content, re.DOTALL)
            if match:
                json_str = match.group(1).strip()
            else:
                # Fallback to finding the first { and last }
                start = content.find('{')
                end = content.rfind('}')
                if start != -1 and end != -1:
                    json_str = content[start:end+1]

            parsed = json.loads(json_str)
            if reasoning_content:
                parsed["reasoning"] = reasoning_content
            return TutorResponse(**parsed)
    except Exception as e:
        logger.error(f"DeepSeek API error: {e}")
        return None


async def _infer_gemini_api(prompt: str) -> TutorResponse | None:
    """Tier 3: Gemini HTTP API Fallback"""
    if not settings.gemini_api_key:
        return None
        
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": settings.ai_tutor_temperature or 0.7,
                    }
                }
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
            return TutorResponse(**parsed)
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return None


async def get_tutor_response(
    mentee_name: str,
    career_goal: str,
    sdg_track: str,
    session_num: int,
    context_text: str,
    transcript: str,
) -> TutorResponse:
    """
    Core AI Tutor entrypoint. Attempts inference tiers in order.
    """
    prompt = build_tutor_prompt(
        mentee_name, career_goal, sdg_track, session_num, context_text, transcript
    )

    # Note: Tier 1 (llama-cpp local) is omitted here for simplicity in this file,
    # but would normally be injected similar to summariser.py. We rely on DeepSeek
    # and Gemini for the HTTP paths.
    
    # Tier 2: DeepSeek API
    res = await _infer_deepseek_api(prompt)
    if res:
        return res
        
    # Tier 3: Gemini API
    res = await _infer_gemini_api(prompt)
    if res:
        return res
        
    # Fallback / Deterministic if everything fails
    return TutorResponse(
        message="I'm here to support you. Can you tell me a little more about how you're feeling about this?",
        coaching_type="encouragement",
        should_nudge_mentor=False,
        sdg_connections=[]
    )

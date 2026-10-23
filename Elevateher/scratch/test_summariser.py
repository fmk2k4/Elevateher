import asyncio
import os
import sys
from pathlib import Path

import pytest

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.agent.summariser import summarise_session

pytestmark = pytest.mark.asyncio

async def test_summariser():
    messages = [
        {"sender_role": "mentor", "content": "Hi! How did your career mapping exercise go this week?"},
        {"sender_role": "mentee", "content": "It went well, but I am still a bit confused about which tech role fits me best."},
        {"sender_role": "mentor", "content": "That is totally normal. Let's look at your strengths. What do you enjoy doing?"},
        {"sender_role": "mentee", "content": "I like problem-solving and coding, but I'm not great at UI design."},
        {"sender_role": "mentor", "content": "Then backend engineering or data science might be perfect for you! I will send you some resources on backend roadmaps."}
    ]
    
    print("Running summariser...")
    summary = await summarise_session(messages, track="STEM", session_num=2)
    
    print("\n====================")
    print("SUMMARY RESULT")
    print("====================")
    print(f"Summary: {summary.summary}")
    print(f"Questions: {summary.questions}")
    print(f"Milestone Reached: {summary.milestone_reached}")
    print(f"SDG Goals Covered: {summary.sdg_goals_covered}")
    print(f"Mentee Sentiment: {summary.mentee_sentiment}")
    print("====================")

if __name__ == "__main__":
    asyncio.run(test_summariser())

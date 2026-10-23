#!/usr/bin/env python3
# =============================================================================
# USSD Simulator — Local testing without Infobip gateway
# =============================================================================
# Run: python -m scripts.ussd_simulator
# Simulates the full USSD flow locally via Infobip-style Form data.
#
# This is useful for:
#   1. Demo day testing without Infobip setup
#   2. CI/CD automated testing
#   3. Local development
#
# Simulates Infobip USSD callback format:
#   POST /ussd/callback
#   Form data: sessionId, serviceCode, phoneNumber, text
# =============================================================================

import sys

# Force UTF-8 encoding for Windows console to support printing Thai characters
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import asyncio
import time

import httpx

BASE_URL = "http://localhost:8000"
USSD_CALLBACK_PATH = "/ussd/callback"

def run_ussd_flow(phone: str, flow_inputs: list[str]) -> dict:
    """
    Run a complete USSD flow with multiple steps.

    Args:
        phone: E.164 format phone number
        flow_inputs: List of inputs at each USSD step, e.g. ["1", "1", "Aisha", "1"]
                    (new user → English → name → STEM track)

    Returns:
        Final response from the USSD callback
    """
    session_id = f"test-session-{phone.replace('+', '')}-{time.time_ns()}"
    all_responses = []
    cumulative_text = ""

    async def _run():
        nonlocal cumulative_text
        async with httpx.AsyncClient(timeout=30) as client:
            health = await client.get(f"{BASE_URL}/health")
            health.raise_for_status()

            # Send initial dial (empty text)
            print("\n  Step: (Initial dial *384#)")
            resp = await client.post(
                f"{BASE_URL}{USSD_CALLBACK_PATH}",
                data={
                    "sessionId": session_id,
                    "session_id": session_id,
                    "serviceCode": "*384#",
                    "service_code": "*384#",
                    "phoneNumber": phone,
                    "phone_number": phone,
                    "text": "",
                },
            )
            print(f"  Response: {resp.text[:200]}")
            all_responses.append(resp.text)
            
            for step_input in flow_inputs:
                cumulative_text = f"{cumulative_text}*{step_input}" if cumulative_text else step_input
                print(f"\n  Step: '{step_input}'")
                print(f"  Cumulative text: '{cumulative_text}'")

                resp = await client.post(
                    f"{BASE_URL}{USSD_CALLBACK_PATH}",
                    data={
                        "sessionId": session_id,
                        "session_id": session_id,
                        "serviceCode": "*384#",
                        "service_code": "*384#",
                        "phoneNumber": phone,
                        "phone_number": phone,
                        "text": cumulative_text,
                    },
                )

                body = resp.text
                print(f"  Response: {body[:200]}")
                all_responses.append(body)

                if not body.startswith(("CON", "END")):
                    raise RuntimeError(f"Unexpected USSD body: {body[:200]}")

                if body.startswith("END"):
                    break

            return all_responses

    return asyncio.run(_run())


# ── Test Scenarios ────────────────────────────────────────────────────────────

SCENARIOS = [
    {
        "name": "New user — English, STEM track",
        "phone": "+60123456789",
        "inputs": ["1", "1", "Aisha Rahman", "1"],  # new → English → name → STEM
    },
    {
        "name": "New user — Malay, Business track",
        "phone": "+60198765432",
        "inputs": ["1", "2", "Nurul Ain", "2"],     # new → Bahasa Melayu → name → Business
    },
    {
        "name": "New user — Thai, Trades track",
        "phone": "+66812345678",
        "inputs": ["1", "4", "Somchai", "3"],        # new → Thai → name → Trades
    },
    {
        "name": "New user — Indonesian, Creative track",
        "phone": "+6281234567890",
        "inputs": ["1", "3", "Siti Rahmi", "4"],     # new → Bahasa Indonesia → name → Creative
    },
    {
        "name": "Returning user",
        "phone": "+60123456789",
        "inputs": ["2", "+60123456789"],             # returning → phone number
    },
    {
        "name": "Mentor portal info",
        "phone": "+60123456789",
        "inputs": ["3"],                             # mentor portal
    },
]


def main():
    print("=" * 60)
    print("ElevateHer USSD Simulator")
    print("=" * 60)
    print(f"Target: {BASE_URL}{USSD_CALLBACK_PATH}")
    print()

    all_passed = True
    for scenario in SCENARIOS:
        print(f"\nScenario: {scenario['name']}")
        print(f"   Phone: {scenario['phone']}")
        print(f"   Inputs: {scenario['inputs']}")
        try:
            responses = run_ussd_flow(scenario["phone"], scenario["inputs"])
            last_response = responses[-1] if responses else ""
            if last_response.startswith("END"):
                print(f"  SUCCESS - Final response: {last_response[:100]}")
            elif last_response.startswith("CON"):
                print(f"  INCOMPLETE - Still expecting more input: {last_response[:100]}")
            else:
                print(f"  ERROR - Unexpected response: {last_response[:100]}")
                all_passed = False
        except httpx.ConnectError:
            print(f"  CONNECTION ERROR - Is the dev server running at {BASE_URL}?")
            all_passed = False
        except Exception as e:
            print(f"  ERROR: {e}")
            all_passed = False

    print()
    print("=" * 60)
    if all_passed:
        print("ALL SCENARIOS PASSED")
    else:
        print("SOME SCENARIOS FAILED")
    print("=" * 60)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())

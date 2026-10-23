"use client";

import { useEffect, useRef, useState } from "react";

const USSD_PROXY_PATH = "/api/ussd/callback";
const DEFAULT_PHONE_NUMBER = "+60123456789";
const DEFAULT_SERVICE_CODE = "*384#";

const QUICK_PATHS = [
  {
    label: "New User (English)",
    sequence: ["1", "1", "Aisha", "1"],
    phone: "+60111111111",
  },
  {
    label: "Returning Mentee",
    sequence: ["2", "1", "00"], // Navigate to mentor list and back
    phone: "+60123456789", // Demo mentee
  },
  {
    label: "Emergency Report",
    sequence: ["3", "1", "911"],
    phone: "+60123456789",
  },
  {
    label: "Match Check",
    sequence: ["4"],
    phone: "+60123456789",
  },
];

const SCREEN_COLORS = { CON: "#00FF41", END: "#FFB800" };

function createSessionId() {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function callUssdGateway({ sessionId, phoneNumber, inputs }) {
  const body = new URLSearchParams({
    sessionId,
    serviceCode: DEFAULT_SERVICE_CODE,
    phoneNumber,
    text: inputs.join("*"),
  });

  const response = await fetch(USSD_PROXY_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/plain",
    },
    body,
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw || `USSD request failed with status ${response.status}`);
  }

  const normalized = raw.trimStart();
  const isEnd = normalized.startsWith("END");
  const type = isEnd ? "END" : "CON";
  const text = normalized.startsWith("END ") || normalized.startsWith("CON ")
    ? normalized.slice(4)
    : normalized;

  return { type, text, raw };
}

export default function USSDSimulator() {
  const [history, setHistory] = useState([]);
  const [state, setState] = useState("booting");
  const [input, setInput] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(DEFAULT_PHONE_NUMBER);
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [sessionInputs, setSessionInputs] = useState([]);
  const [lastResponseType, setLastResponseType] = useState("CON");
  const [isProcessing, setIsProcessing] = useState(false);
  const [gatewayError, setGatewayError] = useState("");
  const historyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    void startSession(sessionId, phoneNumber);
  }, []);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  async function startSession(nextSessionId = createSessionId(), nextPhone = phoneNumber) {
    setIsProcessing(true);
    setGatewayError("");
    setHistory([]);
    setSessionInputs([]);
    setSessionId(nextSessionId);

    try {
      const result = await callUssdGateway({
        sessionId: nextSessionId,
        phoneNumber: nextPhone,
        inputs: [],
      });
      setLastResponseType(result.type);
      setState(result.type === "END" ? "session_ended" : "awaiting_input_step_1");
      setHistory([{ type: result.type, text: result.text, input: "", ts: new Date() }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach USSD gateway.";
      setLastResponseType("END");
      setState("gateway_error");
      setGatewayError(message);
      setHistory([{ type: "END", text: message, input: "", ts: new Date() }]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }

  function addScreen(type, text, inputValue = "") {
    setHistory((prev) => [
      ...prev,
      { type, text, input: inputValue, ts: new Date() },
    ]);
  }

  async function processInput(value) {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) {
      return;
    }

    if (trimmed === "00") {
      setInput("");
      await startSession(createSessionId(), phoneNumber);
      return;
    }

    const nextInputs = [...sessionInputs, trimmed];
    setIsProcessing(true);
    setGatewayError("");

    try {
      const result = await callUssdGateway({
        sessionId,
        phoneNumber,
        inputs: nextInputs,
      });
      setSessionInputs(nextInputs);
      setLastResponseType(result.type);
      setState(
        result.type === "END"
          ? "session_ended"
          : `awaiting_input_step_${nextInputs.length + 1}`,
      );
      addScreen(result.type, result.text, trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach USSD gateway.";
      setLastResponseType("END");
      setState("gateway_error");
      setGatewayError(message);
      addScreen("END", message, trimmed);
    } finally {
      setInput("");
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }

  async function runDemoPath(sequence, overridePhone) {
    if (overridePhone) {
      setPhoneNumber(overridePhone);
    }
    const targetPhone = overridePhone || phoneNumber;
    
    const nextSessionId = createSessionId();
    await startSession(nextSessionId, targetPhone);

    for (const step of sequence) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await processInput(step);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F0A1E",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <a
            href="/"
            style={{
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Home
          </a>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                background: "linear-gradient(135deg, #A78BFA, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🌟 USSD Simulator
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              Canonical offline demo of *384# using the real FastAPI USSD flow
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div
              style={{
                background: "#1a1a2e",
                borderRadius: 32,
                padding: "20px 16px 32px",
                border: "3px solid #333",
                boxShadow: "0 0 40px rgba(124,58,237,0.2)",
                maxWidth: 340,
                margin: "0 auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div
                  style={{
                    width: 80,
                    height: 6,
                    borderRadius: 3,
                    background: "#333",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#000",
                  borderRadius: 12,
                  padding: 16,
                  minHeight: 360,
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    fontSize: 11,
                    color: "#666",
                  }}
                >
                  <span>{phoneNumber}</span>
                  <span>{DEFAULT_SERVICE_CODE}</span>
                </div>

                <div ref={historyRef} style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
                  {history.map((item, index) => (
                    <div key={`${item.ts.toISOString()}-${index}`} style={{ marginBottom: 12 }}>
                      {item.input && (
                        <div
                          style={{
                            color: "#666",
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          ▶ You entered: {item.input}
                        </div>
                      )}
                      <div style={{ color: SCREEN_COLORS[item.type] || "#fff" }}>
                        {item.type === "END" && (
                          <span style={{ color: "#FFB800", fontSize: 11 }}>
                            END SESSION
                            <br />
                          </span>
                        )}
                        {item.text}
                      </div>
                    </div>
                  ))}
                  {isProcessing && <div style={{ color: "#7C3AED" }}>Processing...</div>}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    borderTop: "1px solid #222",
                    paddingTop: 10,
                  }}
                >
                  <div style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>
                    Enter option:
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void processInput(input);
                        }
                      }}
                      placeholder="type here..."
                      style={{
                        flex: 1,
                        background: "#111",
                        border: "1px solid #333",
                        color: "#00FF41",
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => {
                        void processInput(input);
                      }}
                      style={{
                        padding: "6px 12px",
                        background: "#7C3AED",
                        border: "none",
                        borderRadius: 6,
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  marginTop: 16,
                }}
              >
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                  <button
                    key={key}
                    onClick={() => setInput((previous) => previous + key)}
                    style={{
                      padding: "10px 0",
                      borderRadius: 8,
                      background: "#222",
                      border: "1px solid #333",
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => setInput((previous) => previous.slice(0, -1))}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    background: "#1a1a2e",
                    border: "1px solid #333",
                    color: "#ff6b6b",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ⌫ Del
                </button>
                <button
                  onClick={() => {
                    void processInput(input);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    background: "#7C3AED",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ✓ Send
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                CURRENT STATE
              </div>
              <div style={{ fontWeight: 700, color: "#A78BFA" }}>{state}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
                Session ID: {sessionId}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                Last response: {lastResponseType}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                Inputs sent: {sessionInputs.length}
              </div>
              {gatewayError && (
                <div style={{ color: "#FCA5A5", fontSize: 13, marginTop: 6 }}>
                  {gatewayError}
                </div>
              )}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                CANONICAL FLOW
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                This simulator now calls the real FastAPI USSD gateway through
                <span style={{ color: "#A78BFA" }}> /api/ussd/callback</span>.
                The browser demo, the product surface, and the backend callback now share one Redis-backed flow.
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                PHONE NUMBER
              </div>
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#fff",
                  outline: "none",
                  fontSize: 13,
                }}
              />
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                QUICK DEMO PATHS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {QUICK_PATHS.map((path) => (
                  <button
                    key={path.label}
                    onClick={() => {
                      void runDemoPath(path.sequence, path.phone);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      textAlign: "left",
                      fontSize: 13,
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#A78BFA",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {path.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                SPECIAL INPUTS
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <div>
                  <span style={{ color: "#A78BFA", fontFamily: "monospace" }}>00</span>{" "}
                  — Start a fresh simulator session
                </div>
                <div>
                  <span style={{ color: "#FFB800", fontFamily: "monospace" }}>END</span>{" "}
                  — Session terminated by backend
                </div>
                <div>
                  <span style={{ color: "#00FF41", fontFamily: "monospace" }}>CON</span>{" "}
                  — Backend expects more input
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#F87171",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                🛡️ SAFETY DEMO
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                This screen now exercises the canonical USSD callback path. Safety escalation still belongs to the FastAPI safety endpoints and temporal detector instead of a browser-only mock flow.
              </p>
            </div>

            <button
              onClick={() => {
                void startSession(createSessionId(), phoneNumber);
                setInput("");
              }}
              style={{
                padding: "12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              🔄 Reset Simulator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

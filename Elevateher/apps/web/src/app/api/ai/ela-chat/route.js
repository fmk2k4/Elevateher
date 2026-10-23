/**
 * /api/ai/ela-chat/route.js
 *
 * Stateless Ela AI chat route — no session/match required.
 * Used by the standalone /session/ai-tutor page for demo mode
 * or when a mentee hasn't been matched yet.
 *
 * If DEEPSEEK_API_KEY is set, uses DeepSeek API.
 * Falls back to Gemini API (GEMINI_API_KEY).
 * Falls back to a deterministic coaching response.
 */

const SYSTEM_PROMPT = `You are Ela, an AI career mentor for young women in Southeast Asia aged 14–22.
You practice Socratic coaching — you NEVER give direct answers. Instead, ask ONE powerful guiding question that helps the mentee discover the answer themselves.

Rules:
1. Acknowledge feelings and effort before addressing facts.
2. Maximum 3 sentences per response. Keep it SMS-friendly.
3. If they share a win, celebrate specifically, then gently push forward with a question.
4. If they express distress ("overwhelmed", "can't", "failing", "hopeless"), shift entirely to support mode.
5. Connect responses to their SDG track when possible (SDG 4.4 Skills, SDG 5.5 Empowerment, SDG 8.6 Employment).
6. End every message with a question to keep the conversation moving.`;

const FALLBACK_RESPONSES = [
  "That's a really important question to reflect on. What do you think would be the very first small step you could take this week toward that goal?",
  "I can hear that you're thinking deeply about this. What would success look like to you in 6 months if everything went well?",
  "Thank you for sharing that with me. What's the biggest thing holding you back from taking action right now?",
  "That sounds challenging, and I'm proud of you for thinking it through. If your future self could give you one piece of advice today, what do you think she'd say?",
  "What an interesting situation! Let's think about your strengths. Which skill of yours do you feel could help you most here?",
];

async function tryDeepSeek(messages) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-reasoner",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
    signal: AbortSignal.timeout(15000), // Reasoner takes longer
  });

  if (!res.ok) return null;
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  return {
    reply: message?.content || null,
    reasoning: message?.reasoning_content || null,
  };
}

async function tryGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const history = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history,
        generationConfig: { temperature: 0.72, maxOutputTokens: 250 },
      }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function POST(request) {
  try {
    const { message, history = [] } = await request.json();

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Build conversation history for the model
    const chatHistory = history.slice(-10); // Keep last 10 turns max
    chatHistory.push({ role: "user", content: message });

    // Try DeepSeek first, then Gemini, then fallback
    const deepSeekRes = await tryDeepSeek(chatHistory).catch(() => null);
    const geminiRes = await tryGemini(chatHistory).catch(() => null);

    let reply = deepSeekRes?.reply || geminiRes || FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
    let reasoning = deepSeekRes?.reasoning || null;

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(`data: ${JSON.stringify({ type: 'metadata', reasoning })}\n\n`);
        
        const chunkSize = 4;
        for (let i = 0; i < reply.length; i += chunkSize) {
          const chunk = reply.slice(i, i + chunkSize);
          controller.enqueue(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          await new Promise(r => setTimeout(r, 10));
        }
        
        controller.enqueue("data: [DONE]\n\n");
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (err) {
    console.error("[ela-chat]", err);
    
    const fallback = "I'm here with you. Can you tell me a bit more about what you're experiencing right now?";
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(`data: ${JSON.stringify({ type: 'chunk', content: fallback })}\n\n`);
        controller.enqueue("data: [DONE]\n\n");
        controller.close();
      }
    });
    
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}

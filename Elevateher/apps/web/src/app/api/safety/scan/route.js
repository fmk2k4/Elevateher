import { auth } from "@/auth";

// SEA-Guard equivalent — AI-powered safety scanner using Gemini
// Covers: bio scanning, message scanning, temporal grooming detection

const OFF_PLATFORM_PATTERNS = [
  /whatsapp/i,
  /wechat/i,
  /telegram/i,
  /line\s+app/i,
  /signal\s+app/i,
  /nomor\s+hp/i,
  /nombor\s+telefon/i,
  /personal\s+number/i,
  /private\s+number/i,
  /meet\s+outside/i,
  /meet\s+in\s+person/i,
  /come\s+to\s+my/i,
  /don't\s+tell\s+(anyone|your\s+parents|your\s+family)/i,
  /rahsia\s+kita/i,
  /jangan\s+beritahu/i,
  /rahasia\s+kita/i,
  /special\s+girl/i,
  /special\s+to\s+me/i,
  /mature\s+for\s+your\s+age/i,
  /bagi\s+nombor/i,
  /kasih\s+nomor/i,
  /send\s+your\s+(number|phone)/i,
];

const ISOLATION_PATTERNS = [
  /just\s+between\s+us/i,
  /our\s+little\s+secret/i,
  /don't\s+tell/i,
  /no\s+one\s+needs\s+to\s+know/i,
  /keep\s+this\s+private/i,
  /rahsia\s+kita\s+saja/i,
  /simpan\s+rahsia/i,
];

const RAPID_INTIMACY_PATTERNS = [
  /you're\s+so\s+beautiful/i,
  /i\s+love\s+you/i,
  /you're\s+special/i,
  /i\s+think\s+about\s+you/i,
  /miss\s+you\s+so\s+much/i,
  /you're\s+not\s+like\s+other\s+girls/i,
];

function checkPatterns(text) {
  const flags = [];
  const lower = text.toLowerCase();
  for (const p of OFF_PLATFORM_PATTERNS) {
    if (p.test(lower)) {
      flags.push("off_platform_solicitation");
      break;
    }
  }
  for (const p of ISOLATION_PATTERNS) {
    if (p.test(lower)) {
      flags.push("isolation_language");
      break;
    }
  }
  for (const p of RAPID_INTIMACY_PATTERNS) {
    if (p.test(lower)) {
      flags.push("rapid_intimacy");
      break;
    }
  }
  return flags;
}

async function scanWithAI(text, type = "message") {
  const systemPrompt = `You are SEA-Guard, a child safety content moderation AI for ElevateHer — a mentorship platform for girls aged 14-22.
Your job is to scan ${type === "bio" ? "mentor bios" : "messages"} for safety risks.

Rate the content on a safety scale from 0.0 (extremely unsafe) to 1.0 (completely safe).
Identify any of these flags if present:
- off_platform_solicitation: requesting to move to WhatsApp, Telegram, personal phone, etc.
- isolation_language: "don't tell anyone", "keep this secret", etc.
- rapid_intimacy: inappropriate romantic/personal language toward a minor
- personal_info_request: asking for address, school, location, etc.
- career_unrelated: content with no educational or career mentorship value
- content_too_short: less than 20 meaningful words (for bios)

Respond in JSON only:
{
  "safe_score": 0.0-1.0,
  "approved": true/false,
  "flags": ["flag1", "flag2"],
  "reason": "brief explanation"
}

approved = true if safe_score >= 0.75 AND no critical flags (off_platform_solicitation, isolation_language, rapid_intimacy)`;

  try {
    const resp = await fetch("/integrations/google-gemini-2-5-flash/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Scan this ${type}:\n\n"${text.slice(0, 2000)}"`,
          },
        ],
      }),
    });

    if (!resp.ok) throw new Error("AI scan failed");
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("AI scan error:", e);
  }
  return null;
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { text, type = "message" } = body;

    if (!text || text.trim().length < 2) {
      return Response.json({
        safe_score: 0.0,
        approved: false,
        flags: ["content_too_short"],
        reason: "Content is too short to evaluate",
        content_hash: "",
      });
    }

    // Quick pattern check (no AI needed for obvious violations)
    const patternFlags = checkPatterns(text);

    // Hash for deduplication
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // If obvious violation caught by patterns, skip AI
    if (
      patternFlags.length > 0 &&
      ["off_platform_solicitation", "isolation_language"].some((f) =>
        patternFlags.includes(f),
      )
    ) {
      return Response.json({
        safe_score: 0.1,
        approved: false,
        flags: patternFlags,
        reason: "Safety patterns detected",
        content_hash: contentHash,
        method: "pattern",
      });
    }

    // AI scan for nuanced content
    const aiResult = await scanWithAI(text, type);
    if (aiResult) {
      const allFlags = [
        ...new Set([...patternFlags, ...(aiResult.flags || [])]),
      ];
      return Response.json({
        ...aiResult,
        flags: allFlags,
        approved:
          aiResult.safe_score >= 0.75 &&
          !allFlags.some((f) =>
            [
              "off_platform_solicitation",
              "isolation_language",
              "rapid_intimacy",
            ].includes(f),
          ),
        content_hash: contentHash,
        method: "ai",
      });
    }

    // Fallback: pattern-only
    return Response.json({
      safe_score: patternFlags.length > 0 ? 0.3 : 0.85,
      approved: patternFlags.length === 0,
      flags: patternFlags,
      reason:
        patternFlags.length > 0
          ? "Safety patterns detected"
          : "Passed pattern check",
      content_hash: contentHash,
      method: "pattern_fallback",
    });
  } catch (err) {
    console.error("POST /api/safety/scan", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

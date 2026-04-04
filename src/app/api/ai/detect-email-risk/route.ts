import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

interface DetectedItem {
  type: "risk" | "decision" | "none";
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, body, fromName } = await req.json();
  if (!subject && !body) return NextResponse.json({ error: "Missing email content" }, { status: 400 });

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    // Fallback: keyword-based detection
    return NextResponse.json(detectByKeywords(subject || "", body || ""));
  }

  try {
    const prompt = `Analyze this email and determine if it contains:
1. A PROJECT RISK (something that could delay, block, or negatively impact the project)
2. A DECISION (a decision that was made or needs to be recorded)

Email Subject: ${subject}
From: ${fromName || "Unknown"}
Body excerpt: ${(body || "").slice(0, 1000)}

Respond with JSON only:
{
  "items": [
    {
      "type": "risk" or "decision" or "none",
      "title": "short title for the risk/decision",
      "description": "1-2 sentence summary",
      "confidence": "high" or "medium" or "low"
    }
  ]
}

If the email is just informational/FYI with no risk or decision, return {"items": [{"type": "none", "title": "", "description": "", "confidence": "high"}]}.`;

    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [
          { role: "system", content: "You are a PM assistant that detects project risks and decisions from emails. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return NextResponse.json(detectByKeywords(subject || "", body || ""));

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return NextResponse.json({ items: parsed.items || [] });
      }
    } catch { /* fall through */ }
    return NextResponse.json(detectByKeywords(subject || "", body || ""));
  } catch {
    return NextResponse.json(detectByKeywords(subject || "", body || ""));
  }
}

function detectByKeywords(subject: string, body: string): { items: DetectedItem[] } {
  const text = `${subject} ${body}`.toLowerCase();
  const items: DetectedItem[] = [];

  const riskKeywords = ["delay", "block", "at risk", "behind schedule", "can't meet", "deadline", "escalat", "critical issue", "outage", "incident", "failure"];
  const decisionKeywords = ["decided", "approved", "agreed", "confirmed", "we'll go with", "signed off", "the decision is", "moving forward with"];

  const hasRisk = riskKeywords.some(kw => text.includes(kw));
  const hasDecision = decisionKeywords.some(kw => text.includes(kw));

  if (hasRisk) {
    items.push({
      type: "risk",
      title: `Potential risk: ${subject.slice(0, 60)}`,
      description: `Detected risk-related language in email from this thread.`,
      confidence: "medium",
    });
  }
  if (hasDecision) {
    items.push({
      type: "decision",
      title: `Decision: ${subject.slice(0, 60)}`,
      description: `A decision appears to have been made in this email thread.`,
      confidence: "medium",
    });
  }
  if (items.length === 0) {
    items.push({ type: "none", title: "", description: "", confidence: "high" });
  }
  return { items };
}

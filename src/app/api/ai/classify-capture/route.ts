import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text || typeof text !== "string" || text.length < 2) {
    return NextResponse.json({ type: "task", confidence: 0.5, suggestedFields: {} });
  }

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    // Fallback: simple keyword-based classification
    return NextResponse.json(classifyByKeywords(text));
  }

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [
          {
            role: "system",
            content: `You classify text into categories for a PM productivity app. Classify the input text into exactly one of: task, note, risk, decision, followup.

Rules:
- "task": actionable items, todos, reminders
- "note": observations, thoughts, meeting notes
- "risk": potential problems, blockers, warnings
- "decision": choices made, agreements, approvals
- "followup": items to track/chase with someone

Respond ONLY with valid JSON: {"type":"task"|"note"|"risk"|"decision"|"followup","confidence":0.0-1.0,"suggestedFields":{}}.
suggestedFields can include: {"priority":1-4, "dueDate":"YYYY-MM-DD", "severity":"low"|"medium"|"high", "contactName":"...", "rationale":"..."}`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      return NextResponse.json(classifyByKeywords(text));
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    // Extract JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        type: parsed.type || "task",
        confidence: parsed.confidence || 0.7,
        suggestedFields: parsed.suggestedFields || {},
      });
    }
    return NextResponse.json(classifyByKeywords(text));
  } catch {
    return NextResponse.json(classifyByKeywords(text));
  }
}

function classifyByKeywords(text: string): { type: string; confidence: number; suggestedFields: Record<string, unknown> } {
  const lower = text.toLowerCase();
  if (/\brisk\b|\bblocker\b|\bthreat\b|\bdanger\b|\bconcern\b|might fail|could break/.test(lower)) {
    return { type: "risk", confidence: 0.7, suggestedFields: { severity: "medium" } };
  }
  if (/\bdecided\b|\bagreed\b|\bapproved\b|\bchose\b|decision:|we chose/.test(lower)) {
    return { type: "decision", confidence: 0.7, suggestedFields: {} };
  }
  if (/\bfollow.?up\b|\bcheck.?in\b|\bping\b|\breach out\b|\bremind\b.*\babout\b/.test(lower)) {
    return { type: "followup", confidence: 0.7, suggestedFields: {} };
  }
  if (/\bnote\b|\bobserved\b|\bnoticed\b|\bfyi\b|\bfor reference\b/.test(lower)) {
    return { type: "note", confidence: 0.6, suggestedFields: {} };
  }
  return { type: "task", confidence: 0.6, suggestedFields: {} };
}

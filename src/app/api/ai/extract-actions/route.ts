import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notes } = await req.json();
  if (!notes) return NextResponse.json({ error: "notes required" }, { status: 400 });

  const apiKey = process.env.DEEPINFRA_API_KEY;

  const systemPrompt = `Extract action items and decisions from these meeting notes.

Return a JSON object with:
{
  "actionItems": [{ "text": "action description", "assignee": "name or null" }],
  "decisions": [{ "text": "decision description" }]
}

Look for:
- Patterns like [ACTION: ...] or TODO or tasks assigned
- Patterns like [DECISION: ...] or agreed-upon choices
- Implicit action items from the discussion

Return only the JSON, no other text.`;

  // Parse explicit patterns first
  const explicitActions: Array<{ text: string; assignee: string | null }> = [];
  const explicitDecisions: Array<{ text: string }> = [];

  const actionPattern = /\[ACTION:\s*([^\]]+)\]/gi;
  const decisionPattern = /\[DECISION:\s*([^\]]+)\]/gi;

  let match;
  while ((match = actionPattern.exec(notes)) !== null) {
    explicitActions.push({ text: match[1].trim(), assignee: null });
  }
  while ((match = decisionPattern.exec(notes)) !== null) {
    explicitDecisions.push({ text: match[1].trim() });
  }

  if (!apiKey) {
    return NextResponse.json({
      actionItems: explicitActions.length > 0 ? explicitActions : [{ text: "Review meeting notes and identify follow-ups", assignee: null }],
      decisions: explicitDecisions,
    });
  }

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: notes },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error("AI unavailable");
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          actionItems: [...explicitActions, ...(parsed.actionItems || [])],
          decisions: [...explicitDecisions, ...(parsed.decisions || [])],
        });
      }
    } catch { /* JSON parse failed, use explicit patterns */ }

    return NextResponse.json({
      actionItems: explicitActions,
      decisions: explicitDecisions,
    });
  } catch {
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}

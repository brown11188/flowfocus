import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── DeepInfra Adapter ───────────────────────────────────────────────────────
// DeepInfra exposes an OpenAI-compatible chat completions endpoint.
// Docs: https://deepinfra.com/docs/advanced/openai_api
const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL =
  process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

async function callDeepInfra(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPINFRA_MODEL,
      messages,
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepInfra error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "{}";
}
// ─────────────────────────────────────────────────────────────────────────────

const refreshCounts: Record<string, { count: number; resetAt: number }> = {};

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = refreshCounts[userId];
  if (!userLimit || now > userLimit.resetAt) {
    refreshCounts[userId] = { count: 1, resetAt: now + 3600000 };
    return true;
  }
  if (userLimit.count >= 5) return false;
  userLimit.count++;
  return true;
}

function fallbackPrioritize(
  tasks: { id: string; title: string; priority: number; dueDate: Date | null }[]
) {
  const scored = tasks.map((t) => {
    let score = 0;
    if (t.dueDate) {
      const hoursUntilDue = (t.dueDate.getTime() - Date.now()) / 3600000;
      if (hoursUntilDue < 2) score += 100;
      else if (hoursUntilDue < 24) score += 50;
      else if (hoursUntilDue < 48) score += 25;
    }
    score += (5 - t.priority) * 20;
    return { ...t, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((t, i) => ({
      taskId: t.id,
      rank: i + 1,
      reason:
        t.dueDate && (t.dueDate.getTime() - Date.now()) / 3600000 < 24
          ? `Due soon and marked P${t.priority}`
          : `High priority task (P${t.priority})`,
    }));
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 5 refreshes per hour." },
      { status: 429 }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tasks = await db.query.tasks.findMany({
    where: (t, { eq: e, and: a, or: o, lte }) => a(
      e(t.userId, session.user.id),
      e(t.isDeleted, false),
      e(t.completed, false),
      o(lte(t.dueDate, tomorrow), lte(t.priority, 2))
    ),
    with: { project: true },
    limit: 20,
  });

  if (tasks.length === 0) {
    return NextResponse.json({
      greeting: `Good ${getTimeOfDay()}! 🌟`,
      summary:
        "You have no pending tasks for today. Great job staying on top of things!",
      priorities: [],
    });
  }

  const taskList = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate,
    project: t.project?.name || "Inbox",
  }));

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    // No API key configured — use deterministic fallback
    return NextResponse.json({
      greeting: `Good ${getTimeOfDay()}, ${
        session.user.name?.split(" ")[0] || "there"
      }! 👋`,
      summary: `You have ${tasks.length} active tasks. Here are your top priorities for today.`,
      priorities: fallbackPrioritize(taskList),
    });
  }

  const prompt = `You are a productivity assistant. Analyze these tasks and identify the top 3 most important ones to focus on today.

Tasks:
${taskList
  .map(
    (t) =>
      `- ID: ${t.id} | "${t.title}" | Priority: P${t.priority} | Due: ${
        t.dueDate ? t.dueDate.toLocaleDateString() : "No due date"
      } | Project: ${t.project}`
  )
  .join("\n")}

Today's date: ${new Date().toLocaleDateString()}
User's name: ${session.user.name || "User"}

Respond with JSON only:
{
  "greeting": "personalized greeting with time of day",
  "summary": "2-3 sentence motivational summary of the day ahead",
  "priorities": [
    { "taskId": "id", "rank": 1, "reason": "brief reason why this is top priority" },
    { "taskId": "id", "rank": 2, "reason": "brief reason" },
    { "taskId": "id", "rank": 3, "reason": "brief reason" }
  ]
}`;

  try {
    const raw = await callDeepInfra(apiKey, [
      { role: "user", content: prompt },
    ]);
    const result = JSON.parse(raw);
    return NextResponse.json(result);
  } catch (error) {
    console.error("DeepInfra error:", error);
    return NextResponse.json({
      greeting: `Good ${getTimeOfDay()}, ${
        session.user.name?.split(" ")[0] || "there"
      }! 👋`,
      summary: `You have ${tasks.length} active tasks. Focus on your highest priority items first.`,
      priorities: fallbackPrioritize(taskList),
    });
  }
}

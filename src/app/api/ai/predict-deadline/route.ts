import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";

/**
 * FEAT-03: Smart Deadline Prediction
 * Analyzes task title + user's historical completion patterns
 * to suggest a realistic due date.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, projectId } = await req.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Gather historical context
  const [recentTasks, openTasks] = await Promise.all([
    // Last 50 completed tasks with duration data
    prisma.task.findMany({
      where: { userId, completed: true, completedAt: { not: null } },
      select: { title: true, createdAt: true, completedAt: true, estimatedHours: true, priority: true },
      orderBy: { completedAt: "desc" },
      take: 50,
    }),
    // Current open tasks for workload assessment
    prisma.task.findMany({
      where: { userId, completed: false, isDeleted: false },
      select: { title: true, dueDate: true, priority: true },
    }),
  ]);

  // Calculate average completion time
  const completionDays = recentTasks
    .filter(t => t.completedAt && t.createdAt)
    .map(t => {
      const created = new Date(t.createdAt).getTime();
      const completed = new Date(t.completedAt!).getTime();
      return Math.max(1, Math.round((completed - created) / (1000 * 60 * 60 * 24)));
    });
  const avgDays = completionDays.length > 0
    ? Math.round(completionDays.reduce((a, b) => a + b, 0) / completionDays.length)
    : 3;

  const todayOpenCount = openTasks.filter(t => t.dueDate && t.dueDate.toString().startsWith(todayStr)).length;
  const totalOpen = openTasks.length;

  // If no API key, use heuristic
  if (!DEEPINFRA_API_KEY) {
    const suggestDays = Math.max(1, avgDays);
    const suggestedDate = new Date(now);
    suggestedDate.setDate(suggestedDate.getDate() + suggestDays);
    // Skip weekends
    while (suggestedDate.getDay() === 0 || suggestedDate.getDay() === 6) {
      suggestedDate.setDate(suggestedDate.getDate() + 1);
    }
    return NextResponse.json({
      suggestedDate: suggestedDate.toISOString().split("T")[0],
      reasoning: `Based on your average completion time of ~${avgDays} day(s)`,
      confidence: "medium" as const,
    });
  }

  // AI prediction
  try {
    const prompt = `You are a productivity assistant. Suggest a realistic due date for this task.

Task: "${title.slice(0, 100)}"
Today: ${todayStr} (${now.toLocaleDateString("en-US", { weekday: "long" })})
User stats:
- Average task completion time: ${avgDays} days
- Currently ${totalOpen} open tasks
- ${todayOpenCount} tasks due today
- Recent task titles: ${recentTasks.slice(0, 5).map(t => t.title).join(", ")}

Respond ONLY with JSON:
{"suggestedDate":"YYYY-MM-DD","reasoning":"brief reason","confidence":"high|medium|low"}

Rules:
- Suggest a weekday (Mon-Fri)
- Consider current workload
- If task sounds complex (multiple steps, research, review), allow more days
- If task sounds simple (reply, call, check), suggest tomorrow or today`;

    const res = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`DeepInfra ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        suggestedDate: parsed.suggestedDate || todayStr,
        reasoning: parsed.reasoning || "AI suggestion",
        confidence: parsed.confidence || "medium",
      });
    }
  } catch (err) {
    console.error("[PredictDeadline] AI error:", err);
  }

  // Fallback
  const fallbackDate = new Date(now);
  fallbackDate.setDate(fallbackDate.getDate() + avgDays);
  while (fallbackDate.getDay() === 0 || fallbackDate.getDay() === 6) {
    fallbackDate.setDate(fallbackDate.getDate() + 1);
  }
  return NextResponse.json({
    suggestedDate: fallbackDate.toISOString().split("T")[0],
    reasoning: `Based on your average completion time of ~${avgDays} day(s)`,
    confidence: "low" as const,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { weekStats } = await req.json();
  const apiKey = process.env.DEEPINFRA_API_KEY;

  const prompt = `You are a productivity assistant. Generate a concise weekly summary for a PM based on these stats:
- Completed: ${weekStats.completed} tasks
- Overdue: ${weekStats.overdue} tasks
- Focus time: ${Math.floor(weekStats.focusMinutes / 60)}h ${weekStats.focusMinutes % 60}m
- Completion rate: ${weekStats.completionRate}%
- Daily breakdown: ${weekStats.byDay?.map((d: { day: string; completedCount: number; focusMinutes: number }) => `${d.day}:${d.completedCount} done,${d.focusMinutes}m focus`).join("; ")}

Provide:
1. summary: 3-4 sentence narrative summary
2. slackFormat: Same content formatted for Slack (use bold, bullet points)
3. emailFormat: Same content as professional email update

Respond ONLY with JSON: {"summary":"...","slackFormat":"...","emailFormat":"..."}`.trim();

  if (!apiKey) {
    const summary = `This week you completed ${weekStats.completed} tasks with a ${weekStats.completionRate}% completion rate. You focused for ${Math.floor(weekStats.focusMinutes / 60)} hours. ${weekStats.overdue > 0 ? `${weekStats.overdue} tasks are overdue and need attention.` : "Great job keeping up!"}`;
    return NextResponse.json({
      summary,
      slackFormat: `*Weekly Update*\n• Completed: ${weekStats.completed} tasks\n• Focus: ${Math.floor(weekStats.focusMinutes / 60)}h\n• Rate: ${weekStats.completionRate}%`,
      emailFormat: `Weekly Update\n\n${summary}\n\nBest regards`,
    });
  }

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.5,
      }),
    });
    if (!res.ok) throw new Error("AI failed");
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    }
    return NextResponse.json({ summary: content, slackFormat: content, emailFormat: content });
  } catch {
    return NextResponse.json({
      summary: `Completed ${weekStats.completed} tasks this week. Completion rate: ${weekStats.completionRate}%.`,
      slackFormat: `*Weekly*: ${weekStats.completed} done, ${weekStats.completionRate}% rate`,
      emailFormat: `This week: ${weekStats.completed} tasks completed.`,
    });
  }
}

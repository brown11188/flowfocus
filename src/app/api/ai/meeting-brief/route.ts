import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, attendees, meetingTime } = await req.json();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const userId = session.user.id;
  const apiKey = process.env.DEEPINFRA_API_KEY;

  // Gather related context
  const [recentTasks, recentEmails] = await Promise.all([
    prisma.task.findMany({
      where: { userId, isDeleted: false, completed: false },
      select: { id: true, title: true, priority: true, dueDate: true, project: { select: { name: true } } },
      orderBy: { priority: "asc" },
      take: 20,
    }),
    prisma.emailDigest.findMany({
      where: { userId },
      select: { aiSummary: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }).catch(() => []),
  ]);

  const contextParts = [
    `Meeting: "${title}"`,
    meetingTime ? `Time: ${meetingTime}` : "",
    attendees?.length ? `Attendees: ${attendees.join(", ")}` : "",
    "\nRelated open tasks:",
    ...recentTasks.slice(0, 10).map((t) => `- ${t.title} (P${t.priority}${t.project?.name ? `, ${t.project.name}` : ""}${t.dueDate ? `, due ${new Date(t.dueDate).toLocaleDateString()}` : ""})`),
    recentEmails.length > 0 ? "\nRecent email digest:" : "",
    ...recentEmails.slice(0, 3).map((e: { aiSummary: string | null }) => `- ${e.aiSummary || "(no summary)"}`),
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a meeting prep assistant for a Product Manager. Generate a concise brief (3-5 bullet points) to prepare for this meeting. Consider:
- What topics are likely based on the title and attendees
- Any relevant open tasks or email threads
- Key talking points or decisions needed
- Potential risks or blockers to address

Format as bullet points. Be specific and actionable.`;

  if (!apiKey) {
    const fallback = [
      `• Review agenda items for "${title}"`,
      `• ${recentTasks.length} open tasks may be relevant to discuss`,
      attendees?.length ? `• Prepare updates for ${attendees.length} attendees` : "• Check if attendee list is finalized",
      "• Have recent metrics and progress data ready",
      "• Note any blockers or decisions needed from this meeting",
    ];
    return NextResponse.json({ brief: fallback, suggestedAgenda: ["Review progress", "Open items", "Next steps"] });
  }

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextParts },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error("AI unavailable");
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse bullets
    const brief = content
      .split("\n")
      .filter((l: string) => l.trim().startsWith("•") || l.trim().startsWith("-") || l.trim().startsWith("*"))
      .map((l: string) => l.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    return NextResponse.json({ brief: brief.length > 0 ? brief : [content.trim()], suggestedAgenda: [] });
  } catch {
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}

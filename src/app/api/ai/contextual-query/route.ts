import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { query, history } = await req.json();
  if (!query) return new Response("query required", { status: 400 });

  const userId = session.user.id;
  const apiKey = process.env.DEEPINFRA_API_KEY;

  // Build context from DB
  const [allTasks, focusSessions] = await Promise.all([
    prisma.task.findMany({
      where: { userId, isDeleted: false },
      select: { id: true, title: true, priority: true, dueDate: true, completed: true, project: { select: { name: true } } },
      take: 100,
    }),
    prisma.focusSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { taskLabel: true, actualMins: true, createdAt: true },
    }),
  ]);

  const overdue = allTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date());
  const today = allTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString());

  const contextStr = [
    `Total tasks: ${allTasks.length} (${allTasks.filter(t => t.completed).length} completed)`,
    `Overdue: ${overdue.length}`,
    `Due today: ${today.length}`,
    `Today's tasks: ${today.map(t => `"${t.title}" (P${t.priority}${t.project?.name ? ` in ${t.project.name}` : ""})`).join(", ") || "none"}`,
    `Recent focus: ${focusSessions.map(s => `${s.actualMins}min on "${s.taskLabel}"`).join(", ") || "none"}`,
    overdue.length > 0 ? `Overdue tasks: ${overdue.slice(0, 5).map(t => `"${t.title}"`).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a productivity assistant for a PM. You have access to their tasks, emails, and calendar. Be concise. Reference specific items by name. Suggest concrete next actions.

Current context:
${contextStr}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-10),
    { role: "user", content: query },
  ];

  if (!apiKey) {
    // Fallback
    const fallback = `Based on your current workload: ${today.length} tasks due today, ${overdue.length} overdue. I'd recommend focusing on your highest priority items first.`;
    return new Response(
      new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "text", content: fallback })}\n\n`));
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } }
    );
  }

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEEPINFRA_MODEL, messages, max_tokens: 800, temperature: 0.7, stream: true }),
    });

    if (!res.ok || !res.body) {
      return new Response(JSON.stringify({ error: "AI unavailable" }), { status: 500 });
    }

    // Stream SSE to client
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    return new Response(
      new ReadableStream({
        async pull(controller) {
          const enc = new TextEncoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                  controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "text", content: delta })}\n\n`));
                  }
                } catch { /* skip */ }
              }
            }
          }
        },
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "AI error" }), { status: 500 });
  }
}

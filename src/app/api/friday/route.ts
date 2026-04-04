import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq, and, lt, lte, gt, gte, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ─── DeepInfra adapter ───────────────────────────────────────────────────────
const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

async function callDeepInfra(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  // Note: response_format json_object is NOT used — not all DeepInfra models support it.
  // Instead we instruct the model via system prompt to always reply in JSON.
  const body: Record<string, unknown> = {
    model: DEEPINFRA_MODEL,
    messages,
    max_tokens: 1200,
    temperature: 0.7,
  };

  const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepInfra error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices[0]?.message?.content ?? "";
  return content;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FridayAction {
  type:
    | "create_task"
    | "complete_task"
    | "reschedule_task"
    | "search_tasks"
    | "weekly_summary"
    | "schedule_suggestion"
    | "none";
  payload?: Record<string, unknown>;
}

interface FridayResponse {
  message: string;
  action?: FridayAction;
  tasks?: Array<{
    id: string;
    title: string;
    priority: number;
    dueDate: string | null;
    completed: boolean;
    projectName?: string;
  }>;
  createdTask?: { id: string; title: string };
}

// ─── Context builder ─────────────────────────────────────────────────────────
async function buildUserContext(userId: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);   todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);    weekEnd.setDate(now.getDate() + 7);

  const [allTasks, projectList, overdueTasks, todayTasks, upcomingTasks] = await Promise.all([
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false)),
      with: { project: true },
      orderBy: (t, { asc }) => [asc(t.priority), asc(t.dueDate)],
      limit: 60,
    }),
    db.query.projects.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    }),
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, lt: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), l(t.dueDate, todayStart)),
      with: { project: true },
      limit: 20,
    }),
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, gte: g, lte: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), g(t.dueDate, todayStart), l(t.dueDate, todayEnd)),
      with: { project: true },
      limit: 20,
    }),
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, gt: g, lte: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), g(t.dueDate, todayEnd), l(t.dueDate, weekEnd)),
      with: { project: true },
      limit: 20,
    }),
  ]);

  const [{ count: completedCount }] = await db.select({ count: count() }).from(tasks).where(
    and(eq(tasks.userId, userId), eq(tasks.completed, true), gte(tasks.completedAt, new Date(now.getTime() - 7 * 86400000)))
  );
  const completedThisWeek = Number(completedCount);

  return {
    allTasks,
    projects: projectList,
    overdueTasks,
    todayTasks,
    upcomingTasks,
    completedThisWeek,
    now,
  };
}

function formatTasksForPrompt(
  tasks: Array<{ id: string; title: string; priority: number; dueDate: Date | null; project?: { name: string } | null }>
) {
  return tasks
    .map(
      (t) =>
        `  • [${t.id.slice(-6)}] "${t.title}" | P${t.priority} | Due: ${
          t.dueDate ? t.dueDate.toLocaleDateString() : "No date"
        } | Project: ${t.project?.name ?? "Inbox"}`
    )
    .join("\n");
}

// ─── System prompt ───────────────────────────────────────────────────────────
function buildSystemPrompt(
  userName: string,
  ctx: Awaited<ReturnType<typeof buildUserContext>>
) {
  const { overdueTasks, todayTasks, upcomingTasks, projects, completedThisWeek, now } = ctx;

  return `You are Friday, a smart and friendly AI productivity assistant for FlowFocus — a task management app.
Your personality: warm, concise, proactive, slightly witty. You address the user by first name when natural.

Today: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
User: ${userName}

## User's Workspace Snapshot
Projects: ${projects.map((p) => `"${p.name}"`).join(", ") || "None yet"}
Completed this week: ${completedThisWeek} tasks
Overdue tasks (${overdueTasks.length}): 
${overdueTasks.length > 0 ? formatTasksForPrompt(overdueTasks) : "  (none)"}
Due today (${todayTasks.length}):
${todayTasks.length > 0 ? formatTasksForPrompt(todayTasks) : "  (none)"}
Upcoming this week (${upcomingTasks.length}):
${upcomingTasks.length > 0 ? formatTasksForPrompt(upcomingTasks) : "  (none)"}

## Your Capabilities
You can help the user with:
1. Answering questions about their tasks, deadlines, workload
2. Creating new tasks (extract title, due date, priority, project from natural language)
3. Completing tasks by partial title or ID
4. Rescheduling tasks
5. Searching/filtering tasks by keyword, priority, project, or date
6. Generating a weekly summary and productivity insights
7. Smart scheduling suggestions ("I have 2 hours, what should I do?")
8. Motivational coaching and productivity tips

## CRITICAL: Your ENTIRE response must be a single valid JSON object. No prose before or after. No markdown code fences.
Format:
{"message": "Your conversational response (markdown allowed inside the string value: **bold**, bullets, emojis)", "action": {"type": "create_task|complete_task|reschedule_task|search_tasks|weekly_summary|schedule_suggestion|none", "payload": {}}}

## Action Payloads
- create_task: { title, priority (1-4, default 4), dueDateISO (or null), projectName (or null), notes (or null) }
- complete_task: { taskId (last 6 chars) or titleKeyword }
- reschedule_task: { taskId or titleKeyword, newDueDateISO }
- search_tasks: { keyword, priority (optional), projectName (optional), overdue (optional bool), dueToday (optional bool) }
- schedule_suggestion: { availableHours }
- weekly_summary: {}
- none: {}

## Rules
- Always respond in JSON format
- Be concise but helpful; use markdown in "message"
- For ambiguous intents, pick the most likely action and mention it
- When listing tasks in "message", use the actual task titles from context
- Priority: P1=Urgent, P2=High, P3=Medium, P4=Low
- If no DEEPINFRA_API_KEY, still respond helpfully within context`;
}

// ─── Action executor ─────────────────────────────────────────────────────────
async function executeAction(
  action: FridayAction,
  userId: string,
  ctx: Awaited<ReturnType<typeof buildUserContext>>
): Promise<Partial<FridayResponse>> {
  switch (action.type) {
    case "create_task": {
      const p = action.payload as {
        title: string;
        priority?: number;
        dueDateISO?: string | null;
        projectName?: string | null;
        notes?: string | null;
      };
      if (!p?.title) return {};

      let projectId: string | null = null;
      if (p.projectName) {
        const proj = ctx.projects.find((pr) =>
          pr.name.toLowerCase().includes(p.projectName!.toLowerCase())
        );
        if (proj) projectId = proj.id;
      }
      if (!projectId) {
        const inbox = ctx.projects.find((pr) => pr.isInbox);
        if (inbox) projectId = inbox.id;
      }

      const [task] = await db.insert(tasks).values({
        title: p.title,
        priority: Math.min(4, Math.max(1, p.priority ?? 4)),
        dueDate: p.dueDateISO ? new Date(p.dueDateISO) : null,
        notes: p.notes ?? null,
        projectId,
        userId,
      }).returning({ id: tasks.id, title: tasks.title });
      return { createdTask: { id: task.id, title: task.title } };
    }

    case "search_tasks": {
      const p = action.payload as {
        keyword?: string;
        priority?: number;
        projectName?: string;
        overdue?: boolean;
        dueToday?: boolean;
      };
      let tasks = ctx.allTasks.filter((t) => {
        if (p.keyword && !t.title.toLowerCase().includes(p.keyword.toLowerCase())) return false;
        if (p.priority && t.priority !== p.priority) return false;
        if (p.projectName && !t.project?.name.toLowerCase().includes(p.projectName.toLowerCase())) return false;
        if (p.overdue) {
          const now = new Date(); now.setHours(0, 0, 0, 0);
          if (!t.dueDate || t.dueDate >= now) return false;
        }
        if (p.dueToday) {
          const s = new Date(); s.setHours(0, 0, 0, 0);
          const e = new Date(); e.setHours(23, 59, 59, 999);
          if (!t.dueDate || t.dueDate < s || t.dueDate > e) return false;
        }
        return true;
      });
      tasks = tasks.slice(0, 15);
      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
          completed: t.completed,
          projectName: t.project?.name,
        })),
      };
    }

    case "complete_task": {
      const p = action.payload as { taskId?: string; titleKeyword?: string };
      let task = null;
      if (p.taskId) {
        task = ctx.allTasks.find((t) => t.id.endsWith(p.taskId!));
      }
      if (!task && p.titleKeyword) {
        task = ctx.allTasks.find((t) =>
          t.title.toLowerCase().includes(p.titleKeyword!.toLowerCase())
        );
      }
      if (task) {
        await db.update(tasks).set({ completed: true, completedAt: new Date() }).where(eq(tasks.id, task.id));
      }
      return {};
    }

    case "reschedule_task": {
      const p = action.payload as {
        taskId?: string;
        titleKeyword?: string;
        newDueDateISO?: string;
      };
      let task = null;
      if (p.taskId) task = ctx.allTasks.find((t) => t.id.endsWith(p.taskId!));
      if (!task && p.titleKeyword)
        task = ctx.allTasks.find((t) =>
          t.title.toLowerCase().includes(p.titleKeyword!.toLowerCase())
        );
      if (task && p.newDueDateISO) {
        await db.update(tasks).set({ dueDate: new Date(p.newDueDateISO) }).where(eq(tasks.id, task.id));
      }
      return {};
    }

    default:
      return {};
  }
}

// ─── Streaming helper ───────────────────────────────────────────────────────────
function createStreamingResponse(
  message: string,
  tasks?: FridayResponse["tasks"],
  createdTask?: FridayResponse["createdTask"]
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send message in chunks for smooth streaming effect
      const chunkSize = 3; // characters per chunk
      for (let i = 0; i < message.length; i += chunkSize) {
        const chunk = message.slice(i, i + chunkSize);
        const data = JSON.stringify({ type: "text", content: chunk });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        // Small delay for smooth streaming effect
        await new Promise((r) => setTimeout(r, 15));
      }

      // Send tasks if present
      if (tasks && tasks.length > 0) {
        const data = JSON.stringify({ type: "tasks", tasks });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send createdTask if present
      if (createdTask) {
        const data = JSON.stringify({ type: "createdTask", createdTask });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send done signal
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── POST /api/friday ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  const messages = body.messages ?? [];
  if (!messages.length) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;
  const userName = session.user.name?.split(" ")[0] ?? "there";

  const ctx = await buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(userName, ctx);
  const apiKey = process.env.DEEPINFRA_API_KEY;

  // Build message history for the API
  const apiMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let rawResponse = "";

  if (!apiKey) {
    // Fallback: rule-based responses without AI
    rawResponse = buildFallbackResponse(messages[messages.length - 1]?.content ?? "", ctx, userName);
  } else {
    try {
      rawResponse = await callDeepInfra(apiKey, apiMessages);
    } catch (err) {
      console.error("[Friday] DeepInfra error:", err);
      // Fall back to rule-based on API error
      rawResponse = buildFallbackResponse(messages[messages.length - 1]?.content ?? "", ctx, userName);
    }
  }

  // Parse AI response — the model may wrap JSON in ```json ... ``` fences, strip them
  let cleaned = rawResponse.trim();
  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // Find first { ... } block in case model prepends explanation text
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  let parsed: FridayResponse;
  try {
    parsed = JSON.parse(cleaned) as FridayResponse;
    // Validate required fields
    if (!parsed.message || typeof parsed.message !== "string") {
      throw new Error("Missing message field");
    }
  } catch {
    // If still can't parse, use raw text as plain message
    parsed = {
      message: cleaned || "Sorry, I didn't understand that. Could you rephrase? 🤔",
      action: { type: "none" },
    };
  }

  // Execute action if present
  let createdTask: FridayResponse["createdTask"] = undefined;
  let tasks: FridayResponse["tasks"] = undefined;

  if (parsed.action && parsed.action.type !== "none") {
    try {
      const actionResult = await executeAction(parsed.action, userId, ctx);
      createdTask = actionResult.createdTask;
      tasks = actionResult.tasks;
    } catch (err) {
      console.error("[Friday] Action execution error:", err);
    }
  }

  // Also include tasks from parsed response if any
  if (parsed.tasks) {
    tasks = parsed.tasks;
  }

  // Return streaming response
  return createStreamingResponse(parsed.message, tasks, createdTask);
}

// ─── Fallback (no API key) ────────────────────────────────────────────────────
function buildFallbackResponse(
  userMessage: string,
  ctx: Awaited<ReturnType<typeof buildUserContext>>,
  userName: string
): string {
  const msg = userMessage.toLowerCase();
  const { overdueTasks, todayTasks, upcomingTasks, completedThisWeek } = ctx;

  if (msg.includes("overdue") || msg.includes("late") || msg.includes("missed")) {
    const list = overdueTasks.slice(0, 5).map((t) => `- **${t.title}** (P${t.priority})`).join("\n");
    return JSON.stringify({
      message: overdueTasks.length === 0
        ? `Great news, ${userName}! 🎉 You have **no overdue tasks**. You're on top of things!`
        : `You have **${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}**, ${userName}:\n\n${list}\n\nI'd recommend tackling the highest priority ones first! 💪`,
      action: { type: "none" },
    });
  }

  if (msg.includes("today") || msg.includes("due today")) {
    const list = todayTasks.slice(0, 5).map((t) => `- **${t.title}** (P${t.priority})`).join("\n");
    return JSON.stringify({
      message: todayTasks.length === 0
        ? `Your plate is clear for today, ${userName}! 🌟 No tasks due. Maybe get ahead on tomorrow's work?`
        : `Here's what's due today:\n\n${list}`,
      action: { type: "none" },
    });
  }

  if (msg.includes("week") || msg.includes("summary") || msg.includes("how am i doing")) {
    return JSON.stringify({
      message: `**Weekly Snapshot for ${userName}** 📊\n\n- ✅ Completed this week: **${completedThisWeek} tasks**\n- 🔴 Overdue: **${overdueTasks.length} tasks**\n- 📅 Due today: **${todayTasks.length} tasks**\n- 📆 Upcoming (7 days): **${upcomingTasks.length} tasks**\n\n${completedThisWeek > 5 ? "You're crushing it! 🚀" : "Keep pushing, every completed task counts! 💪"}`,
      action: { type: "none" },
    });
  }

  if (msg.includes("upcoming") || msg.includes("next") || msg.includes("this week")) {
    const list = upcomingTasks.slice(0, 5).map((t) => `- **${t.title}** — ${t.dueDate?.toLocaleDateString() ?? "No date"}`).join("\n");
    return JSON.stringify({
      message: upcomingTasks.length === 0
        ? `Nothing coming up this week, ${userName}! You're either very organised or need to plan ahead 😄`
        : `Upcoming tasks this week:\n\n${list}`,
      action: { type: "none" },
    });
  }

  return JSON.stringify({
    message: `Hey ${userName}! 👋 I'm Friday, your productivity assistant. I can help you with:\n\n- 📋 Checking your tasks and deadlines\n- ✅ Creating tasks from natural language\n- 📊 Weekly summaries\n- 🎯 Scheduling suggestions\n\n*(Connect a DeepInfra API key in settings to unlock full AI capabilities!)*`,
    action: { type: "none" },
  });
}

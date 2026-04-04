import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, projects, sprints, microsoftConnections, calendarEvents, emailDigests, dailyBriefings, users } from "@/lib/db/schema";
import { eq, and, lt, lte, gte, count, sql, inArray } from "drizzle-orm";
import type { DailyBriefing, DailyBriefingTask } from "@/types/daily-briefing";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

// Get YYYY-MM-DD date key in user's timezone
function getLocalDateKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Get start and end of today in user's timezone (as UTC Date objects)
function getTodayBoundsInTz(tz: string): { start: Date; end: Date } {
  const now = new Date();
  // Get today's date in user's timezone
  const todayStr = getLocalDateKey(now, tz);
  // Create start of day in user's timezone (midnight)
  const startStr = `${todayStr}T00:00:00`;
  // Create end of day in user's timezone (23:59:59.999)
  const endStr = `${todayStr}T23:59:59.999`;
  
  // We need to interpret these as user's local time and convert to UTC
  // This is complex because we need to handle the offset properly
  // A simpler approach: use the formatter to get the offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  
  // Get current offset in hours
  const nowParts = formatter.formatToParts(now);
  const nowHour = parseInt(nowParts.find(p => p.type === "hour")?.value ?? "0");
  const nowUtcHour = now.getUTCHours();
  const offsetHours = nowHour - nowUtcHour;
  
  // Approximate start/end by offset
  const startUtc = new Date(now);
  startUtc.setUTCHours(0 - offsetHours, 0, 0, 0);
  const endUtc = new Date(now);
  endUtc.setUTCHours(23 - offsetHours, 59, 59, 999);
  
  return { start: startUtc, end: endUtc };
}

// Cache TTL: 4 hours
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
// Max manual refreshes per hour
const MAX_REFRESHES_PER_HOUR = 3;

// In-memory rate-limiter for refresh
const refreshLimiter: Record<string, { count: number; resetAt: number }> = {};

function checkRefreshLimit(userId: string): boolean {
  const now = Date.now();
  const entry = refreshLimiter[userId];
  if (!entry || entry.resetAt < now) {
    refreshLimiter[userId] = { count: 1, resetAt: now + 3600_000 };
    return true;
  }
  if (entry.count >= MAX_REFRESHES_PER_HOUR) return false;
  entry.count++;
  return true;
}

// ─── DeepInfra call ───────────────────────────────────────────────────────────
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
      max_tokens: 2500,
      temperature: 0.6,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepInfra ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// ─── Full context builder ─────────────────────────────────────────────────────
async function buildBriefingContext(userId: string, tz: string) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getTodayBoundsInTz(tz);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const [
    overdueTasks,
    todayTasks,
    upcomingTasks,
    projectList,
    completedThisWeek,
    completedToday,
  ] = await Promise.all([
    // Overdue tasks
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, lt: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), l(t.dueDate, todayStart)),
      with: { project: true },
      orderBy: (t, { asc }) => [asc(t.priority), asc(t.dueDate)],
      limit: 20,
    }),
    // Today tasks
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, gte: g, lte: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), g(t.dueDate, todayStart), l(t.dueDate, todayEnd)),
      with: { project: true },
      orderBy: (t, { asc }) => [asc(t.priority), asc(t.dueDate)],
      limit: 30,
    }),
    // Upcoming (next 7 days)
    db.query.tasks.findMany({
      where: (t, { eq: e, and: a, gt: g, lte: l }) => a(e(t.userId, userId), e(t.isDeleted, false), e(t.completed, false), g(t.dueDate, todayEnd), l(t.dueDate, weekEnd)),
      with: { project: true },
      orderBy: (t, { asc }) => [asc(t.priority), asc(t.dueDate)],
      limit: 20,
    }),
    // Projects
    db.query.projects.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    }),
    // Completed this week
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), eq(tasks.completed, true), gte(tasks.completedAt, new Date(now.getTime() - 7 * 86400000)))
    ).then(r => Number(r[0]?.count ?? 0)),
    // Completed today
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), eq(tasks.completed, true), gte(tasks.completedAt, todayStart), lte(tasks.completedAt, todayEnd))
    ).then(r => Number(r[0]?.count ?? 0)),
  ]);

  // Active sprint (first active sprint across any project owned by user)
  const userProjectIds = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
  const projectIdList = userProjectIds.map(p => p.id);
  let activeSprint: (Awaited<ReturnType<typeof db.query.sprints.findFirst>> & { _count: { tasks: number } }) | null = null;
  if (projectIdList.length > 0) {
    const sprintRow = await db.query.sprints.findFirst({
      where: (s, { eq: e, and: a }) => a(e(s.isActive, true), inArray(s.projectId, projectIdList)),
      with: { project: true },
    }) ?? null;
    if (sprintRow) {
      const [{ count: sprintTotal }] = await db.select({ count: count() }).from(tasks).where(
        and(eq(tasks.sprintId, sprintRow.id), eq(tasks.isDeleted, false))
      );
      activeSprint = { ...sprintRow, _count: { tasks: Number(sprintTotal) } };
    }
  }

  // Microsoft connection
  const microsoftConn = await db.query.microsoftConnections.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  }) ?? null;

  // Streak (weekdays only)
  const stats = await (async () => {
    let streak = 0;
    let checkDate = new Date(todayStart);
    checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      const nextDay = new Date(checkDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const [{ count: cnt }] = await db.select({ count: count() }).from(tasks).where(
        and(eq(tasks.userId, userId), gte(tasks.completedAt, checkDate), lt(tasks.completedAt, nextDay))
      );
      if (Number(cnt) > 0) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    return streak;
  })();

  // Calendar events today (if Microsoft connected)
  let calendarEventList: Array<{
    id: string; subject: string | null; startDateTime: Date; endDateTime: Date;
    location: string | null; webLink: string | null;
  }> = [];
  if (microsoftConn?.syncCalendarEnabled) {
    calendarEventList = await db.query.calendarEvents.findMany({
      where: (t, { eq: e, and: a, gte: g, lte: l }) => a(e(t.userId, userId), g(t.startDateTime, todayStart), l(t.startDateTime, todayEnd)),
      orderBy: (t, { asc }) => [asc(t.startDateTime)],
      limit: 10,
    });
  }

  // Email digest (latest today/this week)
  let latestDigest: {
    missedReplyCount: number;
    needsReplyCount: number;
    missedReplies: string;
    needsReply: string;
    aiSummary: string | null;
  } | null = null;
  if (microsoftConn) {
    latestDigest = await db.query.emailDigests.findFirst({
      where: (t, { eq: e, and: a }) => a(e(t.userId, userId), e(t.status, "done")),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      columns: {
        missedReplyCount: true,
        needsReplyCount: true,
        missedReplies: true,
        needsReply: true,
        aiSummary: true,
      },
    }) ?? null;
  }

  // Sprint done count
  let sprintDoneCount = 0;
  if (activeSprint) {
    const [{ count: doneCount }] = await db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.sprintId, activeSprint.id), eq(tasks.completed, true), eq(tasks.isDeleted, false))
    );
    sprintDoneCount = Number(doneCount);
  }

  return {
    now,
    overdueTasks,
    todayTasks,
    upcomingTasks,
    projects: projectList,
    completedThisWeek,
    completedToday,
    streak: stats,
    activeSprint,
    sprintDoneCount,
    microsoftConn,
    calendarEvents: calendarEventList,
    latestDigest,
  };
}

// ─── Briefing system prompt ───────────────────────────────────────────────────
function buildBriefingPrompt(
  userName: string,
  ctx: Awaited<ReturnType<typeof buildBriefingContext>>
): string {
  const {
    now, overdueTasks, todayTasks, upcomingTasks, projects, completedThisWeek,
    completedToday, streak, activeSprint, sprintDoneCount, calendarEvents, latestDigest,
  } = ctx;

  const todayStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const formatTask = (t: { id: string; title: string; priority: number; dueDate: Date | null; project?: { name: string } | null }) =>
    `[${t.id.slice(-6)}] "${t.title}" P${t.priority} proj:${t.project?.name ?? "Inbox"} due:${t.dueDate ? t.dueDate.toISOString().split("T")[0] : "none"}`;

  const formatEvent = (e: { subject: string | null; startDateTime: Date; endDateTime: Date; location: string | null }) => {
    const start = e.startDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const end = e.endDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${start}-${end} "${e.subject ?? "(No title)"}" loc:${e.location ?? "none"}`;
  };

  const overdueSection = overdueTasks.length > 0
    ? `OVERDUE (${overdueTasks.length}):\n${overdueTasks.slice(0, 10).map(formatTask).join("\n")}`
    : "OVERDUE: none";

  const todaySection = todayTasks.length > 0
    ? `TODAY'S TASKS (${todayTasks.length}):\n${todayTasks.slice(0, 15).map(formatTask).join("\n")}`
    : "TODAY'S TASKS: none";

  const upcomingSection = upcomingTasks.length > 0
    ? `UPCOMING (next 7d, ${upcomingTasks.length}):\n${upcomingTasks.slice(0, 8).map(formatTask).join("\n")}`
    : "UPCOMING: none";

  const calendarSection = calendarEvents.length > 0
    ? `TODAY'S CALENDAR (${calendarEvents.length} events):\n${calendarEvents.map(formatEvent).join("\n")}`
    : "TODAY'S CALENDAR: none (or not connected)";

  const sprintSection = activeSprint
    ? `ACTIVE SPRINT: "${activeSprint.name}" goal:"${activeSprint.goal ?? "none"}" done:${sprintDoneCount}/${activeSprint._count?.tasks ?? 0} ends:${new Date(activeSprint.endDate).toISOString().split("T")[0]}`
    : "ACTIVE SPRINT: none";

  const emailSection = latestDigest
    ? `EMAIL STATUS: ${latestDigest.missedReplyCount} missed replies, ${latestDigest.needsReplyCount} need reply\nAI Summary: ${latestDigest.aiSummary ?? "N/A"}`
    : "EMAIL STATUS: not connected or not scanned yet";

  const statsSection = `STATS: streak=${streak}d completed_today=${completedToday} completed_this_week=${completedThisWeek}`;

  return `You are Friday, an AI daily briefing assistant for FlowFocus. Generate a structured daily briefing JSON for the user's morning.

Today: ${todayStr} at ${timeStr}
User: ${userName}
Projects: ${projects.filter(p => !p.isInbox).map(p => p.name).join(", ") || "none"}

${overdueSection}
${todaySection}
${upcomingSection}
${calendarSection}
${sprintSection}
${emailSection}
${statsSection}

Generate a comprehensive morning briefing. Respond ONLY with a valid JSON object matching this exact schema (no markdown, no prose before/after):

{
  "greeting": "<warm personalized morning greeting based on time of day, workload, streak>",
  "priorityTasks": [
    {
      "taskId": "<last 6 chars of task id>",
      "title": "<exact task title>",
      "priority": <1|2|3|4>,
      "dueDate": "<YYYY-MM-DD or null>",
      "projectName": "<project name>",
      "rank": <1-5>,
      "reason": "<1 sentence why this is a priority today>",
      "estimatedHours": <number or null>
    }
  ],
  "overdueAlert": <null if no overdue, or: {
    "count": <number>,
    "topItems": [{"taskId": "<id>", "title": "<title>", "daysOverdue": <number>}],
    "message": "<motivating message about overdue tasks>"
  }>,
  "sprintStatus": <null if no sprint, or: {
    "sprintName": "<name>",
    "goal": "<goal or null>",
    "daysLeft": <number>,
    "progressPct": <0-100>,
    "doneTasks": <number>,
    "totalTasks": <number>,
    "isOnTrack": <bool>,
    "message": "<sprint status message>"
  }>,
  "dayPlan": [
    {"timeSlot": "09:00 - 10:00", "type": "meeting|task|break|buffer", "title": "<event/task title>", "taskId": "<optional>", "eventId": "<optional>"}
  ],
  "coachingMessage": "<1-2 sentences personalized coaching based on streak, completion rate, workload>"
}

Rules:
- priorityTasks: pick top 3-5 most important tasks for TODAY from overdue+today list, rank them 1 (most important) to 5
- overdueAlert: null if overdueTasks count is 0
- sprintStatus: null if no active sprint; calculate daysLeft from today to end date
- dayPlan: suggest a realistic schedule 9am-6pm with meetings first, then top tasks. Use 30min-2h slots. Include buffer slots.
- calendarSection, emailActions are NOT in this JSON — they are filled from real data by the server
- coachingMessage: be specific about the user's streak and today's workload. Be motivating but honest.
- Keep all strings concise and actionable
- IMPORTANT: use task IDs (last 6 chars) exactly as provided in the context above`;
}

// ─── Parse AI briefing response ───────────────────────────────────────────────
function parseBriefingResponse(raw: string): Partial<DailyBriefing> | null {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned) as Partial<DailyBriefing>;
  } catch {
    return null;
  }
}

// ─── Build structured briefing from context + AI ─────────────────────────────
function buildFullBriefing(
  aiParsed: Partial<DailyBriefing> | null,
  ctx: Awaited<ReturnType<typeof buildBriefingContext>>,
  isFromCache = false
): DailyBriefing {
  const { now, overdueTasks, todayTasks, calendarEvents, latestDigest, activeSprint, sprintDoneCount } = ctx;

  // Calendar section from real DB data
  let calendarSection: DailyBriefing["calendarSection"] = undefined;
  if (calendarEvents.length > 0) {
    const events = calendarEvents.map(e => {
      const startTime = e.startDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const endTime = e.endDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const isNow = e.startDateTime <= now && e.endDateTime >= now;
      return {
        id: e.id,
        subject: e.subject ?? "(No title)",
        startTime,
        endTime,
        location: e.location ?? undefined,
        webLink: e.webLink ?? undefined,
        isNow,
      };
    });
    const count = events.length;
    calendarSection = {
      events,
      summary: `You have ${count} event${count !== 1 ? "s" : ""} today`,
    };
  }

  // Email actions from real digest data
  let emailActions: DailyBriefing["emailActions"] = undefined;
  if (latestDigest && (latestDigest.missedReplyCount > 0 || latestDigest.needsReplyCount > 0)) {
    const missedItems = (() => { try { return JSON.parse(latestDigest.missedReplies); } catch { return []; } })();
    const needsItems = (() => { try { return JSON.parse(latestDigest.needsReply); } catch { return []; } })();
    const allItems = [
      ...missedItems.slice(0, 3).map((it: Record<string, unknown>) => ({
        id: String(it.id ?? ""),
        subject: String(it.subject ?? ""),
        fromName: String(it.fromName ?? it.fromEmail ?? ""),
        urgency: "high" as const,
        category: "missed" as const,
        webLink: it.webLink as string | undefined,
      })),
      ...needsItems.slice(0, 2).map((it: Record<string, unknown>) => ({
        id: String(it.id ?? ""),
        subject: String(it.subject ?? ""),
        fromName: String(it.fromName ?? it.fromEmail ?? ""),
        urgency: "medium" as const,
        category: "needs_reply" as const,
        webLink: it.webLink as string | undefined,
      })),
    ];
    const urgentCount = latestDigest.missedReplyCount + latestDigest.needsReplyCount;
    emailActions = {
      urgentCount,
      items: allItems.slice(0, 5),
      summary: `${latestDigest.missedReplyCount} missed, ${latestDigest.needsReplyCount} need reply`,
    };
  }

  // Sprint status from real DB
  let sprintStatus: DailyBriefing["sprintStatus"] = undefined;
  if (activeSprint) {
    const totalTasks = activeSprint._count?.tasks ?? 0;
    const progressPct = totalTasks > 0 ? Math.round((sprintDoneCount / totalTasks) * 100) : 0;
    const daysLeft = Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - now.getTime()) / 86400000));
    const isOnTrack = aiParsed?.sprintStatus?.isOnTrack ?? progressPct >= 40;
    sprintStatus = {
      sprintName: activeSprint.name,
      goal: activeSprint.goal ?? undefined,
      daysLeft,
      progressPct,
      doneTasks: sprintDoneCount,
      totalTasks,
      isOnTrack,
      message: aiParsed?.sprintStatus?.message ?? `${progressPct}% done with ${daysLeft} days remaining`,
    };
  }

  // Priority tasks — merge AI ranking with real task data
  const aiTasks = aiParsed?.priorityTasks ?? [];
  const priorityTasks: DailyBriefing["priorityTasks"] = [];
  const allCandidates = [...overdueTasks, ...todayTasks];

  for (const aiTask of aiTasks.slice(0, 5)) {
    // Match by last 6 chars of ID or by title
    const realTask = allCandidates.find(
      t => t.id.endsWith(aiTask.taskId ?? "") || t.title.toLowerCase() === (aiTask.title ?? "").toLowerCase()
    );
    if (realTask) {
      priorityTasks.push({
        taskId: realTask.id,
        title: realTask.title,
        priority: realTask.priority as 1 | 2 | 3 | 4,
        dueDate: realTask.dueDate ? realTask.dueDate.toISOString().split("T")[0] : null,
        projectName: realTask.project?.name ?? "Inbox",
        rank: aiTask.rank ?? priorityTasks.length + 1,
        reason: aiTask.reason ?? "Priority task for today",
        estimatedHours: realTask.estimatedHours ?? undefined,
      });
    }
  }

  // Fallback: if AI gave no tasks, use top tasks by priority
  if (priorityTasks.length === 0) {
    const fallbackTasks = allCandidates
      .sort((a, b) => a.priority - b.priority || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .slice(0, 5);
    fallbackTasks.forEach((t, i) => {
      priorityTasks.push({
        taskId: t.id,
        title: t.title,
        priority: t.priority as 1 | 2 | 3 | 4,
        dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
        projectName: t.project?.name ?? "Inbox",
        rank: i + 1,
        reason: overdueTasks.includes(t) ? "Overdue — needs immediate attention" : "Due today",
        estimatedHours: t.estimatedHours ?? undefined,
      });
    });
  }

  // Overdue alert
  let overdueAlert: DailyBriefing["overdueAlert"] = undefined;
  if (overdueTasks.length > 0) {
    overdueAlert = {
      count: overdueTasks.length,
      topItems: overdueTasks.slice(0, 3).map(t => ({
        taskId: t.id,
        title: t.title,
        daysOverdue: t.dueDate ? Math.ceil((now.getTime() - t.dueDate.getTime()) / 86400000) : 1,
      })),
      message: aiParsed?.overdueAlert?.message
        ?? `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} that need attention.`,
    };
  }

  return {
    generatedAt: now.toISOString(),
    greeting: aiParsed?.greeting ?? buildFallbackGreeting(ctx),
    calendarSection,
    priorityTasks,
    overdueAlert,
    emailActions,
    sprintStatus,
    dayPlan: aiParsed?.dayPlan,
    coachingMessage: aiParsed?.coachingMessage ?? buildFallbackCoaching(ctx),
    metadata: {
      hasCalendar: calendarEvents.length > 0,
      hasEmailDigest: !!latestDigest,
      hasActiveSprint: !!activeSprint,
      overdueCount: overdueTasks.length,
      todayTaskCount: todayTasks.length,
      isFromCache,
    },
  };
}

function buildFallbackGreeting(ctx: Awaited<ReturnType<typeof buildBriefingContext>>): string {
  const hour = ctx.now.getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const workload = ctx.todayTasks.length;
  if (ctx.overdueTasks.length > 0) {
    return `${timeGreet}! You have ${ctx.overdueTasks.length} overdue tasks and ${workload} tasks due today. Let's get focused! 💪`;
  }
  if (workload === 0) return `${timeGreet}! Your schedule is clear today. A great time to get ahead! 🌟`;
  return `${timeGreet}! You have ${workload} task${workload !== 1 ? "s" : ""} lined up for today. Let's make it count! 🚀`;
}

function buildFallbackCoaching(ctx: Awaited<ReturnType<typeof buildBriefingContext>>): string {
  const { streak, completedThisWeek, overdueTasks, todayTasks } = ctx;
  if (streak >= 7) return `🔥 ${streak}-day streak — you're unstoppable! Keep the momentum going today.`;
  if (streak >= 3) return `✨ ${streak} days in a row! You're building a great habit. ${todayTasks.length} tasks await.`;
  if (overdueTasks.length > 3) return `Clear those ${overdueTasks.length} overdue tasks first — getting caught up will feel amazing! 💯`;
  if (completedThisWeek >= 10) return `You've crushed ${completedThisWeek} tasks this week already! Stay focused today.`;
  return `Every task completed today builds your momentum. You've got this! 💪`;
}

// ─── GET /api/friday/daily-briefing ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userName = session.user.name?.split(" ")[0] ?? "there";
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Fetch user's timezone
  const user = await db.query.users.findFirst({
    where: (t, { eq: e }) => e(t.id, userId),
    columns: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";

  const todayKey = getLocalDateKey(new Date(), tz);

  // Check cache first
  if (!forceRefresh) {
    const cached = await db.query.dailyBriefings.findFirst({
      where: (t, { eq: e, and: a }) => a(e(t.userId, userId), e(t.briefingDate, todayKey)),
    });
    if (cached) {
      // Check if cache is still fresh (< 4 hours)
      const ageMs = Date.now() - cached.generatedAt.getTime();
      if (ageMs < CACHE_TTL_MS) {
        try {
          const data = JSON.parse(cached.data) as DailyBriefing;
          data.metadata.isFromCache = true;
          return NextResponse.json({ briefing: data, isFromCache: true });
        } catch {
          // Corrupted cache — regenerate
        }
      }
    }
  }

  // Rate limit check for manual refreshes
  if (forceRefresh && !checkRefreshLimit(userId)) {
    return NextResponse.json(
      { error: "Too many refreshes. Please wait before refreshing again." },
      { status: 429 }
    );
  }

  // Build full context
  const ctx = await buildBriefingContext(userId, tz);
  const apiKey = process.env.DEEPINFRA_API_KEY;

  let aiParsed: Partial<DailyBriefing> | null = null;

  if (apiKey) {
    try {
      const systemPrompt = buildBriefingPrompt(userName, ctx);
      const raw = await callDeepInfra(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate my daily briefing for today." },
      ]);
      aiParsed = parseBriefingResponse(raw);
    } catch (err) {
      console.error("[DailyBriefing] AI error:", err);
      // Continue with fallback
    }
  }

  const briefing = buildFullBriefing(aiParsed, ctx, false);

  // Save to cache (upsert)
  await db.insert(dailyBriefings).values({
    userId,
    briefingDate: todayKey,
    data: JSON.stringify(briefing),
    generatedAt: new Date(),
    refreshCount: 0,
    isFromCache: false,
  }).onConflictDoUpdate({
    target: [dailyBriefings.userId, dailyBriefings.briefingDate],
    set: {
      data: JSON.stringify(briefing),
      generatedAt: new Date(),
      isFromCache: false,
      ...(forceRefresh ? { refreshCount: sql`${dailyBriefings.refreshCount} + 1` } : {}),
    },
  });

  return NextResponse.json({ briefing, isFromCache: false });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";

function serializeTask(t: Record<string, unknown>) {
  return {
    ...t,
    dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : (t.dueDate ?? null),
    completedAt: t.completedAt instanceof Date ? (t.completedAt as Date).toISOString() : (t.completedAt ?? null),
    recurrenceEndDate: t.recurrenceEndDate instanceof Date ? (t.recurrenceEndDate as Date).toISOString() : (t.recurrenceEndDate ?? null),
    blockedAt: t.blockedAt instanceof Date ? (t.blockedAt as Date).toISOString() : (t.blockedAt ?? null),
    importedAt: t.importedAt instanceof Date ? (t.importedAt as Date).toISOString() : (t.importedAt ?? null),
    createdAt: t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? (t.updatedAt as Date).toISOString() : t.updatedAt,
    labels: Array.isArray(t.labels) ? (t.labels as Array<{ label: unknown }>).map((l) => l.label) : [],
    timeLogs: Array.isArray(t.timeLogs) ? (t.timeLogs as Array<Record<string, unknown>>).map((log) => ({
      ...log,
      loggedAt: log.loggedAt instanceof Date ? (log.loggedAt as Date).toISOString() : log.loggedAt,
    })) : [],
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const taskList = await db.query.tasks.findMany({
    where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.isDeleted, false)),
    orderBy: (t, { asc, desc }) => [asc(t.sortOrder), desc(t.createdAt)],
    with: {
      project: true,
      labels: { with: { label: true } },
      subtasks: { where: (t, { eq }) => eq(t.isDeleted, false) },
      blockedBy: { with: { blockingTask: true } },
      blocking: { with: { blockedTask: true } },
      timeLogs: { orderBy: (tl, { desc }) => [desc(tl.loggedAt)] },
    },
  });

  return NextResponse.json(taskList.map((t) => serializeTask(t as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();
  const {
    title, notes, dueDate, dueTime, priority = 4, projectId, parentId, depth,
    recurrenceRule, recurrenceInterval, recurrenceDays, recurrenceEndDate,
    estimatedHours, status, sprintId, assigneeName, waitingOn, approvalStatus, blockedAt,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  let finalProjectId = projectId;
  if (!finalProjectId) {
    const inbox = await db.query.projects.findFirst({
      where: (p, { eq, and }) => and(eq(p.userId, userId), eq(p.isInbox, true)),
    });
    finalProjectId = inbox?.id;
  }

  const [created] = await db.insert(tasks).values({
    title: title.trim(),
    notes,
    dueDate: dueDate ? new Date(dueDate) : null,
    dueTime,
    priority: Number(priority),
    userId,
    projectId: finalProjectId,
    parentId,
    depth: depth ?? 0,
    recurrenceRule,
    recurrenceInterval,
    recurrenceDays,
    recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
    estimatedHours: estimatedHours ? Number(estimatedHours) : null,
    status: status ?? "TODO",
    sprintId,
    assigneeName: assigneeName ?? null,
    waitingOn: waitingOn ?? null,
    approvalStatus: approvalStatus ?? null,
    blockedAt: blockedAt ? new Date(blockedAt) : null,
  }).returning();

  const task = await db.query.tasks.findFirst({
    where: (t, { eq }) => eq(t.id, created.id),
    with: {
      project: true,
      labels: { with: { label: true } },
      subtasks: { where: (t, { eq }) => eq(t.isDeleted, false) },
      blockedBy: { with: { blockingTask: true } },
      blocking: { with: { blockedTask: true } },
      timeLogs: { orderBy: (tl, { desc }) => [desc(tl.loggedAt)] },
    },
  });

  return NextResponse.json(serializeTask(task as unknown as Record<string, unknown>));
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tasks, projects, taskLabels, labels } from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";

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
    labels: Array.isArray(t.labels) ? (t.labels as Array<{label: unknown}>).map((l) => l.label) : [],
    timeLogs: Array.isArray(t.timeLogs) ? (t.timeLogs as Array<Record<string, unknown>>).map((log) => ({
      ...log,
      loggedAt: log.loggedAt instanceof Date ? (log.loggedAt as Date).toISOString() : log.loggedAt,
    })) : [],
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskRows = await db.select().from(tasks)
    .where(and(eq(tasks.userId, session.user.id), eq(tasks.isDeleted, false)))
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  const taskIds = taskRows.map(t => t.id);
  const labelRows = taskIds.length > 0
    ? await db.select({ taskId: taskLabels.taskId, label: labels })
        .from(taskLabels)
        .innerJoin(labels, eq(taskLabels.labelId, labels.id))
        .where(inArray(taskLabels.taskId, taskIds))
    : [];

  const labelsByTaskId: Record<string, { label: unknown }[]> = {};
  for (const row of labelRows) {
    if (!labelsByTaskId[row.taskId]) labelsByTaskId[row.taskId] = [];
    labelsByTaskId[row.taskId].push({ label: row.label });
  }

  return NextResponse.json(taskRows.map(t => serializeTask({
    ...t,
    labels: labelsByTaskId[t.id] ?? [],
    timeLogs: [],
    subtasks: [],
    blockedBy: [],
    blocking: [],
  } as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, notes, dueDate, dueTime, priority = 4, projectId, parentId, depth,
    recurrenceRule, recurrenceInterval, recurrenceDays, recurrenceEndDate,
    estimatedHours, status, sprintId, assigneeName, waitingOn, approvalStatus, blockedAt,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  let finalProjectId = projectId;
  if (!finalProjectId) {
    const [inbox] = await db.select().from(projects)
      .where(and(eq(projects.userId, session.user.id), eq(projects.isInbox, true)))
      .limit(1);
    finalProjectId = inbox?.id;
  }

  const [task] = await db.insert(tasks).values({
    title: title.trim(),
    notes,
    dueDate: dueDate ? new Date(dueDate) : null,
    dueTime,
    priority: Number(priority),
    userId: session.user.id,
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

  return NextResponse.json(serializeTask({
    ...task,
    labels: [],
    timeLogs: [],
    subtasks: [],
    blockedBy: [],
    blocking: [],
  } as unknown as Record<string, unknown>));
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TASK_INCLUDE = {
  project: true,
  labels: { include: { label: true } },
  subtasks: { where: { isDeleted: false } },
  blockedBy: { include: { blockingTask: { select: { id: true, title: true, completed: true } } } },
  blocking: { include: { blockedTask: { select: { id: true, title: true, completed: true } } } },
  timeLogs: { orderBy: { loggedAt: "desc" as const } },
};

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

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, isDeleted: false },
    include: TASK_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks.map(serializeTask));
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
    const inbox = await prisma.project.findFirst({ where: { userId: session.user.id, isInbox: true } });
    finalProjectId = inbox?.id;
  }

  const task = await prisma.task.create({
    data: {
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
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json(serializeTask(task as unknown as Record<string, unknown>));
}

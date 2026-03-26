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
    createdAt: t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? (t.updatedAt as Date).toISOString() : t.updatedAt,
    labels: Array.isArray(t.labels) ? (t.labels as Array<{label: unknown}>).map((l) => l.label) : [],
    timeLogs: Array.isArray(t.timeLogs) ? (t.timeLogs as Array<Record<string, unknown>>).map((log) => ({
      ...log,
      loggedAt: log.loggedAt instanceof Date ? (log.loggedAt as Date).toISOString() : log.loggedAt,
    })) : [],
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.dueTime !== undefined) updates.dueTime = body.dueTime;
  if (body.priority !== undefined) updates.priority = Number(body.priority);
  if (body.projectId !== undefined) updates.projectId = body.projectId;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.status !== undefined) updates.status = body.status;
  if (body.sprintId !== undefined) updates.sprintId = body.sprintId;
  if (body.kanbanColumnId !== undefined) updates.kanbanColumnId = body.kanbanColumnId;
  if (body.estimatedHours !== undefined) updates.estimatedHours = body.estimatedHours !== null ? Number(body.estimatedHours) : null;
  if (body.recurrenceRule !== undefined) updates.recurrenceRule = body.recurrenceRule;
  if (body.recurrenceInterval !== undefined) updates.recurrenceInterval = body.recurrenceInterval;
  if (body.recurrenceDays !== undefined) updates.recurrenceDays = body.recurrenceDays;
  if (body.recurrenceEndDate !== undefined) updates.recurrenceEndDate = body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null;

  if (body.completed !== undefined) {
    updates.completed = body.completed;
    updates.completedAt = body.completed ? new Date() : null;
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updates,
    include: TASK_INCLUDE,
  });

  // Auto-generate next occurrence for recurring tasks on completion
  if (body.completed === true && task.recurrenceRule) {
    await createNextRecurrence(task);
  }

  return NextResponse.json(serializeTask(updated as unknown as Record<string, unknown>));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.task.update({
    where: { id, userId: session.user.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

// Auto-create the next occurrence of a recurring task on completion
async function createNextRecurrence(task: {
  id: string; title: string; notes: string | null; dueDate: Date | null; dueTime: string | null;
  priority: number; userId: string; projectId: string | null; recurrenceRule: string | null;
  recurrenceInterval: number | null; recurrenceDays: string | null; recurrenceEndDate: Date | null;
}) {
  if (!task.recurrenceRule || !task.dueDate) return;

  const nextDate = computeNextDate(task.dueDate, task.recurrenceRule, task.recurrenceInterval ?? 1, task.recurrenceDays);
  if (!nextDate) return;
  if (task.recurrenceEndDate && nextDate > task.recurrenceEndDate) return;

  await prisma.task.create({
    data: {
      title: task.title,
      notes: task.notes,
      dueDate: nextDate,
      dueTime: task.dueTime,
      priority: task.priority,
      userId: task.userId,
      projectId: task.projectId,
      recurrenceRule: task.recurrenceRule,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceDays: task.recurrenceDays,
      recurrenceEndDate: task.recurrenceEndDate,
      recurringParentId: task.id,
      status: "TODO",
    },
  });
}

function computeNextDate(from: Date, rule: string, interval: number, recurrenceDays: string | null): Date | null {
  const d = new Date(from);
  switch (rule) {
    case "DAILY":
      d.setDate(d.getDate() + interval);
      return d;
    case "WEEKLY":
      if (recurrenceDays) {
        const days: number[] = JSON.parse(recurrenceDays);
        const currentDay = d.getDay();
        const nextDay = days.find((day) => day > currentDay) ?? days[0];
        const diff = nextDay > currentDay
          ? nextDay - currentDay
          : 7 - currentDay + nextDay + (interval - 1) * 7;
        d.setDate(d.getDate() + diff);
      } else {
        d.setDate(d.getDate() + interval * 7);
      }
      return d;
    case "MONTHLY":
      d.setMonth(d.getMonth() + interval);
      return d;
    case "CUSTOM":
      d.setDate(d.getDate() + interval);
      return d;
    default:
      return null;
  }
}

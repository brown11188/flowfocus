import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { milestones, milestoneTasks, tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function serializeMilestone(m: Record<string, unknown>) {
  return {
    ...m,
    targetDate: m.targetDate instanceof Date ? (m.targetDate as Date).toISOString() : m.targetDate,
    createdAt: m.createdAt instanceof Date ? (m.createdAt as Date).toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? (m.updatedAt as Date).toISOString() : m.updatedAt,
    tasks: Array.isArray(m.tasks) ? (m.tasks as Array<Record<string, unknown>>).map((mt) => ({
      ...mt,
      task: mt.task ? {
        ...(mt.task as Record<string, unknown>),
        dueDate: (mt.task as Record<string, unknown>).dueDate instanceof Date ? ((mt.task as Record<string, unknown>).dueDate as Date).toISOString() : ((mt.task as Record<string, unknown>).dueDate ?? null),
      } : null,
    })) : [],
  };
}

async function getMilestoneWithTasks(milestoneId: string) {
  const [milestone] = await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  if (!milestone) return null;

  const mts = await db
    .select({
      milestoneId: milestoneTasks.milestoneId,
      taskId: milestoneTasks.taskId,
      task: {
        id: tasks.id,
        title: tasks.title,
        completed: tasks.completed,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      },
    })
    .from(milestoneTasks)
    .leftJoin(tasks, eq(milestoneTasks.taskId, tasks.id))
    .where(eq(milestoneTasks.milestoneId, milestoneId));

  return { ...milestone, tasks: mts, _count: { tasks: mts.length } };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.targetDate !== undefined) updates.targetDate = new Date(body.targetDate);

  await db.update(milestones).set(updates).where(eq(milestones.id, id));
  const result = await getMilestoneWithTasks(id);
  return NextResponse.json(serializeMilestone(result as unknown as Record<string, unknown>));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(milestones).where(eq(milestones.id, id));
  return NextResponse.json({ success: true });
}

// POST /api/milestones/[id] with action=link|unlink
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, taskId } = await req.json();

  if (action === "link") {
    await db.insert(milestoneTasks).values({ milestoneId: id, taskId }).onConflictDoNothing();
  } else if (action === "unlink") {
    await db.delete(milestoneTasks).where(and(eq(milestoneTasks.milestoneId, id), eq(milestoneTasks.taskId, taskId)));
  }

  const result = await getMilestoneWithTasks(id);
  return NextResponse.json(serializeMilestone(result as unknown as Record<string, unknown>));
}

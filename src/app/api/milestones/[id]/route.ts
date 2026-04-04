import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { milestones, milestoneTasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function serializeMilestone(m: Record<string, unknown>) {
  const taskList = Array.isArray(m.tasks) ? (m.tasks as Array<Record<string, unknown>>) : [];
  return {
    ...m,
    targetDate: m.targetDate instanceof Date ? (m.targetDate as Date).toISOString() : m.targetDate,
    createdAt: m.createdAt instanceof Date ? (m.createdAt as Date).toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? (m.updatedAt as Date).toISOString() : m.updatedAt,
    tasks: taskList.map((mt) => ({
      ...mt,
      task: mt.task
        ? {
            ...(mt.task as Record<string, unknown>),
            dueDate:
              (mt.task as Record<string, unknown>).dueDate instanceof Date
                ? ((mt.task as Record<string, unknown>).dueDate as Date).toISOString()
                : ((mt.task as Record<string, unknown>).dueDate ?? null),
          }
        : null,
    })),
    _count: { tasks: taskList.length },
  };
}

const MILESTONE_WITH = {
  tasks: {
    with: {
      task: { columns: { id: true, title: true, completed: true, priority: true, dueDate: true } as const },
    },
  },
} as const;

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

  const milestone = await db.query.milestones.findFirst({
    where: (m, { eq }) => eq(m.id, id),
    with: MILESTONE_WITH,
  });
  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
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
    await db
      .delete(milestoneTasks)
      .where(and(eq(milestoneTasks.milestoneId, id), eq(milestoneTasks.taskId, taskId)));
  }

  const milestone = await db.query.milestones.findFirst({
    where: (m, { eq }) => eq(m.id, id),
    with: MILESTONE_WITH,
  });
  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

const MILESTONE_INCLUDE = {
  tasks: { include: { task: { select: { id: true, title: true, completed: true, priority: true, dueDate: true } } } },
  _count: { select: { tasks: true } },
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.targetDate !== undefined) updates.targetDate = new Date(body.targetDate);

  const milestone = await prisma.milestone.update({
    where: { id },
    data: updates,
    include: MILESTONE_INCLUDE,
  });
  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.milestone.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// POST /api/milestones/[id] with action=link|unlink
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, taskId } = await req.json();

  if (action === "link") {
    await prisma.milestoneTask.upsert({
      where: { milestoneId_taskId: { milestoneId: id, taskId } },
      update: {},
      create: { milestoneId: id, taskId },
    });
  } else if (action === "unlink") {
    await prisma.milestoneTask.deleteMany({ where: { milestoneId: id, taskId } });
  }

  const milestone = await prisma.milestone.findUnique({ where: { id }, include: MILESTONE_INCLUDE });
  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
}

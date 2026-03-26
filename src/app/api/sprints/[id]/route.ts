import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeSprint(s: Record<string, unknown>) {
  return {
    ...s,
    startDate: s.startDate instanceof Date ? (s.startDate as Date).toISOString() : s.startDate,
    endDate: s.endDate instanceof Date ? (s.endDate as Date).toISOString() : s.endDate,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.goal !== undefined) updates.goal = body.goal;
  if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);
  if (body.isActive !== undefined) {
    updates.isActive = body.isActive;
    // Deactivate other sprints in same project if activating this one
    if (body.isActive) {
      const sprint = await prisma.sprint.findUnique({ where: { id } });
      if (sprint) {
        await prisma.sprint.updateMany({ where: { projectId: sprint.projectId, id: { not: id } }, data: { isActive: false } });
      }
    }
  }

  const sprint = await prisma.sprint.update({
    where: { id },
    data: updates,
    include: { _count: { select: { tasks: true } } },
  });
  return NextResponse.json(serializeSprint(sprint as unknown as Record<string, unknown>));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Remove tasks from sprint before deleting
  await prisma.task.updateMany({ where: { sprintId: id }, data: { sprintId: null } });
  await prisma.sprint.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

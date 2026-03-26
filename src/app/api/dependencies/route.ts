import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/dependencies
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedTaskId, blockingTaskId } = await req.json();
  if (!blockedTaskId || !blockingTaskId) return NextResponse.json({ error: "Both task IDs required" }, { status: 400 });
  if (blockedTaskId === blockingTaskId) return NextResponse.json({ error: "Task cannot block itself" }, { status: 400 });

  // Verify both tasks belong to this user
  const [blockedTask, blockingTask] = await Promise.all([
    prisma.task.findFirst({ where: { id: blockedTaskId, userId: session.user.id } }),
    prisma.task.findFirst({ where: { id: blockingTaskId, userId: session.user.id } }),
  ]);
  if (!blockedTask || !blockingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Circular dependency check (simple: ensure blockingTask is not itself blocked by blockedTask)
  const circular = await prisma.taskDependency.findFirst({
    where: { blockedTaskId: blockingTaskId, blockingTaskId: blockedTaskId },
  });
  if (circular) return NextResponse.json({ error: "Circular dependency detected" }, { status: 400 });

  const dep = await prisma.taskDependency.upsert({
    where: { blockedTaskId_blockingTaskId: { blockedTaskId, blockingTaskId } },
    update: {},
    create: { blockedTaskId, blockingTaskId },
    include: { blockingTask: { select: { id: true, title: true, completed: true } } },
  });

  return NextResponse.json(dep);
}

// DELETE /api/dependencies
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedTaskId, blockingTaskId } = await req.json();
  await prisma.taskDependency.deleteMany({ where: { blockedTaskId, blockingTaskId } });
  return NextResponse.json({ success: true });
}

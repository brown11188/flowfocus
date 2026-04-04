import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, taskDependencies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/dependencies
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedTaskId, blockingTaskId } = await req.json();
  if (!blockedTaskId || !blockingTaskId) return NextResponse.json({ error: "Both task IDs required" }, { status: 400 });
  if (blockedTaskId === blockingTaskId) return NextResponse.json({ error: "Task cannot block itself" }, { status: 400 });

  // Verify both tasks belong to this user
  const [blockedTask, blockingTask] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.id, blockedTaskId), eq(tasks.userId, session.user.id))).limit(1).then(r => r[0]),
    db.select().from(tasks).where(and(eq(tasks.id, blockingTaskId), eq(tasks.userId, session.user.id))).limit(1).then(r => r[0]),
  ]);
  if (!blockedTask || !blockingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Circular dependency check
  const [circular] = await db
    .select()
    .from(taskDependencies)
    .where(and(eq(taskDependencies.blockedTaskId, blockingTaskId), eq(taskDependencies.blockingTaskId, blockedTaskId)))
    .limit(1);
  if (circular) return NextResponse.json({ error: "Circular dependency detected" }, { status: 400 });

  const [dep] = await db
    .insert(taskDependencies)
    .values({ blockedTaskId, blockingTaskId })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(dep ?? { blockedTaskId, blockingTaskId });
}

// DELETE /api/dependencies
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedTaskId, blockingTaskId } = await req.json();
  await db
    .delete(taskDependencies)
    .where(and(eq(taskDependencies.blockedTaskId, blockedTaskId), eq(taskDependencies.blockingTaskId, blockingTaskId)));
  return NextResponse.json({ success: true });
}

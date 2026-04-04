import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tasks, taskDependencies } from "@/db/schema";
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
    db.select().from(tasks).where(and(eq(tasks.id, blockedTaskId), eq(tasks.userId, session.user.id))).limit(1),
    db.select().from(tasks).where(and(eq(tasks.id, blockingTaskId), eq(tasks.userId, session.user.id))).limit(1),
  ]);
  if (!blockedTask[0] || !blockingTask[0]) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Circular dependency check (simple: ensure blockingTask is not itself blocked by blockedTask)
  const [circular] = await db
    .select()
    .from(taskDependencies)
    .where(and(eq(taskDependencies.blockedTaskId, blockingTaskId), eq(taskDependencies.blockingTaskId, blockedTaskId)))
    .limit(1);
  if (circular) return NextResponse.json({ error: "Circular dependency detected" }, { status: 400 });

  // Upsert: insert if not exists
  const [existing] = await db
    .select()
    .from(taskDependencies)
    .where(and(eq(taskDependencies.blockedTaskId, blockedTaskId), eq(taskDependencies.blockingTaskId, blockingTaskId)))
    .limit(1);

  let dep;
  if (!existing) {
    [dep] = await db.insert(taskDependencies).values({ blockedTaskId, blockingTaskId }).returning();
  } else {
    dep = existing;
  }

  const [blockingTaskData] = await db
    .select({ id: tasks.id, title: tasks.title, completed: tasks.completed })
    .from(tasks)
    .where(eq(tasks.id, blockingTaskId))
    .limit(1);

  return NextResponse.json({ ...dep, blockingTask: blockingTaskData });
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

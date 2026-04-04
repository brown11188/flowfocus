import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tasks, projects, approvalItems, emailDigests } from "@/db/schema";
import { eq, and, or, isNotNull, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pendingApprovals, blockedTasksRaw, latestDigest] = await Promise.all([
    db.select().from(approvalItems)
      .where(and(eq(approvalItems.userId, session.user.id), eq(approvalItems.status, "pending")))
      .orderBy(desc(approvalItems.createdAt))
      .limit(10),
    db.select({
      id: tasks.id,
      title: tasks.title,
      completed: tasks.completed,
      isDeleted: tasks.isDeleted,
      userId: tasks.userId,
      projectId: tasks.projectId,
      dueDate: tasks.dueDate,
      waitingOn: tasks.waitingOn,
      blockedAt: tasks.blockedAt,
      priority: tasks.priority,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectName: projects.name,
      projectColor: projects.color,
    })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.userId, session.user.id),
          eq(tasks.completed, false),
          eq(tasks.isDeleted, false),
          or(isNotNull(tasks.waitingOn), isNotNull(tasks.blockedAt))
        )
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(10),
    db.select().from(emailDigests)
      .where(and(eq(emailDigests.userId, session.user.id), eq(emailDigests.status, "done")))
      .orderBy(desc(emailDigests.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const blockedTasks = blockedTasksRaw.map((t) => ({
    ...t,
    project: t.projectName ? { name: t.projectName, color: t.projectColor } : null,
  }));

  return NextResponse.json({
    pendingApprovals: pendingApprovals.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), dueDate: item.dueDate?.toISOString() ?? null })),
    blockedTasks: blockedTasks.map((task) => ({ ...task, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(), dueDate: task.dueDate?.toISOString() ?? null, blockedAt: task.blockedAt?.toISOString() ?? null })),
    email: latestDigest ? {
      missedReplyCount: latestDigest.missedReplyCount,
      needsReplyCount: latestDigest.needsReplyCount,
      aiSummary: latestDigest.aiSummary,
      createdAt: latestDigest.createdAt.toISOString(),
    } : null,
  });
}

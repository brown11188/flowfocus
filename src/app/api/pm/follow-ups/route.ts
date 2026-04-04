import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalItems, tasks, emailDigests, projects } from "@/lib/db/schema";
import { eq, and, isNotNull, or, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pendingApprovals, blockedTasks, latestDigest] = await Promise.all([
    db.query.approvalItems.findMany({ where: (a, { eq, and }) => and(eq(a.userId, session.user.id!), eq(a.status, "pending")), orderBy: (a, { desc }) => [desc(a.createdAt)], limit: 10 }),
    db.query.tasks.findMany({
      where: (t, { eq, and, or, isNotNull }) => and(eq(t.userId, session.user.id!), eq(t.completed, false), eq(t.isDeleted, false), or(isNotNull(t.waitingOn), isNotNull(t.blockedAt))),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
      limit: 10,
      with: { project: true },
    }),
    db.query.emailDigests.findFirst({ where: (d, { eq, and }) => and(eq(d.userId, session.user.id!), eq(d.status, "done")), orderBy: (d, { desc }) => [desc(d.createdAt)] }),
  ]);

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

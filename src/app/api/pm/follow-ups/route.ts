import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pendingApprovals, blockedTasks, latestDigest] = await Promise.all([
    prisma.approvalItem.findMany({ where: { userId: session.user.id, status: "pending" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        completed: false,
        isDeleted: false,
        OR: [{ waitingOn: { not: null } }, { blockedAt: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { project: true },
    }),
    prisma.emailDigest.findFirst({ where: { userId: session.user.id, status: "done" }, orderBy: { createdAt: "desc" } }),
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

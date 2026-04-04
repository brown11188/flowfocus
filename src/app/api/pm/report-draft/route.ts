import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const projectId = body.projectId as string | undefined;

  const [project, dbTasks, dbRisks, dbApprovals] = await Promise.all([
    projectId ? db.query.projects.findFirst({ where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, session.user.id!)) }) : Promise.resolve(null),
    db.query.tasks.findMany({ where: (t, { eq, and }) => projectId ? and(eq(t.userId, session.user.id!), eq(t.projectId, projectId), eq(t.isDeleted, false)) : and(eq(t.userId, session.user.id!), eq(t.isDeleted, false)), orderBy: (t, { desc }) => [desc(t.updatedAt)], limit: 50 }),
    db.query.risks.findMany({ where: (r, { eq, and, inArray }) => projectId ? and(eq(r.userId, session.user.id!), eq(r.projectId, projectId), inArray(r.status, ["open", "watching"])) : and(eq(r.userId, session.user.id!), inArray(r.status, ["open", "watching"])), orderBy: (r, { desc }) => [desc(r.score)], limit: 10 }),
    db.query.approvalItems.findMany({ where: (a, { eq, and }) => projectId ? and(eq(a.userId, session.user.id!), eq(a.projectId, projectId), eq(a.status, "pending")) : and(eq(a.userId, session.user.id!), eq(a.status, "pending")), orderBy: (a, { desc }) => [desc(a.createdAt)], limit: 10 }),
  ]);

  const completed = dbTasks.filter((t) => t.completed).length;
  const active = dbTasks.filter((t) => !t.completed).length;
  const overdue = dbTasks.filter((t) => !t.completed && t.dueDate && t.dueDate < new Date()).length;

  const content = [
    `# ${project?.name ?? "Portfolio"} Status Report`,
    "",
    "## Overall status",
    overdue > 0 || dbRisks.length > 0 ? "Needs attention" : "On track",
    "",
    "## Completed",
    `- ${completed} tasks completed`,
    "",
    "## In progress",
    `- ${active} active tasks`,
    overdue > 0 ? `- ${overdue} overdue items need recovery` : "- No overdue items",
    "",
    "## Risks",
    ...(dbRisks.length ? dbRisks.slice(0, 5).map((risk) => `- ${risk.title} (score ${risk.score})`) : ["- No major risks logged"]),
    "",
    "## Pending approvals",
    ...(dbApprovals.length ? dbApprovals.slice(0, 5).map((approval) => `- ${approval.title}`) : ["- No pending approvals"]),
    "",
    "## Next steps",
    "- Confirm priorities for the next cycle",
    "- Unblock pending approvals and dependencies",
  ].join("\n");

  return NextResponse.json({
    title: `${project?.name ?? "Portfolio"} Weekly Status`,
    summary: overdue > 0 ? `${overdue} overdue items require attention.` : "Execution remains on track.",
    content,
  });
}

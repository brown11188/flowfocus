import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, tasks, risks, approvalItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const projectId = body.projectId as string | undefined;

  const [project, tasksList, risksList, approvalsList] = await Promise.all([
    projectId
      ? db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id))).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db.select().from(tasks)
      .where(and(eq(tasks.userId, session.user.id), eq(tasks.isDeleted, false), ...(projectId ? [eq(tasks.projectId, projectId)] : [])))
      .orderBy(desc(tasks.updatedAt))
      .limit(50),
    db.select().from(risks)
      .where(and(eq(risks.userId, session.user.id), ...(projectId ? [eq(risks.projectId, projectId)] : [])))
      .orderBy(desc(risks.createdAt))
      .limit(10),
    db.select().from(approvalItems)
      .where(and(eq(approvalItems.userId, session.user.id), eq(approvalItems.status, "pending"), ...(projectId ? [eq(approvalItems.projectId, projectId)] : [])))
      .orderBy(desc(approvalItems.createdAt))
      .limit(10),
  ]);

  const completed = tasksList.filter((t) => t.completed).length;
  const active = tasksList.filter((t) => !t.completed).length;
  const overdue = tasksList.filter((t) => !t.completed && t.dueDate && t.dueDate < new Date()).length;

  const content = [
    `# ${project?.name ?? "Portfolio"} Status Report`,
    "",
    "## Overall status",
    overdue > 0 || risksList.length > 0 ? "Needs attention" : "On track",
    "",
    "## Completed",
    `- ${completed} tasks completed`,
    "",
    "## In progress",
    `- ${active} active tasks`,
    overdue > 0 ? `- ${overdue} overdue items need recovery` : "- No overdue items",
    "",
    "## Risks",
    ...(risksList.length ? risksList.slice(0, 5).map((risk) => `- ${risk.title}`) : ["- No major risks logged"]),
    "",
    "## Pending approvals",
    ...(approvalsList.length ? approvalsList.slice(0, 5).map((approval) => `- ${approval.title}`) : ["- No pending approvals"]),
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

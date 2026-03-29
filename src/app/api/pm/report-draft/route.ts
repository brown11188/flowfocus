import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const projectId = body.projectId as string | undefined;

  const [project, tasks, risks, approvals] = await Promise.all([
    projectId ? prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } }) : null,
    prisma.task.findMany({ where: { userId: session.user.id, ...(projectId ? { projectId } : {}), isDeleted: false }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.risk.findMany({ where: { userId: session.user.id, ...(projectId ? { projectId } : {}), status: { in: ["open", "watching"] } }, orderBy: { score: "desc" }, take: 10 }),
    prisma.approvalItem.findMany({ where: { userId: session.user.id, ...(projectId ? { projectId } : {}), status: "pending" }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const completed = tasks.filter((t) => t.completed).length;
  const active = tasks.filter((t) => !t.completed).length;
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < new Date()).length;

  const content = [
    `# ${project?.name ?? "Portfolio"} Status Report`,
    "",
    "## Overall status",
    overdue > 0 || risks.length > 0 ? "Needs attention" : "On track",
    "",
    "## Completed",
    `- ${completed} tasks completed`,
    "",
    "## In progress",
    `- ${active} active tasks`,
    overdue > 0 ? `- ${overdue} overdue items need recovery` : "- No overdue items",
    "",
    "## Risks",
    ...(risks.length ? risks.slice(0, 5).map((risk) => `- ${risk.title} (score ${risk.score})`) : ["- No major risks logged"]),
    "",
    "## Pending approvals",
    ...(approvals.length ? approvals.slice(0, 5).map((approval) => `- ${approval.title}`) : ["- No pending approvals"]),
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

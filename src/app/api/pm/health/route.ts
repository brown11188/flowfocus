import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjectHealth } from "@/lib/pm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [projects, tasks, risks, approvals, scopeChanges] = await Promise.all([
    prisma.project.findMany({ where: { userId: session.user.id, isInbox: false }, orderBy: { sortOrder: "asc" } }),
    prisma.task.findMany({ where: { userId: session.user.id, isDeleted: false }, include: { blockedBy: true } }),
    prisma.risk.findMany({ where: { userId: session.user.id } }),
    prisma.approvalItem.findMany({ where: { userId: session.user.id } }),
    prisma.scopeChange.findMany({ where: { userId: session.user.id } }),
  ]);

  const items = projects.map((project) => {
    const normalizedHealthStatus =
      project.healthStatus === "green" || project.healthStatus === "yellow" || project.healthStatus === "red"
        ? project.healthStatus
        : "green";

    const result = computeProjectHealth({
      project: {
        ...project,
        healthStatus: normalizedHealthStatus,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        lastHealthCheckAt: project.lastHealthCheckAt?.toISOString() ?? null,
      },
      tasks: tasks.map((t) => ({ ...t, priority: t.priority as 1 | 2 | 3 | 4, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), dueDate: t.dueDate?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null, blockedAt: t.blockedAt?.toISOString() ?? null, recurrenceEndDate: t.recurrenceEndDate?.toISOString() ?? null, importedAt: t.importedAt?.toISOString() ?? null }))
        .filter((t) => t.projectId === project.id),
      risks: risks.map((r) => ({
        ...r,
        status: r.status as "open" | "closed" | "watching" | "mitigated",
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        dueDate: r.dueDate?.toISOString() ?? null,
      })).filter((r) => r.projectId === project.id),
      approvals: approvals.map((a) => ({
        ...a,
        status: a.status as "pending" | "approved" | "rejected",
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        dueDate: a.dueDate?.toISOString() ?? null,
      })).filter((a) => a.projectId === project.id),
      scopeChanges: scopeChanges.map((s) => ({
        ...s,
        impactLevel: s.impactLevel as "low" | "medium" | "high",
        approvalStatus: s.approvalStatus as "pending" | "approved" | "rejected",
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })).filter((s) => s.projectId === project.id),
    });
    return { projectId: project.id, projectName: project.name, ...result };
  });

  return NextResponse.json(items);
}

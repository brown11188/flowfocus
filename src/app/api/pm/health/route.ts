import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeProjectHealth } from "@/lib/pm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [dbProjects, dbTasks, dbRisks, dbApprovals, dbScopeChanges] = await Promise.all([
    db.query.projects.findMany({ where: (p, { eq, and }) => and(eq(p.userId, session.user.id!), eq(p.isInbox, false)), orderBy: (p, { asc }) => [asc(p.sortOrder)] }),
    db.query.tasks.findMany({ where: (t, { eq, and }) => and(eq(t.userId, session.user.id!), eq(t.isDeleted, false)), with: { blockedBy: true } }),
    db.query.risks.findMany({ where: (r, { eq }) => eq(r.userId, session.user.id!) }),
    db.query.approvalItems.findMany({ where: (a, { eq }) => eq(a.userId, session.user.id!) }),
    db.query.scopeChanges.findMany({ where: (s, { eq }) => eq(s.userId, session.user.id!) }),
  ]);

  const items = dbProjects.map((project) => {
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
      tasks: dbTasks.map((t) => ({ ...t, priority: t.priority as 1 | 2 | 3 | 4, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), dueDate: t.dueDate?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null, blockedAt: t.blockedAt?.toISOString() ?? null, recurrenceEndDate: t.recurrenceEndDate?.toISOString() ?? null, importedAt: t.importedAt?.toISOString() ?? null }))
        .filter((t) => t.projectId === project.id),
      risks: dbRisks.map((r) => ({
        ...r,
        status: r.status as "open" | "closed" | "watching" | "mitigated",
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        dueDate: r.dueDate?.toISOString() ?? null,
      })).filter((r) => r.projectId === project.id),
      approvals: dbApprovals.map((a) => ({
        ...a,
        status: a.status as "pending" | "approved" | "rejected",
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        dueDate: a.dueDate?.toISOString() ?? null,
      })).filter((a) => a.projectId === project.id),
      scopeChanges: dbScopeChanges.map((s) => ({
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

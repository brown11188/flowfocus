import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, tasks, risks, approvalItems, scopeChanges } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { computeProjectHealth } from "@/lib/pm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [projectsList, tasksList, risksList, approvalsList, scopeChangesList] = await Promise.all([
    db.select().from(projects)
      .where(and(eq(projects.userId, session.user.id), eq(projects.isInbox, false)))
      .orderBy(asc(projects.sortOrder)),
    db.select().from(tasks).where(and(eq(tasks.userId, session.user.id), eq(tasks.isDeleted, false))),
    db.select().from(risks).where(eq(risks.userId, session.user.id)),
    db.select().from(approvalItems).where(eq(approvalItems.userId, session.user.id)),
    db.select().from(scopeChanges).where(eq(scopeChanges.userId, session.user.id)),
  ]);

  const items = projectsList.map((project) => {
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
      tasks: tasksList
        .map((t) => ({
          ...t,
          priority: t.priority as 1 | 2 | 3 | 4,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          dueDate: t.dueDate?.toISOString() ?? null,
          completedAt: t.completedAt?.toISOString() ?? null,
          blockedAt: t.blockedAt?.toISOString() ?? null,
          recurrenceEndDate: t.recurrenceEndDate?.toISOString() ?? null,
          importedAt: t.importedAt?.toISOString() ?? null,
          blockedBy: [],
        }))
        .filter((t) => t.projectId === project.id),
      risks: risksList
        .map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description ?? null,
          projectId: r.projectId,
          userId: r.userId,
          probability: 2,
          impact: 2,
          score: 0,
          status: r.status as "open" | "closed" | "watching" | "mitigated",
          mitigationPlan: r.mitigationPlan ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          dueDate: null,
        }))
        .filter((r) => r.projectId === project.id),
      approvals: approvalsList
        .map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description ?? null,
          projectId: a.projectId,
          userId: a.userId,
          status: a.status as "pending" | "approved" | "rejected",
          dueDate: a.dueDate?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }))
        .filter((a) => a.projectId === project.id),
      scopeChanges: scopeChangesList
        .map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? null,
          projectId: s.projectId,
          userId: s.userId,
          category: "general",
          impactLevel: (s.impact ?? "medium") as "low" | "medium" | "high",
          approvalStatus: (s.status ?? "pending") as "pending" | "approved" | "rejected",
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }))
        .filter((s) => s.projectId === project.id),
    });
    return { projectId: project.id, projectName: project.name, ...result };
  });

  return NextResponse.json(items);
}

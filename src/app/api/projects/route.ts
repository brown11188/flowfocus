import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

async function getTaskCountMap(userId: string) {
  const counts = await db
    .select({ projectId: tasks.projectId, count: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isDeleted, false), eq(tasks.completed, false)))
    .groupBy(tasks.projectId);
  return new Map(counts.map((c) => [c.projectId, c.count]));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const [projectList, countMap] = await Promise.all([
    db.query.projects.findMany({
      where: (p, { eq: e }) => e(p.userId, userId),
      orderBy: (p, { desc, asc }) => [desc(p.isInbox), asc(p.sortOrder)],
    }),
    getTaskCountMap(userId),
  ]);

  return NextResponse.json(projectList.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastHealthCheckAt: p.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: countMap.get(p.id) ?? 0 },
  })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { id, healthStatus, healthScore, healthSummary, name, color } = await req.json();
  if (!id) return NextResponse.json({ error: "Project id required" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (color !== undefined) updateData.color = color;
  if (healthStatus !== undefined) updateData.healthStatus = healthStatus;
  if (healthScore !== undefined) updateData.healthScore = Number(healthScore);
  if (healthSummary !== undefined) updateData.healthSummary = healthSummary;
  if (healthStatus !== undefined || healthScore !== undefined || healthSummary !== undefined) {
    updateData.lastHealthCheckAt = new Date();
  }

  const [updated] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();

  const countMap = await getTaskCountMap(userId);
  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    lastHealthCheckAt: updated.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: countMap.get(updated.id) ?? 0 },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { name, color = "#6366f1", healthStatus, healthScore, healthSummary } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const [created] = await db.insert(projects).values({
    name: name.trim(),
    color,
    userId,
    ...(healthStatus ? { healthStatus } : {}),
    ...(healthScore !== undefined ? { healthScore: Number(healthScore) } : {}),
    ...(healthSummary !== undefined ? { healthSummary } : {}),
    lastHealthCheckAt: healthStatus || healthScore !== undefined || healthSummary !== undefined ? new Date() : null,
  }).returning();

  return NextResponse.json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    lastHealthCheckAt: created.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: 0 },
  });
}

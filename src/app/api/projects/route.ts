import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, desc, asc, count } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectRows = await db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(desc(projects.isInbox), asc(projects.sortOrder));

  const taskCountRows = await db.select({ projectId: tasks.projectId, cnt: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), eq(tasks.isDeleted, false), eq(tasks.completed, false)))
    .groupBy(tasks.projectId);

  const countMap = new Map(taskCountRows.map(r => [r.projectId, r.cnt]));

  return NextResponse.json(projectRows.map(p => ({
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

  const [project] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();

  const [{ cnt }] = await db.select({ cnt: count() }).from(tasks).where(eq(tasks.projectId, id));

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastHealthCheckAt: project.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: cnt },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, color = "#6366f1", healthStatus, healthScore, healthSummary } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const [project] = await db.insert(projects).values({
    name: name.trim(),
    color,
    userId: session.user.id,
    ...(healthStatus ? { healthStatus } : {}),
    ...(healthScore !== undefined ? { healthScore: Number(healthScore) } : {}),
    ...(healthSummary !== undefined ? { healthSummary } : {}),
    lastHealthCheckAt: healthStatus || healthScore !== undefined || healthSummary !== undefined ? new Date() : null,
  }).returning();

  return NextResponse.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastHealthCheckAt: project.lastHealthCheckAt?.toISOString() ?? null,
    _count: { tasks: 0 },
  });
}

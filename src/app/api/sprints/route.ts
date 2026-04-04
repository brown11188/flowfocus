import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sprints, projects } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

function serializeSprint(s: Record<string, unknown>) {
  return {
    ...s,
    startDate: s.startDate instanceof Date ? (s.startDate as Date).toISOString() : s.startDate,
    endDate: s.endDate instanceof Date ? (s.endDate as Date).toISOString() : s.endDate,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
  };
}

// GET /api/sprints?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id))).limit(1);
  if (!project) return NextResponse.json([]);

  const sprintRows = await db.select().from(sprints).where(eq(sprints.projectId, projectId)).orderBy(desc(sprints.startDate));

  // Build _count for each sprint
  const { tasks } = await import("@/db/schema");
  const results = await Promise.all(
    sprintRows.map(async (s) => {
      const [{ value }] = await db.select({ value: count() }).from(tasks).where(eq(tasks.sprintId, s.id));
      return { ...s, _count: { tasks: value } };
    })
  );

  return NextResponse.json(results.map((s) => serializeSprint(s as unknown as Record<string, unknown>)));
}

// POST /api/sprints
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, goal, startDate, endDate, projectId } = await req.json();
  if (!name?.trim() || !startDate || !endDate || !projectId) {
    return NextResponse.json({ error: "name, startDate, endDate, projectId required" }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id))).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [sprint] = await db.insert(sprints).values({
    name: name.trim(),
    goal,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    projectId,
  }).returning();

  return NextResponse.json(serializeSprint({ ...sprint, _count: { tasks: 0 } } as unknown as Record<string, unknown>));
}

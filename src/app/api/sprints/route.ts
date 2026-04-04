import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, sprints as sprintsTable } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

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

  const project = await db.query.projects.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const sprintList = await db.query.sprints.findMany({
    where: (s, { eq }) => eq(s.projectId, projectId),
    orderBy: (s, { desc }) => [desc(s.startDate)],
  });

  const counts = await db
    .select({ sprintId: tasks.sprintId, count: count() })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.sprintId);
  const countMap = new Map(counts.map((c) => [c.sprintId, c.count]));

  return NextResponse.json(
    sprintList.map((s) =>
      serializeSprint({ ...(s as unknown as Record<string, unknown>), _count: { tasks: countMap.get(s.id) ?? 0 } })
    )
  );
}

// POST /api/sprints
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, goal, startDate, endDate, projectId } = await req.json();
  if (!name?.trim() || !startDate || !endDate || !projectId) {
    return NextResponse.json({ error: "name, startDate, endDate, projectId required" }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [sprint] = await db
    .insert(sprintsTable)
    .values({ name: name.trim(), goal, startDate: new Date(startDate), endDate: new Date(endDate), projectId })
    .returning();

  return NextResponse.json(
    serializeSprint({ ...(sprint as unknown as Record<string, unknown>), _count: { tasks: 0 } })
  );
}

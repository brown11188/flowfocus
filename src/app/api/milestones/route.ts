import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { milestones as milestonesTable } from "@/lib/db/schema";


function serializeMilestone(m: Record<string, unknown>) {
  const taskList = Array.isArray(m.tasks) ? (m.tasks as Array<Record<string, unknown>>) : [];
  return {
    ...m,
    targetDate: m.targetDate instanceof Date ? (m.targetDate as Date).toISOString() : m.targetDate,
    createdAt: m.createdAt instanceof Date ? (m.createdAt as Date).toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? (m.updatedAt as Date).toISOString() : m.updatedAt,
    tasks: taskList.map((mt) => ({
      ...mt,
      task: mt.task ? serializeTask(mt.task as Record<string, unknown>) : null,
    })),
    _count: { tasks: taskList.length },
  };
}

function serializeTask(t: Record<string, unknown>) {
  return {
    ...t,
    dueDate: t.dueDate instanceof Date ? (t.dueDate as Date).toISOString() : (t.dueDate ?? null),
  };
}

const MILESTONE_WITH = {
  tasks: {
    with: {
      task: { columns: { id: true, title: true, completed: true, priority: true, dueDate: true } as const },
    },
  },
} as const;

// GET /api/milestones?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  let milestoneList;
  if (projectId) {
    const project = await db.query.projects.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, session.user.id)),
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    milestoneList = await db.query.milestones.findMany({
      where: (m, { eq }) => eq(m.projectId, projectId),
      with: MILESTONE_WITH,
      orderBy: (m, { asc }) => [asc(m.targetDate)],
    });
  } else {
    const userProjects = await db.query.projects.findMany({
      where: (p, { eq }) => eq(p.userId, session.user.id),
      columns: { id: true },
    });
    const projectIds = userProjects.map((p) => p.id);
    if (projectIds.length === 0) return NextResponse.json([]);

    milestoneList = await db.query.milestones.findMany({
      where: (m, { inArray }) => inArray(m.projectId, projectIds),
      with: MILESTONE_WITH,
      orderBy: (m, { asc }) => [asc(m.targetDate)],
    });
  }

  return NextResponse.json(milestoneList.map((m) => serializeMilestone(m as unknown as Record<string, unknown>)));
}

// POST /api/milestones
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, targetDate, projectId } = await req.json();
  if (!name?.trim() || !targetDate || !projectId) {
    return NextResponse.json({ error: "name, targetDate, projectId required" }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [inserted] = await db
    .insert(milestonesTable)
    .values({ name: name.trim(), description, targetDate: new Date(targetDate), projectId })
    .returning();

  const milestone = await db.query.milestones.findFirst({
    where: (m, { eq }) => eq(m.id, inserted.id),
    with: MILESTONE_WITH,
  });

  return NextResponse.json(serializeMilestone(milestone as unknown as Record<string, unknown>));
}

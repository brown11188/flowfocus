import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { milestones, milestoneTasks, tasks, projects } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

function serializeMilestone(m: Record<string, unknown>) {
  return {
    ...m,
    targetDate: m.targetDate instanceof Date ? (m.targetDate as Date).toISOString() : m.targetDate,
    createdAt: m.createdAt instanceof Date ? (m.createdAt as Date).toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? (m.updatedAt as Date).toISOString() : m.updatedAt,
    tasks: Array.isArray(m.tasks) ? (m.tasks as Array<Record<string, unknown>>).map((mt) => ({
      ...mt,
      task: mt.task ? serializeTask(mt.task as Record<string, unknown>) : null,
    })) : [],
  };
}

function serializeTask(t: Record<string, unknown>) {
  return {
    ...t,
    dueDate: t.dueDate instanceof Date ? (t.dueDate as Date).toISOString() : (t.dueDate ?? null),
    completedAt: t.completedAt instanceof Date ? (t.completedAt as Date).toISOString() : (t.completedAt ?? null),
    createdAt: t.createdAt instanceof Date ? (t.createdAt as Date).toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? (t.updatedAt as Date).toISOString() : t.updatedAt,
  };
}

async function getMilestoneWithTasks(milestoneId: string) {
  const milestone = await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  if (!milestone[0]) return null;

  const mts = await db
    .select({
      milestoneId: milestoneTasks.milestoneId,
      taskId: milestoneTasks.taskId,
      task: {
        id: tasks.id,
        title: tasks.title,
        completed: tasks.completed,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      },
    })
    .from(milestoneTasks)
    .leftJoin(tasks, eq(milestoneTasks.taskId, tasks.id))
    .where(eq(milestoneTasks.milestoneId, milestoneId));

  return { ...milestone[0], tasks: mts, _count: { tasks: mts.length } };
}

// GET /api/milestones?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  // Get authorized project IDs
  const userProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, session.user.id));
  const projectIds = userProjects.map((p) => p.id);

  let milestoneRows;
  if (projectId) {
    if (!projectIds.includes(projectId)) return NextResponse.json([]);
    milestoneRows = await db.select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(asc(milestones.targetDate));
  } else {
    const { inArray } = await import("drizzle-orm");
    milestoneRows = projectIds.length
      ? await db.select().from(milestones).where(inArray(milestones.projectId, projectIds)).orderBy(asc(milestones.targetDate))
      : [];
  }

  const results = await Promise.all(
    milestoneRows.map(async (m) => {
      const mts = await db
        .select({
          milestoneId: milestoneTasks.milestoneId,
          taskId: milestoneTasks.taskId,
          task: {
            id: tasks.id,
            title: tasks.title,
            completed: tasks.completed,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
          },
        })
        .from(milestoneTasks)
        .leftJoin(tasks, eq(milestoneTasks.taskId, tasks.id))
        .where(eq(milestoneTasks.milestoneId, m.id));
      return { ...m, tasks: mts, _count: { tasks: mts.length } };
    })
  );

  return NextResponse.json(results.map((m) => serializeMilestone(m as unknown as Record<string, unknown>)));
}

// POST /api/milestones
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, targetDate, projectId } = await req.json();
  if (!name?.trim() || !targetDate || !projectId) {
    return NextResponse.json({ error: "name, targetDate, projectId required" }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id))).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [milestone] = await db.insert(milestones).values({
    name: name.trim(),
    description,
    targetDate: new Date(targetDate),
    projectId,
  }).returning();

  const result = await getMilestoneWithTasks(milestone.id);
  return NextResponse.json(serializeMilestone(result as unknown as Record<string, unknown>));
}

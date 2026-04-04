import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { timeLogs, tasks, projects } from "@/db/schema";
import { eq, and, gte, lt, asc, desc } from "drizzle-orm";

function serializeLog(l: Record<string, unknown>) {
  return {
    ...l,
    loggedAt: l.loggedAt instanceof Date ? (l.loggedAt as Date).toISOString() : l.loggedAt,
  };
}

// GET /api/timelogs?taskId=xxx OR ?week=YYYY-WXX
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  const weekParam = req.nextUrl.searchParams.get("week"); // "YYYY-WXX" format or ISO date

  if (taskId) {
    const logs = await db.select().from(timeLogs)
      .where(and(eq(timeLogs.taskId, taskId), eq(timeLogs.userId, session.user.id)))
      .orderBy(desc(timeLogs.loggedAt));
    return NextResponse.json(logs.map(l => serializeLog(l as unknown as Record<string, unknown>)));
  }

  // Weekly summary
  let startDate: Date;
  let endDate: Date;

  if (weekParam) {
    startDate = new Date(weekParam);
    startDate.setHours(0, 0, 0, 0);
    // Align to Monday
    const day = startDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diff);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const day = startDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diff);
  }
  endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const rows = await db.select({
    id: timeLogs.id,
    taskId: timeLogs.taskId,
    userId: timeLogs.userId,
    durationMinutes: timeLogs.durationMinutes,
    note: timeLogs.note,
    loggedAt: timeLogs.loggedAt,
    taskTitle: tasks.title,
    taskProjectId: tasks.projectId,
    projectName: projects.name,
    projectColor: projects.color,
  }).from(timeLogs)
    .leftJoin(tasks, eq(timeLogs.taskId, tasks.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(timeLogs.userId, session.user.id),
      gte(timeLogs.loggedAt, startDate),
      lt(timeLogs.loggedAt, endDate),
    ))
    .orderBy(asc(timeLogs.loggedAt));

  const logs = rows.map(row => ({
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    durationMinutes: row.durationMinutes,
    note: row.note,
    loggedAt: row.loggedAt,
    task: row.taskTitle ? {
      id: row.taskId,
      title: row.taskTitle,
      projectId: row.taskProjectId,
      project: row.projectName ? { name: row.projectName, color: row.projectColor } : null,
    } : null,
  }));

  return NextResponse.json(logs.map((l) => serializeLog(l as unknown as Record<string, unknown>)));
}

// POST /api/timelogs
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId, durationMinutes, note } = await req.json();
  if (!taskId || !durationMinutes) return NextResponse.json({ error: "taskId and durationMinutes required" }, { status: 400 });

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
    .limit(1);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const [log] = await db.insert(timeLogs).values({
    taskId,
    userId: session.user.id,
    durationMinutes: Number(durationMinutes),
    note,
  }).returning();
  return NextResponse.json(serializeLog(log as unknown as Record<string, unknown>));
}

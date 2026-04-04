import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeLogs } from "@/lib/db/schema";


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
    const logs = await db.query.timeLogs.findMany({
      where: (tl, { eq, and }) => and(eq(tl.taskId, taskId), eq(tl.userId, session.user.id)),
      orderBy: (tl, { desc }) => [desc(tl.loggedAt)],
    });
    return NextResponse.json(logs.map((l) => serializeLog(l as unknown as Record<string, unknown>)));
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

  const logs = await db.query.timeLogs.findMany({
    where: (tl, { eq, and, gte, lt }) =>
      and(eq(tl.userId, session.user.id), gte(tl.loggedAt, startDate), lt(tl.loggedAt, endDate)),
    with: {
      task: {
        columns: { id: true, title: true, projectId: true },
        with: { project: { columns: { name: true, color: true } } },
      },
    },
    orderBy: (tl, { asc }) => [asc(tl.loggedAt)],
  });

  return NextResponse.json(logs.map((l) => serializeLog(l as unknown as Record<string, unknown>)));
}

// POST /api/timelogs
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId, durationMinutes, note } = await req.json();
  if (!taskId || !durationMinutes) return NextResponse.json({ error: "taskId and durationMinutes required" }, { status: 400 });

  const task = await db.query.tasks.findFirst({
    where: (t, { eq, and }) => and(eq(t.id, taskId), eq(t.userId, session.user.id)),
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const [log] = await db
    .insert(timeLogs)
    .values({ taskId, userId: session.user.id, durationMinutes: Number(durationMinutes), note })
    .returning();
  return NextResponse.json(serializeLog(log as unknown as Record<string, unknown>));
}

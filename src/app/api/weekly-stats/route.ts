import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function getWeekBounds(weekStr?: string | null): { start: Date; end: Date } {
  const now = new Date();
  if (weekStr) {
    // YYYY-WNN format
    const [yearStr, weekNum] = weekStr.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekNum);
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);
    const start = new Date(firstMonday);
    start.setDate(start.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // Current week (Mon-Sun)
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week");
  const { start, end } = getWeekBounds(week);
  const userId = session.user.id;

  const [completedTasks, allDueTasks, focusSessionRows] = await Promise.all([
    db.query.tasks.findMany({
      where: (t, { eq, and, gte, lte }) => and(
        eq(t.userId, userId),
        eq(t.completed, true),
        gte(t.completedAt, start),
        lte(t.completedAt, end)
      ),
      columns: { id: true, completedAt: true, projectId: true },
      with: { project: { columns: { name: true, color: true } } },
    }),
    db.query.tasks.findMany({
      where: (t, { eq, and, gte, lte }) => and(
        eq(t.userId, userId),
        gte(t.dueDate, start),
        lte(t.dueDate, end),
        eq(t.isDeleted, false)
      ),
      columns: { id: true, title: true, dueDate: true, completed: true, projectId: true },
      with: { project: { columns: { name: true } } },
    }),
    db.query.focusSessions.findMany({
      where: (fs, { eq, and, gte, lte }) => and(
        eq(fs.userId, userId),
        gte(fs.createdAt, start),
        lte(fs.createdAt, end)
      ),
      columns: { actualMins: true, createdAt: true },
    }),
  ]);

  const completed = completedTasks.length;
  const overdueTasks = allDueTasks.filter(t => !t.completed);
  const overdue = overdueTasks.length;
  const focusMinutes = focusSessionRows.reduce((sum, s) => sum + s.actualMins, 0);
  const completionRate = completed + overdue > 0 ? Math.round((completed / (completed + overdue)) * 100) : 0;

  // By day breakdown
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byDay = days.map((day, i) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    const dayStr = dayDate.toISOString().slice(0, 10);
    const completedCount = completedTasks.filter(t => t.completedAt && t.completedAt.toISOString().slice(0, 10) === dayStr).length;
    const focusMins = focusSessionRows.filter(s => s.createdAt.toISOString().slice(0, 10) === dayStr).reduce((sum, s) => sum + s.actualMins, 0);
    return { day, completedCount, focusMinutes: focusMins };
  });

  // By project
  const byProject: Record<string, { name: string; color: string; count: number }> = {};
  for (const t of completedTasks) {
    const pId = t.projectId || "_none";
    if (!byProject[pId]) byProject[pId] = { name: t.project?.name || "No Project", color: t.project?.color || "#888", count: 0 };
    byProject[pId].count++;
  }

  return NextResponse.json({
    completed,
    overdue,
    focusMinutes,
    emailsResponded: 0, // placeholder for MS 365 data
    completionRate,
    byDay,
    byProject: Object.values(byProject),
    overdueTasks: overdueTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate?.toISOString(), projectName: t.project?.name })),
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
  });
}

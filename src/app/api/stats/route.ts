import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, isNotNull, count, gte, lt } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [completedTodayRows, totalTodayRows] = await Promise.all([
    db.select({ value: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), eq(tasks.isDeleted, false), gte(tasks.completedAt, today), lt(tasks.completedAt, tomorrow))
    ),
    db.select({ value: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), eq(tasks.isDeleted, false), gte(tasks.dueDate, today), lt(tasks.dueDate, tomorrow))
    ),
  ]);
  const completedToday = completedTodayRows[0].value;
  const totalToday = totalTodayRows[0].value;

  // Weekly data (last 7 days)
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const [{ value }] = await db.select({ value: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), eq(tasks.isDeleted, false), gte(tasks.completedAt, d), lt(tasks.completedAt, next))
    );
    weeklyData.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count: value });
  }

  // Streak: count consecutive WEEKDAYS with at least 1 completed task
  // Weekends (Sat/Sun) are skipped — they don't count toward streak but don't break it
  let streak = 0;
  let checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1); // start from yesterday
  for (let i = 0; i < 365; i++) {
    const dayOfWeek = checkDate.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Skip weekends — don't break streak, just move back
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }
    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const [{ value }] = await db.select({ value: count() }).from(tasks).where(
      and(eq(tasks.userId, userId), gte(tasks.completedAt, checkDate), lt(tasks.completedAt, nextDay))
    );
    if (value > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  const [overdueRow] = await db.select({ value: count() }).from(tasks).where(
    and(eq(tasks.userId, userId), eq(tasks.isDeleted, false), eq(tasks.completed, false), lt(tasks.dueDate, today))
  );
  const overdueCount = overdueRow.value;

  const [blockedRow] = await db.select({ value: count() }).from(tasks).where(
    and(
      eq(tasks.userId, userId),
      eq(tasks.isDeleted, false),
      eq(tasks.completed, false),
      or(isNotNull(tasks.waitingOn), isNotNull(tasks.blockedAt))
    )
  );
  const blockedCount = blockedRow.value;

  return NextResponse.json({ completedToday, totalToday, streak, weeklyData, overdueCount, blockedCount });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [completedToday, totalToday] = await Promise.all([
    prisma.task.count({
      where: { userId: session.user.id, isDeleted: false, completedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.task.count({
      where: { userId: session.user.id, isDeleted: false, dueDate: { gte: today, lt: tomorrow } },
    }),
  ]);

  // Weekly data (last 7 days)
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = await prisma.task.count({
      where: { userId: session.user.id, isDeleted: false, completedAt: { gte: d, lt: next } },
    });
    weeklyData.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count });
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
    const count = await prisma.task.count({
      where: { userId: session.user.id, completedAt: { gte: checkDate, lt: nextDay } },
    });
    if (count > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  const overdueCount = await prisma.task.count({
    where: { userId: session.user.id, isDeleted: false, completed: false, dueDate: { lt: today } },
  });

  const blockedCount = await prisma.task.count({
    where: {
      userId: session.user.id,
      isDeleted: false,
      completed: false,
      OR: [
        { waitingOn: { not: null } },
        { blockedAt: { not: null } },
      ],
    },
  });

  return NextResponse.json({ completedToday, totalToday, streak, weeklyData, overdueCount, blockedCount });
}

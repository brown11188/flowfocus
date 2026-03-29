import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  const where: Record<string, unknown> = { userId: session.user.id };
  if (date) {
    const start = new Date(date + "T00:00:00Z");
    const end = new Date(date + "T23:59:59Z");
    where.createdAt = { gte: start, lte: end };
  }

  const sessions = await prisma.focusSession.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId, taskLabel, plannedMins, actualMins, wasCompleted } = await req.json();
  if (!taskLabel || !plannedMins) {
    return NextResponse.json({ error: "taskLabel and plannedMins required" }, { status: 400 });
  }
  const focusSession = await prisma.focusSession.create({
    data: {
      userId: session.user.id,
      taskId: taskId || null,
      taskLabel,
      plannedMins,
      actualMins: actualMins || 0,
      wasCompleted: wasCompleted || false,
      completedAt: new Date(),
    },
  });
  return NextResponse.json(focusSession);
}

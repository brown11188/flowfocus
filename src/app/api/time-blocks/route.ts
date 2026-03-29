import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const blocks = await prisma.timeBlock.findMany({
    where: { userId: session.user.id, date },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json(blocks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId, title, startTime, endTime, date, color, note } = await req.json();
  if (!title || !startTime || !endTime || !date) {
    return NextResponse.json({ error: "title, startTime, endTime, date required" }, { status: 400 });
  }
  const block = await prisma.timeBlock.create({
    data: {
      userId: session.user.id,
      taskId: taskId || null,
      title,
      startTime,
      endTime,
      date,
      color: color || "violet",
      note: note || null,
    },
  });
  return NextResponse.json(block);
}

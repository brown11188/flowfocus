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

  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  return NextResponse.json(log);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { date, intention, eodNote, completedCount, deferredCount, morningDone, eodDone } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const log = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: {
      userId: session.user.id,
      date,
      intention: intention ?? null,
      eodNote: eodNote ?? null,
      completedCount: completedCount ?? 0,
      deferredCount: deferredCount ?? 0,
      morningDone: morningDone ?? false,
      eodDone: eodDone ?? false,
    },
    update: {
      ...(intention !== undefined && { intention }),
      ...(eodNote !== undefined && { eodNote }),
      ...(completedCount !== undefined && { completedCount }),
      ...(deferredCount !== undefined && { deferredCount }),
      ...(morningDone !== undefined && { morningDone }),
      ...(eodDone !== undefined && { eodDone }),
    },
  });
  return NextResponse.json(log);
}

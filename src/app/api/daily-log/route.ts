import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { dailyLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const [log] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, session.user.id), eq(dailyLogs.date, date)))
    .limit(1);
  return NextResponse.json(log ?? null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { date, intention, eodNote, completedCount, deferredCount, morningDone, eodDone } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const existing = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, session.user.id), eq(dailyLogs.date, date)))
    .limit(1);

  let log;
  if (existing.length === 0) {
    [log] = await db
      .insert(dailyLogs)
      .values({
        userId: session.user.id,
        date,
        intention: intention ?? null,
        eodNote: eodNote ?? null,
        completedCount: completedCount ?? 0,
        deferredCount: deferredCount ?? 0,
        morningDone: morningDone ?? false,
        eodDone: eodDone ?? false,
      })
      .returning();
  } else {
    const updateData: Record<string, unknown> = {};
    if (intention !== undefined) updateData.intention = intention;
    if (eodNote !== undefined) updateData.eodNote = eodNote;
    if (completedCount !== undefined) updateData.completedCount = completedCount;
    if (deferredCount !== undefined) updateData.deferredCount = deferredCount;
    if (morningDone !== undefined) updateData.morningDone = morningDone;
    if (eodDone !== undefined) updateData.eodDone = eodDone;
    [log] = await db
      .update(dailyLogs)
      .set(updateData)
      .where(and(eq(dailyLogs.userId, session.user.id), eq(dailyLogs.date, date)))
      .returning();
  }
  return NextResponse.json(log);
}

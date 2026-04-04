import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TIMEZONE_LIST } from "@/lib/timezone";

const VALID_TIMEZONES = new Set(TIMEZONE_LIST.map(t => t.value));

function isValidTimezone(tz: string): boolean {
  if (VALID_TIMEZONES.has(tz)) return true;
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; }
  catch { return false; }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, session.user.id)).limit(1);
  return NextResponse.json({ timezone: user?.timezone ?? "UTC" });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { timezone?: unknown };
  const tz = body.timezone;

  if (typeof tz !== "string" || !tz.trim()) {
    return NextResponse.json({ error: "timezone is required" }, { status: 400 });
  }
  if (!isValidTimezone(tz)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  await db.update(users).set({ timezone: tz }).where(eq(users.id, session.user.id));

  return NextResponse.json({ timezone: tz });
}


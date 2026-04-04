import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gt } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 86400000);
  const activeSessions = await db.query.sessions.findMany({
    where: (s, { gt }) => gt(s.expires, cutoff),
    columns: { userId: true },
  });

  const seen = new Set<string>();
  const userIds: string[] = [];
  for (const s of activeSessions) {
    if (!seen.has(s.userId)) { seen.add(s.userId); userIds.push(s.userId); }
  }

  const results: Array<{ userId: string; status: string; error?: string }> = [];
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const baseUrl = process.env.AUTH_URL
    ? process.env.AUTH_URL.replace(/\/api\/auth\/?$/, "")
    : `http://localhost:${process.env.PORT ?? 3000}${BASE_PATH}`;

  for (const userId of userIds) {
    try {
      const url = `${baseUrl}/api/cron/daily-briefing/generate?userId=${userId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${cronSecret}` } });
      const json = await res.json() as { ok?: boolean; error?: string };
      results.push({ userId, status: json.ok ? "generated" : "skipped", error: json.error });
    } catch (err) {
      results.push({ userId, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, processed: userIds.length, results, timestamp: new Date().toISOString() });
}

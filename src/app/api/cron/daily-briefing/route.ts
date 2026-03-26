import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Secured cron endpoint: called daily at 7:00 AM (Asia/Bangkok = 00:00 UTC)
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all users who have logged in within the last 7 days
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const activeSessions = await prisma.session.findMany({
    where: { expires: { gt: cutoff } },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = activeSessions.map(s => s.userId);
  const results: Array<{ userId: string; status: string; error?: string }> = [];

  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const baseUrl = process.env.AUTH_URL
    ? process.env.AUTH_URL.replace(/\/api\/auth\/?$/, "")
    : `http://localhost:${process.env.PORT ?? 3000}${BASE_PATH}`;

  for (const userId of userIds) {
    try {
      // Call the daily-briefing endpoint internally with a fake session cookie
      // We use a direct DB call approach to avoid needing a real session
      const url = `${baseUrl}/api/cron/daily-briefing/generate?userId=${userId}`;
      // For simplicity: re-use the generation logic by importing it server-side
      // This is handled by the generate sub-route
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      results.push({ userId, status: json.ok ? "generated" : "skipped", error: json.error });
    } catch (err) {
      results.push({ userId, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: userIds.length,
    results,
    timestamp: new Date().toISOString(),
  });
}

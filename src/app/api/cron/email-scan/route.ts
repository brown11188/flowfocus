import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runEmailScan } from "@/lib/email-scan";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = new Date();
  const today = startedAt.toISOString().split("T")[0];

  const connections = await db.query.microsoftConnections.findMany({
    where: (c, { eq }) => eq(c.syncEmailsEnabled, true),
    columns: { userId: true, email: true, displayName: true },
  });

  if (connections.length === 0) {
    return NextResponse.json({ success: true, message: "No connected Microsoft accounts found", processed: 0, date: today });
  }

  const results: Array<{ userId: string; email: string | null; status: "success" | "error" | "skipped"; error?: string }> = [];

  for (const conn of connections) {
    const existingDigest = await db.query.emailDigests.findFirst({
      where: (d, { eq, and }) => and(eq(d.userId, conn.userId), eq(d.scanDate, today), eq(d.status, "done")),
    });

    if (existingDigest) {
      results.push({ userId: conn.userId, email: conn.email, status: "skipped" });
      continue;
    }

    try {
      const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, conn.userId), columns: { timezone: true } });
      const tz = user?.timezone ?? "UTC";
      await runEmailScan(conn.userId, tz);
      results.push({ userId: conn.userId, email: conn.email, status: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ userId: conn.userId, email: conn.email, status: "error", error: msg });
      console.error(`[CronEmailScan] Failed for user ${conn.userId}:`, err);
    }
  }

  const duration = Date.now() - startedAt.getTime();
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;

  return NextResponse.json({ success: true, date: today, duration_ms: duration, processed: connections.length, successCount, errorCount, skippedCount, results });
}

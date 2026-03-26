import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Import the core scan logic from shared lib
import { runEmailScan } from "@/lib/email-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for batch processing

/**
 * GET /api/cron/email-scan
 *
 * Daily cron job that scans emails for ALL connected users.
 * Protected by CRON_SECRET env variable.
 *
 * Call this daily via:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.com/api/cron/email-scan
 *
 * Or configure via crontab / external cron service:
 *   # 7:00 AM GMT+7 = 00:00 UTC
 *   0 0 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/apps/xklwb3f46m48u5s4h2h5d4pd/api/cron/email-scan
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const today = startedAt.toISOString().split("T")[0];

  // Find all users with Microsoft connected and email sync enabled
  const connections = await prisma.microsoftConnection.findMany({
    where: { syncEmailsEnabled: true },
    select: { userId: true, email: true, displayName: true },
  });

  if (connections.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No connected Microsoft accounts found",
      processed: 0,
      date: today,
    });
  }

  const results: Array<{
    userId: string;
    email: string | null;
    status: "success" | "error" | "skipped";
    error?: string;
  }> = [];

  for (const conn of connections) {
    // Skip if already scanned today successfully
    const existingDigest = await prisma.emailDigest.findFirst({
      where: { userId: conn.userId, scanDate: today, status: "done" },
    });

    if (existingDigest) {
      results.push({ userId: conn.userId, email: conn.email, status: "skipped" });
      continue;
    }

    try {
      await runEmailScan(conn.userId);
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

  console.log(`[CronEmailScan] Completed: ${successCount} success, ${errorCount} error, ${skippedCount} skipped. Duration: ${duration}ms`);

  return NextResponse.json({
    success: true,
    date: today,
    duration_ms: duration,
    processed: connections.length,
    successCount,
    errorCount,
    skippedCount,
    results,
  });
}

import { NextResponse } from "next/server";

/**
 * Health check endpoint.
 * Called by the deployment script to verify the container is ready.
 * Must be fast, unauthenticated, and always return 200.
 * The /api/* prefix is excluded from auth middleware so no redirect occurs.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

// Must never be statically generated — needs to run at request time
export const dynamic = "force-dynamic";

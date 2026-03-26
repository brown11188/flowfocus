/**
 * POST /api/clickup/verify-token
 * Validates a Personal API Token and returns the list of workspaces
 * WITHOUT saving anything to the DB yet.
 * Body: { token: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ClickUpClient } from "@/lib/clickup";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { token?: string };
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const client = new ClickUpClient(token);
    const workspaces = await client.getWorkspaces();

    if (workspaces.length === 0) {
      return NextResponse.json(
        { error: "No workspaces found for this token" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color ?? null,
        avatar: w.avatar ?? null,
        memberCount: w.members?.length ?? 0,
      })),
    });
  } catch (err) {
    console.error("[ClickUp VerifyToken]", err);
    const msg = err instanceof Error ? err.message : "Invalid token";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

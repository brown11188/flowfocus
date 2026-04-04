import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { decisionLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const decisions = await db
    .select()
    .from(decisionLogs)
    .where(eq(decisionLogs.userId, session.user.id))
    .orderBy(desc(decisionLogs.createdAt))
    .limit(50);
  return NextResponse.json(
    decisions.map((d) => ({
      ...d,
      decidedAt: d.decidedAt ? d.decidedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.projectId) return NextResponse.json({ error: "title and projectId required" }, { status: 400 });
  const [decision] = await db
    .insert(decisionLogs)
    .values({
      userId: session.user.id,
      title: body.title,
      decision: body.decision || body.title,
      description: body.context || null,
      impact: body.impact || null,
      decidedBy: body.owner || null,
      projectId: body.projectId,
    })
    .returning();
  return NextResponse.json({
    ...decision,
    decidedAt: decision.decidedAt ? decision.decidedAt.toISOString() : null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  });
}

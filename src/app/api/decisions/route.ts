import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const decisions = await prisma.decisionLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(decisions.map(d => ({ ...d, decidedAt: d.decidedAt.toISOString(), createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.projectId) return NextResponse.json({ error: "title and projectId required" }, { status: 400 });
  const decision = await prisma.decisionLog.create({
    data: {
      userId: session.user.id,
      title: body.title,
      decision: body.decision || body.title,
      context: body.context || null,
      optionsConsidered: body.optionsConsidered || null,
      impact: body.impact || null,
      owner: body.owner || null,
      projectId: body.projectId,
    },
  });
  return NextResponse.json({ ...decision, decidedAt: decision.decidedAt.toISOString(), createdAt: decision.createdAt.toISOString(), updatedAt: decision.updatedAt.toISOString() });
}

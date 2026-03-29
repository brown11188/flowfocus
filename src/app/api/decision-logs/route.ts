import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    decidedAt: item.decidedAt instanceof Date ? item.decidedAt.toISOString() : item.decidedAt,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.decisionLog.findMany({ where: { userId: session.user.id }, orderBy: { decidedAt: "desc" } });
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.decisionLog.create({
    data: {
      title: String(body.title ?? "").trim(),
      context: body.context ?? null,
      optionsConsidered: body.optionsConsidered ?? null,
      decision: body.decision ?? "",
      impact: body.impact ?? null,
      owner: body.owner ?? null,
      projectId: body.projectId,
      userId: session.user.id,
      decidedAt: body.decidedAt ? new Date(body.decidedAt) : new Date(),
    },
  });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.scopeChange.findMany({ where: { userId: session.user.id }, orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.scopeChange.create({
    data: {
      title: String(body.title ?? "").trim(),
      description: body.description ?? null,
      projectId: body.projectId,
      userId: session.user.id,
      category: body.category ?? "change_request",
      impactLevel: body.impactLevel ?? "medium",
      approvalStatus: body.approvalStatus ?? "pending",
      timelineImpact: body.timelineImpact ?? null,
      effortHours: body.effortHours !== undefined ? Number(body.effortHours) : null,
      requestedBy: body.requestedBy ?? null,
    },
  });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

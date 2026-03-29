import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    periodStart: item.periodStart instanceof Date ? item.periodStart.toISOString() : (item.periodStart ?? null),
    periodEnd: item.periodEnd instanceof Date ? item.periodEnd.toISOString() : (item.periodEnd ?? null),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.statusReport.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.statusReport.create({
    data: {
      title: String(body.title ?? "").trim(),
      projectId: body.projectId ?? null,
      userId: session.user.id,
      audience: body.audience ?? "stakeholders",
      reportType: body.reportType ?? "weekly",
      content: body.content ?? "",
      summary: body.summary ?? null,
      generatedBy: body.generatedBy ?? "manual",
      periodStart: body.periodStart ? new Date(body.periodStart) : null,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
    },
  });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

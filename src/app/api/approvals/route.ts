import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    dueDate: item.dueDate instanceof Date ? item.dueDate.toISOString() : (item.dueDate ?? null),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.approvalItem.findMany({ where: { userId: session.user.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.approvalItem.create({
    data: {
      title: String(body.title ?? "").trim(),
      description: body.description ?? null,
      projectId: body.projectId,
      userId: session.user.id,
      approver: body.approver ?? null,
      status: body.status ?? "pending",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      taskId: body.taskId ?? null,
    },
  });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

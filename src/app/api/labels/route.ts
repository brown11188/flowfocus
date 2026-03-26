import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const labels = await prisma.label.findMany({ where: { userId: session.user.id }, orderBy: { name: "asc" } });
  return NextResponse.json(labels.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, color = "#6366f1" } = await req.json();
  const label = await prisma.label.create({ data: { name: name.trim(), color, userId: session.user.id } });
  return NextResponse.json({ ...label, createdAt: label.createdAt.toISOString() });
}

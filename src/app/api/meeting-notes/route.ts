import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    meetingDate: item.meetingDate instanceof Date ? item.meetingDate.toISOString() : item.meetingDate,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.meetingNote.findMany({ where: { userId: session.user.id }, orderBy: { meetingDate: "desc" } });
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const item = await prisma.meetingNote.create({
    data: {
      title: String(body.title ?? "").trim(),
      rawNotes: body.rawNotes ?? "",
      summary: body.summary ?? null,
      decisions: body.decisions ?? null,
      actionItems: body.actionItems ?? null,
      meetingDate: body.meetingDate ? new Date(body.meetingDate) : new Date(),
      projectId: body.projectId ?? null,
      userId: session.user.id,
      source: body.source ?? "manual",
    },
  });
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

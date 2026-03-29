import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = await prisma.capturedNote.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { text, type, metadata } = await req.json();
  if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });
  const note = await prisma.capturedNote.create({
    data: {
      userId: session.user.id,
      text,
      type: type || "note",
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
  return NextResponse.json(note);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { capturedNotes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = await db
    .select()
    .from(capturedNotes)
    .where(eq(capturedNotes.userId, session.user.id))
    .orderBy(desc(capturedNotes.createdAt))
    .limit(50);
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { text, type, metadata } = await req.json();
  if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });
  const [note] = await db
    .insert(capturedNotes)
    .values({
      userId: session.user.id,
      text,
      type: type || "note",
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning();
  return NextResponse.json(note);
}


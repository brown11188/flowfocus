import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(labels).where(eq(labels.userId, session.user.id)).orderBy(asc(labels.name));
  return NextResponse.json(rows.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, color = "#6366f1" } = await req.json();
  const [label] = await db.insert(labels).values({ name: name.trim(), color, userId: session.user.id }).returning();
  return NextResponse.json({ ...label, createdAt: label.createdAt.toISOString() });
}


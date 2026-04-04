import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scopeChanges } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

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
  const items = await db.select().from(scopeChanges).where(eq(scopeChanges.userId, session.user.id)).orderBy(asc(scopeChanges.status), desc(scopeChanges.createdAt));
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const [item] = await db.insert(scopeChanges).values({
    title: String(body.title ?? "").trim(),
    description: body.description ?? null,
    projectId: body.projectId,
    userId: session.user.id,
    status: body.approvalStatus ?? body.status ?? "pending",
    requestedBy: body.requestedBy ?? null,
    impact: body.impact ?? null,
  }).returning();
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

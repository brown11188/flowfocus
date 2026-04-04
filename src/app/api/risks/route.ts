import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { risks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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
  const items = await db
    .select()
    .from(risks)
    .where(eq(risks.userId, session.user.id))
    .orderBy(desc(risks.score), desc(risks.createdAt));
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const probability = Number(body.probability ?? 3);
  const impact = Number(body.impact ?? 3);
  const [item] = await db
    .insert(risks)
    .values({
      title: String(body.title ?? "").trim(),
      description: body.description ?? null,
      projectId: body.projectId,
      userId: session.user.id,
      probability,
      impact,
      score: probability * impact,
      status: body.status ?? "open",
      owner: body.owner ?? null,
      mitigationPlan: body.mitigationPlan ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      source: body.source ?? "manual",
    })
    .returning();
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}


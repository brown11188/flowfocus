import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { statusReports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

function serialize(item: Record<string, unknown>) {
  return {
    ...item,
    reportDate: item.reportDate instanceof Date ? item.reportDate.toISOString() : (item.reportDate ?? null),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await db.select().from(statusReports).where(eq(statusReports.userId, session.user.id)).orderBy(desc(statusReports.createdAt));
  return NextResponse.json(items.map((item) => serialize(item as unknown as Record<string, unknown>)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const [item] = await db.insert(statusReports).values({
    title: String(body.title ?? "").trim(),
    projectId: body.projectId ?? null,
    userId: session.user.id,
    content: body.content ?? "",
    status: body.status ?? "draft",
    reportDate: body.reportDate ? new Date(body.reportDate) : null,
  }).returning();
  return NextResponse.json(serialize(item as unknown as Record<string, unknown>));
}

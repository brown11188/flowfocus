import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { sendPasswordResetOtp } from "@/lib/email";

export const dynamic = "force-dynamic";

// Rate-limit map: email -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 60 * 60 * 1000 }); // 1h window
    return true;
  }
  if (entry.count >= 3) return false; // max 3 requests/hour
  entry.count++;
  return true;
}

// Generate a 6-digit numeric OTP
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const genericOk = NextResponse.json({
      message: "If an account with that email exists, an OTP has been sent.",
    });

    if (!checkRateLimit(email)) {
      return genericOk;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return genericOk;

    if (!user.password) return genericOk;

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate any previous unexpired tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

    // Create new token
    await db.insert(passwordResetTokens).values({ userId: user.id, email, otp, expiresAt });

    await sendPasswordResetOtp({ to: email, name: user.name, otp });

    return genericOk;
  } catch (err) {
    console.error("[forgot-password] Error:", err);
    return NextResponse.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
}


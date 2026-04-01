import { NextRequest, NextResponse } from "next/server";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function getPublicOrigin(req: NextRequest): string {
  const authUrl = process.env.AUTH_URL ? new URL(process.env.AUTH_URL) : null;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    authUrl?.protocol.replace(":", "") ||
    req.nextUrl.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    authUrl?.host ||
    req.nextUrl.host;

  return `${proto}://${host}`;
}

function buildShareText(values: Array<FormDataEntryValue | null>): string {
  const parts = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return Array.from(new Set(parts)).join("\n");
}

function redirectToToday(req: NextRequest, shareText?: string): NextResponse {
  const url = new URL(`${getPublicOrigin(req)}${BASE_PATH}/today`);
  if (shareText) {
    url.searchParams.set("share", shareText);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: NextRequest) {
  return redirectToToday(req);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const shareText = buildShareText([
    formData.get("title"),
    formData.get("text"),
    formData.get("url"),
  ]);

  return redirectToToday(req, shareText || undefined);
}

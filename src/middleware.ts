import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Build an absolute redirect URL that works correctly behind a reverse proxy
 * with a Next.js basePath.
 *
 * We use x-forwarded-host / x-forwarded-proto headers (set by the reverse
 * proxy) to reconstruct the correct external URL, then append basePath + path
 * so the browser lands on the right absolute URL without any duplication.
 */
function redirectTo(req: NextRequest, path: string): NextResponse {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0] ??
    req.nextUrl.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  const url = new URL(`${proto}://${host}${basePath}${path}`);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  // This app runs behind an HTTPS reverse proxy. Next.js middleware sees
  // requests as HTTP (from the proxy), but x-forwarded-proto: https tells us
  // the original request was HTTPS.
  //
  // NextAuth v5 determines cookie names based on `useSecureCookies`:
  //   - HTTPS → "__Secure-authjs.session-token"
  //   - HTTP  → "authjs.session-token"
  //
  // Since AUTH_URL is set to an https:// URL, NextAuth sets useSecureCookies=true
  // and writes "__Secure-authjs.session-token" cookies.
  // We must use secureCookie:true here so getToken() looks for the right cookie
  // AND uses the right HKDF salt for decryption.
  const isHttps =
    (req.headers.get("x-forwarded-proto") ?? "").split(",")[0] === "https" ||
    process.env.AUTH_URL?.startsWith("https://") === true;

  // The salt used for JWT encryption MUST match the cookie name used when
  // the JWT was encrypted. Pass secureCookie so getToken derives both.
  let token = await getToken({
    req,
    secret,
    secureCookie: isHttps,
    cookieName: isHttps
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
    salt: isHttps
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  }).catch(() => null);

  const isLoggedIn = !!token;
  const pathname = req.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthPage && isLoggedIn) {
    return redirectTo(req, "/dashboard");
  }
  if (!isAuthPage && !isLoggedIn) {
    return redirectTo(req, "/login");
  }
  return NextResponse.next();
}

export const config = {
  // Protect all routes except Next.js internals and static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

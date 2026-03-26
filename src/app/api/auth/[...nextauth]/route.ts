import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * NextAuth v5 + Next.js basePath + nginx reverse-proxy fix.
 *
 * How @auth/core parses actions (web.js parseActionAndProviderId):
 *   regex: ^${config.basePath}(.+)
 *   split captured suffix by "/" — must produce 1 or 2 non-empty segments.
 *
 * Our config.basePath = "/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth"
 * So the full request URL passed to handlers must look like:
 *   https://buildwith.agentcrew.dev/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth/session
 *
 * The Problem:
 * 1. nginx proxies: https://host/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth/session
 * 2. Next.js STRIPS basePath from req.nextUrl.pathname before this handler runs:
 *    pathname = /api/auth/session   (no /apps/xklwb3f46m48u5s4h2h5d4pd prefix)
 * 3. req.nextUrl reflects the internal Docker network (http://container:3000)
 *    not the public HTTPS host.
 *
 * The Fix (rewriteRequest):
 * - Restore the correct origin using x-forwarded-proto + x-forwarded-host.
 * - Re-prepend NEXT_PUBLIC_BASE_PATH (the Next.js basePath that was stripped)
 *   so NextAuth sees the full canonical URL.
 *
 * Result:
 *   config.basePath regex matches /apps/.../api/auth/session
 *   → captured suffix = /session  → action = "session" ✓
 */

const APP_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ─── Step-by-step OAuth flow logger ─────────────────────────────────────────
function logStep(step: string, data: Record<string, unknown>) {
  console.log(`[AUTH:STEP] ${step}`, JSON.stringify(data, null, 2));
}

function rewriteRequest(req: NextRequest): NextRequest {
  const { headers, nextUrl: { pathname, search } } = req;

  // ── Log every incoming auth request ────────────────────────────────────────
  const isCallback = pathname.includes("/callback/");
  const isSignin   = pathname.includes("/signin");
  const isCsrf     = pathname.includes("/csrf");
  const isSession  = pathname.includes("/session");

  logStep("INCOMING_REQUEST", {
    method: req.method,
    pathname,
    search,
    isCallback,
    isSignin,
    isCsrf,
    isSession,
    headers: {
      host: headers.get("host"),
      "x-forwarded-host":  headers.get("x-forwarded-host"),
      "x-forwarded-proto": headers.get("x-forwarded-proto"),
      "x-forwarded-for":   headers.get("x-forwarded-for"),
      "content-type":      headers.get("content-type"),
      origin:              headers.get("origin"),
      referer:             headers.get("referer"),
    },
    env: {
      APP_BASE,
      AUTH_URL:    process.env.AUTH_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NODE_ENV:    process.env.NODE_ENV,
    },
  });

  // If this is the callback from Microsoft, log the query params (code, state, error)
  if (isCallback) {
    const urlObj = new URL(req.url, "http://localhost");
    logStep("OAUTH_CALLBACK_PARAMS", {
      code:          urlObj.searchParams.get("code") ? "[PRESENT - length " + urlObj.searchParams.get("code")!.length + "]" : "[MISSING]",
      state:         urlObj.searchParams.get("state") ? "[PRESENT]" : "[MISSING]",
      session_state: urlObj.searchParams.get("session_state") ?? null,
      error:         urlObj.searchParams.get("error") ?? null,
      error_description: urlObj.searchParams.get("error_description") ?? null,
      provider:      pathname.split("/callback/")[1]?.split("?")[0] ?? "unknown",
    });
  }

  // Use x-forwarded headers set by nginx to get the real external host/proto.
  // NOTE: The nginx deploy script sets `proxy_set_header Host $host` but does NOT
  // set X-Forwarded-Host. We therefore fall back to the `Host` header (which nginx
  // always passes and which equals the public hostname) rather than req.nextUrl.host
  // (which would be the internal container address e.g. "container:3000").
  const detectedHost =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    req.nextUrl.host;
  const rawProto = headers.get("x-forwarded-proto") ?? req.nextUrl.protocol;
  const protocol = rawProto.split(",")[0].trim();
  const _protocol = protocol.endsWith(":") ? protocol : `${protocol}:`;

  // pathname at this point is /api/auth/<action> because Next.js strips
  // the basePath (/apps/xklwb3f46m48u5s4h2h5d4pd) before routing.
  // We must restore it so @auth/core can match config.basePath correctly.
  //
  // Guard against double-prepend: only prepend APP_BASE if pathname does NOT
  // already start with APP_BASE (can happen in some Next.js versions/configs).
  const fullPath = pathname.startsWith(APP_BASE)
    ? pathname
    : `${APP_BASE}${pathname}`;

  const rewrittenUrl = new URL(`${_protocol}//${detectedHost}${fullPath}${search}`);

  logStep("REWRITTEN_URL", {
    original: req.url,
    rewritten: rewrittenUrl.toString(),
    detectedHost,
    protocol: _protocol,
    fullPath,
    search,
    APP_BASE,
  });

  return new NextRequest(rewrittenUrl, req);
}

/**
 * Intercepts the Microsoft OAuth callback when it belongs to the
 * "connect integration" flow (not a sign-in flow).
 *
 * Detection: presence of the `ms_connect_userid` cookie which is set
 * by /api/microsoft/connect before redirecting to Microsoft.
 *
 * When detected, the token exchange + DB save is handled entirely here,
 * keeping the existing NextAuth session intact (no new JWT is issued).
 * The registered Azure redirect URI stays as:
 *   .../api/auth/callback/microsoft-entra-id
 * — so NO Azure Portal changes are needed.
 */
async function handleMicrosoftConnectCallback(
  req: NextRequest,
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  const isMsCallback =
    pathname.endsWith("/callback/microsoft-entra-id") ||
    pathname.includes("/callback/microsoft-entra-id");
  if (!isMsCallback) return null;

  const userId = req.cookies.get("ms_connect_userid")?.value;
  if (!userId) return null; // Normal sign-in flow — let NextAuth handle it

  logStep("MS_CONNECT_INTERCEPT", { userId, pathname });

  const { searchParams } = req.nextUrl;
  const code      = searchParams.get("code");
  const state     = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDesc  = searchParams.get("error_description");

  // nginx terminates SSL externally — x-forwarded-proto is always "http" inside the container.
  // Use AUTH_URL as the source of truth for proto/host instead.
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const proto = authUrl.startsWith("https") ? "https" : "http";
  const host  = req.headers.get("x-forwarded-host")?.split(",")[0].trim()
    ?? req.headers.get("host")
    ?? (authUrl ? new URL(authUrl).host : "localhost");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const redirectBase = `${basePath}/microsoft`;

  function redirectError(err: string): NextResponse {
    const r = NextResponse.redirect(
      new URL(`${proto}://${host}${redirectBase}?microsoft_error=${encodeURIComponent(err)}`, req.url)
    );
    clearConnectCookies(r);
    return r;
  }

  if (errorParam) {
    console.error("[MS_CONNECT] Microsoft returned error", { errorParam, errorDesc });
    return redirectError(errorParam);
  }

  // Validate state
  const savedState = req.cookies.get("ms_connect_state")?.value;
  const verifier   = req.cookies.get("ms_connect_verifier")?.value;

  if (!code || !state || !savedState || state !== savedState || !verifier) {
    console.error("[MS_CONNECT] State mismatch or missing cookies", {
      hasCode: !!code, stateMatch: state === savedState, hasVerifier: !!verifier,
    });
    return redirectError("invalid_state");
  }

  // Build redirect_uri — MUST match what /connect sent and what Azure has registered.
  // Uses the same proto/host resolution (AUTH_URL-based) as /api/microsoft/connect.
  const redirectUri = `${proto}://${host}${basePath}/api/auth/callback/microsoft-entra-id`;

  // Exchange code for tokens
  let tokenData: Record<string, unknown>;
  try {
    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     process.env.MICROSOFT_CLIENT_ID ?? "",
          client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
          code,
          redirect_uri:  redirectUri,
          grant_type:    "authorization_code",
          code_verifier: verifier,
        }),
      }
    );
    tokenData = await tokenRes.json() as Record<string, unknown>;
    if (tokenData.error) {
      console.error("[MS_CONNECT] Token exchange failed", tokenData);
      return redirectError(String(tokenData.error));
    }
    logStep("MS_CONNECT_TOKEN_SUCCESS", {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      scope: tokenData.scope,
    });
  } catch (e) {
    console.error("[MS_CONNECT] Token exchange threw", e);
    return redirectError("token_exchange_failed");
  }

  // Fetch Graph profile
  let graphProfile: Record<string, unknown> = {};
  try {
    const graphRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    if (graphRes.ok) {
      graphProfile = await graphRes.json() as Record<string, unknown>;
      logStep("MS_CONNECT_GRAPH_SUCCESS", {
        hasId: !!graphProfile.id,
        hasMail: !!graphProfile.mail,
        email: graphProfile.mail ?? graphProfile.userPrincipalName,
      });
    } else {
      console.error("[MS_CONNECT] Graph API failed", { status: graphRes.status });
    }
  } catch (e) {
    console.error("[MS_CONNECT] Graph API threw", e);
  }

  // Save MicrosoftConnection for the ORIGINAL logged-in user
  const { prisma } = await import("@/lib/prisma");
  try {
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
      : null;
    await prisma.microsoftConnection.upsert({
      where: { userId },
      create: {
        userId,
        microsoftId:  (graphProfile.id  ?? "") as string,
        email:        (graphProfile.mail ?? graphProfile.userPrincipalName ?? null) as string | null,
        displayName:  (graphProfile.displayName ?? null) as string | null,
        accessToken:  tokenData.access_token as string,
        refreshToken: (tokenData.refresh_token as string | null) ?? null,
        expiresAt,
        scopes:       (tokenData.scope as string | null) ?? null,
        accountType:  "work",
      },
      update: {
        microsoftId:  (graphProfile.id  ?? "") as string,
        email:        (graphProfile.mail ?? graphProfile.userPrincipalName ?? null) as string | null,
        displayName:  (graphProfile.displayName ?? null) as string | null,
        accessToken:  tokenData.access_token as string,
        refreshToken: (tokenData.refresh_token as string | null) ?? null,
        expiresAt,
        scopes:       (tokenData.scope as string | null) ?? null,
      },
    });
    logStep("MS_CONNECT_SAVED", { userId, email: graphProfile.mail ?? graphProfile.userPrincipalName });
  } catch (e) {
    console.error("[MS_CONNECT] DB upsert failed", e);
    return redirectError("db_save_failed");
  }

  // Success — redirect back, session completely unchanged
  const resp = NextResponse.redirect(
    new URL(`${proto}://${host}${redirectBase}?microsoft_connected=true`, req.url)
  );
  clearConnectCookies(resp);
  return resp;
}

function clearConnectCookies(resp: NextResponse) {
  resp.cookies.set("ms_connect_verifier", "", { maxAge: 0, path: "/" });
  resp.cookies.set("ms_connect_state",    "", { maxAge: 0, path: "/" });
  resp.cookies.set("ms_connect_userid",   "", { maxAge: 0, path: "/" });
}

export async function GET(req: NextRequest) {
  logStep("HANDLER_GET_START", { pathname: req.nextUrl.pathname });
  try {
    // ── Connect-flow intercept: if ms_connect_userid cookie is present on the
    // Microsoft callback URL, handle the token exchange ourselves and keep the
    // existing NextAuth session intact. Falls through to NextAuth otherwise.
    const connectResponse = await handleMicrosoftConnectCallback(req);
    if (connectResponse) return connectResponse;

    const rewritten = rewriteRequest(req);
    const response = await handlers.GET(rewritten);
    logStep("HANDLER_GET_RESPONSE", {
      status: response.status,
      location: response.headers.get("location"),
      setCookie: response.headers.get("set-cookie") ? "[PRESENT]" : "[ABSENT]",
    });
    return response;
  } catch (err) {
    console.error("[AUTH:ERROR] GET handler threw:", err);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  logStep("HANDLER_POST_START", { pathname: req.nextUrl.pathname });
  try {
    const rewritten = rewriteRequest(req);
    const response = await handlers.POST(rewritten);
    logStep("HANDLER_POST_RESPONSE", {
      status: response.status,
      location: response.headers.get("location"),
      setCookie: response.headers.get("set-cookie") ? "[PRESENT]" : "[ABSENT]",
    });
    return response;
  } catch (err) {
    console.error("[AUTH:ERROR] POST handler threw:", err);
    throw err;
  }
}

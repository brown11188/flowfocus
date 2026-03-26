import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// The Next.js app is deployed at:
//   https://buildwith.agentcrew.dev/apps/xklwb3f46m48u5s4h2h5d4pd/
//
// NextAuth v5 (@auth/core) action parsing (web.js parseActionAndProviderId):
//   1. Takes the request URL pathname.
//   2. Matches it against regex: ^${config.basePath}(.+)
//   3. Splits the captured suffix by "/" — expects exactly 1 or 2 segments.
//
// If config.basePath = "/apps/xklwb3f46m48u5s4h2h5d4pd" (derived from AUTH_URL),
// the pathname /apps/xklwb3f46m48u5s4h2h5d4pd/api/auth/session captures
// "/api/auth/session" → splits to ["api","auth","session"] (3 parts) → UnknownAction.
//
// The fix: set config.basePath = "/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth"
// so that the pathname /apps/.../api/auth/session captures just "/session"
// → splits to ["session"] (1 part) → action = "session" ✓
//
// The route handler re-prepends basePath to the stripped pathname that
// Next.js passes so NextAuth sees the full URL including the subpath.
const APP_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const AUTH_BASE_PATH = `${APP_BASE}/api/auth`;

// ─── Auth config debug logger ────────────────────────────────────────────────────
function authLog(step: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH:CONFIG] ${step}`, JSON.stringify(data, null, 2));
  }
}

const config: NextAuthConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV !== "production",
  // basePath MUST equal the full path prefix before the action segment.
  // @auth/core strips this prefix then splits the remainder to get the action.
  // Next.js basePath is /apps/xklwb3f46m48u5s4h2h5d4pd, auth routes live at
  // /apps/xklwb3f46m48u5s4h2h5d4pd/api/auth/<action> — so basePath here
  // must be /apps/xklwb3f46m48u5s4h2h5d4pd/api/auth.
  basePath: AUTH_BASE_PATH,
  trustHost: true,
  pages: {
    // IMPORTANT: These paths are relative to Next.js basePath — do NOT prepend
    // APP_BASE here. Next.js automatically prepends basePath when redirecting
    // to these pages. Prepending APP_BASE would double the prefix and cause a
    // 404 (e.g. /apps/id/apps/id/login).
    signIn: "/login",
    error: "/login",
  },
  events: {
    // ── Lifecycle event: signIn attempt (before token exchange result)
    async signIn({ user, account, profile, isNewUser }) {
      authLog("EVENT_SIGN_IN", {
        provider: account?.provider ?? "unknown",
        isNewUser,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        accountType: account?.type ?? null,
        providerAccountId: account?.providerAccountId ?? null,
        hasAccessToken: !!account?.access_token,
        hasRefreshToken: !!account?.refresh_token,
        hasIdToken: !!account?.id_token,
        profileSub: (profile as Record<string, unknown>)?.sub ?? null,
      });
    },
    async session({ session, token }) {
      authLog("EVENT_SESSION", {
        userId: (token as Record<string, unknown>)?.id ?? null,
        sessionUserEmail: session?.user?.email ?? null,
      });
    },
    // ── Auth.js v5 events run AFTER the database transaction is fully committed.
    // This is safer than the signIn callback for creating dependent records
    // (projects, microsoftConnection) because user.id is guaranteed to be
    // the real DB row id at this point.
    async createUser({ user }) {
      // New user registered via any provider — create their Inbox project
      if (user.id) {
        try {
          await prisma.project.create({
            data: { name: "Inbox", color: "#6366f1", userId: user.id, isInbox: true },
          });
        } catch (e) {
          console.error("[auth] Error creating inbox for new user:", e);
        }
      }
    },
    // ── Lifecycle event: linkAccount — merged logging + inbox logic
    async linkAccount({ user, account }) {
      authLog("EVENT_LINK_ACCOUNT", {
        provider: account?.provider,
        userId: user?.id,
        providerAccountId: account?.providerAccountId,
      });
      // Existing user linked a new OAuth account — ensure Inbox exists
      if (user.id) {
        try {
          const inbox = await prisma.project.findFirst({
            where: { userId: user.id, isInbox: true },
          });
          if (!inbox) {
            await prisma.project.create({
              data: { name: "Inbox", color: "#6366f1", userId: user.id, isInbox: true },
            });
          }
        } catch (e) {
          console.error("[auth] Error ensuring inbox on linkAccount:", e);
        }
      }
    },
  },
  // ── Override logger to surface NextAuth internals ─────────────────────────
  logger: {
    error(code, ...message) {
      console.error("[AUTH:INTERNAL_ERROR]", code, ...message);
    },
    warn(code, ...message) {
      console.warn("[AUTH:INTERNAL_WARN]", code, ...message);
    },
    debug(code, ...message) {
      // Filter noisy cookie/csrf debug lines; keep token-exchange related ones
      const codeStr = String(code);
      const relevant = [
        "token", "callback", "provider", "signin", "error",
        "microsoft", "entra", "oauth", "issuer", "redirect",
        "fetch", "exchange", "pkce", "state",
      ];
      if (relevant.some(k => codeStr.toLowerCase().includes(k))) {
        console.log("[AUTH:INTERNAL_DEBUG]", code, ...message);
      }
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    // ─── Microsoft Entra ID ────────────────────────────────────────────────────
    // Using the built-in MicrosoftEntraID provider with a specific tenant issuer
    // so that the [conformInternal] OIDC discovery flow works correctly.
    //
    // KEY INSIGHT: The built-in provider's [conformInternal] + [customFetch] work
    // together to handle the "{tenantid}" placeholder in the issuer returned by
    // Microsoft's OIDC discovery endpoint. The customFetch replaces {tenantid}
    // with the actual tenant ID from the discovered issuer, so OIDC validation
    // works for both personal accounts (tenant: 9188040d-...) and org accounts.
    //
    // We use issuer: common so all Microsoft account types are accepted.
    // The profile() override fetches user info via Graph API for the full profile
    // including mail/userPrincipalName (personal accounts don't have email in
    // the standard OIDC id_token claims).
    //
    // Azure App: tenant b16e6c57-2a05-4527-9210-ddb885add7d4
    //            app    d39e20a7-907b-4d6c-bcb2-0c9bbeaeec45
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      // ── Instrument the token fetch so we can see exactly what Microsoft returns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token: {
        async conform(response: Response) {
          // Clone before reading so the original body is still consumable
          const clone = response.clone();
          try {
            const body = await clone.json() as Record<string, unknown>;
            if (body.error) {
              // Microsoft returned an error in the token response
              authLog("MS_TOKEN_ERROR", {
                error: body.error,
                error_description: body.error_description,
                error_codes: body.error_codes,
                trace_id: body.trace_id,
                correlation_id: body.correlation_id,
                timestamp: body.timestamp,
              });
            } else {
              authLog("MS_TOKEN_SUCCESS", {
                token_type: body.token_type,
                scope: body.scope,
                expires_in: body.expires_in,
                hasAccessToken: !!body.access_token,
                hasRefreshToken: !!body.refresh_token,
                hasIdToken: !!body.id_token,
              });
            }
          } catch {
            authLog("MS_TOKEN_PARSE_ERROR", { status: response.status });
          }
          return response;
        },
      } as unknown as Record<string, unknown>,
      // "common" accepts personal + org accounts.
      // The built-in [customFetch] replaces {tenantid} in discovery responses
      // so the issuer validation works correctly for any tenant.
      issuer: "https://login.microsoftonline.com/common/v2.0",
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read Mail.Read Calendars.ReadWrite",
          prompt: "select_account",
        },
      },
      // Override profile() to fetch email from Graph API since personal
      // Microsoft accounts may not include email in the OIDC id_token.
      async profile(profile, tokens) {
        // Fetch full profile from Graph API using the access token
        let email = profile.email;
        let displayName = profile.name;
        let microsoftGraphId = profile.sub;

        authLog("MS_PROFILE_START", {
          idTokenSub: profile.sub,
          idTokenEmail: profile.email,
          idTokenName: profile.name,
          hasAccessToken: !!tokens.access_token,
        });

        try {
          const graphRes = await fetch(
            "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName",
            { headers: { Authorization: `Bearer ${tokens.access_token}` } }
          );
          authLog("MS_GRAPH_RESPONSE", {
            status: graphRes.status,
            ok: graphRes.ok,
          });
          if (graphRes.ok) {
            const graphProfile = await graphRes.json() as Record<string, unknown>;
            authLog("MS_GRAPH_PROFILE", {
              hasId: !!graphProfile.id,
              hasMail: !!graphProfile.mail,
              hasUPN: !!graphProfile.userPrincipalName,
              hasDisplayName: !!graphProfile.displayName,
            });
            email = (graphProfile.mail ?? graphProfile.userPrincipalName ?? email) as string;
            displayName = (graphProfile.displayName ?? displayName) as string;
            microsoftGraphId = (graphProfile.id ?? microsoftGraphId) as string;
          } else {
            const errBody = await graphRes.json().catch(() => ({})) as Record<string, unknown>;
            authLog("MS_GRAPH_ERROR", {
              status: graphRes.status,
              error: errBody,
            });
          }
        } catch (e) {
          console.error("[auth] Graph API profile fetch failed:", e);
          authLog("MS_GRAPH_EXCEPTION", { error: String(e) });
        }

        return {
          id: microsoftGraphId ?? profile.sub,
          name: displayName ?? "Microsoft User",
          email: email ?? "",
          image: null,
        };
      },
      // Allow linking even when the email already exists from another provider.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      authLog("JWT_CALLBACK", {
        isFirstSignIn: !!user,
        provider: account?.provider ?? null,
        hasUser: !!user,
        hasAccount: !!account,
        hasProfile: !!profile,
        tokenId: (token as Record<string, unknown>)?.id ?? null,
      });
      if (user) token.id = user.id;
      // Persist MS Graph ID in token so we can save the connection in the session callback.
      // With the built-in MicrosoftEntraID provider + our profile() override:
      //   - profile.sub   = Microsoft Graph user ID (from OIDC id_token)
      //   - profile.email = resolved from Graph /me (mail or userPrincipalName)
      //   - profile.name  = displayName from Graph /me
      //   - account.providerAccountId = our returned profile.id (the Graph ID)
      if (account?.provider === "microsoft-entra-id" && account.access_token) {
        token.msAccessToken   = account.access_token;
        token.msRefreshToken  = account.refresh_token;
        token.msExpiresAt     = account.expires_at;
        token.msScope         = account.scope;
        token.msProviderAccountId = account.providerAccountId;
        // profile is available on first sign-in — use the values our profile()
        // override returned which already fetched from Graph API
        token.msEmail         = user?.email ?? (profile as any)?.email ?? null;
        token.msDisplayName   = user?.name  ?? (profile as any)?.name  ?? null;
        // providerAccountId is set to our profile.id (the Graph user ID)
        token.msGraphId       = account.providerAccountId;

        // ── Save MicrosoftConnection immediately in the JWT callback.
        // The session callback fires on EVERY session read and mutating
        // token.msShouldSaveConnection there does NOT persist the flag
        // (the JWT is already encrypted by then). Do the DB write here
        // once, on the first sign-in, where we have all the token data.
        if (token.id) {
          try {
            const userId = token.id as string;
            const expiresAt = account.expires_at
              ? new Date((account.expires_at as number) * 1000)
              : null;
            await prisma.microsoftConnection.upsert({
              where: { userId },
              create: {
                userId,
                microsoftId: account.providerAccountId,
                email: user?.email ?? null,
                displayName: user?.name ?? null,
                accessToken: account.access_token,
                refreshToken: (account.refresh_token as string | null) ?? null,
                expiresAt,
                scopes: (account.scope as string | null) ?? null,
                accountType: "personal",
              },
              update: {
                microsoftId: account.providerAccountId,
                email: user?.email ?? null,
                displayName: user?.name ?? null,
                accessToken: account.access_token,
                refreshToken: (account.refresh_token as string | null) ?? undefined,
                expiresAt,
                scopes: (account.scope as string | null) ?? null,
              },
            });
            authLog("MS_CONNECTION_SAVED", { userId, provider: "microsoft-entra-id" });
          } catch (e) {
            console.error("[auth] Error saving MicrosoftConnection in JWT callback:", e);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      authLog("SESSION_CALLBACK", {
        hasUser: !!session?.user,
        tokenId: (token as Record<string, unknown>)?.id ?? null,
        msShouldSaveConnection: !!(token as Record<string, unknown>)?.msShouldSaveConnection,
      });
      if (token && session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
    async signIn({ user, account }) {
      authLog("SIGNIN_CALLBACK", {
        provider: account?.provider ?? "unknown",
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
      });
      // Inbox creation and MS connection saving are handled in events.createUser,
      // events.linkAccount, and the session callback respectively.
      // Keep this callback minimal — just approve all sign-ins.
      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

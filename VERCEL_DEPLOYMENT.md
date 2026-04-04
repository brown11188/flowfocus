# FlowFocus on Vercel

## Summary
FlowFocus is now prepared to run against **PostgreSQL** in production. The Prisma runtime no longer depends on SQLite or `better-sqlite3`, while the app remains compatible with the existing basePath/auth deployment model.

For Vercel, you should do two things:

1. Configure Vercel environment variables correctly.
2. Provision a managed Postgres database and run Prisma migrations there.

---

## 1) Recommended Vercel Environment Variables

If deploying on a normal Vercel domain like:

- `https://flowfocus.vercel.app`

then configure these variables in Vercel Project Settings.

### Required

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | `""` | Keep empty on Vercel root deployment |
| `NEXTAUTH_URL` | `https://flowfocus.vercel.app` | No trailing slash preferred |
| `AUTH_URL` | `https://flowfocus.vercel.app/api/auth` | Important for Auth.js callback handling |
| `AUTH_SECRET` | `<random-secret>` | Generate a long random value |
| `DATABASE_URL` | `postgresql://...` | Prefer Postgres on Vercel |
| `NODE_ENV` | `production` | Standard production mode |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional |

### Optional integrations

| Variable |
|---|
| `DEEPINFRA_API_KEY` |
| `DEEPINFRA_MODEL` |
| `GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` |
| `MICROSOFT_CLIENT_ID` |
| `MICROSOFT_CLIENT_SECRET` |
| `CLICKUP_CLIENT_ID` |
| `CLICKUP_CLIENT_SECRET` |
| `CLICKUP_RELAY_URI` |
| `SMTP_HOST` |
| `SMTP_PORT` |
| `SMTP_USER` |
| `SMTP_PASS` |
| `SMTP_FROM_NAME` |
| `SMTP_FROM_EMAIL` |
| `CRON_SECRET` |

---

## 2) Values You Should NOT Reuse From AgentCrew Deployment

Do **not** copy these values into Vercel unchanged:

- `NEXT_PUBLIC_BASE_PATH=/apps/xklwb3f46m48u5s4h2h5d4pd`
- `AUTH_URL=https://buildwith.agentcrew.dev/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth`
- `NEXTAUTH_URL=https://buildwith.agentcrew.dev/apps/xklwb3f46m48u5s4h2h5d4pd`

Those are for the reverse-proxy subpath deployment, not a standard Vercel root app.

---

## 3) PostgreSQL on Vercel

Current app state:

- Prisma datasource provider = `postgresql`
- runtime uses the standard Prisma client
- `DATABASE_URL` should point to a managed Postgres instance

This is the recommended fit for Vercel production because:

- data is durable
- concurrent access is supported properly
- Prisma works well in stateless/serverless environments with hosted Postgres
- auth/session persistence is reliable

---

## 4) Recommended Production Database Setup

Good Postgres options:

- Neon
- Supabase Postgres
- Vercel Postgres
- Railway Postgres

### Minimal rollout plan

1. Provision hosted Postgres
2. Set `DATABASE_URL` in Vercel
3. Run Prisma migrations against Postgres
4. Import existing SQLite data if needed
5. Update any local/dev env vars to Postgres URLs

---

## 5) Exact Vercel Setup Checklist

### Build & Development Settings

- Framework Preset: `Next.js`
- Build Command: leave default or use `npm run build`
- Install Command: default is fine
- Output Directory: default
- Node version: `20.x`

### Environment Variables for root-domain Vercel deploy

```bash
NEXT_PUBLIC_BASE_PATH=
NEXTAUTH_URL=https://your-app.vercel.app
AUTH_URL=https://your-app.vercel.app/api/auth
AUTH_SECRET=replace-with-random-secret
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### Database

Preferred:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
```

Use a managed PostgreSQL database for Vercel production. SQLite file URLs are no longer part of the recommended deployment path.

---

## 6) OAuth Redirect URIs To Update

If you deploy to a new Vercel domain, update provider callback URLs.

### Google

Add:

```text
https://your-app.vercel.app/api/auth/callback/google
```

### Microsoft

Add:

```text
https://your-app.vercel.app/api/auth/callback/microsoft-entra-id
```

### ClickUp relay

Use:

```text
https://your-app.vercel.app/clickup-relay.html
```

And set if needed:

```bash
CLICKUP_RELAY_URI=https://your-app.vercel.app/clickup-relay.html
```

---

## 7) Current Codebase Notes

The codebase is already mostly basePath-aware via `NEXT_PUBLIC_BASE_PATH`, so it can work in both modes:

- subpath deployment: `/apps/<id>`
- Vercel root deployment: `""`

For Vercel, root deployment is strongly recommended.

---

## 8) Recommended Next Step

### Short term
Use Vercel with:

- `NEXT_PUBLIC_BASE_PATH=""`
- correct `AUTH_URL`
- correct `NEXTAUTH_URL`
- updated OAuth callback URLs

### Real production-safe path
Use managed PostgreSQL with Prisma migrations and import legacy SQLite data once.

If you want, the next implementation step should be:

1. **move legacy SQLite data into PostgreSQL**, then
2. **generate a fresh PostgreSQL baseline migration history**.

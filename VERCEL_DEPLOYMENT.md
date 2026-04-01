# FlowFocus on Vercel

## Summary
FlowFocus currently builds on Vercel after the Prisma client generation fix, but **production runtime on Vercel is still high risk** because the app uses:

- Prisma + SQLite
- `better-sqlite3`
- file-based persistence (`DATABASE_URL=file:...`)
- middleware/auth/basePath logic originally designed for subpath reverse-proxy deployment

For Vercel, you should do two things:

1. Configure Vercel environment variables correctly.
2. Prefer migrating away from SQLite to a managed Postgres database for production.

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

## 3) SQLite on Vercel: Why It Is Risky

Current app state:

- Prisma datasource provider = `sqlite`
- runtime uses `@prisma/adapter-better-sqlite3`
- database path uses `file:` URLs

This is not a good fit for Vercel production because:

- serverless functions are ephemeral
- filesystem writes are not durable in the way SQLite expects
- multiple invocations can create locking and consistency issues
- `better-sqlite3` is optimized for persistent server/container workloads, not Vercel-style stateless runtime

### Practical impact
You may see one or more of these after build succeeds:

- auth/session persistence issues
- missing data after redeploys
- write failures
- database lock errors
- inconsistent behavior between requests

---

## 4) Recommended Production Database Migration Path

### Best option
Migrate production from SQLite to **Postgres**.

Good options:

- Neon
- Supabase Postgres
- Vercel Postgres
- Railway Postgres

### Minimal migration plan

1. Change Prisma datasource from `sqlite` to `postgresql`
2. Replace `@prisma/adapter-better-sqlite3` runtime usage with normal Prisma Postgres client usage
3. Provision hosted Postgres
4. Set `DATABASE_URL` in Vercel
5. Run Prisma migrations against Postgres
6. Import existing SQLite data if needed

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

Not recommended for Vercel production:

```bash
DATABASE_URL=file:./data/app.db
```

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
Migrate DB from SQLite to Postgres.

If you want, the next implementation step should be:

1. **convert Prisma schema/runtime from SQLite to Postgres**, then
2. **prepare a data migration path from the current SQLite DB**.

# FlowFocus

> **Stop managing tasks. Start finishing what matters.**

FlowFocus is a self-hosted, AI-powered task and project management application. It combines intelligent prioritization, multi-platform integrations, and focus-session tooling to help individuals and teams get work done.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Integrations](#integrations)
- [Contributing](#contributing)

---

## Features

- **AI Task Prioritization** — Automatically ranks and re-orders tasks using a large language model (DeepInfra / GLM-5 by default).
- **Natural Language Input** — Create tasks by typing plain text; the AI parses dates, priorities, and labels automatically.
- **Friday AI Assistant** — Daily briefings, smart recommendations, and a conversational planning interface.
- **Project & Sprint Management** — Kanban boards, milestone tracking, sprint planning, decision logs, and scope-change tracking.
- **Time Tracking** — Focus sessions (Pomodoro-style), time logs, time blocking, and smart deadline suggestions.
- **Email Intelligence** — AI-powered daily Outlook inbox scan with missed reply, needs reply, follow-up, and read-again classification.
- **ClickUp Hub** — Read-only task browser for ClickUp workspaces with AI-powered workspace reports.
- **Microsoft 365 Integration** — Read Outlook calendar events, import emails, and send Teams notifications.
- **Google Sign-In** — OAuth login via Google.
- **PWA / Offline Support** — Installable as a Progressive Web App with offline task access.
- **Self-Hosted** — Runs entirely on your own infrastructure; no data leaves your server.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, standalone output) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) |
| Icons | [Lucide React](https://lucide.dev/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Auth | [NextAuth v5](https://authjs.dev/) (Credentials, Google, Microsoft Entra ID) |
| Database | [Neon PostgreSQL](https://neon.tech/) via [Drizzle ORM](https://orm.drizzle.team/) |
| AI / LLM | [DeepInfra](https://deepinfra.com/) (default model: `meta-llama/Llama-3.3-70B-Instruct-Turbo`) |
| Email | [Nodemailer](https://nodemailer.com/) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| Language | TypeScript 5 |
| Runtime | Node.js 20 |
| Container | Docker (multi-stage, Alpine Linux) |

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- (Optional) **Docker** for containerised deployment

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/brown11188/flowfocus.git
   cd flowfocus
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and fill in at minimum:

   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_URL="http://localhost:3000"
   AUTH_URL="http://localhost:3000"
   AUTH_SECRET="<output of: openssl rand -base64 32>"
   NEXTAUTH_SECRET="<same value as AUTH_SECRET>"
   DEEPINFRA_API_KEY="<your DeepInfra API key>"
   ```

   See [Environment Variables](#environment-variables) for all options.

4. **Initialise the database**

   ```bash
   npm run db:push        # Apply schema to SQLite (dev only)
   # or, for production-style migrations:
   npm run db:migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Docker Deployment

The repository includes a multi-stage `Dockerfile` that produces a minimal production image.

#### Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_BASE_PATH="" \
  -t flowfocus .
```

> To serve the app at a subpath (e.g. `/apps/myapp`), set  
> `--build-arg NEXT_PUBLIC_BASE_PATH=/apps/myapp`.  
> The value is baked into the Next.js build.

#### Run

```bash
docker run -d \
  --name flowfocus \
  -p 3000:3000 \
  -v /opt/flowfocus/data:/app/db \
  -e DATABASE_URL="file:/app/db/app.db" \
  -e AUTH_SECRET="<your-secret>" \
  -e NEXTAUTH_SECRET="<your-secret>" \
  -e AUTH_URL="https://yourdomain.com/api/auth" \
  -e NEXTAUTH_URL="https://yourdomain.com" \
  -e DEEPINFRA_API_KEY="<your-key>" \
  flowfocus
```

The container exposes port **3000** and stores the SQLite database at the path specified by `DATABASE_URL`.

---

## Environment Variables

Copy `.env.example` to `.env.local` (development) or pass variables to the container at runtime (production).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | SQLite file path, e.g. `file:./dev.db` |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | ✅ | JWT signing secret. Generate: `openssl rand -base64 32` |
| `AUTH_URL` | ✅ (prod) | Full URL to the NextAuth endpoint, e.g. `https://yourdomain.com/api/auth` |
| `NEXTAUTH_URL` | ✅ (prod) | Canonical app URL, e.g. `https://yourdomain.com` |
| `DEEPINFRA_API_KEY` | ✅ | API key for AI features ([deepinfra.com](https://deepinfra.com/dash/api_keys)) |
| `DEEPINFRA_MODEL` | ➖ | Override default LLM model (default: `zai-org/GLM-5`) |
| `GOOGLE_CLIENT_ID` | ➖ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ➖ | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | ➖ | Azure app (client) ID |
| `MICROSOFT_CLIENT_SECRET` | ➖ | Azure client secret |
| `CLICKUP_CLIENT_ID` | ➖ | ClickUp OAuth2 client ID |
| `CLICKUP_CLIENT_SECRET` | ➖ | ClickUp OAuth2 client secret |
| `CLICKUP_RELAY_URI` | ➖ | Relay page URL for ClickUp OAuth (see `.env.example`) |
| `SMTP_HOST` | ➖ | SMTP server host (required for password-reset emails) |
| `SMTP_PORT` | ➖ | SMTP port (default: `587`) |
| `SMTP_USER` | ➖ | SMTP username |
| `SMTP_PASS` | ➖ | SMTP password / app password |
| `SMTP_FROM_NAME` | ➖ | Sender display name (default: `FlowFocus`) |
| `SMTP_FROM_EMAIL` | ➖ | Sender email address |
| `NEXT_PUBLIC_BASE_PATH` | ➖ | Sub-path prefix baked into the build (e.g. `/apps/myapp`) |

---

## Database

FlowFocus uses **SQLite** managed through **Prisma ORM**. The schema is located at `prisma/schema.prisma`.

### Key models

| Model | Purpose |
|-------|---------|
| `User` | Accounts, preferences, integration tokens |
| `Task` | Tasks with priority, status, dependencies, reminders |
| `Project` | Projects with labels, scope, and team members |
| `TimeBlock` | Scheduled time allocations |
| `FocusSession` | Pomodoro-style work sessions |
| `DecisionLog` | Project decision records |
| `ScopeChange` | Tracked scope modifications |
| `ClickUpConnection` | ClickUp OAuth token storage |
| `MicrosoftConnection` | Microsoft OAuth token storage |
| `EmailDigest` | Generated email digests |
| `DailyBriefing` | AI-generated daily briefings |
| `CapturedNote` | Quick-capture notes |

### Useful commands

```bash
npm run db:push        # Sync schema → database (no migration history; dev only)
npm run db:generate    # Regenerate Prisma Client after schema changes
npm run db:migrate     # Run migration script (prisma/migrate.ts)
npm run db:seed        # Seed initial data (prisma/seed.ts)
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start development server with hot reload |
| `build` | `next build` | Create optimised production build |
| `start` | `next start` | Serve the production build |
| `lint` | `eslint src --ext .ts,.tsx` | Lint TypeScript source files |
| `db:push` | `prisma db push` | Push schema changes to the database |
| `db:generate` | `prisma generate` | Regenerate Prisma Client |
| `db:migrate` | `tsx prisma/migrate.ts` | Run migration script |
| `db:seed` | `tsx prisma/seed.ts` | Seed the database |

---

## Project Structure

```
flowfocus/
├── prisma/                  # Database schema & migrations
│   ├── schema.prisma        # Prisma data model
│   ├── migrations/          # Migration files
│   ├── migrate.ts           # Custom migration runner
│   └── seed.ts              # Seed script
├── public/                  # Static assets & PWA manifest
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Login, register, password reset
│   │   ├── (app)/           # Protected application routes
│   │   │   ├── today/       # Daily task view
│   │   │   ├── dashboard/   # Overview dashboard
│   │   │   ├── projects/    # Project management
│   │   │   ├── kanban/      # Kanban board
│   │   │   ├── milestones/  # Milestone tracking
│   │   │   ├── sprints/     # Sprint planning
│   │   │   ├── time-logs/   # Time tracking
│   │   │   ├── weekly/      # Weekly planner
│   │   │   ├── upcoming/    # Upcoming tasks
│   │   │   ├── clickup/     # ClickUp integration UI
│   │   │   ├── microsoft/   # Microsoft integration UI
│   │   │   ├── integrations/# Integration settings
│   │   │   ├── settings/    # User settings
│   │   │   └── capture/     # Quick-capture route
│   │   └── api/             # REST API routes (30+ endpoints)
│   ├── components/          # Reusable React components
│   │   ├── calendar/        # Calendar widgets
│   │   ├── clickup/         # ClickUp-specific UI
│   │   ├── composed/        # Complex composed components
│   │   ├── features/        # Feature-level components
│   │   ├── friday/          # AI Friday assistant UI
│   │   ├── layout/          # Layout, theme, auth providers
│   │   ├── microsoft/       # Microsoft integration UI
│   │   ├── settings/        # Settings panels
│   │   └── tasks/           # Task cards, forms, lists
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Server-side utilities
│   │   ├── auth.ts          # NextAuth configuration
│   │   ├── prisma.ts        # Prisma singleton client
│   │   ├── clickup.ts       # ClickUp API wrapper
│   │   ├── microsoft-graph.ts # Microsoft Graph API wrapper
│   │   ├── email.ts         # Email sending (Nodemailer)
│   │   ├── email-scan.ts    # Inbox scanning logic
│   │   ├── email-digest.ts  # Email digest generation
│   │   └── task-reminder-engine.ts # Reminder scheduling
│   ├── store/               # Zustand global state
│   │   └── task-store.ts
│   ├── types/               # Shared TypeScript types
│   └── middleware.ts        # Next.js route middleware
├── .env.example             # Environment variable reference
├── Dockerfile               # Multi-stage Docker build
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── prisma.config.ts         # Prisma configuration
└── tsconfig.json            # TypeScript configuration
```

---

## Integrations

### DeepInfra (AI)
Sign up at [deepinfra.com](https://deepinfra.com) and create an API key. Set `DEEPINFRA_API_KEY` in your environment. The default model is `zai-org/GLM-5`; override with `DEEPINFRA_MODEL`.

### Google OAuth
Create an OAuth 2.0 credential in [Google Cloud Console](https://console.cloud.google.com/). Add `http://localhost:3000/api/auth/callback/google` (and your production URL) as an authorised redirect URI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Microsoft 365
Register an application in [Azure Active Directory](https://portal.azure.com/). Grant the scopes `offline_access`, `User.Read`, `Mail.Read`, and `Calendars.ReadWrite`. Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

### ClickUp
Register an OAuth2 app at [app.clickup.com/settings/apps](https://app.clickup.com/settings/apps). Set `CLICKUP_CLIENT_ID` and `CLICKUP_CLIENT_SECRET`. See `.env.example` for notes on the relay-URI workaround required by ClickUp's OAuth implementation.

### SMTP (Password Reset)
Any standard SMTP provider works (Gmail App Passwords, SendGrid, AWS SES, etc.). Set the `SMTP_*` variables in your environment.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run `npm install` and configure `.env.local`.
3. Make your changes and run `npm run lint` to check for issues.
4. Submit a pull request with a clear description of what was changed and why.

---

*FlowFocus is open source and self-hosted. Your data stays on your servers.*

# FlowFocus — SQLite → PostgreSQL Migration

## Status: ✅ COMPLETE

All code changes have been applied. The app is fully PostgreSQL-ready.

## What was done

| # | Task | Status |
|---|------|--------|
| 1 | Prisma datasource changed from `sqlite` to `postgresql` | ✅ Done |
| 2 | Prisma runtime client — removed `@prisma/adapter-better-sqlite3` | ✅ Done |
| 3 | Seed / check-empty / migrate scripts — plain PrismaClient | ✅ Done |
| 4 | Dockerfile — removed python3/make/g++ (no native SQLite build) | ✅ Done |
| 5 | start.sh — PostgreSQL validation, no SQLite file logic | ✅ Done |
| 6 | .env.example / .env.development — PostgreSQL defaults | ✅ Done |
| 7 | Old SQLite migration SQL files — deleted (9 files) | ✅ Done |
| 8 | Fresh PostgreSQL baseline migration — `0001_baseline` | ✅ Done |
| 9 | migration_lock.toml — `provider = "postgresql"` | ✅ Done |
| 10 | migrate.ts — uses `prisma migrate deploy` (not `db push`) | ✅ Done |
| 11 | docker-compose.yml — PostgreSQL service for local dev | ✅ Done |
| 12 | .dockerignore — created | ✅ Done |
| 13 | SQLite → PostgreSQL data import script | ✅ Done |

## Migration baseline

The single migration `prisma/migrations/0001_baseline/migration.sql` was generated
from the current `schema.prisma` using:

```sh
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

This produces proper PostgreSQL DDL (`TIMESTAMP(3)`, `BOOLEAN`, `DOUBLE PRECISION`,
`CONSTRAINT ... PRIMARY KEY`, `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`, etc.).

## Legacy data import

If existing SQLite data must be preserved:

```sh
npm run db:import:sqlite -- --from=./data/app.db
```

Flags:
- `--truncate` — clear Postgres tables first
- `--batch-size=500` — control insert batch size
- `--no-skip-duplicates` — fail on duplicate keys

The import script is a dev-only tool (`better-sqlite3` in devDependencies).

## Runtime environment required

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
NEXTAUTH_URL=https://your-domain/apps/xklwb3f46m48u5s4h2h5d4pd
AUTH_URL=https://your-domain/apps/xklwb3f46m48u5s4h2h5d4pd/api/auth
AUTH_SECRET=<secret>
NEXT_PUBLIC_BASE_PATH=/apps/xklwb3f46m48u5s4h2h5d4pd
```

## Local development

```sh
# Start PostgreSQL
docker compose up postgres -d

# Install deps + generate Prisma client
npm install
npm run db:generate

# Apply migrations + seed
npm run db:migrate

# Start dev server
npm run dev
```

Or use the full stack:
```sh
docker compose up --build
```

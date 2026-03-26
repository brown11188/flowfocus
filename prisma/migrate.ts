#!/usr/bin/env tsx
/**
 * FlowFocus migration runner.
 *
 * Called by the deployment pipeline as: npm run db:migrate
 * Also called manually for local development.
 *
 * Behaviour:
 *   1. If DB is locked (old container running): retry up to 15× with 2s
 *      delay (30s total) — the deployment script stops the old container
 *      during Step 5, so the lock will clear.
 *   2. After successful migration: if the User table is empty, run the
 *      seed script to populate demo data.
 *   3. P3009 (failed migration in DB): auto-resolve the stuck migration
 *      by marking it applied if all its columns already exist, then retry.
 *      This handles the case where a prior deploy partially applied the SQL
 *      but Prisma's engine crashed before recording it as finished.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const MAX_RETRIES = 15
const RETRY_DELAY_MS = 2000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isLockError(err: unknown): boolean {
  const msg = getErrMsg(err)
  return msg.includes('database is locked') || msg.includes('SQLITE_BUSY')
}

function isFailedMigrationError(err: unknown): boolean {
  const msg = getErrMsg(err)
  return msg.includes('P3009') || msg.includes('migrate found failed migrations')
}

function getErrMsg(err: unknown): string {
  return String(
    (err as { stderr?: string; stdout?: string; message?: string })?.stderr ??
    (err as { message?: string })?.message ??
    err
  )
}

/**
 * Auto-resolve stuck migrations caused by P3009.
 *
 * When Prisma's schema engine applies SQL but crashes before writing
 * finished_at, it records the migration as failed. On next deploy Prisma
 * refuses all further migrations until the failure is resolved.
 *
 * Strategy: open the SQLite DB directly, find migrations where
 * finished_at IS NULL and rolled_back_at IS NULL (= failed/stuck), check
 * whether all the DDL in that migration already landed in the DB, and if
 * so mark it finished. This is equivalent to running:
 *   prisma migrate resolve --applied <migration_name>
 */
function resolveStuckMigrations(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? 'file:./data/app.db'
  const dbPath = dbUrl.replace(/^file:/, '')
  const absDbPath = resolve(dbPath)

  if (!existsSync(absDbPath)) {
    console.log('⚠️  DB file not found — skipping stuck-migration resolution.')
    return false
  }

  let resolved = false
  try {
    // Dynamic import so the script still works if better-sqlite3 isn't available
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const BetterSqlite3 = require('better-sqlite3') as any
    // The module default export is the constructor (works with both CJS and ESM interop)
    const Ctor = BetterSqlite3.default ?? BetterSqlite3
    const db = new Ctor(absDbPath) as {
      prepare: (sql: string) => { all: () => unknown[]; run: (...args: unknown[]) => unknown }
      close: () => void
    }

    const stuckRows = db.prepare(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NULL AND rolled_back_at IS NULL`
    ).all() as { migration_name: string }[]

    for (const { migration_name } of stuckRows) {
      console.log(`🔧 Found stuck migration: ${migration_name} — checking schema...`)

      // Parse the migration SQL to extract ADD COLUMN statements
      const sqlPath = resolve(`prisma/migrations/${migration_name}/migration.sql`)
      if (!existsSync(sqlPath)) {
        console.log(`   ⚠️  SQL file not found at ${sqlPath} — skipping.`)
        continue
      }

      const sql = readFileSync(sqlPath, 'utf-8')
      const addColumnMatches = [
        ...sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/gi),
      ]

      if (addColumnMatches.length === 0) {
        // No ADD COLUMN — assume it can be safely re-applied; leave to Prisma
        console.log(`   ℹ️  No ADD COLUMN statements found — leaving for Prisma to handle.`)
        continue
      }

      // Check every expected column exists already
      let allPresent = true
      for (const match of addColumnMatches) {
        const [, tableName, colName] = match
        const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
        const exists = tableInfo.some(c => c.name === colName)
        console.log(`   Column ${tableName}.${colName}: ${exists ? '✅ exists' : '❌ missing'}`)
        if (!exists) { allPresent = false }
      }

      if (allPresent) {
        const now = Date.now()
        db.prepare(
          `UPDATE _prisma_migrations
           SET finished_at = ?, applied_steps_count = 1, logs = NULL
           WHERE migration_name = ?`
        ).run(now, migration_name)
        console.log(`✅ Resolved stuck migration: ${migration_name}`)
        resolved = true
      } else {
        console.log(`   ⚠️  Not all columns present — migration will be retried by Prisma.`)
      }
    }

    db.close()
  } catch (e) {
    console.warn('⚠️  Could not auto-resolve stuck migrations (non-fatal):', e)
  }

  return resolved
}

async function runMigrations(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  > npx prisma migrate deploy (attempt ${attempt}/${MAX_RETRIES})`)
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('✅ Migrations applied successfully.')
      return
    } catch (err) {
      if (isLockError(err)) {
        if (attempt === MAX_RETRIES) {
          console.log('⚠️  DB still locked after max retries — assuming already migrated by running container.')
          return
        }
        console.log(`⚠️  DB locked — waiting ${RETRY_DELAY_MS}ms before retry ${attempt + 1}/${MAX_RETRIES}...`)
        await sleep(RETRY_DELAY_MS)
      } else if (isFailedMigrationError(err)) {
        console.log('⚠️  P3009 detected — attempting to auto-resolve stuck migrations...')
        const didResolve = resolveStuckMigrations()
        if (!didResolve) {
          console.error('❌ Could not auto-resolve stuck migrations. Manual intervention required.')
          console.error('   Run: prisma migrate resolve --applied <migration_name>')
          process.exit(1)
        }
        // Retry immediately after resolving
        console.log('🔄 Retrying migration deploy after resolution...')
      } else {
        console.error('❌ Migration failed:', err)
        process.exit(1)
      }
    }
  }
}

async function seedIfEmpty(): Promise<void> {
  try {
    // Use a separate script file to avoid $disconnect being mangled in shell strings
    const result = execSync('npx tsx prisma/check-empty.ts', {
      encoding: 'utf-8',
      env: { ...process.env },
    }).trim()
    const userCount = parseInt(result, 10)
    if (isNaN(userCount) || userCount === 0) {
      console.log('🌱 Empty database detected — running seed...')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
      console.log('✅ Seed completed.')
    } else {
      console.log(`ℹ️  Database has ${userCount} user(s) — skipping seed.`)
    }
  } catch (e) {
    // Seed failure is non-fatal — the app still works without demo data
    console.warn('⚠️  Seed check/run failed (non-fatal):', e)
  }
}

async function main() {
  console.log('🚀 FlowFocus — running database migrations...')
  await runMigrations()
  await seedIfEmpty()
}

main()

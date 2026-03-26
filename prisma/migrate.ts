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
 */

import { execSync } from 'child_process'

const MAX_RETRIES = 15
const RETRY_DELAY_MS = 2000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isLockError(err: unknown): boolean {
  const msg = String(
    (err as { stderr?: string; stdout?: string; message?: string })?.stderr ??
    (err as { message?: string })?.message ??
    err
  )
  return msg.includes('database is locked') || msg.includes('SQLITE_BUSY')
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

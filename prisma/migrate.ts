#!/usr/bin/env tsx
/**
 * FlowFocus PostgreSQL migration runner.
 *
 * Called by the deployment pipeline as: npm run db:migrate
 * Also called manually for local development.
 *
 * Uses `prisma migrate deploy` against the fresh PostgreSQL baseline migration
 * in prisma/migrations/0001_baseline/.
 */

import { execSync } from 'child_process'

const MAX_RETRIES = 15
const RETRY_DELAY_MS = 2000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrMsg(err: unknown): string {
  return String(
    (err as { stderr?: string; stdout?: string; message?: string })?.stderr
    ?? (err as { stdout?: string; message?: string })?.stdout
    ?? (err as { message?: string })?.message
    ?? err,
  )
}

function isRetryableError(err: unknown): boolean {
  const msg = getErrMsg(err).toLowerCase()
  return [
    'can\'t reach database server',
    'connection refused',
    'connection reset',
    'timed out',
    'timeout',
    'the database system is starting up',
    'remaining connection slots are reserved',
    'too many clients already',
    'server closed the connection unexpectedly',
  ].some((needle) => msg.includes(needle))
}

async function runMigrations(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  > npx prisma migrate deploy (attempt ${attempt}/${MAX_RETRIES})`)
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('✅ Migrations applied successfully.')
      return
    } catch (err) {
      if (!isRetryableError(err) || attempt === MAX_RETRIES) {
        console.error('❌ Migration failed:', getErrMsg(err))
        process.exit(1)
      }

      console.log(
        `⚠️  Database not ready yet — waiting ${RETRY_DELAY_MS}ms before retry ${attempt + 1}/${MAX_RETRIES}...`,
      )
      await sleep(RETRY_DELAY_MS)
    }
  }
}

async function seedIfEmpty(): Promise<void> {
  try {
    const result = execSync('npx tsx prisma/check-empty.ts', {
      encoding: 'utf-8',
      env: { ...process.env },
    }).trim()

    const userCount = Number.parseInt(result, 10)

    if (Number.isNaN(userCount) || userCount === 0) {
      console.log('🌱 Empty database detected — running seed...')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
      console.log('✅ Seed completed.')
      return
    }

    console.log(`ℹ️  Database has ${userCount} user(s) — skipping seed.`)
  } catch (error) {
    console.warn('⚠️  Seed check/run failed (non-fatal):', error)
  }
}

async function main() {
  console.log('🚀 FlowFocus — applying PostgreSQL migrations...')
  await runMigrations()
  await seedIfEmpty()
}

main()

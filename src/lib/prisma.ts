import { PrismaClient } from '../generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var __pgPool: pg.Pool | undefined
}

function createClient() {
  const pool = globalThis.__pgPool ?? new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  })

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__pgPool = pool
  }

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.__prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

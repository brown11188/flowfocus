#!/usr/bin/env tsx
/**
 * Outputs the number of users in the database to stdout.
 * Used by migrate.ts to determine whether seeding is needed.
 * Exit 0 always — caller reads stdout for the count.
 */
import { PrismaClient } from '../src/generated/prisma/client/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const url     = process.env.DATABASE_URL ?? 'file:./data/app.db'
const adapter = new PrismaBetterSqlite3({ url })
const prisma  = new PrismaClient({ adapter })

prisma.user
  .count()
  .then((n) => {
    console.log(n)
  })
  .catch(() => {
    // Table may not exist yet — treat as 0
    console.log('0')
  })
  .finally(() => prisma.$disconnect())

prisma.user
  .count()
  .then((n) => {
    console.log(n)
  })
  .catch(() => {
    // Table may not exist yet — treat as 0
    console.log('0')
  })
  .finally(() => prisma.$disconnect())

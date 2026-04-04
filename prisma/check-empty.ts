#!/usr/bin/env tsx
/**
 * Outputs the number of users in the database to stdout.
 * Used by migrate.ts to determine whether seeding is needed.
 * Exit 0 always — caller reads stdout for the count.
 */
import { PrismaClient } from '../src/generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

prisma.user
  .count()
  .then((n) => {
    console.log(n)
  })
  .catch(() => {
    console.log('0')
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

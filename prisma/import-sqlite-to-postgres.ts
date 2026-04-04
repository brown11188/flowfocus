#!/usr/bin/env tsx
import Database from 'better-sqlite3'
import { PrismaClient, Prisma } from '../src/generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

type JsonRow = Record<string, unknown>

type ImportJob = {
  sourceTable: string
  clear: () => Promise<unknown>
  read: () => JsonRow[]
  insert: (rows: JsonRow[], skipDuplicates: boolean) => Promise<number>
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const fromArg = process.argv.find((arg) => arg.startsWith('--from='))
const batchSizeArg = process.argv.find((arg) => arg.startsWith('--batch-size='))
const sourcePath = process.env.SQLITE_IMPORT_PATH ?? fromArg?.slice('--from='.length) ?? './data/app.db'
const batchSize = Number.parseInt(batchSizeArg?.slice('--batch-size='.length) ?? '250', 10)
const truncateFirst = process.argv.includes('--truncate')
const skipDuplicates = !process.argv.includes('--no-skip-duplicates')

const sqlite = new Database(sourcePath, { readonly: true })

function tableExists(tableName: string): boolean {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName) as { name?: string } | undefined

  return row?.name === tableName
}

function readTable(tableName: string): JsonRow[] {
  if (!tableExists(tableName)) {
    console.log(`↷ Skipping missing SQLite table: ${tableName}`)
    return []
  }

  return sqlite.prepare(`SELECT * FROM "${tableName}"`).all() as JsonRow[]
}

function normalizeDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value instanceof Date) return value

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 't', 'yes'].includes(normalized)) return true
  if (['0', 'false', 'f', 'no'].includes(normalized)) return false
  return null
}

function normalizeNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value === 'number') return value

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeRows(
  rows: JsonRow[],
  options: {
    dateFields?: string[]
    booleanFields?: string[]
    numberFields?: string[]
  },
): JsonRow[] {
  return rows.map((row) => {
    const next: JsonRow = { ...row }

    for (const field of options.dateFields ?? []) {
      next[field] = normalizeDate(next[field])
    }

    for (const field of options.booleanFields ?? []) {
      next[field] = normalizeBoolean(next[field])
    }

    for (const field of options.numberFields ?? []) {
      next[field] = normalizeNumber(next[field])
    }

    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    )
  })
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }

  return chunks
}

function sortTasks(rows: JsonRow[]): JsonRow[] {
  return [...rows].sort((left, right) => {
    const leftDepth = normalizeNumber(left.depth) ?? 0
    const rightDepth = normalizeNumber(right.depth) ?? 0

    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth
    }

    const leftParent = left.parentId ? 1 : 0
    const rightParent = right.parentId ? 1 : 0

    if (leftParent !== rightParent) {
      return leftParent - rightParent
    }

    return String(left.id ?? '').localeCompare(String(right.id ?? ''))
  })
}

const jobs: ImportJob[] = [
  {
    sourceTable: 'User',
    clear: () => prisma.user.deleteMany(),
    read: () => normalizeRows(readTable('User'), { dateFields: ['emailVerified', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.user.createMany({ data: rows as Prisma.UserCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'VerificationToken',
    clear: () => prisma.verificationToken.deleteMany(),
    read: () => normalizeRows(readTable('VerificationToken'), { dateFields: ['expires'] }),
    insert: (rows, skip) => prisma.verificationToken.createMany({ data: rows as Prisma.VerificationTokenCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'PasswordResetToken',
    clear: () => prisma.passwordResetToken.deleteMany(),
    read: () => normalizeRows(readTable('PasswordResetToken'), {
      dateFields: ['expiresAt', 'usedAt', 'createdAt'],
      numberFields: ['attempts'],
    }),
    insert: (rows, skip) => prisma.passwordResetToken.createMany({ data: rows as Prisma.PasswordResetTokenCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Account',
    clear: () => prisma.account.deleteMany(),
    read: () => normalizeRows(readTable('Account'), { numberFields: ['expires_at'] }),
    insert: (rows, skip) => prisma.account.createMany({ data: rows as Prisma.AccountCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Session',
    clear: () => prisma.session.deleteMany(),
    read: () => normalizeRows(readTable('Session'), { dateFields: ['expires'] }),
    insert: (rows, skip) => prisma.session.createMany({ data: rows as Prisma.SessionCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Project',
    clear: () => prisma.project.deleteMany(),
    read: () => normalizeRows(readTable('Project'), {
      dateFields: ['createdAt', 'updatedAt', 'lastHealthCheckAt'],
      booleanFields: ['isInbox'],
      numberFields: ['sortOrder', 'healthScore'],
    }),
    insert: (rows, skip) => prisma.project.createMany({ data: rows as Prisma.ProjectCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Label',
    clear: () => prisma.label.deleteMany(),
    read: () => normalizeRows(readTable('Label'), { dateFields: ['createdAt'] }),
    insert: (rows, skip) => prisma.label.createMany({ data: rows as Prisma.LabelCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'KanbanColumn',
    clear: () => prisma.kanbanColumn.deleteMany(),
    read: () => normalizeRows(readTable('KanbanColumn'), {
      booleanFields: ['isDefault'],
      numberFields: ['sortOrder'],
    }),
    insert: (rows, skip) => prisma.kanbanColumn.createMany({ data: rows as Prisma.KanbanColumnCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Sprint',
    clear: () => prisma.sprint.deleteMany(),
    read: () => normalizeRows(readTable('Sprint'), {
      dateFields: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
      booleanFields: ['isActive', 'isCompleted'],
    }),
    insert: (rows, skip) => prisma.sprint.createMany({ data: rows as Prisma.SprintCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Task',
    clear: () => prisma.task.deleteMany(),
    read: () => sortTasks(normalizeRows(readTable('Task'), {
      dateFields: ['dueDate', 'completedAt', 'deletedAt', 'recurrenceEndDate', 'blockedAt', 'createdAt', 'updatedAt', 'importedAt'],
      booleanFields: ['completed', 'isDeleted'],
      numberFields: ['priority', 'sortOrder', 'recurrenceInterval', 'depth', 'estimatedHours'],
    })),
    insert: (rows, skip) => prisma.task.createMany({ data: rows as Prisma.TaskCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'TaskLabel',
    clear: () => prisma.taskLabel.deleteMany(),
    read: () => readTable('TaskLabel'),
    insert: (rows, skip) => prisma.taskLabel.createMany({ data: rows as Prisma.TaskLabelCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'TaskDependency',
    clear: () => prisma.taskDependency.deleteMany(),
    read: () => readTable('TaskDependency'),
    insert: (rows, skip) => prisma.taskDependency.createMany({ data: rows as Prisma.TaskDependencyCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Milestone',
    clear: () => prisma.milestone.deleteMany(),
    read: () => normalizeRows(readTable('Milestone'), { dateFields: ['targetDate', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.milestone.createMany({ data: rows as Prisma.MilestoneCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'MilestoneTask',
    clear: () => prisma.milestoneTask.deleteMany(),
    read: () => readTable('MilestoneTask'),
    insert: (rows, skip) => prisma.milestoneTask.createMany({ data: rows as Prisma.MilestoneTaskCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'TimeLog',
    clear: () => prisma.timeLog.deleteMany(),
    read: () => normalizeRows(readTable('TimeLog'), {
      dateFields: ['loggedAt'],
      numberFields: ['durationMinutes'],
    }),
    insert: (rows, skip) => prisma.timeLog.createMany({ data: rows as Prisma.TimeLogCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'Risk',
    clear: () => prisma.risk.deleteMany(),
    read: () => normalizeRows(readTable('Risk'), {
      dateFields: ['dueDate', 'createdAt', 'updatedAt'],
      numberFields: ['probability', 'impact', 'score'],
    }),
    insert: (rows, skip) => prisma.risk.createMany({ data: rows as Prisma.RiskCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'DecisionLog',
    clear: () => prisma.decisionLog.deleteMany(),
    read: () => normalizeRows(readTable('DecisionLog'), { dateFields: ['decidedAt', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.decisionLog.createMany({ data: rows as Prisma.DecisionLogCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ScopeChange',
    clear: () => prisma.scopeChange.deleteMany(),
    read: () => normalizeRows(readTable('ScopeChange'), {
      dateFields: ['createdAt', 'updatedAt'],
      numberFields: ['effortHours'],
    }),
    insert: (rows, skip) => prisma.scopeChange.createMany({ data: rows as Prisma.ScopeChangeCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ApprovalItem',
    clear: () => prisma.approvalItem.deleteMany(),
    read: () => normalizeRows(readTable('ApprovalItem'), { dateFields: ['dueDate', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.approvalItem.createMany({ data: rows as Prisma.ApprovalItemCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'MeetingNote',
    clear: () => prisma.meetingNote.deleteMany(),
    read: () => normalizeRows(readTable('MeetingNote'), { dateFields: ['meetingDate', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.meetingNote.createMany({ data: rows as Prisma.MeetingNoteCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'StatusReport',
    clear: () => prisma.statusReport.deleteMany(),
    read: () => normalizeRows(readTable('StatusReport'), { dateFields: ['periodStart', 'periodEnd', 'createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.statusReport.createMany({ data: rows as Prisma.StatusReportCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'MicrosoftConnection',
    clear: () => prisma.microsoftConnection.deleteMany(),
    read: () => normalizeRows(readTable('MicrosoftConnection'), {
      dateFields: ['expiresAt', 'lastEmailSyncAt', 'lastCalendarSyncAt', 'createdAt', 'updatedAt'],
      booleanFields: ['syncEmailsEnabled', 'syncCalendarEnabled'],
    }),
    insert: (rows, skip) => prisma.microsoftConnection.createMany({ data: rows as Prisma.MicrosoftConnectionCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'CalendarEvent',
    clear: () => prisma.calendarEvent.deleteMany(),
    read: () => normalizeRows(readTable('CalendarEvent'), {
      dateFields: ['startDateTime', 'endDateTime', 'lastSyncedAt', 'createdAt', 'updatedAt'],
      booleanFields: ['isAllDay', 'isRecurring'],
    }),
    insert: (rows, skip) => prisma.calendarEvent.createMany({ data: rows as Prisma.CalendarEventCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'EmailTask',
    clear: () => prisma.emailTask.deleteMany(),
    read: () => normalizeRows(readTable('EmailTask'), {
      dateFields: ['receivedAt', 'suggestedDueDate', 'convertedAt', 'createdAt'],
      numberFields: ['suggestedPriority'],
    }),
    insert: (rows, skip) => prisma.emailTask.createMany({ data: rows as Prisma.EmailTaskCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ActionedEmail',
    clear: () => prisma.actionedEmail.deleteMany(),
    read: () => normalizeRows(readTable('ActionedEmail'), { dateFields: ['actionedAt'] }),
    insert: (rows, skip) => prisma.actionedEmail.createMany({ data: rows as Prisma.ActionedEmailCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'EmailScanRule',
    clear: () => prisma.emailScanRule.deleteMany(),
    read: () => normalizeRows(readTable('EmailScanRule'), {
      dateFields: ['createdAt'],
      booleanFields: ['isActive'],
    }),
    insert: (rows, skip) => prisma.emailScanRule.createMany({ data: rows as Prisma.EmailScanRuleCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'EmailDigest',
    clear: () => prisma.emailDigest.deleteMany(),
    read: () => normalizeRows(readTable('EmailDigest'), {
      dateFields: ['startedAt', 'completedAt', 'createdAt', 'updatedAt'],
      numberFields: ['totalScanned', 'clientEmailCount', 'noReplyFiltered', 'missedReplyCount', 'needsReplyCount', 'followUpCount', 'readAgainCount'],
    }),
    insert: (rows, skip) => prisma.emailDigest.createMany({ data: rows as Prisma.EmailDigestCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'SyncLog',
    clear: () => prisma.syncLog.deleteMany(),
    read: () => normalizeRows(readTable('SyncLog'), {
      dateFields: ['startedAt', 'completedAt'],
      numberFields: ['recordsProcessed', 'recordsCreated', 'recordsUpdated', 'recordsSkipped'],
    }),
    insert: (rows, skip) => prisma.syncLog.createMany({ data: rows as Prisma.SyncLogCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'DailyBriefing',
    clear: () => prisma.dailyBriefing.deleteMany(),
    read: () => normalizeRows(readTable('DailyBriefing'), {
      dateFields: ['generatedAt', 'createdAt', 'updatedAt'],
      booleanFields: ['isFromCache'],
      numberFields: ['refreshCount'],
    }),
    insert: (rows, skip) => prisma.dailyBriefing.createMany({ data: rows as Prisma.DailyBriefingCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ClickUpConnection',
    clear: () => prisma.clickUpConnection.deleteMany(),
    read: () => normalizeRows(readTable('ClickUpConnection'), { dateFields: ['createdAt', 'updatedAt'] }),
    insert: (rows, skip) => prisma.clickUpConnection.createMany({ data: rows as Prisma.ClickUpConnectionCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ClickUpWorkspaceConnection',
    clear: () => prisma.clickUpWorkspaceConnection.deleteMany(),
    read: () => normalizeRows(readTable('ClickUpWorkspaceConnection'), {
      dateFields: ['lastSyncedAt', 'createdAt', 'updatedAt'],
      booleanFields: ['isActive', 'syncEnabled'],
    }),
    insert: (rows, skip) => prisma.clickUpWorkspaceConnection.createMany({ data: rows as Prisma.ClickUpWorkspaceConnectionCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'ClickUpReport',
    clear: () => prisma.clickUpReport.deleteMany(),
    read: () => normalizeRows(readTable('ClickUpReport'), {
      dateFields: ['createdAt'],
      numberFields: ['taskCount', 'overdueCount'],
    }),
    insert: (rows, skip) => prisma.clickUpReport.createMany({ data: rows as Prisma.ClickUpReportCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'DailyLog',
    clear: () => prisma.dailyLog.deleteMany(),
    read: () => normalizeRows(readTable('DailyLog'), {
      dateFields: ['createdAt', 'updatedAt'],
      booleanFields: ['morningDone', 'eodDone'],
      numberFields: ['completedCount', 'deferredCount'],
    }),
    insert: (rows, skip) => prisma.dailyLog.createMany({ data: rows as Prisma.DailyLogCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'TimeBlock',
    clear: () => prisma.timeBlock.deleteMany(),
    read: () => normalizeRows(readTable('TimeBlock'), {
      dateFields: ['createdAt', 'updatedAt'],
      booleanFields: ['isCalendarEvent'],
    }),
    insert: (rows, skip) => prisma.timeBlock.createMany({ data: rows as Prisma.TimeBlockCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'FocusSession',
    clear: () => prisma.focusSession.deleteMany(),
    read: () => normalizeRows(readTable('FocusSession'), {
      dateFields: ['completedAt', 'createdAt'],
      booleanFields: ['wasCompleted'],
      numberFields: ['plannedMins', 'actualMins'],
    }),
    insert: (rows, skip) => prisma.focusSession.createMany({ data: rows as Prisma.FocusSessionCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
  {
    sourceTable: 'CapturedNote',
    clear: () => prisma.capturedNote.deleteMany(),
    read: () => normalizeRows(readTable('CapturedNote'), { dateFields: ['createdAt'] }),
    insert: (rows, skip) => prisma.capturedNote.createMany({ data: rows as Prisma.CapturedNoteCreateManyInput[], skipDuplicates: skip }).then((result) => result.count),
  },
]

async function clearTargetDatabase() {
  console.log('⚠️  Truncate mode enabled — clearing PostgreSQL tables in reverse dependency order...')

  for (const job of [...jobs].reverse()) {
    await job.clear()
  }
}

async function importJob(job: ImportJob) {
  const rows = job.read()

  if (rows.length === 0) {
    console.log(`• ${job.sourceTable}: 0 rows`)
    return
  }

  let imported = 0

  for (const chunk of chunkRows(rows, batchSize)) {
    imported += await job.insert(chunk, skipDuplicates)
  }

  console.log(`✓ ${job.sourceTable}: ${imported}/${rows.length} rows imported`)
}

async function main() {
  console.log('🚀 FlowFocus SQLite → PostgreSQL import')
  console.log(`Source SQLite DB: ${sourcePath}`)
  console.log(`Target PostgreSQL DB: ${process.env.DATABASE_URL ? 'configured' : 'missing DATABASE_URL'}`)
  console.log(`Batch size: ${batchSize}`)
  console.log(`Skip duplicates: ${skipDuplicates ? 'yes' : 'no'}`)
  console.log(`Truncate first: ${truncateFirst ? 'yes' : 'no'}`)

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for PostgreSQL import')
  }

  if (truncateFirst) {
    await clearTargetDatabase()
  }

  for (const job of jobs) {
    await importJob(job)
  }

  console.log('✅ Import complete')
}

main()
  .catch((error: unknown) => {
    console.error('❌ Import failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    sqlite.close()
    await prisma.$disconnect()
    await pool.end()
  })

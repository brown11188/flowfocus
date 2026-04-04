import { pgTable, text, integer, boolean, timestamp, real, primaryKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// AUTH TABLES (exact column names required by @auth/drizzle-adapter)
export const users = pgTable('User', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const accounts = pgTable('Account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.provider, table.providerAccountId] }),
}))

export const sessions = pgTable('Session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable('VerificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.identifier, table.token] }),
}))

export const passwordResetTokens = pgTable('PasswordResetToken', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  usedAt: timestamp('usedAt', { mode: 'date' }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const projects = pgTable('Project', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isInbox: boolean('isInbox').notNull().default(false),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
  healthStatus: text('healthStatus').notNull().default('green'),
  healthScore: integer('healthScore').notNull().default(100),
  healthSummary: text('healthSummary'),
  lastHealthCheckAt: timestamp('lastHealthCheckAt', { mode: 'date' }),
  clickupSpaceId: text('clickupSpaceId'),
  clickupSpaceName: text('clickupSpaceName'),
  clickupTeamId: text('clickupTeamId'),
  clickupWorkspaceConnectionId: text('clickupWorkspaceConnectionId'),
})

export const labels = pgTable('Label', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const tasks = pgTable('Task', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  notes: text('notes'),
  dueDate: timestamp('dueDate', { mode: 'date' }),
  dueTime: text('dueTime'),
  priority: integer('priority').notNull().default(4),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  isDeleted: boolean('isDeleted').notNull().default(false),
  deletedAt: timestamp('deletedAt', { mode: 'date' }),
  sortOrder: integer('sortOrder').notNull().default(0),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('projectId').references(() => projects.id),
  parentId: text('parentId'),
  assigneeName: text('assigneeName'),
  waitingOn: text('waitingOn'),
  approvalStatus: text('approvalStatus'),
  blockedAt: timestamp('blockedAt', { mode: 'date' }),
  recurrenceRule: text('recurrenceRule'),
  recurrenceInterval: integer('recurrenceInterval'),
  recurrenceDays: text('recurrenceDays'),
  recurrenceEndDate: timestamp('recurrenceEndDate', { mode: 'date' }),
  recurringParentId: text('recurringParentId'),
  depth: integer('depth').notNull().default(0),
  estimatedHours: real('estimatedHours'),
  status: text('status').notNull().default('TODO'),
  kanbanColumnId: text('kanbanColumnId'),
  sprintId: text('sprintId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
  clickupTaskId: text('clickupTaskId'),
  clickupListId: text('clickupListId'),
  clickupSpaceId: text('clickupSpaceId'),
  clickupUrl: text('clickupUrl'),
  clickupStatus: text('clickupStatus'),
  clickupAssignees: text('clickupAssignees'),
  importedAt: timestamp('importedAt', { mode: 'date' }),
})

export const taskLabels = pgTable('TaskLabel', {
  taskId: text('taskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  labelId: text('labelId').notNull().references(() => labels.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.labelId] }),
}))

export const taskDependencies = pgTable('TaskDependency', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  blockedTaskId: text('blockedTaskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  blockingTaskId: text('blockingTaskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
})

export const milestones = pgTable('Milestone', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  targetDate: timestamp('targetDate', { mode: 'date' }).notNull(),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const milestoneTasks = pgTable('MilestoneTask', {
  milestoneId: text('milestoneId').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  taskId: text('taskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.milestoneId, table.taskId] }),
}))

export const timeLogs = pgTable('TimeLog', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  taskId: text('taskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  durationMinutes: integer('durationMinutes').notNull(),
  note: text('note'),
  loggedAt: timestamp('loggedAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const kanbanColumns = pgTable('KanbanColumn', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sortOrder: integer('sortOrder').notNull().default(0),
  isDefault: boolean('isDefault').notNull().default(false),
  color: text('color').notNull().default('#6366f1'),
})

export const risks = pgTable('Risk', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  probability: text('probability').notNull().default('medium'),
  impact: text('impact').notNull().default('medium'),
  status: text('status').notNull().default('open'),
  mitigationPlan: text('mitigationPlan'),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const decisionLogs = pgTable('DecisionLog', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  decision: text('decision').notNull(),
  rationale: text('rationale'),
  impact: text('impact'),
  decidedBy: text('decidedBy'),
  decidedAt: timestamp('decidedAt', { mode: 'date' }),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const scopeChanges = pgTable('ScopeChange', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  impact: text('impact'),
  status: text('status').notNull().default('pending'),
  requestedBy: text('requestedBy'),
  requestedAt: timestamp('requestedAt', { mode: 'date' }),
  approvedBy: text('approvedBy'),
  approvedAt: timestamp('approvedAt', { mode: 'date' }),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const approvalItems = pgTable('ApprovalItem', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  requestedBy: text('requestedBy'),
  requestedAt: timestamp('requestedAt', { mode: 'date' }),
  approvedBy: text('approvedBy'),
  approvedAt: timestamp('approvedAt', { mode: 'date' }),
  dueDate: timestamp('dueDate', { mode: 'date' }),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const meetingNotes = pgTable('MeetingNote', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  content: text('content'),
  meetingDate: timestamp('meetingDate', { mode: 'date' }),
  attendees: text('attendees'),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const statusReports = pgTable('StatusReport', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  content: text('content'),
  status: text('status').notNull().default('draft'),
  reportDate: timestamp('reportDate', { mode: 'date' }),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const microsoftConnections = pgTable('MicrosoftConnection', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  microsoftId: text('microsoftId'),
  email: text('email'),
  displayName: text('displayName'),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  expiresAt: timestamp('expiresAt', { mode: 'date' }),
  scopes: text('scopes'),
  accountType: text('accountType').notNull().default('personal'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const calendarEvents = pgTable('CalendarEvent', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connectionId').notNull().references(() => microsoftConnections.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  microsoftId: text('microsoftId').notNull().unique(),
  subject: text('subject'),
  bodyPreview: text('bodyPreview'),
  startDateTime: timestamp('startDateTime', { mode: 'date' }).notNull(),
  endDateTime: timestamp('endDateTime', { mode: 'date' }).notNull(),
  isAllDay: boolean('isAllDay').notNull().default(false),
  location: text('location'),
  organizer: text('organizer'),
  attendees: text('attendees'),
  onlineMeetingUrl: text('onlineMeetingUrl'),
  webLink: text('webLink'),
  isRecurring: boolean('isRecurring').notNull().default(false),
  recurrencePattern: text('recurrencePattern'),
  lastSyncedAt: timestamp('lastSyncedAt', { mode: 'date' }).notNull().default(sql`now()`),
  linkedTaskId: text('linkedTaskId').unique(),
  syncDirection: text('syncDirection').notNull().default('toCalendar'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const emailTasks = pgTable('EmailTask', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connectionId').notNull().references(() => microsoftConnections.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  microsoftId: text('microsoftId').notNull().unique(),
  subject: text('subject'),
  fromEmail: text('fromEmail'),
  fromName: text('fromName'),
  receivedAt: timestamp('receivedAt', { mode: 'date' }).notNull(),
  preview: text('preview'),
  webLink: text('webLink'),
  aiSummary: text('aiSummary'),
  suggestedPriority: integer('suggestedPriority'),
  suggestedDueDate: timestamp('suggestedDueDate', { mode: 'date' }),
  status: text('status').notNull().default('pending'),
  convertedTaskId: text('convertedTaskId').unique(),
  convertedAt: timestamp('convertedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const actionedEmails = pgTable('ActionedEmail', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  microsoftEmailId: text('microsoftEmailId').notNull(),
  subject: text('subject'),
  actionedAt: timestamp('actionedAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const emailScanRules = pgTable('EmailScanRule', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('domain'),
  value: text('value').notNull(),
  label: text('label'),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const emailDigests = pgTable('EmailDigest', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: text('connectionId').notNull().references(() => microsoftConnections.id, { onDelete: 'cascade' }),
  scanDate: text('scanDate').notNull(),
  totalScanned: integer('totalScanned').notNull().default(0),
  clientEmailCount: integer('clientEmailCount').notNull().default(0),
  noReplyFiltered: integer('noReplyFiltered').notNull().default(0),
  missedReplyCount: integer('missedReplyCount').notNull().default(0),
  needsReplyCount: integer('needsReplyCount').notNull().default(0),
  followUpCount: integer('followUpCount').notNull().default(0),
  readAgainCount: integer('readAgainCount').notNull().default(0),
  missedReplies: text('missedReplies').notNull().default('[]'),
  needsReply: text('needsReply').notNull().default('[]'),
  followUp: text('followUp').notNull().default('[]'),
  readAgain: text('readAgain').notNull().default('[]'),
  aiSummary: text('aiSummary'),
  status: text('status').notNull().default('pending'),
  errorMessage: text('errorMessage'),
  startedAt: timestamp('startedAt', { mode: 'date' }),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const syncLogs = pgTable('SyncLog', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull(),
  connectionId: text('connectionId'),
  syncType: text('syncType').notNull(),
  direction: text('direction').notNull(),
  status: text('status').notNull(),
  recordsProcessed: integer('recordsProcessed').notNull().default(0),
  recordsCreated: integer('recordsCreated').notNull().default(0),
  recordsUpdated: integer('recordsUpdated').notNull().default(0),
  recordsSkipped: integer('recordsSkipped').notNull().default(0),
  errorMessage: text('errorMessage'),
  startedAt: timestamp('startedAt', { mode: 'date' }).notNull().default(sql`now()`),
  completedAt: timestamp('completedAt', { mode: 'date' }),
})

export const dailyBriefings = pgTable('DailyBriefing', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  briefingDate: text('briefingDate').notNull(),
  data: text('data').notNull(),
  generatedAt: timestamp('generatedAt', { mode: 'date' }).notNull().default(sql`now()`),
  refreshCount: integer('refreshCount').notNull().default(0),
  isFromCache: boolean('isFromCache').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const clickUpConnections = pgTable('ClickUpConnection', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken').notNull(),
  tokenType: text('tokenType').notNull().default('Bearer'),
  scopes: text('scopes'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const clickUpWorkspaceConnections = pgTable('ClickUpWorkspaceConnection', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connectionId').notNull().references(() => clickUpConnections.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: text('teamId').notNull(),
  teamName: text('teamName').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  syncEnabled: boolean('syncEnabled').notNull().default(true),
  lastSyncedAt: timestamp('lastSyncedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const clickUpReports = pgTable('ClickUpReport', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connectionId').notNull().references(() => clickUpConnections.id, { onDelete: 'cascade' }),
  workspaceId: text('workspaceId').notNull(),
  workspaceName: text('workspaceName').notNull(),
  workspaceConnectionId: text('workspaceConnectionId').references(() => clickUpWorkspaceConnections.id, { onDelete: 'set null' }),
  rawData: text('rawData').notNull(),
  analysis: text('analysis').notNull(),
  taskCount: integer('taskCount').notNull().default(0),
  overdueCount: integer('overdueCount').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const dailyLogs = pgTable('DailyLog', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  intention: text('intention'),
  eodNote: text('eodNote'),
  completedCount: integer('completedCount').notNull().default(0),
  deferredCount: integer('deferredCount').notNull().default(0),
  morningDone: boolean('morningDone').notNull().default(false),
  eodDone: boolean('eodDone').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const timeBlocks = pgTable('TimeBlock', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: text('taskId'),
  title: text('title').notNull(),
  startTime: text('startTime').notNull(),
  endTime: text('endTime').notNull(),
  date: text('date').notNull(),
  color: text('color').notNull().default('violet'),
  note: text('note'),
  isCalendarEvent: boolean('isCalendarEvent').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

export const focusSessions = pgTable('FocusSession', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: text('taskId'),
  taskLabel: text('taskLabel').notNull(),
  plannedMins: integer('plannedMins').notNull(),
  actualMins: integer('actualMins').notNull().default(0),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  wasCompleted: boolean('wasCompleted').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const capturedNotes = pgTable('CapturedNote', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  type: text('type').notNull().default('note'),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
})

export const sprints = pgTable('Sprint', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  goal: text('goal'),
  startDate: timestamp('startDate', { mode: 'date' }).notNull(),
  endDate: timestamp('endDate', { mode: 'date' }).notNull(),
  isActive: boolean('isActive').notNull().default(false),
  isCompleted: boolean('isCompleted').notNull().default(false),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
})

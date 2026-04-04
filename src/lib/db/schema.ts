import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  real,
  unique,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// ─── Helper ──────────────────────────────────────────────────────────────────

const id = () => text('id').primaryKey().$defaultFn(() => createId())
const now = () => timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date())
    .defaultNow()

// ─── Auth / User tables ───────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: now(),
  updatedAt: updatedAt(),
})

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [unique().on(t.provider, t.providerAccountId)],
)

export const sessions = pgTable('sessions', {
  id: id(),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    otp: text('otp').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date' }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: now(),
  },
  (t) => [index('prt_user_idx').on(t.userId), index('prt_email_idx').on(t.email)],
)

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: id(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6366f1'),
    userId: text('user_id').notNull(),
    isInbox: boolean('is_inbox').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: now(),
    updatedAt: updatedAt(),
    healthStatus: text('health_status').notNull().default('green'),
    healthScore: integer('health_score').notNull().default(100),
    healthSummary: text('health_summary'),
    lastHealthCheckAt: timestamp('last_health_check_at', { mode: 'date' }),
    clickupSpaceId: text('clickup_space_id'),
    clickupSpaceName: text('clickup_space_name'),
    clickupTeamId: text('clickup_team_id'),
    clickupWorkspaceConnectionId: text('clickup_workspace_connection_id'),
  },
  (t) => [index('proj_user_clickup_idx').on(t.userId, t.clickupSpaceId)],
)

// ─── Labels ───────────────────────────────────────────────────────────────────

export const labels = pgTable('labels', {
  id: id(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  userId: text('user_id').notNull(),
  createdAt: now(),
})

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    title: text('title').notNull(),
    notes: text('notes'),
    dueDate: timestamp('due_date', { mode: 'date' }),
    dueTime: text('due_time'),
    priority: integer('priority').notNull().default(4),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
    sortOrder: integer('sort_order').notNull().default(0),
    userId: text('user_id').notNull(),
    projectId: text('project_id'),
    parentId: text('parent_id'),
    assigneeName: text('assignee_name'),
    waitingOn: text('waiting_on'),
    approvalStatus: text('approval_status'),
    blockedAt: timestamp('blocked_at', { mode: 'date' }),
    recurrenceRule: text('recurrence_rule'),
    recurrenceInterval: integer('recurrence_interval'),
    recurrenceDays: text('recurrence_days'),
    recurrenceEndDate: timestamp('recurrence_end_date', { mode: 'date' }),
    recurringParentId: text('recurring_parent_id'),
    depth: integer('depth').notNull().default(0),
    estimatedHours: real('estimated_hours'),
    status: text('status').notNull().default('TODO'),
    kanbanColumnId: text('kanban_column_id'),
    sprintId: text('sprint_id'),
    createdAt: now(),
    updatedAt: updatedAt(),
    clickupTaskId: text('clickup_task_id'),
    clickupListId: text('clickup_list_id'),
    clickupSpaceId: text('clickup_space_id'),
    clickupUrl: text('clickup_url'),
    clickupStatus: text('clickup_status'),
    clickupAssignees: text('clickup_assignees'),
    importedAt: timestamp('imported_at', { mode: 'date' }),
  },
  (t) => [
    index('task_user_due_idx').on(t.userId, t.dueDate),
    index('task_user_completed_idx').on(t.userId, t.completed),
    index('task_user_deleted_idx').on(t.userId, t.isDeleted),
    index('task_user_status_idx').on(t.userId, t.status),
    index('task_sprint_idx').on(t.sprintId),
    unique('task_user_clickup_unique').on(t.userId, t.clickupTaskId),
  ],
)

export const taskLabels = pgTable(
  'task_labels',
  {
    taskId: text('task_id').notNull(),
    labelId: text('label_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
)

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: id(),
    blockedTaskId: text('blocked_task_id').notNull(),
    blockingTaskId: text('blocking_task_id').notNull(),
  },
  (t) => [unique().on(t.blockedTaskId, t.blockingTaskId)],
)

// ─── Time logs ────────────────────────────────────────────────────────────────

export const timeLogs = pgTable(
  'time_logs',
  {
    id: id(),
    taskId: text('task_id').notNull(),
    userId: text('user_id').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    note: text('note'),
    loggedAt: timestamp('logged_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('tl_task_idx').on(t.taskId),
    index('tl_user_logged_idx').on(t.userId, t.loggedAt),
  ],
)

// ─── Kanban ───────────────────────────────────────────────────────────────────

export const kanbanColumns = pgTable(
  'kanban_columns',
  {
    id: id(),
    name: text('name').notNull(),
    projectId: text('project_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    color: text('color').notNull().default('#6366f1'),
  },
  (t) => [index('kc_project_idx').on(t.projectId)],
)

// ─── Milestones ───────────────────────────────────────────────────────────────

export const milestones = pgTable('milestones', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  targetDate: timestamp('target_date', { mode: 'date' }).notNull(),
  projectId: text('project_id').notNull(),
  createdAt: now(),
  updatedAt: updatedAt(),
})

export const milestoneTasks = pgTable(
  'milestone_tasks',
  {
    milestoneId: text('milestone_id').notNull(),
    taskId: text('task_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.milestoneId, t.taskId] })],
)

// ─── Sprints ──────────────────────────────────────────────────────────────────

export const sprints = pgTable(
  'sprints',
  {
    id: id(),
    name: text('name').notNull(),
    goal: text('goal'),
    startDate: timestamp('start_date', { mode: 'date' }).notNull(),
    endDate: timestamp('end_date', { mode: 'date' }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    isCompleted: boolean('is_completed').notNull().default(false),
    projectId: text('project_id').notNull(),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sprint_project_idx').on(t.projectId)],
)

// ─── Risks ────────────────────────────────────────────────────────────────────

export const risks = pgTable(
  'risks',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    probability: integer('probability').notNull().default(3),
    impact: integer('impact').notNull().default(3),
    score: integer('score').notNull().default(9),
    status: text('status').notNull().default('open'),
    owner: text('owner'),
    mitigationPlan: text('mitigation_plan'),
    dueDate: timestamp('due_date', { mode: 'date' }),
    source: text('source').notNull().default('manual'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('risk_user_status_idx').on(t.userId, t.status),
    index('risk_project_idx').on(t.projectId),
  ],
)

// ─── Decision logs ────────────────────────────────────────────────────────────

export const decisionLogs = pgTable(
  'decision_logs',
  {
    id: id(),
    title: text('title').notNull(),
    context: text('context'),
    optionsConsidered: text('options_considered'),
    decision: text('decision').notNull(),
    impact: text('impact'),
    owner: text('owner'),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    decidedAt: timestamp('decided_at', { mode: 'date' }).notNull().defaultNow(),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('dl_project_idx').on(t.projectId),
    index('dl_user_idx').on(t.userId),
  ],
)

// ─── Scope changes ────────────────────────────────────────────────────────────

export const scopeChanges = pgTable(
  'scope_changes',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    category: text('category').notNull().default('change_request'),
    impactLevel: text('impact_level').notNull().default('medium'),
    approvalStatus: text('approval_status').notNull().default('pending'),
    timelineImpact: text('timeline_impact'),
    effortHours: real('effort_hours'),
    requestedBy: text('requested_by'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('sc_project_idx').on(t.projectId),
    index('sc_user_status_idx').on(t.userId, t.approvalStatus),
  ],
)

// ─── Approval items ───────────────────────────────────────────────────────────

export const approvalItems = pgTable(
  'approval_items',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    approver: text('approver'),
    status: text('status').notNull().default('pending'),
    dueDate: timestamp('due_date', { mode: 'date' }),
    taskId: text('task_id'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('ai_project_idx').on(t.projectId),
    index('ai_user_status_idx').on(t.userId, t.status),
  ],
)

// ─── Meeting notes ────────────────────────────────────────────────────────────

export const meetingNotes = pgTable(
  'meeting_notes',
  {
    id: id(),
    title: text('title').notNull(),
    rawNotes: text('raw_notes').notNull(),
    summary: text('summary'),
    decisions: text('decisions'),
    actionItems: text('action_items'),
    meetingDate: timestamp('meeting_date', { mode: 'date' }).notNull().defaultNow(),
    projectId: text('project_id'),
    userId: text('user_id').notNull(),
    source: text('source').notNull().default('manual'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('mn_user_date_idx').on(t.userId, t.meetingDate),
    index('mn_project_idx').on(t.projectId),
  ],
)

// ─── Status reports ───────────────────────────────────────────────────────────

export const statusReports = pgTable(
  'status_reports',
  {
    id: id(),
    title: text('title').notNull(),
    projectId: text('project_id'),
    userId: text('user_id').notNull(),
    audience: text('audience').notNull().default('stakeholders'),
    reportType: text('report_type').notNull().default('weekly'),
    content: text('content').notNull(),
    summary: text('summary'),
    generatedBy: text('generated_by').notNull().default('ai'),
    periodStart: timestamp('period_start', { mode: 'date' }),
    periodEnd: timestamp('period_end', { mode: 'date' }),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('sr_user_created_idx').on(t.userId, t.createdAt),
    index('sr_project_idx').on(t.projectId),
  ],
)

// ─── Microsoft ────────────────────────────────────────────────────────────────

export const microsoftConnections = pgTable(
  'microsoft_connections',
  {
    id: id(),
    userId: text('user_id').notNull().unique(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
    tokenType: text('token_type').notNull().default('Bearer'),
    scopes: text('scopes'),
    microsoftId: text('microsoft_id').notNull(),
    email: text('email'),
    displayName: text('display_name'),
    accountType: text('account_type').notNull().default('personal'),
    syncEmailsEnabled: boolean('sync_emails_enabled').notNull().default(true),
    syncCalendarEnabled: boolean('sync_calendar_enabled').notNull().default(true),
    lastEmailSyncAt: timestamp('last_email_sync_at', { mode: 'date' }),
    lastCalendarSyncAt: timestamp('last_calendar_sync_at', { mode: 'date' }),
    lastSyncError: text('last_sync_error'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('mc_user_idx').on(t.userId),
    index('mc_ms_id_idx').on(t.microsoftId),
  ],
)

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: id(),
    connectionId: text('connection_id').notNull(),
    userId: text('user_id').notNull(),
    microsoftId: text('microsoft_id').notNull().unique(),
    subject: text('subject'),
    bodyPreview: text('body_preview'),
    startDateTime: timestamp('start_date_time', { mode: 'date' }).notNull(),
    endDateTime: timestamp('end_date_time', { mode: 'date' }).notNull(),
    isAllDay: boolean('is_all_day').notNull().default(false),
    location: text('location'),
    organizerEmail: text('organizer_email'),
    webLink: text('web_link'),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrencePattern: text('recurrence_pattern'),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }).notNull().defaultNow(),
    linkedTaskId: text('linked_task_id').unique(),
    syncDirection: text('sync_direction').notNull().default('toCalendar'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('ce_connection_idx').on(t.connectionId),
    index('ce_user_start_idx').on(t.userId, t.startDateTime),
  ],
)

export const emailTasks = pgTable(
  'email_tasks',
  {
    id: id(),
    connectionId: text('connection_id').notNull(),
    userId: text('user_id').notNull(),
    microsoftId: text('microsoft_id').notNull().unique(),
    subject: text('subject'),
    fromEmail: text('from_email'),
    fromName: text('from_name'),
    receivedAt: timestamp('received_at', { mode: 'date' }).notNull(),
    preview: text('preview'),
    webLink: text('web_link'),
    aiSummary: text('ai_summary'),
    suggestedPriority: integer('suggested_priority'),
    suggestedDueDate: timestamp('suggested_due_date', { mode: 'date' }),
    status: text('status').notNull().default('pending'),
    convertedTaskId: text('converted_task_id').unique(),
    convertedAt: timestamp('converted_at', { mode: 'date' }),
    createdAt: now(),
  },
  (t) => [
    index('et_connection_idx').on(t.connectionId),
    index('et_user_status_idx').on(t.userId, t.status),
  ],
)

export const actionedEmails = pgTable(
  'actioned_emails',
  {
    id: id(),
    userId: text('user_id').notNull(),
    microsoftEmailId: text('microsoft_email_id').notNull(),
    subject: text('subject'),
    actionedAt: timestamp('actioned_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.microsoftEmailId),
    index('ae_user_idx').on(t.userId),
  ],
)

export const emailScanRules = pgTable(
  'email_scan_rules',
  {
    id: id(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('domain'),
    value: text('value').notNull(),
    label: text('label'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: now(),
  },
  (t) => [index('esr_user_idx').on(t.userId)],
)

export const emailDigests = pgTable(
  'email_digests',
  {
    id: id(),
    userId: text('user_id').notNull(),
    connectionId: text('connection_id').notNull(),
    scanDate: text('scan_date').notNull(),
    totalScanned: integer('total_scanned').notNull().default(0),
    clientEmailCount: integer('client_email_count').notNull().default(0),
    noReplyFiltered: integer('no_reply_filtered').notNull().default(0),
    missedReplyCount: integer('missed_reply_count').notNull().default(0),
    needsReplyCount: integer('needs_reply_count').notNull().default(0),
    followUpCount: integer('follow_up_count').notNull().default(0),
    readAgainCount: integer('read_again_count').notNull().default(0),
    missedReplies: text('missed_replies').notNull().default('[]'),
    needsReply: text('needs_reply').notNull().default('[]'),
    followUp: text('follow_up').notNull().default('[]'),
    readAgain: text('read_again').notNull().default('[]'),
    aiSummary: text('ai_summary'),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { mode: 'date' }),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { mode: 'date' }),
  },
  (t) => [
    index('ed_user_idx').on(t.userId),
    index('ed_user_date_idx').on(t.userId, t.scanDate),
  ],
)

// ─── Sync logs ────────────────────────────────────────────────────────────────

export const syncLogs = pgTable(
  'sync_logs',
  {
    id: id(),
    userId: text('user_id').notNull(),
    connectionId: text('connection_id'),
    syncType: text('sync_type').notNull(),
    direction: text('direction').notNull(),
    status: text('status').notNull(),
    recordsProcessed: integer('records_processed').notNull().default(0),
    recordsCreated: integer('records_created').notNull().default(0),
    recordsUpdated: integer('records_updated').notNull().default(0),
    recordsSkipped: integer('records_skipped').notNull().default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { mode: 'date' }),
  },
  (t) => [index('sl_user_type_started_idx').on(t.userId, t.syncType, t.startedAt)],
)

// ─── Daily briefing ───────────────────────────────────────────────────────────

export const dailyBriefings = pgTable(
  'daily_briefings',
  {
    id: id(),
    userId: text('user_id').notNull(),
    briefingDate: text('briefing_date').notNull(),
    data: text('data').notNull(),
    generatedAt: timestamp('generated_at', { mode: 'date' }).notNull().defaultNow(),
    refreshCount: integer('refresh_count').notNull().default(0),
    isFromCache: boolean('is_from_cache').notNull().default(false),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.userId, t.briefingDate),
    index('db_user_idx').on(t.userId),
  ],
)

// ─── ClickUp ──────────────────────────────────────────────────────────────────

export const clickUpConnections = pgTable(
  'click_up_connections',
  {
    id: id(),
    userId: text('user_id').notNull().unique(),
    accessToken: text('access_token').notNull(),
    tokenType: text('token_type').notNull().default('Bearer'),
    scopes: text('scopes'),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index('cuc_user_idx').on(t.userId)],
)

export const clickUpWorkspaceConnections = pgTable(
  'click_up_workspace_connections',
  {
    id: id(),
    connectionId: text('connection_id').notNull(),
    userId: text('user_id').notNull(),
    teamId: text('team_id').notNull(),
    teamName: text('team_name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.userId, t.teamId),
    index('cuwc_user_idx').on(t.userId),
    index('cuwc_connection_idx').on(t.connectionId),
  ],
)

export const clickUpReports = pgTable(
  'click_up_reports',
  {
    id: id(),
    connectionId: text('connection_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    workspaceName: text('workspace_name').notNull(),
    workspaceConnectionId: text('workspace_connection_id'),
    rawData: text('raw_data').notNull(),
    analysis: text('analysis').notNull(),
    taskCount: integer('task_count').notNull().default(0),
    overdueCount: integer('overdue_count').notNull().default(0),
    createdAt: now(),
  },
  (t) => [
    index('cur_connection_idx').on(t.connectionId),
    index('cur_wsc_idx').on(t.workspaceConnectionId),
  ],
)

// ─── Daily logs ───────────────────────────────────────────────────────────────

export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: id(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    intention: text('intention'),
    eodNote: text('eod_note'),
    completedCount: integer('completed_count').notNull().default(0),
    deferredCount: integer('deferred_count').notNull().default(0),
    morningDone: boolean('morning_done').notNull().default(false),
    eodDone: boolean('eod_done').notNull().default(false),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.userId, t.date), index('dl2_user_idx').on(t.userId)],
)

// ─── Time blocks ──────────────────────────────────────────────────────────────

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: id(),
    userId: text('user_id').notNull(),
    taskId: text('task_id'),
    title: text('title').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    date: text('date').notNull(),
    color: text('color').notNull().default('violet'),
    note: text('note'),
    isCalendarEvent: boolean('is_calendar_event').notNull().default(false),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tb_user_date_idx').on(t.userId, t.date)],
)

// ─── Focus sessions ───────────────────────────────────────────────────────────

export const focusSessions = pgTable(
  'focus_sessions',
  {
    id: id(),
    userId: text('user_id').notNull(),
    taskId: text('task_id'),
    taskLabel: text('task_label').notNull(),
    plannedMins: integer('planned_mins').notNull(),
    actualMins: integer('actual_mins').notNull().default(0),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    wasCompleted: boolean('was_completed').notNull().default(false),
    createdAt: now(),
  },
  (t) => [index('fs_user_created_idx').on(t.userId, t.createdAt)],
)

// ─── Captured notes ───────────────────────────────────────────────────────────

export const capturedNotes = pgTable(
  'captured_notes',
  {
    id: id(),
    userId: text('user_id').notNull(),
    text: text('text').notNull(),
    type: text('type').notNull().default('note'),
    metadata: text('metadata'),
    createdAt: now(),
  },
  (t) => [index('cn_user_type_idx').on(t.userId, t.type)],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  projects: many(projects),
  tasks: many(tasks),
  labels: many(labels),
  timeLogs: many(timeLogs),
  focusSessions: many(focusSessions),
  capturedNotes: many(capturedNotes),
  dailyLogs: many(dailyLogs),
  timeBlocks: many(timeBlocks),
  risks: many(risks),
  decisionLogs: many(decisionLogs),
  scopeChanges: many(scopeChanges),
  approvalItems: many(approvalItems),
  meetingNotes: many(meetingNotes),
  statusReports: many(statusReports),
  microsoftConnection: many(microsoftConnections),
  dailyBriefings: many(dailyBriefings),
  clickUpConnection: many(clickUpConnections),
  clickUpWorkspaceConnections: many(clickUpWorkspaceConnections),
  emailDigests: many(emailDigests),
  emailScanRules: many(emailScanRules),
  actionedEmails: many(actionedEmails),
  syncLogs: many(syncLogs),
  passwordResetTokens: many(passwordResetTokens),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
  kanbanColumns: many(kanbanColumns),
  milestones: many(milestones),
  sprints: many(sprints),
  risks: many(risks),
  decisionLogs: many(decisionLogs),
  scopeChanges: many(scopeChanges),
  approvalItems: many(approvalItems),
  meetingNotes: many(meetingNotes),
  statusReports: many(statusReports),
}))

export const labelsRelations = relations(labels, ({ one, many }) => ({
  user: one(users, { fields: [labels.userId], references: [users.id] }),
  taskLabels: many(taskLabels),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  parent: one(tasks, { fields: [tasks.parentId], references: [tasks.id], relationName: 'subtasks' }),
  subtasks: many(tasks, { relationName: 'subtasks' }),
  kanbanColumn: one(kanbanColumns, { fields: [tasks.kanbanColumnId], references: [kanbanColumns.id] }),
  sprint: one(sprints, { fields: [tasks.sprintId], references: [sprints.id] }),
  labels: many(taskLabels),
  timeLogs: many(timeLogs),
  milestoneTasks: many(milestoneTasks),
  blockedBy: many(taskDependencies, { relationName: 'blockedTask' }),
  blocking: many(taskDependencies, { relationName: 'blockingTask' }),
}))

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}))

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  blockedTask: one(tasks, {
    fields: [taskDependencies.blockedTaskId],
    references: [tasks.id],
    relationName: 'blockedTask',
  }),
  blockingTask: one(tasks, {
    fields: [taskDependencies.blockingTaskId],
    references: [tasks.id],
    relationName: 'blockingTask',
  }),
}))

export const timeLogsRelations = relations(timeLogs, ({ one }) => ({
  task: one(tasks, { fields: [timeLogs.taskId], references: [tasks.id] }),
  user: one(users, { fields: [timeLogs.userId], references: [users.id] }),
}))

export const kanbanColumnsRelations = relations(kanbanColumns, ({ one, many }) => ({
  project: one(projects, { fields: [kanbanColumns.projectId], references: [projects.id] }),
  tasks: many(tasks),
}))

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(milestoneTasks),
}))

export const milestoneTasksRelations = relations(milestoneTasks, ({ one }) => ({
  milestone: one(milestones, { fields: [milestoneTasks.milestoneId], references: [milestones.id] }),
  task: one(tasks, { fields: [milestoneTasks.taskId], references: [tasks.id] }),
}))

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, { fields: [sprints.projectId], references: [projects.id] }),
  tasks: many(tasks),
}))

export const risksRelations = relations(risks, ({ one }) => ({
  project: one(projects, { fields: [risks.projectId], references: [projects.id] }),
  user: one(users, { fields: [risks.userId], references: [users.id] }),
}))

export const decisionLogsRelations = relations(decisionLogs, ({ one }) => ({
  project: one(projects, { fields: [decisionLogs.projectId], references: [projects.id] }),
  user: one(users, { fields: [decisionLogs.userId], references: [users.id] }),
}))

export const scopeChangesRelations = relations(scopeChanges, ({ one }) => ({
  project: one(projects, { fields: [scopeChanges.projectId], references: [projects.id] }),
  user: one(users, { fields: [scopeChanges.userId], references: [users.id] }),
}))

export const approvalItemsRelations = relations(approvalItems, ({ one }) => ({
  project: one(projects, { fields: [approvalItems.projectId], references: [projects.id] }),
  user: one(users, { fields: [approvalItems.userId], references: [users.id] }),
}))

export const meetingNotesRelations = relations(meetingNotes, ({ one }) => ({
  project: one(projects, { fields: [meetingNotes.projectId], references: [projects.id] }),
  user: one(users, { fields: [meetingNotes.userId], references: [users.id] }),
}))

export const statusReportsRelations = relations(statusReports, ({ one }) => ({
  project: one(projects, { fields: [statusReports.projectId], references: [projects.id] }),
  user: one(users, { fields: [statusReports.userId], references: [users.id] }),
}))

export const microsoftConnectionsRelations = relations(microsoftConnections, ({ one, many }) => ({
  user: one(users, { fields: [microsoftConnections.userId], references: [users.id] }),
  calendarEvents: many(calendarEvents),
  emailTasks: many(emailTasks),
  emailDigests: many(emailDigests),
}))

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  connection: one(microsoftConnections, {
    fields: [calendarEvents.connectionId],
    references: [microsoftConnections.id],
  }),
}))

export const emailTasksRelations = relations(emailTasks, ({ one }) => ({
  connection: one(microsoftConnections, {
    fields: [emailTasks.connectionId],
    references: [microsoftConnections.id],
  }),
}))

export const emailDigestsRelations = relations(emailDigests, ({ one }) => ({
  user: one(users, { fields: [emailDigests.userId], references: [users.id] }),
  connection: one(microsoftConnections, {
    fields: [emailDigests.connectionId],
    references: [microsoftConnections.id],
  }),
}))

export const emailScanRulesRelations = relations(emailScanRules, ({ one }) => ({
  user: one(users, { fields: [emailScanRules.userId], references: [users.id] }),
}))

export const actionedEmailsRelations = relations(actionedEmails, ({ one }) => ({
  user: one(users, { fields: [actionedEmails.userId], references: [users.id] }),
}))

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  user: one(users, { fields: [syncLogs.userId], references: [users.id] }),
}))

export const dailyBriefingsRelations = relations(dailyBriefings, ({ one }) => ({
  user: one(users, { fields: [dailyBriefings.userId], references: [users.id] }),
}))

export const clickUpConnectionsRelations = relations(clickUpConnections, ({ one, many }) => ({
  user: one(users, { fields: [clickUpConnections.userId], references: [users.id] }),
  workspaceConnections: many(clickUpWorkspaceConnections),
  reports: many(clickUpReports),
}))

export const clickUpWorkspaceConnectionsRelations = relations(
  clickUpWorkspaceConnections,
  ({ one, many }) => ({
    connection: one(clickUpConnections, {
      fields: [clickUpWorkspaceConnections.connectionId],
      references: [clickUpConnections.id],
    }),
    user: one(users, { fields: [clickUpWorkspaceConnections.userId], references: [users.id] }),
    reports: many(clickUpReports),
  }),
)

export const clickUpReportsRelations = relations(clickUpReports, ({ one }) => ({
  connection: one(clickUpConnections, {
    fields: [clickUpReports.connectionId],
    references: [clickUpConnections.id],
  }),
  workspaceConnection: one(clickUpWorkspaceConnections, {
    fields: [clickUpReports.workspaceConnectionId],
    references: [clickUpWorkspaceConnections.id],
  }),
}))

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
  user: one(users, { fields: [dailyLogs.userId], references: [users.id] }),
}))

export const timeBlocksRelations = relations(timeBlocks, ({ one }) => ({
  user: one(users, { fields: [timeBlocks.userId], references: [users.id] }),
}))

export const focusSessionsRelations = relations(focusSessions, ({ one }) => ({
  user: one(users, { fields: [focusSessions.userId], references: [users.id] }),
}))

export const capturedNotesRelations = relations(capturedNotes, ({ one }) => ({
  user: one(users, { fields: [capturedNotes.userId], references: [users.id] }),
}))

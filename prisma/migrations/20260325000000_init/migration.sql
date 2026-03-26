-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,

    PRIMARY KEY ("identifier", "token")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "userId" TEXT NOT NULL,
    "isInbox" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clickupSpaceId" TEXT,
    "clickupSpaceName" TEXT,
    "clickupTeamId" TEXT,
    "clickupWorkspaceConnectionId" TEXT,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Label_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME,
    "dueTime" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentId" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceInterval" INTEGER,
    "recurrenceDays" TEXT,
    "recurrenceEndDate" DATETIME,
    "recurringParentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "estimatedHours" REAL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "kanbanColumnId" TEXT,
    "sprintId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clickupTaskId" TEXT,
    "clickupListId" TEXT,
    "clickupSpaceId" TEXT,
    "clickupUrl" TEXT,
    "clickupStatus" TEXT,
    "clickupAssignees" TEXT,
    "importedAt" DATETIME,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_kanbanColumnId_fkey" FOREIGN KEY ("kanbanColumnId") REFERENCES "KanbanColumn" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskLabel" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    PRIMARY KEY ("taskId", "labelId"),
    CONSTRAINT "TaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockedTaskId" TEXT NOT NULL,
    "blockingTaskId" TEXT NOT NULL,
    CONSTRAINT "TaskDependency_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDependency_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilestoneTask" (
    "milestoneId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,

    PRIMARY KEY ("milestoneId", "taskId"),
    CONSTRAINT "MilestoneTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MilestoneTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "note" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KanbanColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    CONSTRAINT "KanbanColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MicrosoftConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scopes" TEXT,
    "microsoftId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'personal',
    "syncEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncCalendarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEmailSyncAt" DATETIME,
    "lastCalendarSyncAt" DATETIME,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MicrosoftConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microsoftId" TEXT NOT NULL,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "startDateTime" DATETIME NOT NULL,
    "endDateTime" DATETIME NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "organizerEmail" TEXT,
    "webLink" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrencePattern" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedTaskId" TEXT,
    "syncDirection" TEXT NOT NULL DEFAULT 'toCalendar',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MicrosoftConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEvent_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microsoftId" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "receivedAt" DATETIME NOT NULL,
    "preview" TEXT,
    "webLink" TEXT,
    "aiSummary" TEXT,
    "suggestedPriority" INTEGER,
    "suggestedDueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedTaskId" TEXT,
    "convertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTask_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MicrosoftConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailTask_convertedTaskId_fkey" FOREIGN KEY ("convertedTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailScanRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'domain',
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailScanRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "scanDate" TEXT NOT NULL,
    "totalScanned" INTEGER NOT NULL DEFAULT 0,
    "clientEmailCount" INTEGER NOT NULL DEFAULT 0,
    "missedReplies" TEXT NOT NULL DEFAULT '[]',
    "needsReply" TEXT NOT NULL DEFAULT '[]',
    "followUp" TEXT NOT NULL DEFAULT '[]',
    "noReplyFiltered" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailDigest_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MicrosoftConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "syncType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ClickUpConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scopes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClickUpConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClickUpWorkspaceConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClickUpWorkspaceConnection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClickUpConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClickUpWorkspaceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClickUpReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceName" TEXT NOT NULL,
    "workspaceConnectionId" TEXT,
    "rawData" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "taskCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickUpReport_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClickUpConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClickUpReport_workspaceConnectionId_fkey" FOREIGN KEY ("workspaceConnectionId") REFERENCES "ClickUpWorkspaceConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Project_userId_clickupSpaceId_idx" ON "Project"("userId", "clickupSpaceId");

-- CreateIndex
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_userId_completed_idx" ON "Task"("userId", "completed");

-- CreateIndex
CREATE INDEX "Task_userId_isDeleted_idx" ON "Task"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");

-- CreateIndex
CREATE INDEX "Task_userId_clickupTaskId_idx" ON "Task"("userId", "clickupTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_userId_clickupTaskId_key" ON "Task"("userId", "clickupTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_blockedTaskId_blockingTaskId_key" ON "TaskDependency"("blockedTaskId", "blockingTaskId");

-- CreateIndex
CREATE INDEX "TimeLog_taskId_idx" ON "TimeLog"("taskId");

-- CreateIndex
CREATE INDEX "TimeLog_userId_loggedAt_idx" ON "TimeLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "KanbanColumn_projectId_idx" ON "KanbanColumn"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftConnection_userId_key" ON "MicrosoftConnection"("userId");

-- CreateIndex
CREATE INDEX "MicrosoftConnection_userId_idx" ON "MicrosoftConnection"("userId");

-- CreateIndex
CREATE INDEX "MicrosoftConnection_microsoftId_idx" ON "MicrosoftConnection"("microsoftId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_microsoftId_key" ON "CalendarEvent"("microsoftId");

-- CreateIndex
CREATE INDEX "CalendarEvent_connectionId_idx" ON "CalendarEvent"("connectionId");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startDateTime_idx" ON "CalendarEvent"("userId", "startDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_linkedTaskId_key" ON "CalendarEvent"("linkedTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTask_microsoftId_key" ON "EmailTask"("microsoftId");

-- CreateIndex
CREATE INDEX "EmailTask_connectionId_idx" ON "EmailTask"("connectionId");

-- CreateIndex
CREATE INDEX "EmailTask_userId_status_idx" ON "EmailTask"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTask_convertedTaskId_key" ON "EmailTask"("convertedTaskId");

-- CreateIndex
CREATE INDEX "EmailScanRule_userId_idx" ON "EmailScanRule"("userId");

-- CreateIndex
CREATE INDEX "EmailDigest_userId_idx" ON "EmailDigest"("userId");

-- CreateIndex
CREATE INDEX "EmailDigest_userId_scanDate_idx" ON "EmailDigest"("userId", "scanDate");

-- CreateIndex
CREATE INDEX "SyncLog_userId_syncType_startedAt_idx" ON "SyncLog"("userId", "syncType", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClickUpConnection_userId_key" ON "ClickUpConnection"("userId");

-- CreateIndex
CREATE INDEX "ClickUpConnection_userId_idx" ON "ClickUpConnection"("userId");

-- CreateIndex
CREATE INDEX "ClickUpWorkspaceConnection_userId_idx" ON "ClickUpWorkspaceConnection"("userId");

-- CreateIndex
CREATE INDEX "ClickUpWorkspaceConnection_connectionId_idx" ON "ClickUpWorkspaceConnection"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClickUpWorkspaceConnection_userId_teamId_key" ON "ClickUpWorkspaceConnection"("userId", "teamId");

-- CreateIndex
CREATE INDEX "ClickUpReport_connectionId_idx" ON "ClickUpReport"("connectionId");

-- CreateIndex
CREATE INDEX "ClickUpReport_workspaceConnectionId_idx" ON "ClickUpReport"("workspaceConnectionId");

-- CreateIndex
CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");

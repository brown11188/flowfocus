-- Add missing columns to Project
ALTER TABLE "Project" ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'green';
ALTER TABLE "Project" ADD COLUMN "healthScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Project" ADD COLUMN "healthSummary" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastHealthCheckAt" DATETIME;

-- Add missing columns to Task
ALTER TABLE "Task" ADD COLUMN "assigneeName" TEXT;
ALTER TABLE "Task" ADD COLUMN "waitingOn" TEXT;
ALTER TABLE "Task" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "Task" ADD COLUMN "blockedAt" DATETIME;

-- CreateTable: Risk
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "score" INTEGER NOT NULL DEFAULT 9,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT,
    "mitigationPlan" TEXT,
    "dueDate" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: DecisionLog
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "optionsConsidered" TEXT,
    "decision" TEXT NOT NULL,
    "impact" TEXT,
    "owner" TEXT,
    "projectId" TEXT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: ScopeChange
CREATE TABLE "ScopeChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "category" TEXT NOT NULL DEFAULT 'change_request',
    "impactLevel" TEXT NOT NULL DEFAULT 'medium',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "timelineImpact" TEXT,
    "effortHours" REAL,
    "requestedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: ApprovalItem
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "approver" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME,
    "taskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: MeetingNote
CREATE TABLE "MeetingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "rawNotes" TEXT NOT NULL,
    "summary" TEXT,
    "decisions" TEXT,
    "actionItems" TEXT,
    "meetingDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: StatusReport
CREATE TABLE "StatusReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectId" TEXT REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "audience" TEXT NOT NULL DEFAULT 'stakeholders',
    "reportType" TEXT NOT NULL DEFAULT 'weekly',
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'ai',
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex: Risk
CREATE INDEX "Risk_userId_status_idx" ON "Risk"("userId", "status");
CREATE INDEX "Risk_projectId_idx" ON "Risk"("projectId");

-- CreateIndex: DecisionLog
CREATE INDEX "DecisionLog_projectId_idx" ON "DecisionLog"("projectId");
CREATE INDEX "DecisionLog_userId_idx" ON "DecisionLog"("userId");

-- CreateIndex: ScopeChange
CREATE INDEX "ScopeChange_projectId_idx" ON "ScopeChange"("projectId");
CREATE INDEX "ScopeChange_userId_approvalStatus_idx" ON "ScopeChange"("userId", "approvalStatus");

-- CreateIndex: ApprovalItem
CREATE INDEX "ApprovalItem_projectId_idx" ON "ApprovalItem"("projectId");
CREATE INDEX "ApprovalItem_userId_status_idx" ON "ApprovalItem"("userId", "status");

-- CreateIndex: MeetingNote
CREATE INDEX "MeetingNote_userId_meetingDate_idx" ON "MeetingNote"("userId", "meetingDate");
CREATE INDEX "MeetingNote_projectId_idx" ON "MeetingNote"("projectId");

-- CreateIndex: StatusReport
CREATE INDEX "StatusReport_userId_createdAt_idx" ON "StatusReport"("userId", "createdAt");
CREATE INDEX "StatusReport_projectId_idx" ON "StatusReport"("projectId");

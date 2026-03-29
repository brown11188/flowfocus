-- CreateTable: ActionedEmail — emails marked as actioned by user
CREATE TABLE IF NOT EXISTS "ActionedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "microsoftEmailId" TEXT NOT NULL,
    "subject" TEXT,
    "actionedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActionedEmail_userId_microsoftEmailId_key" ON "ActionedEmail"("userId", "microsoftEmailId");
CREATE INDEX IF NOT EXISTS "ActionedEmail_userId_idx" ON "ActionedEmail"("userId");

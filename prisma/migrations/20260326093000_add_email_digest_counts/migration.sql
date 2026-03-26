-- Add true count columns (never capped by preview slice)
-- SQLite: ADD COLUMN only supports constant defaults; non-constant expressions forbidden
ALTER TABLE "EmailDigest" ADD COLUMN "missedReplyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "needsReplyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "readAgainCount" INTEGER NOT NULL DEFAULT 0;

-- Add updatedAt column required by Prisma @updatedAt
-- NULL default is a constant and is safe for ADD COLUMN in SQLite
ALTER TABLE "EmailDigest" ADD COLUMN "updatedAt" DATETIME;

-- Back-fill counts from existing preview JSON arrays
-- Run as a separate statement AFTER all ADD COLUMNs complete
UPDATE "EmailDigest"
SET
  "missedReplyCount" = json_array_length("missedReplies"),
  "needsReplyCount"  = json_array_length("needsReply"),
  "followUpCount"    = json_array_length("followUp"),
  "readAgainCount"   = json_array_length("readAgain")
WHERE "status" = 'done';

-- Back-fill updatedAt separately (datetime() is a function call, not a constant)
-- Must be a standalone UPDATE to avoid SQLite ADD COLUMN restriction
UPDATE "EmailDigest"
SET "updatedAt" = createdAt
WHERE "updatedAt" IS NULL;

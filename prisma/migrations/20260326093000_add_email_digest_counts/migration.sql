-- Add true count columns (never capped by preview slice)
ALTER TABLE "EmailDigest" ADD COLUMN "missedReplyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "needsReplyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailDigest" ADD COLUMN "readAgainCount" INTEGER NOT NULL DEFAULT 0;

-- Add updatedAt column required by Prisma @updatedAt
-- SQLite: must be nullable when using ADD COLUMN (non-constant defaults not supported)
ALTER TABLE "EmailDigest" ADD COLUMN "updatedAt" DATETIME;

-- Back-fill counts from existing preview JSON arrays (SQLite-compatible syntax)
UPDATE "EmailDigest"
SET
  "missedReplyCount" = json_array_length("missedReplies"),
  "needsReplyCount"  = json_array_length("needsReply"),
  "followUpCount"    = json_array_length("followUp"),
  "readAgainCount"   = json_array_length("readAgain"),
  "updatedAt"        = datetime("createdAt")
WHERE "status" = 'done';

-- Add soft-delete columns to User, Group and Wod
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Group" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Wod" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Replace total unique constraints with partial unique indexes (WHERE "deletedAt" IS NULL)
-- so that soft-deleted rows do not block reuse of email / memberNumber / group name.
-- Note: these were created as CONSTRAINT (not plain index) so we use DROP CONSTRAINT.

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_gymId_key";
DROP INDEX IF EXISTS "User_email_gymId_key";
CREATE UNIQUE INDEX "User_email_gymId_key" ON "User"("email", "gymId") WHERE "deletedAt" IS NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_gymId_memberNumber_key";
DROP INDEX IF EXISTS "User_gymId_memberNumber_key";
CREATE UNIQUE INDEX "User_gymId_memberNumber_key" ON "User"("gymId", "memberNumber") WHERE "deletedAt" IS NULL AND "memberNumber" IS NOT NULL;

ALTER TABLE "Group" DROP CONSTRAINT IF EXISTS "Group_teacherId_name_key";
DROP INDEX IF EXISTS "Group_teacherId_name_key";
CREATE UNIQUE INDEX "Group_teacherId_name_key" ON "Group"("teacherId", "name") WHERE "deletedAt" IS NULL;

-- Non-unique indexes matching @@index declarations in schema.prisma.
CREATE INDEX "User_email_gymId_idx" ON "User"("email", "gymId");
CREATE INDEX "User_gymId_memberNumber_idx" ON "User"("gymId", "memberNumber");
CREATE INDEX "User_gymId_deletedAt_idx" ON "User"("gymId", "deletedAt");
CREATE INDEX "Group_teacherId_name_idx" ON "Group"("teacherId", "name");

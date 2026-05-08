-- AlterTable: add nextPaymentDate to JoinRequest with backfill from createdAt.
-- Step 1: add column with a temporary default so the NOT NULL constraint is
-- satisfied for existing rows.
ALTER TABLE "JoinRequest" ADD COLUMN "nextPaymentDate" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Step 2: backfill historical rows. Audit-only — all current rows are APPROVED
-- so this value is informational; their User.nextPaymentDate is the source of
-- truth from now on.
UPDATE "JoinRequest" SET "nextPaymentDate" = "createdAt"::date;

-- Step 3: drop the default. From this migration onward every new row must
-- supply nextPaymentDate explicitly (the public form enforces this).
ALTER TABLE "JoinRequest" ALTER COLUMN "nextPaymentDate" DROP DEFAULT;

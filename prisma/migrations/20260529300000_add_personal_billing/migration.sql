-- Migration: add personal billing support
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- Adds nullable columns to User, new SignupRequestType enum,
-- type column on GymSignupRequest, makes gym-specific fields nullable,
-- adds 4 new EmailLogType values, and backfills pre-existing Personal users as exempt.

-- Step 1: User — add 4 nullable billing columns

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatusChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- Step 2: New enum SignupRequestType

CREATE TYPE "SignupRequestType" AS ENUM ('GYM', 'PERSONAL');

-- Step 3: GymSignupRequest — add type column with default GYM

ALTER TABLE "GymSignupRequest" ADD COLUMN IF NOT EXISTS "type" "SignupRequestType" NOT NULL DEFAULT 'GYM';

-- Step 4: GymSignupRequest — make gym-specific fields nullable

ALTER TABLE "GymSignupRequest" ALTER COLUMN "gymName" DROP NOT NULL;
ALTER TABLE "GymSignupRequest" ALTER COLUMN "gymKindSuggested" DROP NOT NULL;

-- Step 5: EmailLogType — add 4 new values (idempotent)

ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PERSONAL_LEAD_RECEIVED';
ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PERSONAL_LEAD_APPROVED';
ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PERSONAL_LEAD_REJECTED';
ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PERSONAL_PAYMENT_FAILED';

-- Step 6: Backfill — mark pre-existing Personal users as exempt
-- Only marks users that are not already exempt to preserve manual exemptions.

UPDATE "User"
SET "paymentExempt" = true,
    "paymentExemptReason" = 'Usuario Wody Personal pre-existente al lanzamiento del modelo de cobro (2026-05)'
WHERE "gymId" = (SELECT "id" FROM "Gym" WHERE "kind" = 'PERSONAL' LIMIT 1)
  AND "role" = 'STUDENT'
  AND "canCreateOwnRoutines" = true
  AND "deletedAt" IS NULL
  AND "createdAt" < CURRENT_TIMESTAMP
  AND "paymentExempt" = false;

-- Migration: add SUPERADMIN role, make User.gymId nullable, add subscription fields to Gym
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- 1. ALTER TYPE to add SUPERADMIN: PostgreSQL ALTER TYPE … ADD VALUE is safe and
--    does not lock the table. The new value is immediately usable.
-- 2. ALTER TABLE "User" ALTER COLUMN "gymId" DROP NOT NULL: metadata-only in
--    PostgreSQL — no table rewrite, no data loss. Existing rows keep their gymId.
-- 3. ALTER TABLE "Gym" ADD COLUMN: adds nullable columns with no default —
--    safe, no table rewrite, existing rows get NULL (which is the intended state).

-- Step 1: Add SUPERADMIN to the Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- Step 2: Make User.gymId nullable (existing rows are unaffected — their gymId stays set)
ALTER TABLE "User" ALTER COLUMN "gymId" DROP NOT NULL;

-- Step 3: Add subscription columns to Gym (both nullable, no default)
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "subscriptionNextPaymentDate" TIMESTAMP(3);
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "subscriptionMonthlyAmount" INTEGER;

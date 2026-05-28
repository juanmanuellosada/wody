-- Migration: add gym billing fields (trial, payment exemption, MP subscription)
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- All new columns are either nullable or have a default — no table rewrite,
-- existing rows get NULL / default values immediately.
-- The UPDATE at the end marks all pre-existing gyms as exempt in the same
-- transaction, so there is no window where an existing gym could be blocked.

-- Step 1: Change subscriptionMonthlyAmount to have a default of 60000
ALTER TABLE "Gym" ALTER COLUMN "subscriptionMonthlyAmount" SET DEFAULT 60000;

-- Step 2: Add billing fields (all nullable or boolean with default)
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "trialEndsAt"          TIMESTAMP(3);
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "paymentExempt"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "paymentExemptReason"   TEXT;
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "mpPreapprovalId"       TEXT;
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatus"  TEXT;

-- Step 3: Mark all pre-existing gyms as exempt (data-migration, same transaction)
UPDATE "Gym"
SET    "paymentExempt"       = true,
       "paymentExemptReason" = 'Gym pre-existente al lanzamiento del modelo de cobro (2026-05)'
WHERE  "createdAt" < CURRENT_TIMESTAMP;

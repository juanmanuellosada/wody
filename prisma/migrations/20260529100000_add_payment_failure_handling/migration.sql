-- Migration: add payment failure handling
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- Only adds a nullable column and a new enum value. No existing data is touched.

-- Step 1: New nullable column on Gym for tracking when mpSubscriptionStatus last changed

ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatusChangedAt" TIMESTAMP(3);

-- Step 2: New EmailLogType value for payment-failed emails

ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';

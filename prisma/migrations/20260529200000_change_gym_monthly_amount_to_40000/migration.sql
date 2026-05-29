-- Migration: change_gym_monthly_amount_to_40000
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- Changes the default of subscriptionMonthlyAmount from 60000 to 40000,
-- and updates existing gyms that had the old default to the new price.
-- Gyms with custom negotiated amounts (anything other than exactly 60000)
-- and gyms with NULL are preserved as-is.

-- Step 1: Change the column default
ALTER TABLE "Gym" ALTER COLUMN "subscriptionMonthlyAmount" SET DEFAULT 40000;

-- Step 2: Update rows that had exactly the old default value
UPDATE "Gym" SET "subscriptionMonthlyAmount" = 40000 WHERE "subscriptionMonthlyAmount" = 60000;

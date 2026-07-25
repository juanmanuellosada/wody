-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailLogType" ADD VALUE 'PAYMENT_DUE_STUDENT';
ALTER TYPE "EmailLogType" ADD VALUE 'PAYMENT_DUE_GYM';
ALTER TYPE "EmailLogType" ADD VALUE 'PAYMENT_DUE_PERSONAL';

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "lastBillingEmailedOn" DATE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDueEmailedOn" DATE;

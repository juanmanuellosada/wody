-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "paymentExempt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paymentExemptReason" TEXT;

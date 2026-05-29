-- Migration: add gym signup onboarding (GymSignupRequest + SignupRequestRateLimit)
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- Only adds new types and tables. No existing tables are touched.
-- All FK columns are nullable — no data-migration needed.

-- Step 1: New enums

CREATE TYPE "SignupRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXPIRED');

-- Step 2: New EmailLogType values (ALTER TYPE ADD VALUE is idempotent-safe in PG >= 9.1)

ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'LEAD_RECEIVED';
ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'LEAD_APPROVED';
ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'LEAD_REJECTED';

-- Step 3: GymSignupRequest table

CREATE TABLE "GymSignupRequest" (
    "id"                 TEXT         NOT NULL,
    "email"              TEXT         NOT NULL,
    "contactName"        TEXT         NOT NULL,
    "gymName"            TEXT         NOT NULL,
    "gymKindSuggested"   TEXT         NOT NULL,
    "phone"              TEXT,
    "expectedStudents"   INTEGER,
    "message"            TEXT,
    "status"             "SignupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"         TIMESTAMP(3),
    "rejectedAt"         TIMESTAMP(3),
    "completedAt"        TIMESTAMP(3),
    "onboardingToken"    TEXT,
    "tokenExpiresAt"     TIMESTAMP(3),
    "rejectionReason"    TEXT,
    "gymId"              TEXT,
    "createdByAdminId"   TEXT,

    CONSTRAINT "GymSignupRequest_pkey" PRIMARY KEY ("id")
);

-- Step 4: Unique constraints on GymSignupRequest

ALTER TABLE "GymSignupRequest" ADD CONSTRAINT "GymSignupRequest_onboardingToken_key" UNIQUE ("onboardingToken");
ALTER TABLE "GymSignupRequest" ADD CONSTRAINT "GymSignupRequest_gymId_key" UNIQUE ("gymId");

-- Step 5: Foreign keys on GymSignupRequest (nullable, SetNull on delete)

ALTER TABLE "GymSignupRequest" ADD CONSTRAINT "GymSignupRequest_gymId_fkey"
    FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GymSignupRequest" ADD CONSTRAINT "GymSignupRequest_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Indexes on GymSignupRequest

CREATE INDEX "GymSignupRequest_status_createdAt_idx" ON "GymSignupRequest" ("status", "createdAt" DESC);
CREATE INDEX "GymSignupRequest_email_status_idx" ON "GymSignupRequest" ("email", "status");

-- Step 7: SignupRequestRateLimit table

CREATE TABLE "SignupRequestRateLimit" (
    "id"        TEXT         NOT NULL,
    "ip"        TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupRequestRateLimit_pkey" PRIMARY KEY ("id")
);

-- Step 8: Index on SignupRequestRateLimit

CREATE INDEX "SignupRequestRateLimit_ip_createdAt_idx" ON "SignupRequestRateLimit" ("ip", "createdAt");

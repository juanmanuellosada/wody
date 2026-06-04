-- Migration: add FixedRoutine model and MUSCULACION_LIBRE StudentType
-- Safe to apply with `prisma migrate deploy` (no shadow DB required).
-- Additive only: new enum value + new table.

-- 1. Add new value to StudentType enum
ALTER TYPE "StudentType" ADD VALUE IF NOT EXISTS 'MUSCULACION_LIBRE';

-- 2. Create FixedRoutine table
CREATE TABLE IF NOT EXISTS "FixedRoutine" (
    "id"                    TEXT         NOT NULL,
    "gymId"                 TEXT         NOT NULL,
    "studentId"             TEXT         NOT NULL,
    "teacherId"             TEXT         NOT NULL,
    "title"                 TEXT         NOT NULL,
    "content"               TEXT         NOT NULL,
    "assignedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewAt"               DATE         NOT NULL,
    "lastRenewalNotifiedOn" DATE,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    "deletedAt"             TIMESTAMP(3),

    CONSTRAINT "FixedRoutine_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign keys
ALTER TABLE "FixedRoutine" ADD CONSTRAINT "FixedRoutine_gymId_fkey"
    FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FixedRoutine" ADD CONSTRAINT "FixedRoutine_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FixedRoutine" ADD CONSTRAINT "FixedRoutine_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS "FixedRoutine_gymId_idx"
    ON "FixedRoutine"("gymId");

CREATE INDEX IF NOT EXISTS "FixedRoutine_studentId_deletedAt_idx"
    ON "FixedRoutine"("studentId", "deletedAt");

CREATE INDEX IF NOT EXISTS "FixedRoutine_teacherId_renewAt_idx"
    ON "FixedRoutine"("teacherId", "renewAt");

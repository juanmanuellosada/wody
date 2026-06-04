-- Migration: add studentType to JoinRequest
-- Safe to apply with `prisma migrate deploy` (no shadow DB required).
-- Additive only: new nullable column with default.

ALTER TABLE "JoinRequest" ADD COLUMN "studentType" "StudentType" NOT NULL DEFAULT 'PERSONALIZED';

-- Migration: add AccountKind enum and accountKind column; make email nullable
-- Safe to run with migrate deploy (no shadow DB required).
-- DROP NOT NULL on email is metadata-only in PostgreSQL — no table rewrite.

CREATE TYPE "AccountKind" AS ENUM ('FULL', 'LITE');

ALTER TABLE "User" ADD COLUMN "accountKind" "AccountKind" NOT NULL DEFAULT 'FULL';

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

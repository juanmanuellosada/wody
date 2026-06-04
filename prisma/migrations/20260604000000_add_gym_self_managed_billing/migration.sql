-- Migration: add selfManagedBilling to Gym
-- Safe to apply with `migrate deploy` (no shadow DB required).
--
-- Adds a boolean column to Gym that enables the manual billing mode
-- (gym pays SaaS outside Mercado Pago; super-admin manages due date manually).
-- Default false leaves all existing gyms unchanged.

ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "selfManagedBilling" BOOLEAN NOT NULL DEFAULT false;

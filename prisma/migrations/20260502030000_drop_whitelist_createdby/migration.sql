-- DropForeignKey
ALTER TABLE "PersonalAccessWhitelist" DROP CONSTRAINT IF EXISTS "PersonalAccessWhitelist_createdById_fkey";

-- DropColumn
ALTER TABLE "PersonalAccessWhitelist" DROP COLUMN IF EXISTS "createdById";

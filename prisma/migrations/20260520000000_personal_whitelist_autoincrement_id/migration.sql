-- Los IDs existentes en PersonalAccessWhitelist serán reasignados secuencialmente por SERIAL al recrear la columna.
ALTER TABLE "PersonalAccessWhitelist" DROP CONSTRAINT "PersonalAccessWhitelist_pkey";
ALTER TABLE "PersonalAccessWhitelist" DROP COLUMN "id";
ALTER TABLE "PersonalAccessWhitelist" ADD COLUMN "id" SERIAL PRIMARY KEY;

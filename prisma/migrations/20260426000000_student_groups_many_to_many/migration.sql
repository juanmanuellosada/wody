-- 1. Crear la tabla join
CREATE TABLE "GroupMember" (
    "userId"  TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("userId", "groupId"),
    CONSTRAINT "GroupMember_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- 2. Backfill: cada User.groupId NOT NULL produce exactamente una membership.
--    Esto preserva la pertenencia actual de los 5 alumnos de "PERSONALIZADOS"
--    en unidos-garage y de cualquier otro alumno con groupId no nulo en otros gyms.
INSERT INTO "GroupMember" ("userId", "groupId")
SELECT "id", "groupId"
FROM "User"
WHERE "groupId" IS NOT NULL;

-- 3. Validación dura: si los counts no coinciden, la migración aborta y queda
--    el schema viejo intacto (transacción implícita de Postgres en DDL).
DO $$
DECLARE
    src_count BIGINT;
    dst_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO src_count FROM "User" WHERE "groupId" IS NOT NULL;
    SELECT COUNT(*) INTO dst_count FROM "GroupMember";
    IF src_count <> dst_count THEN
        RAISE EXCEPTION 'GroupMember backfill mismatch: User.groupId NOT NULL count=% vs GroupMember count=%', src_count, dst_count;
    END IF;
END $$;

-- 4. Validación adicional: cada par (User.id, User.groupId) tiene su match
--    exacto en GroupMember. Esto detecta corrupción que un count solo no detectaría.
DO $$
DECLARE
    missing BIGINT;
BEGIN
    SELECT COUNT(*) INTO missing
    FROM "User" u
    WHERE u."groupId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."userId" = u."id" AND gm."groupId" = u."groupId"
      );
    IF missing > 0 THEN
        RAISE EXCEPTION 'GroupMember backfill missing % pairs from User.groupId', missing;
    END IF;
END $$;

-- 5. Drop de la columna ahora redundante. Ejecuta solo si las dos validaciones
--    anteriores pasaron.
ALTER TABLE "User" DROP COLUMN "groupId";

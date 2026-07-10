-- AlterTable
ALTER TABLE "User" ADD COLUMN "canViewRevenue" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: designa canViewRevenue=true al admin indicado de cada gym,
-- matcheando por email + gym.slug. Idempotente (misma condición siempre).
UPDATE "User" u
SET "canViewRevenue" = true
FROM "Gym" g
WHERE u."gymId" = g.id
  AND u."deletedAt" IS NULL
  AND u.role = 'ADMIN'
  AND (
    (g.slug = 'unidos-garage' AND u.email = 'pablo.poch@hotmail.com') OR
    (g.slug = 'rompiendo-limites' AND u.email = 'lescanojess111@gmail.com') OR
    (g.slug = 'atlas-gym' AND u.email = 'marianellareinki@hotmail.com') OR
    (g.slug = 'mila-fit' AND u.email = 'marianellareinki+mila@hotmail.com') OR
    (g.slug = 'crowned-program' AND u.email = 'diazema217@gmail.com') OR
    (g.slug = 'unidos-gap' AND u.email = 'lescanojess111@gmail.com')
  );

-- Fallback: para todo gym (kind != PERSONAL) que quede sin ningún admin
-- designado, asigna el admin más antiguo (createdAt ASC, no eliminado).
-- Idempotente: en una segunda corrida ya no queda ningún gym con 0
-- designados, así que el UPDATE no afecta filas.
UPDATE "User" u
SET "canViewRevenue" = true
FROM (
  SELECT DISTINCT ON (g.id) g.id AS "gymId", a.id AS "userId"
  FROM "Gym" g
  JOIN "User" a
    ON a."gymId" = g.id
   AND a.role = 'ADMIN'
   AND a."deletedAt" IS NULL
  WHERE g.kind != 'PERSONAL'
    AND NOT EXISTS (
      SELECT 1 FROM "User" x
      WHERE x."gymId" = g.id
        AND x.role = 'ADMIN'
        AND x."deletedAt" IS NULL
        AND x."canViewRevenue" = true
    )
  ORDER BY g.id, a."createdAt" ASC
) oldest
WHERE u.id = oldest."userId";

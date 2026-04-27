## 1. Pre-deploy snapshot y verificación

- [ ] 1.1 Conectar a la base de producción (Neon, branch `production`, db `wody`) y correr el snapshot: `SELECT id, name, "gymId", "groupId" FROM "User" WHERE "groupId" IS NOT NULL ORDER BY "gymId", id;` — guardar el output en una pegada local o gist privado para auditoría post-deploy.
- [ ] 1.2 Confirmar que Neon PITR está activo y que la retención cubre al menos 1 hora desde el momento del deploy.
- [ ] 1.3 Anotar el count exacto de filas con `groupId IS NOT NULL` y conservarlo: la migration validará que `count(GroupMember) == count(User.groupId NOT NULL)` exactamente.

## 2. Schema y migración Prisma

- [x] 2.1 Editar `prisma/schema.prisma`: agregar el modelo `GroupMember` con campos `userId String`, `groupId String`, relaciones a `User` y `Group` (`onDelete: Cascade`), `@@id([userId, groupId])` e `@@index([groupId])`.
- [x] 2.2 En el modelo `User`: eliminar el campo `groupId String?` (línea 79) y la relación `group Group? @relation("GroupStudents", fields: [groupId], references: [id], onDelete: SetNull)` (línea 88). Agregar `groupMemberships GroupMember[]`.
- [x] 2.3 En el modelo `Group`: eliminar la relación `students User[] @relation("GroupStudents")` (línea 119). Agregar `members GroupMember[]`.
- [x] 2.4 Crear `prisma/migrations/<timestamp>_student_groups_many_to_many/migration.sql` con el SQL siguiente, en este orden exacto (la migración debe ser idempotente respecto a `Group` y `User`: NO crea, modifica ni borra ninguna fila de esas tablas — solo lee `User.groupId` para backfillear):

  ```sql
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
  ```
- [x] 2.5 Correr `npx prisma generate` localmente y validar que el cliente compila.
- [ ] 2.6 Correr la migración contra una DB de desarrollo o branch de Neon con datos representativos para verificar que el bloque `DO $$` no aborta cuando los counts coinciden.

## 3. Server actions — `src/actions/group.ts`

- [x] 3.1 `assignStudentToGroup(studentId, groupId)`: reemplazar `prisma.user.update({ where: { id: studentId }, data: { groupId } })` por `prisma.groupMember.upsert({ where: { userId_groupId: { userId: studentId, groupId } }, create: { userId: studentId, groupId }, update: {} })`. Mantener intactas las validaciones de PERSONALIZED, `TeacherStudent` y `Group.teacherId`.
- [x] 3.2 `removeStudentFromGroup`: cambiar la firma para recibir `(studentId: string, groupId: string)`. Reemplazar `prisma.user.update({ data: { groupId: null } })` por `prisma.groupMember.deleteMany({ where: { userId: studentId, groupId } })`. Mantener autorización (TEACHER dueño del grupo o ADMIN; verificar `Group.teacherId` igual que en assign).
- [x] 3.3 `deleteGroup`: dentro del `prisma.$transaction`, reemplazar `prisma.user.updateMany({ where: { groupId }, data: { groupId: null } })` por `prisma.groupMember.deleteMany({ where: { groupId } })`.

## 4. Server actions — `src/actions/user.ts`

- [x] 4.1 Soft-delete de profe (líneas ~152-171): reemplazar el `prisma.user.updateMany({ where: { groupId: { in: deletedGroupIds } }, data: { groupId: null } })` (línea 169) por `prisma.groupMember.deleteMany({ where: { groupId: { in: deletedGroupIds } } })`. La condición `if (deletedGroupIds.length > 0)` se mantiene.
- [x] 4.2 `toggleStudentType` (línea 413): cuando `newType === "GENERAL"`, dejar de pasar `groupId: null` en el `data` del `update` (la columna ya no existe). En la misma transacción de `prisma.$transaction([...])`, agregar `prisma.groupMember.deleteMany({ where: { userId } })`. La regla `canCreateOwnRoutines: false` para GENERAL se mantiene.

## 5. UI server — `src/app/[gymSlug]/dashboard/teacher/page.tsx`

- [x] 5.1 En la query `prisma.teacherStudent.findMany` (línea 49-52), reemplazar `select: { student: { select: { id: true, name: true, studentType: true, groupId: true } } }` por `select: { student: { select: { id: true, name: true, studentType: true, groupMemberships: { select: { groupId: true } } } } }`.
- [x] 5.2 En la query `prisma.group.findMany` (línea 44-48), reemplazar `students: { select: { id: true, name: true } }` por `members: { select: { user: { select: { id: true, name: true } } } }` y mapear a `students: g.members.map(m => m.user)` cuando se pasa al `GroupManager`.
- [x] 5.3 Reemplazar el cómputo de `ungroupedStudents` (línea 121-123) por: para cada grupo `g`, calcular `availableToAdd = personalizedStudents.filter(s => !s.groupIds.includes(g.id))`. Pasar al `GroupManager` cada grupo con su `availableToAdd`.
- [x] 5.4 Eliminar la prop `ungroupedStudents` de `<GroupManager>` y agregar `availableToAdd` por grupo.

## 6. UI server — `src/app/[gymSlug]/dashboard/athlete/page.tsx` y `athlete/wod/page.tsx`

- [x] 6.1 En `athlete/page.tsx` (línea 35-38), reemplazar `select: { memberNumber: true, groupId: true, studentType: true }` por `select: { memberNumber: true, studentType: true, groupMemberships: { select: { groupId: true } } }`.
- [x] 6.2 Computar `const groupIds = student?.groupMemberships?.map(m => m.groupId) ?? [];` y reemplazar (línea 104-105) `...(student?.groupId ? [{ targetType: "GROUP" as const, targetGroupId: student.groupId }] : [])` por `...(groupIds.length > 0 ? [{ targetType: "GROUP" as const, targetGroupId: { in: groupIds } }] : [])`.
- [x] 6.3 Repetir 6.1 y 6.2 en `athlete/wod/page.tsx` (líneas 40-44 y 56-61).

## 7. UI server — `src/app/[gymSlug]/admin/page.tsx`

- [x] 7.1 En `prisma.user.findMany` (línea 41-45), reemplazar `groupId: true` por `groupMemberships: { select: { groupId: true } }` dentro del `select`.
- [x] 7.2 En `prisma.group.findMany` (línea 46-56), reemplazar `students: { select: { id: true, name: true } }` por `members: { select: { user: { select: { id: true, name: true } } } }` y mapear a `students` igual que en 5.2.
- [x] 7.3 En el render por profe (línea 165-168): reemplazar `const ungrouped = teacherStudents.filter(s => !s.groupId);` por el cálculo per-grupo `availableToAdd = teacherStudents.filter(s => !s.groupMemberships.some(m => m.groupId === g.id))`. Pasar `availableToAdd` por grupo al `<GroupManager>`.
- [x] 7.4 Eliminar la prop `ungroupedStudents` global del `<GroupManager>` en este archivo.

## 8. UI cliente — `src/components/group/GroupManager.tsx`

- [x] 8.1 Cambiar la interfaz `Group` para incluir `availableToAdd: Student[]`. Eliminar la prop `ungroupedStudents` del componente.
- [x] 8.2 Cambiar el dropdown "Agregar alumno..." (línea 223-247) para iterar sobre `group.availableToAdd` en lugar de `ungroupedStudents`. La lista renderizada por grupo es ahora propia del grupo.
- [x] 8.3 Cambiar `handleRemove(studentId)` a `handleRemove(studentId, groupId)` y pasar `group.id` desde el botón × (línea 209-216). Llamar `removeStudentFromGroup(studentId, group.id)`.

## 9. Verificación con typecheck y lint

- [x] 9.1 Correr `npx tsc --noEmit` y resolver cualquier referencia residual a `user.groupId` o `student.groupId`. Cero errores esperados después de aplicar 3-8.
- [x] 9.2 Correr `npm run lint` y resolver warnings nuevos.
- [x] 9.3 Correr `npm run build` y verificar que `prisma generate && next build` pasa.

## 10. Smoke test local

- [ ] 10.1 Levantar `npm run dev` con DB local poblada con `prisma/seed-atlas-gym.ts` o similar. Login como un profe que tenga ≥2 alumnos PERSONALIZED.
- [ ] 10.2 Verificar UI del profe: crear grupo A, asignar alumno X, crear grupo B, verificar que X aparece en el selector de B (regla "todos los PERSONALIZED menos los del grupo actual").
- [ ] 10.3 Asignar X a B también. Verificar en BD: `SELECT * FROM "GroupMember" WHERE "userId" = '<X.id>';` debe devolver 2 filas.
- [ ] 10.4 Login como X. Crear un WOD `targetType=GROUP, targetGroupId=A` desde el profe; verificar que X lo ve. Crear otro WOD `targetGroupId=B`; verificar que X también lo ve. Total: dos WODs visibles.
- [ ] 10.5 Quitar X del grupo B (×). Verificar que solo desaparece el WOD del grupo B; el del grupo A persiste. `SELECT * FROM "GroupMember" WHERE "userId" = '<X.id>';` queda con 1 fila.
- [ ] 10.6 Cambiar a X a `studentType=GENERAL` desde admin. Verificar que `GroupMember` para X queda vacío.
- [ ] 10.7 Soft-delete del profe desde admin. Verificar que las memberships de los grupos del profe se borran y `Group.deletedAt` queda no-nulo.

## 11. Deploy y verificación post-deploy

- [ ] 11.1 Mergear el PR. Vercel ejecuta `prisma migrate deploy && next build`. Si el bloque `DO $$` aborta, el deploy falla — investigar qué row quedó fuera del backfill.
- [ ] 11.2 Login como Pablo Poch en `unidos-garage`. Crear un grupo nuevo. Verificar que en el selector aparecen los 7 PERSONALIZED del profe (Ayelen, Daiana, Gabriela, Jesica, Jonathan, Justina, Mariana) — no solo 2.
- [ ] 11.3 Verificar que los 5 alumnos en el grupo "PERSONALIZADOS" siguen viendo sus WODs `targetType=GROUP, targetGroupId=PERSONALIZADOS`.
- [ ] 11.4 Spot-check de cualquier otro gym con grupos activos: confirmar que los memberships migraron y los alumnos siguen viendo sus WODs.
- [ ] 11.5 Comparar pares pre/post: en el snapshot guardado en 1.1, cada `(id, groupId)` debe existir en `GroupMember`. Correr en producción:

  ```sql
  -- Debe devolver 0 filas: alumnos que tenían groupId pero no quedaron como miembros.
  -- Como User.groupId ya no existe, esta query se valida indirectamente comparando
  -- contra el snapshot de 1.1: para cada (id, groupId) del snapshot, debe existir
  -- una fila idéntica en GroupMember.
  SELECT "userId", "groupId" FROM "GroupMember" ORDER BY "groupId", "userId";
  ```

  Diff del output contra el snapshot pre-deploy (renombrando la columna `id` → `userId` del snapshot). Las dos listas deben ser idénticas (mismo número de filas, mismos pares). Si difieren: investigar inmediatamente y considerar PITR.

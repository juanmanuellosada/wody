## Why

Hoy un alumno PERSONALIZED solo puede pertenecer a un grupo (`User.groupId` es FK simple). En el gym `unidos-garage`, el profe Pablo Poch tiene 7 alumnos PERSONALIZED pero 5 ya están en su grupo "PERSONALIZADOS", así que al crear un grupo nuevo el selector le muestra solo 2 alumnos disponibles. Como los WODs ya admiten múltiples destinos por día (no hay rutina única por alumno/día), no existe razón de negocio para limitar la pertenencia a un solo grupo.

## What Changes

- **BREAKING (schema)**: `User.groupId` se elimina; la relación alumno↔grupo pasa a M-a-N vía nueva tabla `GroupMember(userId, groupId)` con PK compuesta.
- Backfill de los `User.groupId` existentes a `GroupMember` dentro de la misma migración (volumen bajo, validado con count pre/post).
- `assignStudentToGroup` deja de pisar el grupo previo: agrega una membership; sigue rechazando alumnos GENERAL.
- `removeStudentFromGroup` recibe `groupId` además de `studentId`: borra solo esa membership.
- `deleteGroup` borra todas las memberships del grupo (en vez de nullear `User.groupId`).
- Soft-delete de profe: borra memberships de los grupos del profe (en vez de nullear `User.groupId`).
- `toggleStudentType` a GENERAL: borra todas las memberships del alumno.
- WOD del alumno: filtro pasa de `targetGroupId === student.groupId` a `targetGroupId IN student.groupIds[]`.
- Selector "agregar alumno al grupo X" muestra todos los PERSONALIZED del profe excepto los que ya están en *ese* grupo (un alumno puede aparecer como opción para otro grupo donde aún no esté).
- Cero impacto visual al alumno: hoy no se muestra "tu grupo" en su dashboard.

## Capabilities

### New Capabilities
- `student-groups`: pertenencia M-a-N de alumnos PERSONALIZED a grupos de un profe. Reemplaza la relación 1-a-N implícita en `User.groupId`. Define las invariantes (solo PERSONALIZED, alumno-profe-grupo coherente vía `TeacherStudent`), las operaciones de membership y la regla de visibilidad de WODs tipo `GROUP`.

### Modified Capabilities
<!-- Ninguna: las specs existentes (user-roles, user-soft-delete) no cambian sus requisitos. La interacción de soft-delete con memberships se cubre dentro de la nueva spec student-groups. -->

## Impact

- **Schema y migración**: `prisma/schema.prisma`, nueva migration con `CREATE TABLE GroupMember`, backfill desde `User.groupId`, validación de count, `DROP COLUMN User.groupId`.
- **Server actions**: `src/actions/group.ts` (assign/remove/delete), `src/actions/user.ts` (soft-delete profe en líneas 152-171, `toggleStudentType` línea 413).
- **UI servidor**: `src/app/[gymSlug]/dashboard/teacher/page.tsx` (selectors de GroupManager), `src/app/[gymSlug]/dashboard/athlete/page.tsx` y `athlete/wod/page.tsx` (filtros de WOD por `groupIds[]`), `src/app/[gymSlug]/admin/page.tsx` (vista de grupos por profe).
- **UI cliente**: `src/components/group/GroupManager.tsx` (firma de props para soportar memberships por grupo + `removeStudentFromGroup(studentId, groupId)`).
- **Datos en producción**: gym `unidos-garage` con 5 memberships activas a migrar; resto de gyms a verificar.
- **Sin cambios**: `TeacherStudent` (ya M-a-N), modelos `Wod` / `RM` / `Coupon`, seeds (no asignan `groupId` directamente), crons.
- **Riesgo**: backfill incompleto. Mitigación: `SELECT count(*) FROM "User" WHERE "groupId" IS NOT NULL` debe coincidir con `SELECT count(*) FROM "GroupMember"` antes de `DROP COLUMN`. Neon tiene PITR activo como red de seguridad.

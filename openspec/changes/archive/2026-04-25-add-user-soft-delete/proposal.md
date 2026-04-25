## Why

El borrado actual de usuarios (`deleteUser()` en `src/actions/user.ts`) es físico (`prisma.user.delete`) y se apoya en `onDelete: Cascade` para arrastrar `Wod`, `RM`, `AccessLog`, `CouponRedemption`, `PushSubscription` y `TeacherStudent`. Esto destruye historia legítima del gym: los `RM` (PRs de cada alumno) y los `AccessLog` (asistencia) son datos del **alumno**, no del autor del registro, y se pierden si el profe que los avaló se va. Además, borrar un profe arrastra a sus alumnos vía `TeacherStudent` Cascade, cuando en la práctica los alumnos deberían quedar simplemente sin profe asignado.

Queremos pasar a borrado lógico para preservar historia, simplificar el "alta de un usuario que ya existió" (reusar email / número de socio liberados) y desacoplar la baja de un profe del destino de sus alumnos.

## What Changes

- **BREAKING (interno)**: `deleteUser(userId)` deja de borrar físicamente. Ejecuta soft-delete con cascada manual transaccional según el rol.
- Nuevo campo `deletedAt: DateTime?` en `User`, `Group` y `Wod`.
- Las unicidades `(email, gymId)` y `(memberNumber, gymId)` en `User`, y `(teacherId, name)` en `Group`, pasan a ser **parciales** (`WHERE "deletedAt" IS NULL`) vía SQL crudo en migration. Liberan email / member number / nombre de grupo cuando la fila está soft-deleted.
- Política por relación al borrar:
  - **Soft-delete**: `Wod` (autor profe), `Group` (autor profe).
  - **Hard-delete**: filas de `TeacherStudent` (cualquier lado), `PushSubscription` del usuario.
  - **Set null**: `AccessLog.decidedById`, `Wod.targetStudentId`, `User.groupId` cuando apunta a un grupo soft-deleted.
  - **Sin tocar**: `RM`, `AccessLog.userId`, `CouponRedemption` (datos del alumno; se filtran al listar).
- `authorize()` rechaza login si el usuario tiene `deletedAt != null`.
- `[gymSlug]/layout.tsx` redirige a `/api/auth/kick` si el usuario en sesión quedó soft-deleted (mismo mecanismo que ya usa para `blockedAt`).
- Todas las queries que listan/buscan `User`, `Group` o `Wod` agregan filtro `deletedAt: null` por defecto (11 puntos identificados para `User`, más los de `Group` y `Wod`).
- Restaurar y hard-delete quedan **fuera de alcance** — el operador los hace por DB cuando lo necesita.

## Capabilities

### New Capabilities

- `user-soft-delete`: ciclo de vida de baja lógica de usuarios. Semántica de `deletedAt`, política de cascada por rol, comportamiento de unicidades parciales, y efecto sobre sesiones y queries existentes. No incluye restaurar ni hard-delete (out of scope explícito).

### Modified Capabilities

(Ninguna — `user-roles` cubre asignación/promoción de roles, que no cambia.)

## Impact

**Schema** (`prisma/schema.prisma`):
- `User`: nuevo campo `deletedAt`. Las unicidades existentes pasan a parciales (necesita SQL crudo en migration porque Prisma no soporta `WHERE` en `@@unique`).
- `Group`: nuevo campo `deletedAt`. Unicidad `(teacherId, name)` parcial.
- `Wod`: nuevo campo `deletedAt`.

**Migrations**:
- Una migration con: `ALTER TABLE` para los tres `deletedAt`, `DROP CONSTRAINT` + `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL` para las tres unicidades, e índices de soporte (`@@index([gymId, deletedAt])` en `User`).

**Código tocado**:
- `src/actions/user.ts` — reescritura de `deleteUser()` con la cascada por rol; agregar filtro `deletedAt: null` en `createUser`, `assignStudent`, `updateStudent`, `setUserBlocked`, `toggleStudentType`, `promoteTeacherToAdmin`, `setCanCreateOwnRoutines`.
- `src/lib/auth.ts` — filtro `deletedAt: null` en `authorize()`.
- `src/app/[gymSlug]/layout.tsx` — chequear `deletedAt` y kick.
- `src/actions/payment.ts` — filtro en `assertCanEditStudent`.
- `src/actions/access.ts` — filtro en `createCheckin`.
- `src/app/[gymSlug]/admin/page.tsx`, `src/app/[gymSlug]/pagos/page.tsx`, `src/app/api/cron/notify-due-today/route.ts`, `src/app/api/ingresos/pending/route.ts` — filtros en queries.
- Lugares que listan `Wod` y `Group` (a confirmar en implementación).

**Sin impacto en**:
- API pública / contratos externos (no hay).
- Datos existentes: `deletedAt` arranca en `null` para todos los usuarios actuales.
- `RM`, `AccessLog`, `CouponRedemption`: el schema no cambia (la pérdida de cascade desde `User` no aplica porque ya no se borra físicamente).

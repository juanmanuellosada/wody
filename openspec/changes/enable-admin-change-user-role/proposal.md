## Why

Hoy el rol de un usuario (`User.role`, enum: `ADMIN | TEACHER | STUDENT | ACCESS`) solo se puede asignar al crear el usuario (`createUser` en `src/actions/user.ts:18-123`). No existe ninguna acción ni UI para modificarlo después. Cuando el dueño del gym quiere darle permisos de gestión a un profe ya activo, la única salida es manipular la base a mano.

Este cambio cubre exclusivamente el caso central: **un ADMIN puede promover a un TEACHER del mismo gym al rol ADMIN**. No se contempla ninguna otra transición (ni downgrades, ni cambios desde/hacia STUDENT o ACCESS).

## What Changes

- Nueva server action `promoteTeacherToAdmin(userId)` en `src/actions/user.ts`. Recibe únicamente el `userId` del target — el rol destino es siempre `ADMIN` y el rol origen requerido es siempre `TEACHER`.
- Botón "Promover a admin" en cada fila de TEACHER del panel de admin (`src/app/[gymSlug]/admin/page.tsx`), en la tabla desktop y en las cards mobile.
- Validaciones obligatorias: caller con `role = ADMIN` del mismo `gymId` que el target, target con `role = TEACHER`, target sin `blockedAt` (no se promueve un usuario bloqueado), target distinto del caller (defensivo — implícitamente cubierto porque el caller ya es ADMIN).
- Sin side effects sobre relaciones colaterales: TEACHER → ADMIN es una expansión de permisos. `TeacherStudent`, `Wod` y todos los flags del usuario se conservan tal cual. El conjunto de permisos de TEACHER es subconjunto del de ADMIN, así que no hay nada que limpiar.
- Sin notificación al usuario afectado (decisión explícita del producto).
- Trade-off documentado: la sesión NextAuth incluye `role` en el JWT (`src/lib/auth.ts:88-126`), por lo que el promovido verá los permisos de ADMIN solo tras el próximo login. No se invalidan tokens activos.

## Capabilities

### New Capabilities

- `user-roles`: reglas de modificación del campo `role` de un usuario tras la creación. En este cambio se introduce únicamente la transición TEACHER → ADMIN.

### Modified Capabilities

(ninguna — no hay specs previas en `openspec/specs/`)

## Impact

- **Código**: `src/actions/user.ts` (nueva action `promoteTeacherToAdmin`), `src/app/[gymSlug]/admin/page.tsx` (botón en filas de TEACHER), probablemente un componente cliente chico para el botón con confirmación. Sin cambios en `prisma/schema.prisma`.
- **Auth / sesiones**: el promovido sigue viendo `role = TEACHER` en su sesión activa hasta re-loguearse. Documentado, no se mitiga acá.
- **Multi-tenancy**: la action filtra por `gymId` igual que el resto de actions sobre usuarios.
- **Sin tests automáticos**: el proyecto no tiene suite; verificación manual desde el panel.

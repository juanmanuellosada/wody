## 1. Schema y migration

- [x] 1.1 Agregar `deletedAt DateTime?` a `User`, `Group` y `Wod` en `prisma/schema.prisma`. Agregar `@@index([gymId, deletedAt])` en `User`.
- [x] 1.2 Quitar (o reemplazar por `@@index` no único) los `@@unique([email, gymId])` y `@@unique([gymId, memberNumber])` en `User`, y `@@unique([teacherId, name])` en `Group`. Dejar comentario en el schema indicando que el índice único parcial vive en la migration `add_user_soft_delete`.
- [x] 1.3 `npx prisma migrate dev --create-only --name add_user_soft_delete`. Editar el SQL generado para reemplazar la creación de columnas + (drop de índices únicos viejos si Prisma los emite) por: `ALTER TABLE` para los tres `deletedAt`, `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL` para las tres unicidades parciales, y `CREATE INDEX` para `(gymId, deletedAt)` en `User`. Los nombres de constraint a respetar son los que ya use Prisma — confirmar con `prisma migrate diff` antes de editar.
- [x] 1.4 Para `(gymId, memberNumber)` parcial: incluir también `AND "memberNumber" IS NOT NULL` en el `WHERE`, porque `memberNumber` es opcional.
- [x] 1.5 Aplicar la migration local (`prisma migrate dev`). Correr `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource ...` para verificar que no hay drift entre schema y DB después de aplicar.
- [x] 1.6 `npx prisma generate` para regenerar el client con los campos `deletedAt`.

## 2. Reescritura de `deleteUser()` con cascada manual

- [x] 2.1 En `src/actions/user.ts`, ubicar `deleteUser(userId)` y reemplazar el `prisma.user.delete()` por una transacción `prisma.$transaction([...])`.
- [x] 2.2 Implementar la rama `TEACHER` / `ADMIN`:
  - update `User.deletedAt`,
  - capturar IDs de `Group` activos del teacher (un `findMany({ select: {id: true} })` previo dentro de la transacción),
  - `updateMany` `Group.deletedAt = now()` para ese teacher,
  - `updateMany` `Wod.deletedAt = now()` con `teacherId = X` y `deletedAt = null`,
  - `deleteMany` `TeacherStudent` con `OR: [{teacherId: X}, {studentId: X}]`,
  - `deleteMany` `PushSubscription` con `userId = X`,
  - `updateMany` `AccessLog` con `decidedById = X` → `decidedById = null`,
  - `updateMany` `User.groupId = null` para alumnos cuyo `groupId` esté en los IDs capturados arriba.
- [x] 2.3 Implementar la rama `STUDENT` / `ACCESS`:
  - update `User.deletedAt`,
  - `deleteMany` `TeacherStudent` con `studentId = X`,
  - `deleteMany` `PushSubscription` con `userId = X`,
  - `updateMany` `Wod.targetStudentId = null` con `targetStudentId = X` y `deletedAt = null`,
  - `updateMany` `AccessLog.decidedById = null` con `decidedById = X`.
- [x] 2.4 Verificar que `deleteUser()` chequee primero `deletedAt: null` antes de operar. Si ya está borrado, devolver el resultado actual sin tocar nada (idempotencia). No actualizar `deletedAt` con un nuevo timestamp.
- [x] 2.5 Verificar que `deleteUser()` valide los permisos del caller igual que hoy (no relajar autorización).

## 3. Filtros `deletedAt: null` en queries existentes

- [x] 3.1 `src/lib/auth.ts` — agregar `deletedAt: null` al filtro de `prisma.user.findMany` dentro de `authorize()`.
- [x] 3.2 `src/actions/user.ts` — agregar el filtro en `createUser` (chequeo de email único pre-create), `assignStudent`, `updateStudent`, `setUserBlocked`, `toggleStudentType`, `promoteTeacherToAdmin`, `setCanCreateOwnRoutines`. Para `createUser`, asegurar que el chequeo de email único contemple solo activos (lo cubre el índice parcial, pero dejar el filtro explícito en el código para que la lectura sea evidente).
- [x] 3.3 `src/actions/payment.ts` — agregar el filtro en `assertCanEditStudent`.
- [x] 3.4 `src/actions/access.ts` — agregar el filtro en `createCheckin`.
- [x] 3.5 `src/app/[gymSlug]/admin/page.tsx` — agregar el filtro en el `prisma.user.findMany` que arma la lista del panel.
- [x] 3.6 `src/app/[gymSlug]/pagos/page.tsx` — agregar el filtro en el `prisma.user.findMany` que lista alumnos por estado de pago.
- [x] 3.7 `src/app/api/cron/notify-due-today/route.ts` — agregar el filtro en el `prisma.user.findMany` del cron.
- [x] 3.8 `src/app/api/ingresos/pending/route.ts` — verificar que la relación `user` que se incluye no traiga usuarios borrados. Si la query usa `include`, agregar `where: { deletedAt: null }` en el include.
- [x] 3.9 Buscar otros call sites de `prisma.user.find*`, `prisma.group.find*`, `prisma.wod.find*` y `prisma.user.count` con `grep -rE "prisma\.(user|group|wod)\.(find|count|aggregate)"` y agregar el filtro donde corresponda. Excluir scripts de seed (`prisma/seed*.ts`) y herramientas de operador.
- [x] 3.10 Para `Group` y `Wod`: agregar `deletedAt: null` en cualquier `findMany` que liste rutinas o grupos del gym/profe (a confirmar durante el grep). El alumno no debería ver rutinas borradas en su feed.

## 4. Sesión activa: kick en el layout

- [x] 4.1 En `src/app/[gymSlug]/layout.tsx`, donde hoy se chequea `user.blockedAt`, agregar el chequeo `user.deletedAt`. Si `deletedAt != null`, redirigir a `/api/auth/kick?next=...` igual que para `blockedAt`.
- [x] 4.2 Verificar que `/api/auth/kick` no requiera cambios (ya cierra sesión sin importar la razón).

## 5. Validación local

- [ ] 5.1 Crear un profe de prueba con dos alumnos, un grupo y dos rutinas. Borrar al profe. Verificar:
  - su `deletedAt != null`,
  - sus rutinas `deletedAt != null`,
  - su grupo `deletedAt != null`,
  - filas de `TeacherStudent` desaparecen,
  - alumnos siguen activos y sin profe,
  - `groupId` de los alumnos quedó en `null`.
- [ ] 5.2 Intentar loguearse como el profe borrado. Debe fallar con mismo mensaje que credencial inválida.
- [ ] 5.3 Crear un nuevo usuario con el mismo email y `memberNumber` del profe borrado, en el mismo gym. Debe permitirse.
- [ ] 5.4 Borrar un alumno con RMs e ingresos. Verificar que `RM` y `AccessLog` con `userId = alumno` siguen presentes y la única diferencia es `deletedAt` en `User`.
- [ ] 5.5 Borrar un usuario `ACCESS`. Verificar que `AccessLog.decidedById` que apuntaban a él quedaron en `null`.
- [ ] 5.6 Restaurar manualmente vía DB (`UPDATE "User" SET "deletedAt" = NULL WHERE id = ...`). Verificar que el usuario puede loguearse y aparece en listados.
- [ ] 5.7 Verificar que el panel de admin, la lista de pagos y los listados de alumnos no muestran usuarios borrados.

## 6. Limpieza y revisión

- [x] 6.1 Confirmar que `npm run build` pasa (Prisma generate + Next build).
- [x] 6.2 Confirmar que `npm run lint` pasa.
- [x] 6.3 Revisar `git diff` y verificar que ningún `prisma.user.delete`, `prisma.group.delete`, `prisma.wod.delete` quedó en flujos de producto. Buscar con `grep -rn "\.delete(" src/`.
- [x] 6.4 Actualizar `docs/` si algún flujo documentado mencionaba "borrar usuario" implicando borrado físico (revisar `docs/alta-nuevo-gym.md`, `docs/alta-nuevo-box.md`, `docs/control-accesos.md`).
- [ ] 6.5 Commit en español siguiendo Conventional Commits, p. ej. `feat(user): borrado lógico de usuarios con cascada por rol`.

## 7. deleteGroup soft-delete + shadowDatabaseUrl

- [x] 7.1 En `prisma/schema.prisma`, agregar `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` al bloque `datasource db`.
- [x] 7.2 Crear `.env.example` en la raíz con placeholders para `DATABASE_URL`, `SHADOW_DATABASE_URL` y las demás vars. Documentar que `SHADOW_DATABASE_URL` apunta a un Neon branch dedicado distinto del principal.
- [x] 7.3 Crear `docs/migrations.md` (< 30 líneas) explicando cómo crear el branch shadow en Neon y configurar la env var.
- [x] 7.4 En `src/actions/group.ts`, reemplazar `prisma.group.delete()` en `deleteGroup()` por `prisma.$transaction([...])` con: `group.update(deletedAt)`, `user.updateMany(groupId → null)`, `wod.updateMany(targetGroupId → null)`.
- [x] 7.5 Confirmar que `Wod.targetGroup` tiene `onDelete: SetNull` (confirmado en `prisma/schema.prisma` línea 140) — la cascada replica ese comportamiento con `updateMany`.
- [x] 7.6 Correr `npx prisma generate` para verificar que el schema sigue válido.

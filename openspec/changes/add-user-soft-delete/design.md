## Context

Wody es multi-tenant por `gymId`. Hoy `deleteUser()` en `src/actions/user.ts` ejecuta `prisma.user.delete()` confiando en `onDelete: Cascade` definido en `prisma/schema.prisma` para limpiar `Wod` (cascade), `RM` (cascade), `AccessLog.userId` (cascade), `CouponRedemption` (cascade), `PushSubscription` (cascade) y `TeacherStudent` (cascade en ambos lados). El campo `User.groupId` y `Wod.targetStudentId` están con `SetNull`.

Esta cascada física tiene dos problemas:

1. **Pérdida de historia**: los `RM` (PRs) y `AccessLog` son del **alumno**. Si el profe que los registró se va, esa información desaparece para el gym y para el alumno mismo (cuando borramos al alumno también, perdemos su histórico aunque la baja sea reversible "a mano").
2. **Cascada agresiva en `TeacherStudent`**: borrar un profe arrastra a sus alumnos vía Cascade, cuando lo deseado es solo cortar la asociación.

Existe `setUserBlocked` (`blockedAt`) para suspender, pero no para baja. NextAuth 5 emite JWT de 90 días sin refresh; el `[gymSlug]/layout.tsx` ya hace `findUnique` del `User` en cada navegación y redirige a `/api/auth/kick` si está `blockedAt`.

## Goals / Non-Goals

**Goals:**
- Borrado lógico de `User`, `Group` y `Wod` con `deletedAt: DateTime?`.
- Cascada manual transaccional al borrar un usuario, respetando la política acordada (soft / hard / set-null / no-tocar) por relación.
- Email y `memberNumber` pueden reusarse en el mismo gym tras un soft-delete.
- Bloquear login de usuarios soft-deleted; expulsar sesiones activas en la próxima request bajo `[gymSlug]/`.
- Toda lectura de `User`, `Group`, `Wod` filtra `deletedAt: null` por defecto.

**Non-Goals:**
- UI para restaurar (`deletedAt = null`). El operador lo hace por DB.
- Hard-delete desde producto. Se hace por DB cuando aplique.
- Auditoría de quién borró a quién (`deletedById`, `deletedReason`). Se puede sumar más adelante.
- Mecanismo de revocación inmediata de JWT (`tokenVersion`, blocklist). El kick en el layout cubre el flujo principal; APIs sueltas se cubren por filtro.
- Anonimización GDPR de PII al borrar. Distinto problema, distinta proposal.

## Decisions

### Decision 1 — Soft-delete con `deletedAt: DateTime?` (no `isDeleted: Boolean` ni tabla aparte)

**Por qué**:
- Un timestamp da fecha gratis (auditoría mínima sin nuevo campo).
- Se compara con `null` para "vivo" en queries (tan ergonómico como un booleano).
- Preserva la fila intacta para "restaurar por DB" trivial (`UPDATE ... SET "deletedAt" = NULL`).

**Alternativa descartada**:
- `isDeleted: Boolean` + `deletedAt: DateTime?`: redundante, dos fuentes de verdad que se pueden desincronizar.
- Mover filas a una tabla `*_archive`: complica los FKs (RMs apuntan a `User` activo) y rompe las queries que ya andan.

### Decision 2 — Unicidades parciales vía SQL crudo

Prisma 6.19 no soporta `WHERE` en `@@unique` ni `@@index`. Postgres sí (`CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL`, soportado desde 9.0).

**Plan**:
1. Mantener el `@@unique` en `schema.prisma` con un comentario `/// @ignore — substituted by partial index`.

   Wait — Prisma valida unique constraints durante `generate`; si dejamos la `@@unique` en el modelo, la migration la creará como índice total. Mejor enfoque: **quitar el `@@unique` del modelo** (o reemplazarlo por `@@index([email, gymId])` no único para ergonomía de queries) y crear el índice único parcial vía `prisma migrate` con un archivo SQL editado a mano (`prisma migrate dev --create-only`, luego editar el `.sql` antes de aplicar).

2. La migration agrega:
   ```sql
   ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
   ALTER TABLE "Group" ADD COLUMN "deletedAt" TIMESTAMP(3);
   ALTER TABLE "Wod" ADD COLUMN "deletedAt" TIMESTAMP(3);

   DROP INDEX "User_email_gymId_key";
   CREATE UNIQUE INDEX "User_email_gymId_key" ON "User"("email", "gymId") WHERE "deletedAt" IS NULL;

   DROP INDEX "User_gymId_memberNumber_key";
   CREATE UNIQUE INDEX "User_gymId_memberNumber_key" ON "User"("gymId", "memberNumber") WHERE "deletedAt" IS NULL AND "memberNumber" IS NOT NULL;

   DROP INDEX "Group_teacherId_name_key";
   CREATE UNIQUE INDEX "Group_teacherId_name_key" ON "Group"("teacherId", "name") WHERE "deletedAt" IS NULL;

   CREATE INDEX "User_gymId_deletedAt_idx" ON "User"("gymId", "deletedAt");
   ```
   Los nombres de las constraints existentes hay que verlos en el SQL real generado por Prisma (`prisma migrate diff`) — los de arriba son la convención esperada.

**Riesgo**: si alguien corre `prisma migrate dev` y los índices no están definidos en `schema.prisma`, Prisma intenta "reconciliar" y los puede borrar. Mitigación: marcar el modelo con un comentario claro de "partial unique index lives in migration X" y validar que `prisma migrate diff` no genera drift después de la migration manual.

### Decision 3 — Cascada manual en una sola transacción

`prisma.$transaction([...])` agrupa todas las operaciones por rol. Si una falla, ninguna se aplica. Los pasos exactos por rol están en `tasks.md`.

**Por qué transacción**:
- Si entre soft-delete del `User` y hard-delete de `TeacherStudent` cae el server, queda el usuario "borrado" pero con asociaciones huérfanas. La transacción evita ese estado.
- Postgres maneja la concurrencia: si otro request intenta leer al usuario mientras el delete está corriendo, ve el estado pre-delete o post-delete, nunca intermedio.

**Alternativa descartada**:
- Hooks de Prisma (`$use` middleware) para auto-soft-delete en `delete()`: el middleware **no puede transformar** un `delete` en un `update` con cascada manual. Se rompe en cuanto necesitamos ramificar por rol.
- Triggers SQL: posibles pero opacos para el agente y los devs. Mejor mantener la lógica en TS junto a `deleteUser()`.

### Decision 4 — Cascada por rol (no genérica)

Cuatro roles, dos perfiles de cascada distintos:

**`TEACHER` y `ADMIN`** (ambos pueden tener `Wod`, `Group`, `TeacherStudent` como teacher):
1. `prisma.user.update({ where: {id}, data: { deletedAt: now } })`
2. `prisma.group.updateMany({ where: { teacherId: id, deletedAt: null }, data: { deletedAt: now } })`
3. `prisma.wod.updateMany({ where: { teacherId: id, deletedAt: null }, data: { deletedAt: now } })`
4. `prisma.teacherStudent.deleteMany({ where: { OR: [{ teacherId: id }, { studentId: id }] } })` — el OR cubre el caso (raro) de que un admin/profe figure como student.
5. `prisma.pushSubscription.deleteMany({ where: { userId: id } })`
6. `prisma.accessLog.updateMany({ where: { decidedById: id }, data: { decidedById: null } })`
7. Para alumnos cuyo `groupId` apunta a un grupo recién soft-deleted: `prisma.user.updateMany({ where: { groupId: { in: deletedGroupIds } }, data: { groupId: null } })`. Hay que capturar los IDs de grupos en el paso 2 (`returning` no aplica con `updateMany`; usar `findMany` previo o `transaction` con dos pasos).

**`STUDENT` y `ACCESS`**:
1. `prisma.user.update({ where: {id}, data: { deletedAt: now } })`
2. `prisma.teacherStudent.deleteMany({ where: { studentId: id } })`
3. `prisma.pushSubscription.deleteMany({ where: { userId: id } })`
4. `prisma.wod.updateMany({ where: { targetStudentId: id, deletedAt: null }, data: { targetStudentId: null } })`
5. `prisma.accessLog.updateMany({ where: { decidedById: id }, data: { decidedById: null } })` — un `ACCESS` es justamente quien suele aparecer en `decidedById`. Para `STUDENT` el `updateMany` no toca nada en la práctica, pero es barato y consistente.

**Nota sobre admin = profe**: la AGENTS.md dice que un admin puede actuar como profe. Por eso `ADMIN` se trata igual que `TEACHER`. Si `ADMIN` también tiene una semántica especial al borrarse (último admin del gym), eso es regla de negocio aparte — fuera de alcance acá.

### Decision 5 — Sesión activa: kick en el layout, sin `tokenVersion`

El layout `[gymSlug]/layout.tsx` ya hace `prisma.user.findUnique({ where: { id: session.user.id } })` en cada navegación para chequear `blockedAt`. Sumar el chequeo de `deletedAt` ahí es trivial y no agrega DB hits.

**Coberturas**:
- Páginas dentro de `[gymSlug]/` → kick en próxima navegación.
- `authorize()` con `deletedAt: null` → no se puede iniciar nueva sesión.
- API routes (`/api/cron/...`, `/api/ingresos/...`, server actions) → cada query agrega `deletedAt: null` al filtro de `User` que cargan, así no operan sobre usuarios borrados.

**Hueco conocido**: si un user soft-deleted hace una request a una API que **no** consulta su `User` antes de operar (poco probable en el código actual, dado que casi todo arranca con `auth()` + lookup), la operación podría pasar. Mitigación: revisar handlers durante implementación; agregar el filtro donde corresponda.

**Por qué no `tokenVersion`**: agregaría un campo a `User`, lógica en el callback `jwt`, una columna que crece, y obliga a leer DB en cada validación de JWT. Innecesario para el volumen y modelo de uso actual (gym pequeño/mediano, navegación frecuente). Si más adelante se quiere expulsión instantánea de tokens activos, se evalúa.

### Decision 6 — Filtrado `deletedAt: null` en queries: convención, no helper

Hay 11+ puntos. Tentación: helper tipo `prismaActive.user.findMany(...)` o un middleware Prisma `$use`.

**Decisión**: convención y revisión, no abstracción. Razones:
- Prisma `$use` está deprecado en 6.x (eliminado en 7).
- Un wrapper invade el call site con un import nuevo y convive con el `prisma` directo en cosas que sí quieren ver soft-deleted (admin tools, scripts).
- Son 11 lugares, todos en `src/actions/` y `src/app/`. Una pasada del `executor` los toca de una.

**Mitigación contra olvidos**: el spec define el requirement "queries de listado filtran `deletedAt: null`" para que la verificación sea explícita.

## Risks / Trade-offs

- **[Riesgo] Drift entre `schema.prisma` y migration manual** → revisar `prisma migrate diff` post-merge y dejar nota en el schema. Si Prisma intenta recrear el índice como total, falla `migrate dev` ruidosamente; lo veríamos en CI/local, no en prod.
- **[Riesgo] Olvido de filtrar `deletedAt: null` en una query nueva** → mitigación: el spec lo requiere explícitamente; el `executor` debería buscar todos los `prisma.user.find*` durante implementación. A futuro, considerar un lint custom o `$extends` (Prisma 5+) para forzar el filtro.
- **[Riesgo] Reuso de email crea confusión con datos históricos** → un alumno borrado con email `juan@x.com` puede ser sustituido por otro con el mismo email en el mismo gym. Sus `RM` antiguos siguen apuntando al `User` original (correcto). Si la UI de admin lista usuarios sin saber que el original está borrado, no lo ve (filtro). El operador que quiera ver historia los ve por DB.
- **[Riesgo] Cascada parcial si un paso de la transacción es no-idempotente y falla a mitad** → `prisma.$transaction` cubre el caso. Si el usuario ya estaba `deletedAt != null`, la operación es idempotente (los `updateMany` no encuentran filas vivas que tocar; los `deleteMany` no rompen aunque ya estén borrados).
- **[Trade-off] Sesión sigue viva fuera de `[gymSlug]/`** → aceptable. Las únicas rutas con permisos significativos están bajo `[gymSlug]/` o son APIs que cargan `User`. Lo confirmamos en implementación.
- **[Trade-off] No auditamos quién borró** → si después se necesita, sumar `deletedById: String?` y `deletedReason: String?` en `User`. Cambio aditivo, no rompe nada.

## Migration Plan

1. **Schema**: agregar `deletedAt` a `User`, `Group`, `Wod`. Quitar (o re-marcar) los `@@unique` afectados.
2. **Migration con SQL editado**: `prisma migrate dev --create-only --name add_user_soft_delete`, luego editar el `.sql` para incluir los `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL`. Aplicar local.
3. **Código**: reescribir `deleteUser()`, agregar filtros en los 11 puntos, kick en layout.
4. **Validación local**:
   - Borrar un profe → ver que sus alumnos quedan (sin profe), sus rutinas no aparecen, su grupo no aparece, no se puede loguear.
   - Crear nuevo usuario con email + memberNumber del borrado → debe permitirlo.
   - Restaurar por DB → funciona.
5. **Deploy**: la migration corre en Neon. Datos existentes: `deletedAt = NULL`, comportamiento idéntico al actual.

**Rollback**:
- Si hay que revertir antes de soft-deletar a alguien en prod: revertir la migration (drop columns + recrear índices totales).
- Si ya hay usuarios soft-deleted en prod y se decide volver atrás: decisión manual — o se aceptan como "vivos" (set `deletedAt = NULL` y conviven con duplicados de email si los hay), o se hard-deletan. No hay rollback automático.

## Open Questions

Ninguna pendiente — todas las decisiones de scope se acordaron con el usuario en la conversación previa al `propose`. Si durante la implementación aparece un caller no listado en `proposal.md` que necesite filtro, el `executor` lo agrega y lo nota en el commit.

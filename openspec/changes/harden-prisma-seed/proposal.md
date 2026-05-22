## Why

El 21–22 de mayo de 2026, un `npm run seed` corrido localmente con el `DATABASE_URL` apuntando a producción ejecutó los `prisma.X.deleteMany()` sin filtro de `prisma/seed.ts` (líneas 84-88) y borró datos reales de `Wod`, `RM`, `TeacherStudent`, `User` y `Gym` en la DB de prod (Neon). Como el proyecto está en plan Free, la pérdida cayó fuera de la ventana de history (6h) y la recuperación quedó atada a soporte de Neon. El seed actual asume contexto de desarrollo y arranca borrando todo "para empezar limpio" — sin guard de entorno, sin confirmación, y mezclando datos base (idempotentes) con limpieza destructiva en un solo script.

Esto tiene que ser **imposible** de repetir, incluso con un `.env` mal configurado.

## What Changes

- **BREAKING** `npm run seed` cambia de semántica: pasa de ser destructivo (borra+recrea) a ser **idempotente** (solo crea/actualiza vía `upsert`). Quien dependa del comportamiento viejo tiene que usar el nuevo `npm run seed:reset`.
- Se agrega `npm run seed:reset` para el flujo destructivo de reset de entorno local, **protegido por dos guards**:
  1. Hard guard de entorno: aborta si `DATABASE_URL` no apunta a un host local (`localhost`, `127.0.0.1`, `postgres` por nombre Docker).
  2. Confirmación explícita: requiere `ALLOW_DESTRUCTIVE_SEED=1` en el environment.
- `prisma/seed.ts` se refactoriza: la parte idempotente (gym, users, asignaciones base) se separa de la parte destructiva. Donde aplica, los `create` se reemplazan por `upsert` usando claves naturales (`slug` para gym, `email+gymId` para user).
- Se elimina la entrada `prisma.seed` de `package.json` (la que dispara `prisma db seed` automáticamente en algunos comandos de Prisma) para que ningún comando de Prisma pueda invocar el seed implícitamente.
- Se agrega `prisma/README.md` con el modelo mental: qué hace cada comando, cuándo correrlo, cómo separar `.env.local` (dev) de credenciales de prod, y por qué nunca se debe poner el `DATABASE_URL` de Neon prod en el `.env` local.
- Se actualiza `AGENTS.md` con una sección breve "Seguridad de seeds" que apunta al `prisma/README.md` y enumera las invariantes (no `deleteMany` sin filtro, no correr seeds contra prod, etc.).
- Se documenta el procedimiento de **build de Vercel**: el script `build` actual (`prisma generate && next build`) ya no incluye seed — se deja una nota explícita en `prisma/README.md` para que nadie lo agregue por error.

## Capabilities

### New Capabilities

- `seed-safety`: invariantes y guards que protegen al script de seed contra ejecuciones destructivas en entornos no-locales o sin confirmación explícita. Cubre detección de entorno por `DATABASE_URL`, requerimiento de flag `ALLOW_DESTRUCTIVE_SEED`, separación de comandos idempotentes vs destructivos, e idempotencia del seed base.

### Modified Capabilities

<!-- Ninguna. No hay specs preexistentes relacionadas con el flujo de seed; las specs existentes (join-requests, lite-student-accounts, payment-tracking, personal-mode, user-roles, user-soft-delete) son del dominio y no se ven afectadas a nivel de requirements. -->

## Impact

**Código afectado:**
- `prisma/seed.ts` — refactor completo: separar destructivo de idempotente, usar `upsert`.
- `prisma/seed-guards.ts` (nuevo) — utilidades para detectar entorno y validar confirmación.
- `package.json` — nuevo script `seed:reset`, cambio de semántica de `seed`, remoción del bloque `prisma.seed`.
- `prisma/README.md` (nuevo) — documentación del modelo de seeds y su seguridad.
- `AGENTS.md` — sección nueva "Seguridad de seeds" apuntando al README.

**No afectado:**
- `prisma/schema.prisma` — sin cambios.
- Seeds por gym (`seed-atlas-gym.ts`, `seed-mila-fit.ts`, `seed-rompiendo-limites.ts`, `seed-personal.ts`, `seed-coupons.ts`) — ya son seguros (solo `create` con check de existencia o `upsert`), no se tocan.
- `src/`, server actions, API, UI — no se ven afectados.
- `vercel.json`, `next.config.ts` — sin cambios.

**Dependencias:**
- Ninguna nueva. Se usan APIs nativas de Node (`URL`, `process.env`) y Prisma.

**Riesgo de migración:**
- Bajo. El nuevo `npm run seed` siendo idempotente es seguro de correr múltiples veces. Quien tenga muscle memory de "seed = reset" tiene que aprender el comando nuevo, pero el viejo comportamiento sigue disponible vía `seed:reset` con las guards activadas.

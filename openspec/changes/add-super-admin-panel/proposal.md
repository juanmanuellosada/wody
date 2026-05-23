## Why

Hoy la gestión multi-tenant de Wody (alta de gyms, edición de cupones globales, whitelist de Wody Personal) se hace tocando la base de datos a mano o corriendo seeds (`prisma/seed-[slug].ts`). Eso es lento, propenso a errores, y requiere acceso técnico para tareas operativas que ya deberían estar automatizadas. Falta también una vista centralizada para saber cuándo hay que cobrar la suscripción a cada gym.

## What Changes

- Agregar el rol `SUPERADMIN` al enum `Role` y hacer `User.gymId` opcional (los super admins no pertenecen a ningún gym). **BREAKING** en el schema: requiere migración Prisma y ajustar tipos donde se asumía `gymId` no-null.
- Crear un panel en `/admin` (fuera de `[gymSlug]`) protegido por `role === 'SUPERADMIN'`, con tres secciones CRUD:
  - **Coupons**: ABM completo del modelo `Coupon` existente (ya es global, sin `gymId`). Incluye upload de logo a Vercel Blob (reemplaza `logoKey`).
  - **Gyms**: ABM con creación en DB (slug auto, kind, logo Blob, primaryColor, admin inicial con email + password). El seed `seed-[slug].ts` queda como respaldo manual auditable, no se autogenera.
  - **PersonalAccessWhitelist**: ABM de `email` + `note`, mostrando `consumedAt` (solo lectura).
- Agregar columnas `subscriptionNextPaymentDate DateTime?` y `subscriptionMonthlyAmount Int?` (monto en centavos ARS, opcional) a `Gym`. Son **informativas** — el panel solo las muestra y permite editarlas, no cobra ni notifica automáticamente.
- Vista de suscripciones en el panel: lista de gyms ordenada por `subscriptionNextPaymentDate` para saber a quién cobrar.
- Migrar `src/app/page.tsx` (landing pública) a DB-driven: pasar de imports estáticos de 4 gyms a `prisma.gym.findMany({ where: { blockedAt: null } })`.
- Instalar `@vercel/blob` para storage de logos. Endpoint server action para upload firmado.
- Migración Prisma con `migrate deploy` (sin shadow DB, según convención del proyecto en Neon).

## Capabilities

### New Capabilities

- `super-admin-panel`: panel `/admin` con auth por rol SUPERADMIN, layout, navegación entre secciones, y vista de suscripciones de gyms.
- `coupons-management`: CRUD de cupones globales desde el panel super admin, con upload de logos a Vercel Blob.
- `gyms-management`: CRUD de gimnasios desde el panel (alta en DB, edición de datos visuales, gestión de fechas informativas de suscripción).
- `landing-page`: contenido público de `wody.com.ar` (lista de gyms en la home), pasando a ser DB-driven.

### Modified Capabilities

- `user-roles`: agrega el rol `SUPERADMIN`, define el alcance de sus permisos (gestión cross-tenant) y formaliza que `User.gymId` puede ser null cuando `role === 'SUPERADMIN'`.
- `personal-mode`: agrega la capacidad de gestionar `PersonalAccessWhitelist` desde el super admin (alta, baja, edición de `note`).

## Impact

- **Schema Prisma** (`prisma/schema.prisma`):
  - `Role` enum: agregar `SUPERADMIN`.
  - `User.gymId`: pasar a opcional (`String?`).
  - `Gym`: agregar `subscriptionNextPaymentDate DateTime?`, `subscriptionMonthlyAmount Int?`.
  - Migración: una sola, aplicada con `npx prisma migrate deploy`.
- **Auth** (`src/lib/auth.ts`): la sesión debe tolerar `gymId === null` y propagar `role === 'SUPERADMIN'` al JWT.
- **Código que asume `User.gymId` not null**: revisar y ajustar (server actions, queries, redirects de login). El cambio es retrocompatible para datos existentes (todos los users actuales tienen `gymId`).
- **Rutas nuevas**: `src/app/admin/**` (page principal, secciones, layout).
- **Server actions nuevas**: `src/actions/super-admin/` (couponCrud, gymCrud, whitelistCrud).
- **Landing** (`src/app/page.tsx`): query a Prisma; eliminar imports estáticos de logos en `src/logos/` (mantenerlos para los 4 gyms existentes cuyo `Gym.logo` apunta a `/public/logos/{slug}.png`).
- **Dependencias nuevas**: `@vercel/blob`.
- **Env vars nuevas**: `BLOB_READ_WRITE_TOKEN` (proveída por Vercel al conectar Blob).
- **Sin impacto en**: cron jobs, push notifications, control de accesos, billing de Mercado Pago (las columnas nuevas son informativas y no se integran con MP en este cambio).

## Why

Wody Personal hoy es gratis para todos los users whitelisteados — no genera revenue B2C aunque la plataforma soporta a individuos completamente. Tres consecuencias:

1. No hay monetización del producto B2C, aunque cobra al lado B2B (gyms).
2. No hay funnel público para que un interesado en Personal se postule — solo se entra si el super-admin agrega el email a la whitelist manualmente. No escala.
3. La diferencia operativa entre gyms y users (mismo schema, distinta lógica de cobro) es invisible en el código actual: no hay campos MP en `User`, no hay billing UI para users, el cron solo evalúa gyms.

Este cambio cierra los tres gaps: agrega cobro mensual de $7.000 ARS/mes a Personal con trial 30 días, funnel B2C público en la landing con promoción automática de leads aprobados a `PersonalAccessWhitelist`, y self-cancellation desde el perfil del user (UX B2C estandar). Reutiliza al máximo la infra ya construida (webhook MP, cron, dos planes new/returning, emails transaccionales, panel de leads).

## What Changes

- **Modelo de cobro a nivel User para Wody Personal**: campos `mpPreapprovalId`, `mpSubscriptionStatus`, `mpSubscriptionStatusChangedAt`, `trialEndsAt` agregados a `User`. Reusa `paymentExempt` y `paymentExemptReason` ya existentes.
- **Dos planes nuevos en MP**: `MP_PREAPPROVAL_PLAN_ID_PERSONAL` (free_trial 30d, nuevos) y `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING` (free_trial 0d, re-suscripción).
- **BREAKING (data-migration)**: todos los users existentes con `gymId = <personal-gym-id>` AND `role = STUDENT` AND `canCreateOwnRoutines = true` se marcan como `paymentExempt = true` con razón `"Usuario Wody Personal pre-existente al lanzamiento del modelo de cobro (2026-05)"`. Mismo patrón que cuando lanzamos el cobro de gyms.
- **Webhook discriminador por prefix**: el `external_reference` que pasamos al checkout de MP se prefija con `user_` cuando es Personal. El handler del webhook splittea por prefix y actualiza `User` o `Gym` según corresponda. Gyms quedan con cuid pelado por backward compat.
- **Cron diario extendido**: nuevas fases para evaluar Personal users (trial vencido sin sub → bloqueo; paused/cancelled + grace 7d → bloqueo).
- **Sección Personal en la landing**: nueva pricing section con $7.000/mes + form de contacto Personal (pide solo `contactName`, `email`, `phone?`, `message?`).
- **Extensión de `GymSignupRequest`**: enum nuevo `SignupRequestType { GYM, PERSONAL }` con campo `type @default(GYM)`. Campos gym-específicos pasan a nullable. Cuando type=PERSONAL, el flujo de aprobación crea entry en `PersonalAccessWhitelist` y manda email con link a `/registro-personal` (no genera token de onboarding como gym — la whitelist actúa como gate).
- **Panel super-admin unificado de leads**: `/admin/signup-requests` muestra columna "Tipo" con badge y filtro por tipo. Detalle y acciones se adaptan al tipo.
- **Billing UI para Personal users**: nueva ruta `/personal/perfil/suscripcion` con los 3 casos (exento / trial / activa), incluyendo botón de **self-cancellation** (única diferencia de UX con gyms).
- **4 templates de email nuevos** específicos para Personal: lead recibido, lead aprobado, lead rechazado, payment failed.
- **Push notifications de fin de trial** para Personal users — análogas a las de gym (hitos 7, 3, 1, 0 días).

## Capabilities

### New Capabilities

- `personal-billing`: cobro mensual de $7.000 ARS/mes a users de Wody Personal mediante suscripción de Mercado Pago, con trial de 30 días, exención manual a nivel user, sincronización vía webhook firmado, bloqueo automático por cron (trial vencido + pago fallido con grace 7d), self-cancellation, push notifications en hitos del trial, y email transaccional al user cuando MP no puede cobrar.

### Modified Capabilities

- `gym-signup-onboarding`: el funnel B2B se extiende para soportar leads tipo `PERSONAL`. El form de contacto en la landing, la API pública, el panel super-admin y los emails se generalizan. El flujo de aprobación PERSONAL difiere del GYM: en vez de generar token de onboarding y mandar al wizard, se agrega el email a `PersonalAccessWhitelist` y se manda link a `/registro-personal` (que ya valida vía whitelist).

## Impact

- **Schema (`prisma/schema.prisma`)**: 4 campos nuevos en `User` (`mpPreapprovalId`, `mpSubscriptionStatus`, `mpSubscriptionStatusChangedAt`, `trialEndsAt`), 1 enum nuevo (`SignupRequestType`), 1 campo nuevo en `GymSignupRequest` (`type`), 3 campos gym-específicos pasan a nullable (`gymName`, `gymKindSuggested`, `expectedStudents`), 4 valores nuevos en enum `EmailLogType` (`PERSONAL_LEAD_RECEIVED`, `PERSONAL_LEAD_APPROVED`, `PERSONAL_LEAD_REJECTED`, `PERSONAL_PAYMENT_FAILED`).
- **Migración**: agrega columnas + enum + UPDATE para marcar exentos a Personal users pre-existentes (transacción atómica). Sin cambios destructivos.
- **MP dashboard (manual del usuario)**: crear 2 planes nuevos para Personal y cargar IDs en env vars.
- **Env vars**: 2 nuevas (`MP_PREAPPROVAL_PLAN_ID_PERSONAL`, `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`). Cargar en Vercel.
- **API pública**: el endpoint `POST /api/signup-request` extiende su body para aceptar `type` (default GYM).
- **Webhook (`/api/webhooks/mercadopago/route.ts`)**: lógica nueva de discriminación por prefix del `external_reference`. Branch que actualiza `User` cuando es Personal, `Gym` cuando es gym.
- **Cron (`/api/cron/check-gym-trials/route.ts`)**: 2 fases nuevas para Personal users (trial vencido + grace fallido). Push notifications de fin de trial también extendidas.
- **Server actions nuevas**: `src/actions/personal-billing.ts` con `getMyPersonalSubscriptionStatus`, `getMyPersonalCheckoutUrl`, `cancelMySubscription`.
- **Server actions modificadas**: `src/actions/super-admin/signup-request.ts` adapta `approveSignupRequest` y `createWhitelistEntry` para PERSONAL.
- **Lib**: `src/lib/mercadopago.ts` suma `getPersonalSubscriptionCheckoutUrl(userId)`. `src/lib/billing-emails.ts` suma wrapper de Personal payment-failed. `src/lib/signup-emails.ts` suma 3 wrappers Personal.
- **Componentes UI nuevos**: `PersonalPricingSection`, `PersonalContactForm` (landing), `PersonalSubscriptionPage`, `PersonalTrialEndingBanner`, `PersonalBillingSection` (billing del user). Más una nueva server component para `/personal/perfil/suscripcion`.
- **Componentes UI modificados**: `SignupRequestActions` y `WhitelistForm` adaptan según `type`. Página principal `src/app/page.tsx` agrega la `PersonalPricingSection`.
- **Doc**: nuevo `docs/billing-personal.md` con el modelo + setup MP + procedimiento operativo. `docs/onboarding-gyms.md` se renombra a `docs/onboarding-leads.md` (o se extiende) para cubrir ambos tipos de lead.
- **Sin impacto en**: gym billing (los planes y env vars de gym siguen igual), `payment-tracking` (alumno→gym, dominio distinto), modelo de gyms, super-admin panel base.

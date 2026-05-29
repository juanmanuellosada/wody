## Why

Hoy Wody no cobra a los gyms que usan la plataforma: existen campos de schema (`subscriptionMonthlyAmount`, `subscriptionNextPaymentDate`, `blockedAt`) pero ninguna integración real con un procesador de pagos, ningún flujo de trial, ningún mecanismo para que un gym configure su forma de pago, y ninguna forma de eximir manualmente a los gyms pre-existentes del cobro. Para empezar a monetizar la plataforma se necesita un modelo de suscripción mensual simple, automatizado por Mercado Pago, y compatible con los gyms ya operativos (que deben seguir trabajando sin pagar).

## What Changes

- Plan único de **$60.000 ARS/mes** por gym, editable por el super-admin caso por caso (negociación de precio especial).
- **30 días de trial** desde la creación del gym; al vencer sin suscripción activa y sin estar exento, el gym se bloquea reutilizando `Gym.blockedAt`.
- Integración con **Mercado Pago Suscripciones** vía `preapproval_plan` (un único plan creado en el dashboard de MP; los gyms se suscriben a ese plan).
- Nuevo flag de **exención manual** a nivel `Gym` (`paymentExempt`, `paymentExemptReason`), controlado solo por el super-admin. **BREAKING**: la migración marca como exentos a todos los gyms existentes en el momento del deploy, para no cortarles el servicio.
- **Webhook** `POST /api/webhooks/mercadopago` para recibir notificaciones de cobro y sincronizar el estado de la suscripción de cada gym.
- **Cron diario** que evalúa fin de trial y aplica `blockedAt` cuando corresponde.
- **UI super-admin**: sección "Suscripción y exención" en `/admin/gyms/[id]` con toggle de exento, estado MP, fecha de trial y botón para cancelar suscripción (solo super-admin puede cancelar, para evitar bajas accidentales).
- **UI dueño del gym**: sección `/[gymSlug]/admin/billing` con estado de suscripción, días restantes de trial, link para configurar/reconfigurar tarjeta. Banner persistente los últimos 7 días del trial.
- Actualización del doc `docs/billing-mercadopago.md` reemplazando el plan ambicioso (tarifa de alta + máquina de estados rica + self-signup) por el modelo simplificado que efectivamente se implementa.

**NO incluido en este cambio** (decisiones de scope explícitas, pueden venir después):
- Tarifa de alta one-time.
- Self-signup público en `/signup` (los gyms los sigue creando el super-admin).
- Máquina de estados rica con `PROVISIONING`, `PAST_DUE`, `SUSPENDED` separados — se simplifica a: `trial → active → blocked`.
- Modelos `GymSignupRequest` y `BillingEvent`.
- Múltiples planes / tiers.
- Facturación electrónica / AFIP / comprobantes.

## Capabilities

### New Capabilities

- `gym-billing`: cobro mensual del SaaS a cada gym mediante suscripción de Mercado Pago, ciclo de trial de 30 días, exención manual por gym, sincronización vía webhooks de MP, y bloqueo automático por fin de trial o falta de pago.

### Modified Capabilities

(Ninguna. `payment-tracking` cubre el dominio alumno→gym, no este dominio gym→Wody.)

## Impact

- **Schema (`prisma/schema.prisma`)**: nuevos campos en `Gym` (`trialEndsAt`, `paymentExempt`, `paymentExemptReason`, `mpPreapprovalId`, `mpSubscriptionStatus`). Default de `subscriptionMonthlyAmount` pasa a `60000`.
- **Migración**: agregar columnas + data-migration que marca `paymentExempt = true` con razón `"Gym pre-existente al lanzamiento del modelo de cobro (2026-05)"` para todos los gyms creados antes del deploy.
- **Dependencia nueva**: `mercadopago` SDK en el `package.json` raíz (NO en `remotion/`).
- **Env vars nuevas**: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PREAPPROVAL_PLAN_ID`. Se agregan a `.env.example` y se documentan en `docs/billing-mercadopago.md`.
- **API**: nuevo endpoint `POST /api/webhooks/mercadopago`.
- **Server actions**: nuevas en `src/actions/super-admin/gym.ts` (`setGymPaymentExempt`, `cancelGymSubscription`) y archivo nuevo `src/actions/billing.ts` (lado dueño del gym).
- **UI**: secciones nuevas en `/admin/gyms/[id]` y `/admin`; nueva ruta `/[gymSlug]/admin/billing`; componente nuevo de banner de fin de trial.
- **Cron**: nueva ruta en `src/app/api/cron/` para chequeo diario de trials vencidos. Hay que registrarla también en `vercel.json` o en la config equivalente.
- **Documentación**: reescribir `docs/billing-mercadopago.md`.
- **Sin impacto en**: `User.paymentExempt` (mecanismo distinto a nivel alumno de Wody Personal — se mantiene intacto), `payment-tracking` spec, autenticación, modelo de rutinas/RM/accesos.

## Why

Algunos gyms (hoy Atlas y Mila Fit) pagan el SaaS por fuera de Mercado Pago: el super-admin cobra a mano y mueve la fecha de vencimiento manualmente. Hoy esos gyms están como `paymentExempt = true`, así que no reciben ningún aviso de cobro. Hay que sacarlos de exento sin que el cron los bloquee de inmediato (tienen el trial vencido y sin MP), y darles recordatorios de pago a los dueños antes de cada vencimiento.

## What Changes

- **Nuevo modo de cobro manual** a nivel gym (`Gym.selfManagedBilling: Boolean`, default `false`): el gym debe pagar pero **sin** suscripción de Mercado Pago. El vencimiento lo gobierna `subscriptionNextPaymentDate`, que el super-admin mueve a mano cada vez que el dueño paga.
- **Toggle en el panel super-admin** (`GymForm`) para activar/desactivar el modo manual y editar `subscriptionNextPaymentDate` con el DatePicker del sistema.
- **Recordatorios push a los `ADMIN`** del gym por hitos a 10, 7, 3, 1 y 0 días antes de `subscriptionNextPaymentDate`, emitidos desde el cron diario existente.
- **Indicador in-app para el `ADMIN`** al abrir la app (banner análogo al de los STUDENTs): al día / por vencer / vencido, según `subscriptionNextPaymentDate`.
- **Bloqueo tras período de gracia**: el cron bloquea (`blockedAt = now()`) los gyms en modo manual cuando `subscriptionNextPaymentDate + autoBlockAfterDays` ya pasó. El desbloqueo ya existe (`unblockGym` + botón en `GymForm`); no se construye nada nuevo.
- **Exclusión de las fases de bloqueo por MP/trial**: los gyms en modo manual NO se bloquean por la Condición A (trial vencido sin MP) ni por la Condición B (pago fallido en MP), porque nunca tendrán `mpPreapprovalId`.
- **El flujo de suscripción de MP queda oculto** para gyms en modo manual: el banner de fin de trial y la pantalla de configurar tarjeta no aplican.
- **Cambio de datos**: `atlas-gym` y `mila-fit` pasan de `paymentExempt = true` a `paymentExempt = false` + `selfManagedBilling = true`, con su `subscriptionNextPaymentDate` cargada. Se hace desde el toggle del super-admin para no hardcodear slugs.

**Refinamiento (iteración 2)**: el flag `selfManagedBilling` pasa a tener un **único** efecto — ocultar el flujo de pago por Mercado Pago. Los recordatorios push, el indicador in-app, el estado en la página de suscripción y el bloqueo por vencimiento + gracia se rigen por la presencia de `subscriptionNextPaymentDate` (no exento, no PERSONAL), independientemente del flag. Así, **cualquier** gym con fecha de vencimiento cargada muestra su vencimiento y recibe avisos; los gyms con MP autorizado quedan excluidos del bloqueo (los cobra MP).

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `gym-billing`: se introduce el modo de cobro manual (sin MP) como tercer modo junto a "suscripción MP" y "exento". Cambian los requisitos de bloqueo por cron (nueva condición de bloqueo por vencimiento + gracia, y exclusión del modo manual de las condiciones basadas en MP/trial), se agregan recordatorios push por hitos basados en `subscriptionNextPaymentDate`, un indicador in-app para el `ADMIN`, y la administración del flag por el super-admin.

## Impact

- **Schema/DB**: nuevo campo `Gym.selfManagedBilling Boolean @default(false)`. Migración Prisma aplicada con `migrate deploy` (la shadow DB no está configurada).
- **Cron**: `src/app/api/cron/check-gym-trials/route.ts` — nueva fase de recordatorios por hitos y nueva condición de bloqueo por vencimiento; exclusión del modo manual de las fases A y B.
- **Push**: `src/lib/push.ts` — helper para recordatorio de vencimiento manual a los admins (reutiliza el patrón de `sendTrialEndingPush`).
- **Actions**: `src/actions/super-admin/gym.ts` (set del flag + fecha), `src/actions/billing.ts` (`getMySubscriptionStatus` devuelve `subscriptionNextPaymentDate` y `selfManagedBilling`).
- **UI**: `src/components/admin/GymForm.tsx` (toggle + DatePicker), nuevo banner para `ADMIN` montado en `src/app/[gymSlug]/layout.tsx`, y ocultar `TrialEndingBanner`/flujo MP cuando el modo manual está activo.
- **Datos**: `atlas-gym` y `mila-fit` migran de exento a modo manual vía el panel super-admin.
- **Sin impacto** en multi-tenancy (todas las queries siguen filtrando por `gymId`) ni en gyms `kind = PERSONAL`.

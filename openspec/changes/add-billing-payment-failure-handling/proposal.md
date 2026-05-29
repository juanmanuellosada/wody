## Why

El modelo de cobro actual (lanzado en `add-gym-mp-billing`, archivado 2026-05-28) bloquea gyms solo cuando vence el trial sin suscripción configurada. Pero si una **suscripción ya activa falla** (tarjeta vencida, sin fondos, baja de la tarjeta), Mercado Pago hace sus retries automáticos y termina pasando la suscripción a `paused` o `cancelled` — y desde ahí Wody sigue funcionando indefinidamente sin que nadie se entere. Tres consecuencias:

1. El super-admin tiene que revisar manualmente el dashboard `/admin` para detectar gyms con suscripción no autorizada. No escala.
2. El dueño del gym no se entera de que su tarjeta falló hasta que el super-admin lo bloquea o él descubre que dejó de cobrársele.
3. Si un gym se cancela y vuelve a suscribirse al mismo plan, MP le otorga **otros 30 días gratis** porque el `free_trial` se aplica por suscripción nueva, no por usuario. Esto es un regalo involuntario.

Este cambio cierra los tres gaps: notificación proactiva al dueño cuando el cobro falla, bloqueo automático con grace period de 7 días, y un segundo plan en MP sin `free_trial` para re-suscripciones.

## What Changes

- **BREAKING para operación manual**: el cron empieza a bloquear gyms con `mpSubscriptionStatus IN ('paused', 'cancelled')` que llevan más de 7 días en ese estado. Hasta ahora ese bloqueo era 100% manual del super-admin.
- Nuevo campo `Gym.mpSubscriptionStatusChangedAt: DateTime?` actualizado por el webhook cada vez que cambia `mpSubscriptionStatus`. Es el reloj del grace period.
- Webhook dispara email transaccional `payment-failed` al dueño del gym cuando el status entra por primera vez en `paused/cancelled`. Idempotente: no se re-envía si el status anterior ya era paused/cancelled.
- Cron diario agrega una fase nueva: bloquea gyms cuyo `mpSubscriptionStatus` está en paused/cancelled hace más de 7 días, no exentos, no Personal.
- Nuevo plan en Mercado Pago "Suscripción mensual Wody — Re-activación" con `free_trial = 0 días`. El dueño que vuelve a suscribirse después de cancelar no recibe otros 30 días gratis.
- `getSubscriptionCheckoutUrl(gymId)` ahora consulta el gym y elige el plan: si `mpPreapprovalId === null` usa el plan original (con free_trial), si no es null usa el de re-activación.
- Nuevo valor en enum `EmailLogType`: `PAYMENT_FAILED`.
- Nuevo email template `PaymentFailedEmail.tsx`.

## Capabilities

### New Capabilities

(Ninguna.)

### Modified Capabilities

- `gym-billing`: se modifican los requirements de "Plan único" (ahora son dos), "Bloqueo automático" (suma la fase del grace period por pago fallido), y se agregan dos requirements nuevos relacionados con el flujo de pago fallido (tracking del cambio de status + notificación email + selección automática de plan en re-activación).

## Impact

- **Schema (`prisma/schema.prisma`)**: 1 campo nuevo (`Gym.mpSubscriptionStatusChangedAt`), 1 valor nuevo en enum `EmailLogType` (`PAYMENT_FAILED`).
- **Migración**: solo agrega columna nullable y valor de enum — sin tocar datos existentes ni romper schema.
- **MP dashboard (manual)**: crear el segundo plan con `free_trial = 0 días`. Documentado en el doc actualizado.
- **Env vars**: `MP_PREAPPROVAL_PLAN_ID` (ya existente) sigue siendo el plan original. Se agrega `MP_PREAPPROVAL_PLAN_ID_RETURNING` con el ID del nuevo plan. Cargar la nueva en Vercel (Production + Preview).
- **Código**:
  - `src/lib/mercadopago.ts`: `getSubscriptionCheckoutUrl` recibe `gymId` y consulta el gym para elegir plan. Update callers.
  - `src/app/api/webhooks/mercadopago/route.ts`: actualiza `mpSubscriptionStatusChangedAt`, dispara email payment-failed cuando aplica.
  - `src/app/api/cron/check-gym-trials/route.ts`: nueva fase de bloqueo por grace period.
  - `src/lib/email/templates/PaymentFailedEmail.tsx`: nuevo template.
  - `src/lib/billing-emails.ts` (nuevo) o extender `src/lib/signup-emails.ts`: wrapper `sendPaymentFailedEmail(gym)`.
- **Doc**: actualizar `docs/billing-mercadopago.md` con el flujo de pago fallido, los dos planes, y las env vars renombradas.
- **Sin cambios de UI**: la billing page del dueño ya maneja el caso `paused/cancelled` con la sección de "Configurar tarjeta" — el email solo notifica activamente.
- **Sin impacto en**: signup-onboarding (independiente), super-admin panel, modelo de leads, módulo de pagos alumno→gym (`payment-tracking`).

## Why

Hoy el período de prueba se gestiona en dos lados a la vez: la app es dueña del acceso (`trialEndsAt = createdAt + 30d` + cron de bloqueo), pero el cobro usa un `preapproval_plan` de Mercado Pago con `free_trial = 30 días`. Como el `free_trial` de MP arranca cuando el dueño vincula la tarjeta —no en el alta del gym—, quien vincula al final del trial obtiene hasta **60 días gratis** (doble-trial). El parche actual (un segundo plan `RETURNING` con `free_trial = 0`) solo cubre re-suscripciones, no el caso principal. Conviene que la app sea la **única** dueña del trial y que MP se ocupe solo de cobrar, en la fecha exacta que la app decide.

## What Changes

- **BREAKING** (interno, no afecta datos): se reemplaza el flujo de suscripción "redirect a checkout por plan" por la **creación de un `preapproval` por API** (`POST /preapproval`, sin plan asociado) con `card_token_id` + un `auto_recurring.free_trial` **dinámico en días** = días restantes del trial. El primer cobro cae exacto al fin del trial de la app.
- La captura de tarjeta pasa a ser **in-app** mediante MP Bricks/CardForm (tokenización del lado del cliente; la tarjeta nunca toca el server de Wody), en lugar de redirigir al checkout hosteado de MP.
- Se **elimina el uso de `free_trial` de Mercado Pago**: el trial deja de existir en MP y queda 100% en la app.
- Se **elimina el plan `RETURNING`** y toda la lógica de selección de plan por historial (`mpPreapprovalId` previo). Ya no hace falta: sin `free_trial` no hay nada que re-explotar.
- Se simplifican las variables de entorno: se deja de depender de `MP_PREAPPROVAL_PLAN_ID_RETURNING` y `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`.
- Cambio **simétrico** para gyms (modelo `Gym`) y para Wody Personal (modelo `User`, `external_reference = "user_<id>"`).
- El webhook firmado y el cron de bloqueo/grace **no cambian de lógica** (siguen leyendo `trialEndsAt`, `mpSubscriptionStatus`, `mpSubscriptionStatusChangedAt`); solo se confirma su compatibilidad.
- Compatibilidad: las suscripciones ya creadas bajo el esquema viejo (gyms/users con `mpPreapprovalId` existente) **siguen funcionando** sin migración.

## Capabilities

### New Capabilities
<!-- Ninguna capability nueva: se modifican las existentes de billing. -->

### Modified Capabilities
- `gym-billing`: cambia el requirement de planes (de dos planes con `free_trial` estático a suscripción **sin plan**, monto en el payload) y el requirement de suscripción del gym (de redirect-a-checkout a creación de `preapproval` por API con `card_token_id` + `free_trial` dinámico en días, captura de tarjeta in-app con Bricks). Se elimina la selección de plan por historial.
- `personal-billing`: mismo cambio aplicado a Personal — de "dos planes Mercado Pago para Personal" a suscripción sin plan con `free_trial` dinámico, y de redirect-a-checkout a `preapproval` por API con `external_reference = "user_<userId>"`.

## Impact

- **Código**:
  - `src/lib/mercadopago.ts` — reemplazar `getSubscriptionCheckoutUrl` (construcción de URL con `preapproval_plan_id`) por funciones espejo que creen el `preapproval` por API (sin plan) con `card_token_id` y `auto_recurring.free_trial` dinámico. Conservar `verifyMpWebhookSignature`, `parseMpSubscriptionStatus`, `cancelMpPreapproval`.
  - `src/actions/billing.ts` (y su equivalente Personal) — el flujo de alta de tarjeta deja de devolver una URL de redirect y pasa a recibir un token de tarjeta y disparar la creación del `preapproval`.
  - UI del dueño (banner/página de billing en `/[gymSlug]/admin/billing`) y UI Personal (`/personal/perfil/suscripcion`) — incorporar el componente de captura de tarjeta (MP Bricks) en lugar del botón que redirige a MP.
  - `src/app/api/webhooks/mercadopago/route.ts` — sin cambios de lógica (verificar compatibilidad de eventos y `external_reference`).
  - `src/app/api/cron/check-gym-trials/route.ts` — sin cambios (verificar).
- **Dependencias**: SDK/JS de Mercado Pago Bricks en el cliente (script de MP). No requiere cambios en `prisma/schema.prisma` (los campos `trialEndsAt`, `mpPreapprovalId`, `mpSubscriptionStatus`, `mpSubscriptionStatusChangedAt` ya existen en `Gym` y `User`).
- **Config / env**: deja de usarse `MP_PREAPPROVAL_PLAN_ID_RETURNING` y `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`; se requiere la public key de MP para Bricks en el cliente.
- **Docs**: actualizar `docs/billing-mercadopago.md`.

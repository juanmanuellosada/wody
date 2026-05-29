# Billing con Mercado Pago

## 1. Resumen

Wody cobra a cada gym **$60.000 ARS por mes** mediante una suscripción de Mercado Pago. El modelo es deliberadamente simple: un único plan creado en el dashboard de MP (un `preapproval_plan`), los gyms se suscriben a ese plan desde la UI de Wody, y MP gestiona el cobro mensual automático. Cada gym tiene 30 días de trial desde su creación. Al vencer el trial sin suscripción activa, un cron diario bloquea el gym reutilizando el campo `Gym.blockedAt` ya existente. Los gyms pre-existentes al lanzamiento del modelo de cobro (2026-05), y Wody Personal, están exentos permanentemente.

---

## 2. Modelo de cobro

### Plan único en Mercado Pago

Se usa un `preapproval_plan` único creado manualmente en el dashboard de MP. Todos los gyms se suscriben al mismo plan. El ID del plan en producción es:

```
02dca3f44cc44c5e8089cd00c25a7f08
```

Este valor se carga en la env var `MP_PREAPPROVAL_PLAN_ID`.

### Trial de 30 días

Al crear un gym (desde el panel de super-admin), se setea `Gym.trialEndsAt = createdAt + 30 días`. El plan de MP también está configurado con **"Prueba gratis" = 30 días**, de modo que si el dueño carga su tarjeta a mitad del trial, MP no cobra hasta que venza su propio free_trial. Esto produce una pequeña "ventana extra" para suscriptores muy tempranos, aceptada a cambio de mantener el modelo simple (ver `design.md` §0 para el análisis completo).

### Exención manual

El super-admin puede marcar cualquier gym con `paymentExempt = true` y un campo de texto `paymentExemptReason` desde `/admin/gyms/[id]`. Los gyms exentos nunca se bloquean por el cron, independientemente del estado de su trial o suscripción.

### Wody Personal

El gym `personal` (`kind = PERSONAL`) está doblemente protegido:

- La migración de deploy lo marcó como exento.
- El cron excluye explícitamente `kind = PERSONAL` de su query de bloqueo.

Esto evita que pueda bloquearse accidentalmente incluso si alguien desmarca la exención desde la UI.

### Gyms pre-existentes

Todos los gyms creados antes del deploy de este modelo (2026-05) fueron marcados como exentos en la misma transacción de la migración, con razón:

```
Gym pre-existente al lanzamiento del modelo de cobro (2026-05)
```

### Bloqueo

El cron diario (`/api/cron/check-gym-trials`) setea `blockedAt = now()` en los gyms que cumplen todas las condiciones:

- `trialEndsAt < now`
- `mpPreapprovalId IS NULL` (no se suscribieron)
- `paymentExempt = false`
- `blockedAt IS NULL`
- `kind != PERSONAL`

El webhook de MP actualiza `mpSubscriptionStatus` cuando el estado de una suscripción cambia (ej: pasa a `cancelled`), pero **no** aplica el bloqueo. Solo el cron decide bloquear. Esto evita race conditions y simplifica el flujo.

---

## 3. Componentes en el código

| Componente | Qué hace |
|---|---|
| [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts) | Cliente MP (singleton), validación de firma HMAC del webhook, URL de checkout del plan, cancelación de suscripción, union type `MpSubscriptionStatus` y parser tolerante |
| [`src/actions/billing.ts`](../src/actions/billing.ts) | Server actions para el dueño del gym: `getMySubscriptionStatus` (estado, días restantes de trial) y `getMyCheckoutUrl` (URL de MP para configurar tarjeta) |
| [`src/actions/super-admin/gym.ts`](../src/actions/super-admin/gym.ts) | `setGymPaymentExempt(gymId, exempt, reason)` y `cancelGymSubscription(gymId)` — solo invocables por SUPERADMIN |
| [`src/app/api/webhooks/mercadopago/route.ts`](../src/app/api/webhooks/mercadopago/route.ts) | Handler POST del webhook de MP: valida firma, parsea evento, actualiza `mpPreapprovalId` y `mpSubscriptionStatus` en el gym correspondiente |
| [`src/app/api/cron/check-gym-trials/route.ts`](../src/app/api/cron/check-gym-trials/route.ts) | Cron diario: Fase 1 bloquea gyms con trial vencido sin suscripción; Fase 2 envía push notifications a los hitos de días |
| [`src/app/[gymSlug]/admin/billing/page.tsx`](../src/app/[gymSlug]/admin/billing/page.tsx) | UI del dueño del gym: muestra estado (exento / en trial / activo), días restantes y botón para configurar tarjeta en MP |
| [`src/components/admin/SubscriptionSection.tsx`](../src/components/admin/SubscriptionSection.tsx) | UI super-admin en `/admin/gyms/[id]`: toggle de exención con razón, badge de estado MP, link al preapproval en MP, botón de cancelación con confirmación |
| [`src/components/billing/TrialEndingBanner.tsx`](../src/components/billing/TrialEndingBanner.tsx) | Banner sticky para ADMINs con `daysLeft <= 7`; amarillo si el trial sigue activo, rojo si ya venció. No se puede dismissar. CTA a `/[gymSlug]/admin/billing` |

---

## 4. Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `MP_ACCESS_TOKEN` | Access token de producción de la app "Wody" en MP (Panel de developers → Credenciales de producción) |
| `MP_PREAPPROVAL_PLAN_ID` | ID del `preapproval_plan` creado en el dashboard de MP: `02dca3f44cc44c5e8089cd00c25a7f08` |
| `MP_WEBHOOK_SECRET` | Clave secreta generada por MP al configurar el webhook (Panel de developers → app Wody → Webhooks → Modo productivo) |
| `CRON_SECRET` | Secret compartido con los demás crons del proyecto, para autenticar el endpoint del cron |

Las tres vars MP se cargan en Vercel (Production + Preview). Los placeholders están en `.env.example`.

---

## 5. Procedimiento de setup en Mercado Pago

Este setup es manual y debe hacerse **antes del primer deploy** a producción.

### 5.1 Crear el `preapproval_plan`

1. Ir a [https://www.mercadopago.com.ar/subscriptions/plans](https://www.mercadopago.com.ar/subscriptions/plans).
2. Crear un plan nuevo con:
   - Descripción: "Suscripción mensual Wody"
   - Monto: $60.000 ARS
   - Frecuencia: mensual
   - **Prueba gratis: 30 días** (campo obligatorio para alinear con el trial de Wody)
3. Anotar el `id` que devuelve MP. Cargarlo como `MP_PREAPPROVAL_PLAN_ID` en Vercel.

### 5.2 Crear la app y obtener el Access Token

1. Ir al panel de developers de MP: [https://www.mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel).
2. Crear (o seleccionar) la app "Wody".
3. En "Credenciales de producción", copiar el Access Token.
4. Cargarlo como `MP_ACCESS_TOKEN` en Vercel.

### 5.3 Configurar el webhook

1. En el panel de developers, ir a la app Wody → **Webhooks** → **Modo productivo**.
2. URL de notificación: `https://<dominio-prod>/api/webhooks/mercadopago`.
3. Eventos a suscribir (sección "Planes y suscripciones"):
   - `subscription_preapproval`
   - `subscription_authorized_payment`
4. Generar la clave secreta (MP la llama "Firma secreta" o "Webhook secret").
5. Cargar esa clave como `MP_WEBHOOK_SECRET` en Vercel.

---

## 6. Operación día a día (para el super-admin)

### Eximir un gym

1. Ir a `/admin/gyms/[id]`, sección "Suscripción y exención".
2. Marcar el checkbox "Exento de pago".
3. Completar el campo "Motivo de exención" (obligatorio al marcar como exento).
4. Clic en "Guardar exención".

Para quitar la exención: desmarcar el checkbox y guardar (el motivo se borra automáticamente).

### Cancelar una suscripción

1. Ir a `/admin/gyms/[id]`, sección "Suscripción y exención".
2. El botón "Cancelar suscripción" aparece solo si el gym tiene un `mpPreapprovalId` registrado.
3. Confirmar en el dialog. La action llama a la API de MP para cancelar el `preapproval` y actualiza `mpSubscriptionStatus = 'cancelled'` en la DB.

El dueño del gym **no puede cancelar** desde la UI de su panel — solo puede contactar al super-admin. Esta es una decisión de producto deliberada (ver `design.md` §6).

### Desbloquear un gym bloqueado por error

Si un gym quedó con `blockedAt` por error del cron, el super-admin puede desbloquearlo desde `/admin/gyms/[id]` con el botón de unblock, y luego marcar el gym como exento si corresponde.

---

## 7. Cron y push notifications

### Schedule

El cron `/api/cron/check-gym-trials` corre todos los días a las **06:00 UTC (03:00 ART)**, registrado en `vercel.json`:

```json
{ "path": "/api/cron/check-gym-trials", "schedule": "0 6 * * *" }
```

### Fase 1: bloqueo de gyms

Bloquea los gyms con trial vencido, sin suscripción, no exentos, no bloqueados y no Personal.

### Fase 2: push notifications de fin de trial

En la misma ejecución, después de la query de bloqueo, el cron recorre todos los gyms en trial (no exentos, sin suscripción activa, no bloqueados) y calcula `daysLeft` para cada uno. Si `daysLeft ∈ {7, 3, 1, 0}`, llama a `sendTrialEndingPush(gymId, daysLeft)` definida en [`src/lib/push.ts`](../src/lib/push.ts).

Mensajes enviados (a todos los ADMINs del gym):

| `daysLeft` | Título | Cuerpo |
|---|---|---|
| 7 | "Tu trial termina en 7 días" | "Configurá tu tarjeta para que tu gym no se suspenda." |
| 3 | "Tu trial termina en 3 días" | "Faltan pocos días para configurar tu tarjeta." |
| 1 | "Tu trial termina mañana" | "Última oportunidad para configurar tu tarjeta." |
| 0 | "Tu trial venció hoy" | "Configurá tu tarjeta ahora para evitar la suspensión." |

Para el sistema de push genérico (suscripciones de dispositivos, `sendPushToUser`), ver [`docs/notificaciones-push.md`](./notificaciones-push.md).

### Respuesta del cron

```json
{
  "blockedCount": 0,
  "gymIds": [],
  "pushSummary": [{ "gymId": "...", "daysLeft": 7, "sent": 2, "removed": 0 }]
}
```

---

## 8. Sincronización del estado vía webhook

Cuando MP procesa un evento de suscripción, envía un `POST` a `/api/webhooks/mercadopago`. El handler:

1. Valida la firma HMAC-SHA256 usando `x-signature`, `x-request-id` y el query param `data.id`.
2. Si la firma es inválida o falta, responde `401`.
3. Parsea el `type` del evento. Solo procesa `subscription_preapproval` y `subscription_authorized_payment`. Otros tipos devuelven `200` sin hacer nada (MP no reintenta).
4. Consulta la API de MP con el `preapproval_id` del evento para obtener el estado actual y el `external_reference` (= `gymId`).
5. Actualiza `Gym.mpPreapprovalId` y `Gym.mpSubscriptionStatus` en la DB.
6. Responde `200` en éxito, `500` si hubo un error interno (MP reintenta en caso de 500).

El estado `mpSubscriptionStatus` es un string libre (`'pending'`, `'authorized'`, `'paused'`, `'cancelled'`). Si MP envía un valor desconocido, el parser lo mapea a `'unknown'` y loggea un warning. El gym sigue funcionando normalmente.

---

## 9. Cómo probar el webhook (smoke test)

1. Ir al panel de developers de MP → app Wody → Webhooks → "Simular notificación".
2. Tipo de evento: `subscription_preapproval` o `subscription_authorized_payment`.
3. Data ID: un `preapproval_id` real de tu cuenta (o sandbox si disponible).
4. Verificar en los logs de Vercel que el handler procesó el evento y actualizó el gym.

Alternativamente, para probar el cron localmente:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check-gym-trials
```

---

## 10. Errores conocidos / pitfalls

- **Webhook responde 401 con firma válida**: verificar que `MP_WEBHOOK_SECRET` en Vercel coincide exactamente (sin espacios ni saltos de línea) con el secret configurado en el panel de MP para el modo productivo. Los secrets de sandbox y producción son diferentes.
- **Cron responde 500 con "CRON_SECRET not configured"**: falta la env var `CRON_SECRET` en Vercel.
- **Gym bloqueado por error**: el super-admin puede desbloquearlo desde `/admin/gyms/[id]` y marcar exento si corresponde.
- **`mpSubscriptionStatus` queda en `'unknown'`**: MP envió un estado no contemplado en el parser. El gym sigue funcionando — solo loggea un warning. Si el estado nuevo es permanente, agregar el string al union `MpSubscriptionStatus` en `src/lib/mercadopago.ts`.
- **El plan de MP no existe al hacer el deploy**: si `MP_PREAPPROVAL_PLAN_ID` apunta a un plan inexistente o no fue cargado, el botón "Configurar tarjeta" del dueño falla al construir la URL. Los gyms exentos y el resto de la plataforma siguen funcionando sin interrupciones.
- **Suscripción creada antes de que el cron corra**: hay una latencia de hasta 24h entre que el trial vence y el cron bloquea el gym. Esta ventana es una decisión aceptada del modelo.

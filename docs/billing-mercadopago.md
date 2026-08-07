# Billing con Mercado Pago

> Este doc cubre el cobro a **gimnasios** (modelo B2B, suscripción a nivel Gym) y a **Wody Personal** (modelo B2C, suscripción a nivel User). Ambos flujos son simétricos y se describen en este único documento.

## 1. Resumen

Wody cobra a cada gym **$40.000 ARS/mes** y a cada usuario de Wody Personal **$7.000 ARS/mes** mediante suscripciones de Mercado Pago creadas por API (sin plan asociado). El período de prueba (15 días) es **propiedad exclusiva de la app**: `Gym.trialEndsAt` y `User.trialEndsAt` son la fuente de verdad del trial; Mercado Pago **no maneja ningún `free_trial` configurado en un plan**.

Al suscribirse, la app calcula cuántos días restan del trial (`díasRestantes = ceil((trialEndsAt - now) / 1 día)`) y crea un `preapproval` sin plan, en estado `"pending"`, con un `free_trial` dinámico en días. MP difiere el primer cobro hasta que venza ese free_trial — que coincide exactamente con el fin del trial de la app. Si el trial ya venció (`díasRestantes <= 0`), el cobro es inmediato (~1h).

La vinculación del medio de pago es **vía redirect**: MP devuelve un `init_point` al que se redirige al usuario para que autorice la suscripción en el sitio de Mercado Pago; no hay captura de tarjeta in-app en Wody.

---

## 2. Modelo de cobro

### Suscripción sin plan asociado

Las suscripciones se crean mediante `POST /preapproval` **sin `preapproval_plan_id`**: el monto y el ciclo se definen directamente en el payload (`auto_recurring.transaction_amount`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). No se usan ni se requieren planes creados en el dashboard de MP.

| Parámetro | Gym | Personal |
|---|---|---|
| `transaction_amount` | `40000` | `7000` |
| `currency_id` | `ARS` | `ARS` |
| `external_reference` | `gymId` | `"user_<userId>"` |
| `payer_email` | email del ADMIN | email del user Personal |
| `status` | `"pending"` | `"pending"` |

### Trial 100% en la app

El período de prueba de 15 días está definido en `Gym.trialEndsAt` y `User.trialEndsAt`. Mercado Pago no gestiona ningún `free_trial` de plan. Al vincular la tarjeta, la app calcula `díasRestantes` y, si `>= 1`, incluye:

```json
"auto_recurring": {
  "free_trial": { "frequency": <díasRestantes>, "frequency_type": "days" }
}
```

Si `díasRestantes <= 0` (trial ya vencido), se omite `free_trial` y el cobro ocurre en ~1h.

### Exención manual

El super-admin puede marcar cualquier gym (o user Personal) con `paymentExempt = true` y un campo `paymentExemptReason`. Los tenants exentos nunca se bloquean por el cron, independientemente del estado de su trial o suscripción.

### Gym Personal (`kind = PERSONAL`)

El gym `personal` está protegido:

- La migración de deploy lo marcó como exento.
- El cron excluye explícitamente `kind = PERSONAL` de su query de bloqueo de gyms.

### Gyms pre-existentes

Todos los gyms creados antes del deploy del modelo de cobro (2026-05) fueron marcados como exentos en la migración, con razón `"Gym pre-existente al lanzamiento del modelo de cobro (2026-05)"`.

### Monto de cobro

El monto efectivo cobrado por MP es siempre la **constante** del payload ($40.000 gym / $7.000 Personal). El campo `Gym.subscriptionMonthlyAmount` en la DB es solo una referencia informativa del precio negociado (editable por el super-admin desde `/admin/gyms/[id]`); no afecta el monto real que cobra MP.

### Bloqueo

El cron diario (`/api/cron/check-gym-trials`) setea `blockedAt = now()` en los gyms (y users Personal) que cumplen todas las condiciones:

- `trialEndsAt < now`
- `mpPreapprovalId IS NULL` (no se suscribieron)
- `paymentExempt = false`
- `blockedAt IS NULL`
- (para gyms) `kind != PERSONAL`

El webhook de MP actualiza `mpSubscriptionStatus` cuando el estado de una suscripción cambia (ej: pasa a `cancelled`), pero **no** aplica el bloqueo. Solo el cron decide bloquear.

El cron también bloquea tenants con suscripción en `paused` o `cancelled` que llevan más de 7 días en ese estado (ver §7 "Flujo de pago fallido").

---

## 3. Componentes en el código

| Componente | Qué hace |
|---|---|
| [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts) | Cliente MP (singleton), `createGymSubscription`, `createPersonalSubscription` (crean el preapproval por API con `free_trial` dinámico), `calcDaysRemaining`, validación de firma HMAC del webhook, `cancelMpPreapproval`, union type `MpSubscriptionStatus` y parser tolerante |
| [`src/actions/billing.ts`](../src/actions/billing.ts) | Server actions para el dueño del gym: `getMySubscriptionStatus` (estado, días restantes de trial) y `subscribeGym` (recibe `card_token_id` + `payer_email`, crea el preapproval) |
| [`src/actions/personal-billing.ts`](../src/actions/personal-billing.ts) | Server actions para el user Personal: `getMyPersonalSubscriptionStatus`, `subscribePersonal` y `cancelMySubscription` |
| [`src/actions/super-admin/gym.ts`](../src/actions/super-admin/gym.ts) | `setGymPaymentExempt(gymId, exempt, reason)` y `cancelGymSubscription(gymId)` — solo invocables por SUPERADMIN |
| [`src/app/api/webhooks/mercadopago/route.ts`](../src/app/api/webhooks/mercadopago/route.ts) | Handler POST del webhook de MP: valida firma, parsea evento, actualiza `mpPreapprovalId` y `mpSubscriptionStatus` en el gym/user correspondiente |
| [`src/app/api/cron/check-gym-trials/route.ts`](../src/app/api/cron/check-gym-trials/route.ts) | Cron diario: bloqueo por trial vencido o pago fallido + push notifications en hitos |
| [`src/app/[gymSlug]/admin/billing/page.tsx`](../src/app/[gymSlug]/admin/billing/page.tsx) | UI del dueño del gym: muestra estado (exento / en trial / activo) y el CardForm para vincular tarjeta in-app |
| [`src/app/[gymSlug]/admin/billing/GymCardFormSection.tsx`](../src/app/[gymSlug]/admin/billing/GymCardFormSection.tsx) | Componente cliente que conecta `MpCardForm` con la server action `subscribeGym` |
| [`src/components/personal/PersonalBillingPage.tsx`](../src/components/personal/PersonalBillingPage.tsx) | UI del user Personal: estado de suscripción + CardForm in-app |
| [`src/components/admin/SubscriptionSection.tsx`](../src/components/admin/SubscriptionSection.tsx) | UI super-admin en `/admin/gyms/[id]`: toggle de exención con razón, badge de estado MP, link al preapproval en MP, botón de cancelación |
| [`src/components/billing/TrialEndingBanner.tsx`](../src/components/billing/TrialEndingBanner.tsx) | Banner sticky para ADMINs con `daysLeft <= 7`; CTA a `/[gymSlug]/admin/billing` |

---

## 4. Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `MP_ACCESS_TOKEN` | Access token de producción de la app "Wody" en MP (Panel de developers → Credenciales de producción → Access Token) |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public key de producción de MP (Panel de developers → Credenciales de producción → Public Key). Expuesta al front para MP Bricks/CardForm |
| `MP_WEBHOOK_SECRET` | Clave secreta generada por MP al configurar el webhook (Panel de developers → app Wody → Webhooks → Modo productivo) |
| `CRON_SECRET` | Secret compartido con los demás crons del proyecto, para autenticar el endpoint del cron |
| `APP_URL` | URL base de la app sin slash final (ej: `https://wody.com.ar`). Se usa como `back_url` del preapproval |

Las vars MP se cargan en Vercel (Production + Preview). Los placeholders están en `.env.example`.

**Eliminadas (no se usan más)**:
- `MP_PREAPPROVAL_PLAN_ID`
- `MP_PREAPPROVAL_PLAN_ID_RETURNING`
- `MP_PREAPPROVAL_PLAN_ID_PERSONAL`
- `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`

El dueño puede borrar los planes correspondientes del dashboard de MP y las env vars de Vercel después del deploy.

---

## 5. Procedimiento de setup en Mercado Pago

Este setup es manual y debe hacerse **antes del primer deploy** a producción (o al migrar del flujo viejo de planes al flujo nuevo de API).

### 5.1 Obtener las credenciales de producción

1. Ir al panel de developers de MP: [https://www.mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel).
2. Crear (o seleccionar) la app "Wody".
3. En "Credenciales de producción", copiar el **Access Token** → env var `MP_ACCESS_TOKEN`.
4. Copiar la **Public Key** → env var `NEXT_PUBLIC_MP_PUBLIC_KEY`.

### 5.2 Configurar el webhook

1. En el panel de developers, ir a la app Wody → **Webhooks** → **Modo productivo**.
2. URL de notificación: `https://<dominio-prod>/api/webhooks/mercadopago`.
3. Eventos a suscribir (sección "Planes y suscripciones"):
   - `subscription_preapproval`
   - `subscription_authorized_payment`
4. Generar la clave secreta (MP la llama "Firma secreta" o "Webhook secret").
5. Cargar esa clave como `MP_WEBHOOK_SECRET` en Vercel.

**No es necesario crear planes** en el dashboard de MP — las suscripciones se crean directamente por API sin plan asociado.

---

## 6. Flujo completo de suscripción

### 6.1 Alta de tarjeta (gym o Personal)

1. El dueño/user entra a la página de billing (`/[gymSlug]/admin/billing` o `/personal/perfil/suscripcion`) y confirma la suscripción.
2. La server action (`subscribeGym` o `subscribePersonal`) toma el email del ADMIN (de la sesión) o del user Personal (de la DB) como `payer_email` — si no tiene email cargado, devuelve un error accionable sin llamar a MP.
3. La server action llama a `createGymSubscription` / `createPersonalSubscription`:
   - Calcula `díasRestantes = ceil((trialEndsAt - now) / 1 día)`.
   - Si `díasRestantes >= 1`: incluye `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`.
   - Si `díasRestantes <= 0`: omite `free_trial` (cobro inmediato ~1h).
   - Llama a `preApproval.create(...)` del SDK `mercadopago@3.0.0` con `status: "pending"` y `payer_email`, **sin `preapproval_plan_id`**.
4. Si la creación tiene éxito: se persiste `mpPreapprovalId` y `mpSubscriptionStatus` en la DB, y se devuelve el `init_point` de MP.
5. El usuario es redirigido a `init_point`, donde autoriza la suscripción y vincula su medio de pago en el sitio de Mercado Pago. Wody nunca recibe ni procesa datos de tarjeta.
6. Si falla la creación del preapproval (error de API, email inválido, etc.): se devuelve un error a la UI y se permite reintentar sin persistir nada.

### 6.2 Compatibilidad con suscripciones existentes

Los tenants con `mpPreapprovalId` ya seteado bajo el esquema viejo (plan + `free_trial` estático) **conviven sin cambios**: su suscripción sigue activa en MP y el webhook sigue sincronizando su estado. No se requiere migración.

---

## 7. Operación día a día (para el super-admin)

### Eximir un gym o user Personal

1. Ir a `/admin/gyms/[id]` (o `/admin/wody-personal` para users Personal), sección "Suscripción y exención".
2. Marcar el checkbox "Exento de pago".
3. Completar el campo "Motivo de exención" (obligatorio al marcar como exento).
4. Clic en "Guardar exención".

Para quitar la exención: desmarcar el checkbox y guardar (el motivo se borra automáticamente).

### Cancelar una suscripción

1. Ir a `/admin/gyms/[id]`, sección "Suscripción y exención".
2. El botón "Cancelar suscripción" aparece solo si el gym tiene un `mpPreapprovalId` registrado.
3. Confirmar en el dialog. La action llama a la API de MP para cancelar el `preapproval` y actualiza `mpSubscriptionStatus = 'cancelled'` en la DB.

---

## 8. Cron y push notifications

### Schedule

El cron `/api/cron/check-gym-trials` corre todos los días a las **06:00 UTC (03:00 ART)**, registrado en `vercel.json`:

```json
{ "path": "/api/cron/check-gym-trials", "schedule": "0 6 * * *" }
```

### Fase 1: bloqueo por trial vencido

Bloquea los gyms (y users Personal) con trial vencido, sin suscripción, no exentos y no bloqueados.

### Fase 1.5: bloqueo por pago fallido con grace period

Bloquea los tenants con `mpSubscriptionStatus IN ('paused', 'cancelled')` y `mpSubscriptionStatusChangedAt` hace más de 7 días, no exentos y no bloqueados. Es decir: una vez que MP da por perdido un cobro y pasa el tenant a paused/cancelled, el tenant tiene 7 días para regularizar antes de que el cron lo bloquee.

Si el dueño regulariza la tarjeta antes del día 7, el webhook de MP actualiza el status a `authorized` y resetea `mpSubscriptionStatusChangedAt`. El tenant queda fuera de la query de bloqueo del cron.

### Fase 2: push notifications de fin de trial

En la misma ejecución, el cron recorre todos los tenants en trial y envía push notifications en los hitos `{7, 3, 1, 0}` días restantes.

---

## 9. Sincronización del estado vía webhook

Cuando MP procesa un evento de suscripción, envía un `POST` a `/api/webhooks/mercadopago`. El handler:

1. Valida la firma HMAC-SHA256 usando `x-signature`, `x-request-id` y el query param `data.id`.
2. Si la firma es inválida o falta, responde `401`.
3. Parsea el `type` del evento. Solo procesa `subscription_preapproval` y `subscription_authorized_payment`. Otros tipos devuelven `200` sin hacer nada.
4. Consulta la API de MP con el `preapproval_id` del evento para obtener el estado actual y el `external_reference`.
5. Si `external_reference` empieza con `"user_"`: es un user Personal → actualiza `User.mpPreapprovalId` y `User.mpSubscriptionStatus`.
6. Si no: es un gym → actualiza `Gym.mpPreapprovalId` y `Gym.mpSubscriptionStatus`.
7. Si la transición fue hacia `paused` o `cancelled`, envía email `payment-failed` (en try/catch — no bloquea la respuesta).
8. Responde `200` en éxito, `500` si hubo un error interno (MP reintenta en caso de 500).

El webhook funciona igual con preapprovals creados por plan (flujo viejo) y por API (flujo nuevo), ya que solo lee `external_reference` y `status` del preapproval.

---

## 10. Flujo de pago fallido

Cuando MP no puede cobrar la suscripción mensual:

1. **MP reintenta automáticamente** según su política interna.
2. **Cuando MP da por perdido el cobro**, pasa el `preapproval` a `paused` o `cancelled` y envía un webhook.
3. **El webhook** actualiza el status en la DB, setea `mpSubscriptionStatusChangedAt = now()` (inicio del grace period) y **dispara un email al dueño/user** explicando que el cobro falló y que tiene 7 días para actualizar su tarjeta.
4. **El dueño tiene 7 días** para ir a la página de billing y configurar una tarjeta nueva.
5. **Si regulariza**: MP envía un webhook con status `authorized` → el webhook resetea `mpSubscriptionStatusChangedAt` y el tenant queda fuera de la query de bloqueo del cron.
6. **Si no regulariza en 7 días**: el cron aplica `blockedAt = now()`. El tenant queda suspendido.

---

## 11. Cómo probar el webhook (smoke test)

1. Ir al panel de developers de MP → app Wody → Webhooks → "Simular notificación".
2. Tipo de evento: `subscription_preapproval` o `subscription_authorized_payment`.
3. Data ID: un `preapproval_id` real (creado por API con el nuevo flujo, o un preapproval existente del flujo viejo).
4. Verificar en los logs de Vercel que el handler procesó el evento y actualizó el gym/user.

Alternativamente, para probar el cron localmente:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check-gym-trials
```

---

## 12. Errores conocidos / pitfalls

- **Webhook responde 401 con firma válida**: verificar que `MP_WEBHOOK_SECRET` en Vercel coincide exactamente (sin espacios ni saltos de línea) con el secret configurado en el panel de MP para el modo productivo.
- **Cron responde 500 con "CRON_SECRET not configured"**: falta la env var `CRON_SECRET` en Vercel.
- **Gym bloqueado por error**: el super-admin puede desbloquearlo desde `/admin/gyms/[id]` y marcar exento si corresponde.
- **`mpSubscriptionStatus` queda en `'unknown'`**: MP envió un estado no contemplado en el parser. El tenant sigue funcionando — solo loggea un warning.
- **CardForm no monta**: verificar que `NEXT_PUBLIC_MP_PUBLIC_KEY` está correctamente seteada (es la Public Key, no el Access Token). Un Access Token en ese campo causará error silencioso del SDK.
- **Token de tarjeta expirado o ya usado**: el `card_token_id` es de un solo uso y expira a los 7 días. Si la creación del preapproval falla con este error, la UI permite reintentar (el usuario debe completar el formulario de nuevo).
- **Preapproval creado exitosamente pero sin cobro al final del trial**: verificar que `díasRestantes` se calculó correctamente en el momento de la creación y que MP recibió el `free_trial`. Consultar los logs de la server action.
- **Suscripción creada antes de que el cron corra**: hay una latencia de hasta 24h entre que el trial vence y el cron bloquea. Esta ventana es una decisión aceptada del modelo.

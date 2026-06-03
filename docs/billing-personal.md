# Billing de Wody Personal

## 1. Resumen

Wody Personal cobra **$7.000 ARS/mes** a cada usuario individual mediante una suscripción de Mercado Pago creada por API **sin plan asociado**. El flujo es simétrico al de gyms (ver [billing-mercadopago.md](./billing-mercadopago.md)) pero opera a nivel `User` en vez de `Gym`: cada Personal user tiene sus propios campos MP en el modelo `User`, se suscribe individualmente capturando su tarjeta **in-app** (MP Bricks/CardForm) y puede cancelar desde su perfil (self-service). Los usuarios existentes antes del deploy de mayo 2026 quedaron exentos automáticamente por la migración.

---

## 2. Modelo de cobro Personal

### Suscripción sin plan de MP

Las suscripciones se crean mediante `preApproval.create(...)` del SDK `mercadopago@3.0.0` **sin `preapproval_plan_id`**: el monto ($7.000 ARS) y el ciclo (mensual) se definen directamente en el payload, igual que para gyms. No se crean ni se requieren planes en el dashboard de MP.

La server action es `subscribePersonal(cardTokenId, payerEmail)` en `src/actions/personal-billing.ts`.

### Trial 100% en la app

`User.trialEndsAt` se setea al crear el User Personal: `trialEndsAt = createdAt + 30d`. Mercado Pago no gestiona ningún `free_trial` de plan. Al vincular la tarjeta, la app calcula cuántos días restan del trial (`díasRestantes = ceil((trialEndsAt - now) / 1 día)`) e incluye un `free_trial` dinámico en días en el payload del preapproval si `díasRestantes >= 1`. Si el trial ya venció (`díasRestantes <= 0`), el cobro es inmediato (~1h). Ver el flujo completo en [billing-mercadopago.md §6](./billing-mercadopago.md).

### Exención manual

El super-admin puede marcar un Personal user como `paymentExempt = true` desde `/admin/wody-personal` → toggle "Exento". Los users exentos nunca se bloquean por cron. La action es `setPersonalUserPaymentExempt(userId, exempt, reason)` en `src/actions/super-admin/personal-user.ts`.

### Exentos pre-existentes

La migración de deploy (mayo 2026) marcó a todos los Personal users existentes como exentos con la razón:

```
Usuario Wody Personal pre-existente al lanzamiento del modelo de cobro (2026-05)
```

### Bloqueo

El cron diario (`/api/cron/check-gym-trials`) evalúa dos condiciones:

- **Condición A (trial vencido):** `trialEndsAt < now`, `mpPreapprovalId IS NULL`, `paymentExempt = false`, `blockedAt IS NULL`.
- **Condición B (pago fallido + grace 7d):** `mpSubscriptionStatus IN ('paused', 'cancelled')`, `mpSubscriptionStatusChangedAt < now - 7d`, `paymentExempt = false`, `blockedAt IS NULL`.

El bloqueo setea `User.blockedAt = now()`. El webhook de MP actualiza el status pero no bloquea directamente: solo el cron decide bloquear.

### Self-cancellation

A diferencia de los gyms (donde solo el super-admin puede cancelar), los Personal users cancelan desde su perfil. Ver §3.

---

## 3. Cancelación self-service

El user cancela desde `/personal/perfil/suscripcion` con el botón "Cancelar suscripción".

La server action `cancelMySubscription` (en `src/actions/personal-billing.ts`):
1. Valida sesión: rol `STUDENT`, `canCreateOwnRoutines = true`, gym personal.
2. Lee `mpPreapprovalId` del user. Si es `null`, retorna error: "No tenés ninguna suscripción activa para cancelar".
3. Llama a `cancelMpPreapproval(preapprovalId)` (helper en `src/lib/mercadopago.ts`).
4. Persiste `mpSubscriptionStatus = 'cancelled'` y `mpSubscriptionStatusChangedAt = now()` en el user.
5. No setea `blockedAt` inmediatamente. El cron lo evalúa al día siguiente con grace 7d.

Si la API de MP falla, retorna error sin modificar el estado local.

---

## 4. Componentes en el código

| Componente | Propósito |
|---|---|
| `prisma/schema.prisma` (modelo `User`) | 4 campos: `mpPreapprovalId`, `mpSubscriptionStatus`, `mpSubscriptionStatusChangedAt`, `trialEndsAt` |
| [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts) | `createPersonalSubscription(cardTokenId, payerEmail, userId, trialEndsAt)`: crea el preapproval por API con `free_trial` dinámico + prefix `user_` en `external_reference`. También `cancelMpPreapproval` y utilidades compartidas con gyms |
| [`src/lib/billing-emails.ts`](../src/lib/billing-emails.ts) | `sendPersonalPaymentFailedEmail(user)`: manda email al user cuando MP no puede cobrar |
| [`src/lib/email/templates/PersonalPaymentFailedEmail.tsx`](../src/lib/email/templates/PersonalPaymentFailedEmail.tsx) | Template del email de pago fallido |
| [`src/actions/personal-billing.ts`](../src/actions/personal-billing.ts) | `getMyPersonalSubscriptionStatus`, `subscribePersonal(cardTokenId, payerEmail)`, `cancelMySubscription` |
| [`src/app/api/webhooks/mercadopago/route.ts`](../src/app/api/webhooks/mercadopago/route.ts) | Rama `user_` prefix: actualiza `User` cuando el `external_reference` comienza con `"user_"` |
| [`src/app/api/cron/check-gym-trials/route.ts`](../src/app/api/cron/check-gym-trials/route.ts) | Fases Personal 1 (trial vencido), 1.5 (pago fallido + grace), 2.5 (push notifications) |
| [`src/app/[gymSlug]/perfil/suscripcion/page.tsx`](../src/app/[gymSlug]/perfil/suscripcion/page.tsx) | Server Component: valida sesión, renderiza la billing page |
| [`src/components/personal/PersonalBillingPage.tsx`](../src/components/personal/PersonalBillingPage.tsx) | Client Component: 3 casos (exento / trial / sub activa) + CardForm in-app + botón de self-cancel |
| [`src/components/billing/PersonalTrialEndingBanner.tsx`](../src/components/billing/PersonalTrialEndingBanner.tsx) | Banner persistente cuando `daysLeft <= 7`, sin sub activa, no exento |

---

## 5. Variables de entorno requeridas

Las vars de MP son compartidas con gyms. No hay vars exclusivas de Personal:

| Variable | Descripción |
|---|---|
| `MP_ACCESS_TOKEN` | Access token de producción de MP |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public key de producción de MP (expuesta al front para MP Bricks/CardForm) |
| `MP_WEBHOOK_SECRET` | Secret para validar la firma HMAC del webhook |
| `CRON_SECRET` | Secret del cron |

Ver descripción completa en [billing-mercadopago.md §4](./billing-mercadopago.md).

**No se requieren `MP_PREAPPROVAL_PLAN_ID_PERSONAL` ni `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`** — las suscripciones se crean sin plan asociado.

---

## 6. Operación del super-admin para Wody Personal

### Eximir un user

1. Ir a `/admin/wody-personal`.
2. En la fila del user, toggle "Exento".
3. Completar el motivo de exención (obligatorio al marcar).
4. Guardar.

Para quitar la exención: desmarcar el toggle y guardar.

### Bloquear / desbloquear manualmente

Desde la misma pantalla `/admin/wody-personal`, los botones de bloqueo y desbloqueo están disponibles por fila.

### Extender el trial sin acción formal

No existe un flow de "extender trial". La alternativa: marcá al user como exento (`paymentExempt = true`) mientras resolvés la situación, y cuando esté listo quitá la exención. El cron solo bloqueará cuando deje de ser exento y su trial haya vencido sin sub.

---

## 7. Webhook: discriminación gym / Personal

El `external_reference` que se le pasa a MP distingue el tipo de suscripción:

| Formato | Tipo | Acción |
|---|---|---|
| `"user_<userId>"` | Personal user | El handler extrae el `userId` y actualiza `User` |
| `"<gymId>"` (cuid sin prefix) | Gym | Comportamiento existente, actualiza `Gym` |

El código en `src/app/api/webhooks/mercadopago/route.ts`:

```ts
if (externalReference.startsWith("user_")) {
  const userId = externalReference.slice("user_".length);
  // rama Personal
} else {
  const gymId = externalReference;
  // rama Gym (existente)
}
```

**Idempotencia:** `mpSubscriptionStatusChangedAt` solo se actualiza cuando hay un cambio real de status. Si el mismo webhook llega dos veces con el mismo status, no se resetea el reloj del grace period.

**User inexistente:** si el `userId` del prefix no existe en DB, el handler loggea un warning y responde `200 ok` sin crash.

---

## 8. Cron Personal

El cron `/api/cron/check-gym-trials` corre a las **06:00 UTC (03:00 ART)** todos los días. Además de las fases de gym, incluye:

| Fase | Qué hace |
|---|---|
| **Fase Personal 1** | Bloquea Personal users con `trialEndsAt < now`, sin `mpPreapprovalId`, no exentos, no bloqueados |
| **Fase Personal 1.5** | Bloquea Personal users con sub en `paused`/`cancelled` + `mpSubscriptionStatusChangedAt` hace más de 7 días, no exentos |
| **Fase Personal 2.5** | Push notifications a hitos 7, 3, 1, 0 días antes de `trialEndsAt` (solo a users no exentos, sin sub activa, no bloqueados) |

El helper `findPersonalUsersInPhase` centraliza el filtro base `gymId = <personal>, role = STUDENT, canCreateOwnRoutines = true, deletedAt = null` para evitar duplicación.

El cron responde con campos adicionales: `personalTrialBlockedCount`, `personalTrialBlockedUserIds`, `personalPaymentFailureBlockedCount`, `personalPaymentFailureBlockedUserIds`, `personalPushSummary`.

---

## 9. Cómo probar el flujo

**Suscripción nueva:**
1. Completar el registro en `/registro-personal` con un email whitelisteado.
2. Ir a `/personal/perfil/suscripcion` → completar el CardForm in-app con datos de tarjeta de prueba de MP.
3. Verificar que llega un webhook con `status = 'authorized'` y que `User.mpSubscriptionStatus` queda `'authorized'`.

**Cancel desde Wody:**
1. Ir a `/personal/perfil/suscripcion` → "Cancelar suscripción".
2. Confirmar.
3. Verificar en DB: `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt = now`.
4. Verificar que `blockedAt` sigue `null` (el cron lo evaluará en la próxima ejecución).

**Cancel desde MP (webhook):**
1. Cancelar el preapproval desde el dashboard de MP.
2. Verificar que llega el webhook, se actualiza el status, y se envía el email `PERSONAL_PAYMENT_FAILED`.

**Cron de bloqueo:**
1. Manipular en DB: `mpSubscriptionStatusChangedAt = now() - 8 days`, `mpSubscriptionStatus = 'cancelled'`.
2. Correr cron manualmente:
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check-gym-trials
   ```
3. Verificar que `User.blockedAt` se setea.

---

## 10. Errores conocidos / pitfalls

- **MP no puede cobrar:** webhook `paused`/`cancelled` → email "no pudimos cobrar" → 7 días grace → bloqueo por cron. Si el user regulariza antes del día 7, el webhook de MP actualiza a `authorized` y queda fuera de la query de bloqueo.
- **`getValidatedPersonalSession` retorna "Gym personal no encontrado":** falta el gym con `kind = 'PERSONAL'` en la DB. El seed lo crea; si fue borrado, hay que recrearlo manualmente.
- **Webhook responde 401 con firma válida:** verificar que `MP_WEBHOOK_SECRET` coincide exactamente (sin espacios) con el configurado en el panel de MP para modo productivo.
- **Personal user bloqueado sin aviso:** si el webhook de MP no llegó (o falló el email), el user puede sorprenderse. Verificar `EmailLog` con:
  ```sql
  SELECT * FROM "EmailLog"
  WHERE type = 'PERSONAL_PAYMENT_FAILED'
  ORDER BY "createdAt" DESC;
  ```
- **Latencia de hasta 24h:** el cron corre una vez al día. El bloqueo puede tardar hasta 24h desde el vencimiento del trial o del grace period. Es una decisión aceptada.

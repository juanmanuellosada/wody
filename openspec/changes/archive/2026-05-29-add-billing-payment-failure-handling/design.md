## Context

El cambio anterior `add-gym-mp-billing` (archivado) implementó el modelo de cobro base: trial 30d, suscripción vía `preapproval_plan` único, bloqueo automático cuando el trial vence sin suscripción configurada, exención manual, push notifications a hitos del trial. El cron diario solo aborda **trial vencido + sin sub** — no aborda **sub configurada que después falla**.

En producción esto se vuelve un gap real apenas haya un gym con suscripción activa: la tarjeta caduca, los fondos no alcanzan, el banco bloquea — MP pasa el `preapproval` a `paused` o `cancelled`, el webhook actualiza el status en Wody, y desde ahí no pasa nada. El gym sigue accediendo a la plataforma indefinidamente, el dueño no sabe que tiene que actualizar nada, y vos solo te enterás cuando entrás al dashboard y ves un badge rojo.

Además, MP otorga el `free_trial` por suscripción nueva — no por usuario o por plan. Si un gym cancela y vuelve a suscribirse al mismo plan, MP cuenta otros 30 días sin cobrar. Es un costo silencioso que crece con cada re-suscripción.

## Goals / Non-Goals

**Goals:**

- Notificar proactivamente al dueño cuando MP no pueda cobrar — antes de bloquear.
- Bloquear automáticamente gyms en `paused/cancelled` después de 7 días en ese estado.
- Evitar que un gym que vuelve a suscribirse reciba un segundo `free_trial` de 30 días.
- Mantener idempotencia: si MP manda el mismo evento dos veces, no spamear emails ni duplicar bloqueos.

**Non-Goals:**

- Email recordatorio antes del bloqueo (decisión confirmada: solo el inicial).
- Notificación al super-admin de fallos de pago (lo ve en `/admin`, no necesita su propio email).
- Pre-bill emails / aviso 3 días antes del próximo cobro — fuera de scope.
- Grace period configurable por gym — fijo en 7 días para todos.
- Cobro retroactivo del mes perdido — la re-suscripción arranca al re-activarse, no se intenta cobrar deudas.
- Cambio en la UI del dueño — la billing page ya maneja el estado `paused/cancelled` con su CTA "Configurar tarjeta".

## Decisions

### 1. Dos planes en MP, selección por presencia de `mpPreapprovalId`

**Opciones consideradas:**

- **A)** Un único plan, override del `start_date` o `free_trial` vía API individual al re-suscribir. La doc de MP no es explícita sobre si se puede overridear el `free_trial` del plan al crear un `preapproval` linkeado — riesgo alto de comportamiento inesperado.
- **B)** Dos planes en MP: A con `free_trial = 30d` (subscripción inicial), B con `free_trial = 0d` (re-suscripción). El código elige cuál usar.
- **C)** Aceptar el regalo del re-trial — pequeño costo aceptable.

Elegimos **B**. Razones:
- Comportamiento determinístico (cada plan tiene su config en MP, sin sorpresas).
- Trivial de configurar en MP (clonar el plan actual, cambiar free_trial a 0).
- Trivial de operar en código (un if).
- Reversible: si en el futuro queremos solo un plan, basta con cambiar el código y dejar el plan B sin usar.

**Cómo se decide qué plan usar:**

```ts
function pickPlanForGym(gym: Gym): string {
  return gym.mpPreapprovalId == null
    ? process.env.MP_PREAPPROVAL_PLAN_ID!         // plan original, free_trial = 30 días
    : process.env.MP_PREAPPROVAL_PLAN_ID_RETURNING!; // plan nuevo, free_trial = 0 días
}
```

Nota operativa: la env var `MP_PREAPPROVAL_PLAN_ID` ya existe en Vercel con el valor del plan original (`02dca3f44cc44c5e8089cd00c25a7f08`). No se renombra para evitar fricción con Vercel (no permite renombrado in-place). Solo se agrega la nueva `MP_PREAPPROVAL_PLAN_ID_RETURNING` con el ID del segundo plan (`891d99cc41ae47b094b8059f0b3f3188`).

Una vez que el gym tuvo cualquier suscripción (incluso cancelada), `mpPreapprovalId` queda con el ID histórico (lo sobrescribimos cuando llega una nueva), entonces siempre va al plan B en re-activación.

**Edge case**: si el super-admin "cancela" la suscripción manualmente (action `cancelGymSubscription`), `mpPreapprovalId` NO se borra — solo se actualiza `mpSubscriptionStatus = 'cancelled'`. Así que el gym sigue en plan B si se re-suscribe. Esto es intencional: la cancelación manual es operativa, no debería darles otra ronda de trial.

### 2. Tracking del cambio de status con `mpSubscriptionStatusChangedAt`

Necesitamos saber **cuándo** entró el gym al estado paused/cancelled para calcular el grace period. Opciones:

- **A)** Campo `mpSubscriptionStatusChangedAt: DateTime?` en `Gym`, actualizado por el webhook.
- **B)** Tabla nueva `BillingStatusHistory` con timeline completo.
- **C)** Asumir que MP cancela el día del cron — usar `now() - 7d` rolling.

Elegimos **A**. Simple, suficiente para grace period sin necesidad de timeline. Si en el futuro queremos auditoría completa, se agrega tabla aparte.

El campo se actualiza **solo cuando el status cambia**. Si MP manda el mismo status dos veces (es idempotente en su lado), no actualizamos `mpSubscriptionStatusChangedAt` para no resetear el reloj del grace period.

```ts
if (newStatus !== gym.mpSubscriptionStatus) {
  await prisma.gym.update({
    where: { id: gym.id },
    data: {
      mpSubscriptionStatus: newStatus,
      mpSubscriptionStatusChangedAt: new Date(),
    },
  });
  // Trigger email only if entering paused/cancelled from a different status
  if ((newStatus === 'paused' || newStatus === 'cancelled') &&
      gym.mpSubscriptionStatus !== 'paused' && gym.mpSubscriptionStatus !== 'cancelled') {
    await sendPaymentFailedEmail(gym);
  }
}
```

### 3. Email solo en transición de estado, no en cada reintento

MP puede enviar varios webhooks sobre la misma suscripción si reintentos suceden. La regla:

- Solo mandar email cuando el status **entra por primera vez** en paused/cancelled. Si ya estaba paused y MP confirma paused otra vez, no spamear.
- Si el dueño regulariza y la suscripción vuelve a `authorized`, después falla otra vez y vuelve a paused: nuevo email. Es un nuevo evento.

La condición de disparo en el webhook:

```
newStatus IN ('paused', 'cancelled') AND previousStatus NOT IN ('paused', 'cancelled')
```

Esto naturalmente cubre las idempotencias.

### 4. Cron: bloqueo por grace period

Nueva fase en `/api/cron/check-gym-trials` (después de la fase de bloqueo por trial vencido, antes de las fases de push notifications):

```ts
const failingGyms = await prisma.gym.findMany({
  where: {
    mpSubscriptionStatus: { in: ['paused', 'cancelled'] },
    mpSubscriptionStatusChangedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    blockedAt: null,
    paymentExempt: false,
    kind: { not: 'PERSONAL' },
  },
});

for (const gym of failingGyms) {
  await prisma.gym.update({ where: { id: gym.id }, data: { blockedAt: now } });
  console.log("[check-gym-trials] Blocked gym for payment failure", { gymId: gym.id, slug: gym.slug });
}
```

El grace period se mide desde `mpSubscriptionStatusChangedAt`. Si el dueño regulariza la tarjeta antes del día 7, el status vuelve a `authorized`, `mpSubscriptionStatusChangedAt` se actualiza, y deja de cumplir la condición.

### 5. Nuevo template de email `payment-failed`

Mensaje breve, accionable. Sugerencia de contenido:

- **Asunto**: "No pudimos cobrar tu suscripción de Wody"
- **Cuerpo**: 
  - "Hola [contactName], no pudimos procesar el cobro de tu suscripción a Wody."
  - "Tu gym **[gymName]** sigue funcionando por ahora, pero si no actualizás tu tarjeta en los próximos 7 días, va a quedar suspendido."
  - CTA: "Configurar tarjeta" → link a `https://wody.com.ar/<slug>/admin/billing`
  - "Si ya configuraste una tarjeta nueva, ignorá este mensaje."

El template vive en `src/lib/email/templates/PaymentFailedEmail.tsx` siguiendo el patrón de los existentes (`LeadReceivedEmail.tsx` etc.). El wrapper `sendPaymentFailedEmail(gym)` busca el ADMIN del gym y le manda.

### 6. Convivencia con el cambio de cron de fin de trial

El cron actual ya tiene varias fases (bloqueo por trial vencido, push notifications, expirar tokens, cleanup rate limits). Agregamos una fase nueva entre la primera y las siguientes:

1. **Fase 1**: bloquear por trial vencido sin sub (existente, sin cambios)
2. **Fase 2 (nueva)**: bloquear por pago fallido + grace period
3. **Fase 3**: push notifications de fin de trial (existente)
4. **Fase 4**: expirar tokens de signup (existente)
5. **Fase 5**: cleanup rate limits (existente)

El JSON de respuesta del cron suma una key: `paymentFailureBlockedCount`.

## Risks / Trade-offs

- **Doble plan en MP requiere coordinación manual** — el usuario tiene que crear el segundo plan antes de deploy. **Mitigación**: documentado en `docs/billing-mercadopago.md` y en `tasks.md`. Si se olvida y se intenta re-suscribir un gym, el código va a hacer crash o usar undefined → mejor agregar un fallback explícito en `getSubscriptionCheckoutUrl` que loggee warning si la env var del RETURNING no está y caiga al NEW (acepta el regalo del trial).

- **Email puede no llegar / spam folder** — si el dueño no ve el email, llegará al día 7 al bloqueo sin haber tenido aviso. **Mitigación**: el banner de la billing page no muestra "pago fallido" todavía — quizás en un follow-up podríamos agregar un banner rojo "tu tarjeta falló". Por ahora, el email es la única vía.

- **MP cambia `mpSubscriptionStatus` a un valor inesperado** — el código actual hace `parseMpSubscriptionStatus` que mapea a `unknown`. Nuestra condición de "entró a paused/cancelled" es estricta sobre esos dos strings. Si MP introduce `failed` o `rejected` o algo así, no se dispara el email ni el bloqueo. **Mitigación**: loggear cuando vemos un status nuevo (ya lo hace `parseMpSubscriptionStatus`), revisar logs periódicamente.

- **Race condition: webhook llega tarde** — si MP confirma la regularización después del día 7, el cron ya bloqueó. Cuando llega el webhook, actualiza el status pero no toca `blockedAt`. **Mitigación**: la regularización del status vía webhook NO debe desbloquear. Si pasó la ventana, vos lo desbloqueás manualmente desde super-admin después de validar. Sino podríamos automatizar pero abre la puerta a abuso (alguien podría tener tarjeta vencida + status mal sincronizado).

- **`mpPreapprovalId` se sobreescribe al re-suscribirse** — el webhook actualiza el campo con el ID nuevo cuando llega el evento de la nueva sub. Esto borra el historial del ID viejo. **Aceptado**: no necesitamos historial — solo queremos saber "¿alguna vez hubo sub?" y eso lo da `mpPreapprovalId !== null` o queda nulo solo en gyms nuevos. Una vez que algún ID se setteó, siempre será no-null.

## Migration Plan

**Pre-deploy:**

1. Crear el segundo plan en MP dashboard: nombre "Suscripción mensual Wody — Re-activación", $60.000 ARS/mes, mensual, **free_trial = 0 días**, mismo back_url que el actual.
2. Anotar el `id` del nuevo plan.
3. Cargar en Vercel:
   - Renombrar `MP_PREAPPROVAL_PLAN_ID` → `MP_PREAPPROVAL_PLAN_ID_NEW` (mismo valor, `02dca3f44cc44c5e8089cd00c25a7f08`).
   - Agregar `MP_PREAPPROVAL_PLAN_ID_RETURNING` con el ID del nuevo plan.

**Deploy:**

1. Mergear PR → Vercel build.
2. Aplicar migración con `npx prisma migrate deploy` contra prod (agrega columna + valor de enum).
3. Verificar manualmente: dashboard muestra los 5 gyms con `paymentExempt = true`, sin cambios. La columna nueva queda en NULL inicialmente para todos.

**Rollback:**

- Revertir commit, mantener la migración aplicada (la columna nueva sigue siendo nullable, sin efectos secundarios si nadie la usa).
- El segundo plan en MP queda creado pero inactivo si nadie se suscribe a él. Se puede archivar manualmente más adelante.

**Backfill (opcional)**:

- Los gyms con `mpSubscriptionStatus` NOT NULL al momento del deploy tienen `mpSubscriptionStatusChangedAt = NULL`. Eso significa que el cron NO los va a bloquear (porque `null < now - 7d` es false). Si querés que el cron empiece a vigilarlos, hay que correr un UPDATE puntual: `UPDATE "Gym" SET "mpSubscriptionStatusChangedAt" = "createdAt" WHERE "mpSubscriptionStatus" IS NOT NULL` — usa `createdAt` como fallback "viejo". O simplemente esperar al siguiente cambio de status para que el webhook lo setee. Decisión: NO hacer backfill — al momento de este deploy no hay ningún gym con sub activa (los 5 gyms están exentos). El campo arranca limpio.

## Open Questions

- **¿Banner UI de "pago fallido" en la billing page?** El dueño hoy ve "Suscripción pausada" o "cancelada" como warning amarillo arriba de la card de configurar tarjeta. ¿Querés un banner más prominente en otras pantallas del gym (no solo en /billing)? Por ahora no. Si la métrica de "click rate del email" es mala, se reconsidera.

- **¿Webhook idempotency persistente?** Hoy confiamos en que las condiciones de transición de status sean naturalmente idempotentes. Si MP empieza a mandar muchos eventos repetidos, podríamos guardar el último `event.id` procesado en una tabla para no re-procesar. Por ahora no, lo dejamos para si aparece el problema.

- **¿Permitir que el super-admin haga "reactivación manual sin re-suscripción"?** Caso: el dueño dice "pagame por transferencia" y el super-admin acepta. Hoy no hay un flujo limpio para eso — el super-admin podría desbloquear y dejar exento. Cubre el caso pero esconde el tracking real. No se aborda en este cambio.

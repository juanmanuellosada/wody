## 1. Preparación manual en Mercado Pago

- [x] 1.1 Crear el segundo `preapproval_plan` en el dashboard de MP: nombre "Suscripción mensual Wody — Re-activación", monto $60.000 ARS/mes, frecuencia mensual, **"Prueba gratis" en 0 días** (clave — diferencia con el plan original), mismo back_url. Plan creado: `891d99cc41ae47b094b8059f0b3f3188`
- [ ] 1.2 En Vercel, agregar nueva var `MP_PREAPPROVAL_PLAN_ID_RETURNING = 891d99cc41ae47b094b8059f0b3f3188`. Cargar en Production + Preview. **NO renombrar** `MP_PREAPPROVAL_PLAN_ID` — sigue siendo el plan de gyms nuevos (`02dca3f44cc44c5e8089cd00c25a7f08`)

## 2. Schema y migración Prisma

- [x] 2.1 Editar `prisma/schema.prisma`: agregar `mpSubscriptionStatusChangedAt DateTime?` al modelo `Gym`
- [x] 2.2 Editar `prisma/schema.prisma`: agregar `PAYMENT_FAILED` al enum `EmailLogType`
- [x] 2.3 Crear migración manual `prisma/migrations/<timestamp>_add_payment_failure_handling/migration.sql` con:
  - `ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatusChangedAt" TIMESTAMP(3);`
  - `ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';`
- [x] 2.4 Revisar el SQL: confirma que solo agrega columna nullable y valor de enum, sin tocar datos existentes
- [x] 2.5 Correr `npx prisma generate` y compilar TypeScript

## 3. Lógica de selección de plan en `getSubscriptionCheckoutUrl`

- [x] 3.1 Editar `src/lib/mercadopago.ts`: cambiar signature de `getSubscriptionCheckoutUrl` de `(gymId: string)` (que ya recibe gymId) a una versión que internamente consulte el gym y elija el plan correcto. Alternativa más limpia: la función actual sigue siendo síncrona y genera URL; agregar una nueva función `async pickPlanIdForGym(gymId): Promise<string>` y componer
- [x] 3.2 Implementar la lógica:
  ```ts
  async function pickPlanIdForGym(gymId: string): Promise<string> {
    const gym = await prisma.gym.findUniqueOrThrow({
      where: { id: gymId },
      select: { mpPreapprovalId: true }
    });
    const newPlan = process.env.MP_PREAPPROVAL_PLAN_ID;
    const returningPlan = process.env.MP_PREAPPROVAL_PLAN_ID_RETURNING;
    if (!newPlan) throw new Error("MP_PREAPPROVAL_PLAN_ID env var is not set");
    if (gym.mpPreapprovalId == null) return newPlan;
    if (!returningPlan) {
      console.warn(
        "[mercadopago] MP_PREAPPROVAL_PLAN_ID_RETURNING not set — falling back to NEW plan; user will receive another free_trial",
        { gymId }
      );
      return newPlan;
    }
    return returningPlan;
  }
  ```
- [x] 3.3 Convertir `getSubscriptionCheckoutUrl` a `async` (recibe `gymId`, retorna `Promise<string>`)
- [x] 3.4 Actualizar callers (probablemente solo `src/actions/billing.ts`: `getMyCheckoutUrl`) para `await`-ear

## 4. Webhook: tracking de cambio de status + email payment-failed

- [x] 4.1 Editar `src/app/api/webhooks/mercadopago/route.ts`: antes del `prisma.gym.update` que actualiza el status, leer el `mpSubscriptionStatus` previo del gym
- [x] 4.2 Cuando el status cambia (newStatus !== previousStatus), agregar `mpSubscriptionStatusChangedAt: new Date()` al `data` del update
- [x] 4.3 Después del update exitoso, si la transición fue desde un estado NO paused/cancelled hacia paused o cancelled, llamar a `sendPaymentFailedEmail(gym)`. Hacerlo en try/catch para no romper la response del webhook si el email falla
- [x] 4.4 Si el gym tiene `paymentExempt = true`, NO disparar email (la lógica del bloqueo ya lo excluye igual, pero también queremos no spamear)

## 5. Cron: nueva fase de bloqueo por grace period

- [x] 5.1 Editar `src/app/api/cron/check-gym-trials/route.ts`: después de la Fase 1 (bloqueo por trial vencido) y antes de Fase 2 (push notifications), agregar una nueva fase:
  ```ts
  const failureGracePeriodMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - failureGracePeriodMs);
  const paymentFailureGyms = await prisma.gym.findMany({
    where: {
      mpSubscriptionStatus: { in: ["paused", "cancelled"] },
      mpSubscriptionStatusChangedAt: { lt: cutoff },
      blockedAt: null,
      paymentExempt: false,
      kind: { not: "PERSONAL" },
    },
    select: { id: true, slug: true },
  });
  for (const gym of paymentFailureGyms) {
    await prisma.gym.update({ where: { id: gym.id }, data: { blockedAt: now } });
    console.log("[check-gym-trials] Blocked for payment failure", { gymId: gym.id, slug: gym.slug });
  }
  ```
- [x] 5.2 Extender el JSON de respuesta del cron a incluir `paymentFailureBlockedCount: paymentFailureGyms.length` y `paymentFailureBlockedGymIds: [...]`

## 6. Email template `payment-failed`

- [x] 6.1 Crear `src/lib/email/templates/PaymentFailedEmail.tsx` siguiendo el patrón de los Lead*Email existentes:
  - Props: `{ contactName, gymName, gymSlug }`
  - Asunto: "No pudimos cobrar tu suscripción de Wody"
  - Cuerpo: "Hola [contactName], no pudimos procesar el cobro de tu suscripción a Wody. Tu gym [gymName] sigue funcionando por ahora, pero si no actualizás tu tarjeta en los próximos 7 días, va a quedar suspendido."
  - CTA: "Configurar tarjeta" → href `https://<dominio>/<gymSlug>/admin/billing`
  - Footer: "Si ya configuraste una tarjeta nueva, ignorá este mensaje."
- [x] 6.2 Crear `src/lib/billing-emails.ts` (archivo nuevo) con la función `sendPaymentFailedEmail(gym: Gym)`:
  - Busca todos los `User` con `role = 'ADMIN'`, `gymId = gym.id`, `deletedAt = null`
  - Si no hay admins (caso edge raro), loggear warning y salir
  - Para cada admin, invocar `sendEmail({ to: admin.email, gymId: gym.id, type: 'PAYMENT_FAILED', subject: ..., react: <PaymentFailedEmail ... /> })`
- [x] 6.3 Resolver el `APP_URL` desde env var igual que en `signup-emails.ts` (con fallback a `https://www.wody.com.ar`)

## 7. Documentación

- [x] 7.1 Editar `docs/billing-mercadopago.md`:
  - Sección "Plan único en Mercado Pago" → renombrar a "Planes en Mercado Pago" y documentar los dos planes (qué hace cada uno, cuándo se usa, cómo se eligen)
  - Sección nueva "Flujo de pago fallido" describiendo: webhook → email → grace period → bloqueo
  - Actualizar tabla de env vars con `MP_PREAPPROVAL_PLAN_ID_NEW` y `MP_PREAPPROVAL_PLAN_ID_RETURNING`
  - En "Errores conocidos", agregar nota: si `MP_PREAPPROVAL_PLAN_ID_RETURNING` no está configurada, el código cae al plan NEW y loggea warning (regalo de free_trial — aceptable como fallback)

## 8. Deploy y verificación

- [ ] 8.1 Crear PR a `main` con todos los cambios
- [ ] 8.2 Verificar build de Vercel exitoso (env vars nuevas configuradas también en Preview)
- [ ] 8.3 Confirmar que el segundo plan en MP ya está creado (paso 1.1) **antes** de aplicar la migración a prod
- [ ] 8.4 Confirmar que `MP_PREAPPROVAL_PLAN_ID_NEW` y `MP_PREAPPROVAL_PLAN_ID_RETURNING` están cargadas en Vercel
- [ ] 8.5 Correr `npx prisma migrate deploy` contra prod
- [ ] 8.6 Verificar que el cron `check-gym-trials` corre la mañana siguiente sin errores (revisar logs de Vercel)
- [ ] 8.7 Smoke test del email: forzar un escenario en sandbox o crear un gym de prueba, suscribirlo, cancelar la suscripción manualmente desde el panel MP (no desde super-admin) y confirmar que llega el email al ADMIN
- [ ] 8.8 Smoke test del grace period: en DB, setear `mpSubscriptionStatus = 'cancelled'` y `mpSubscriptionStatusChangedAt = now - 8d` para un gym de prueba (no exento), correr el cron manualmente con `curl`, verificar que se bloquea
- [ ] 8.9 Limpieza: borrar el gym de prueba después

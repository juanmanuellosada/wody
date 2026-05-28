## Context

Wody es un SaaS multi-tenant para gimnasios y boxes de CrossFit con cuatro tenants productivos al momento de este cambio. Hoy no hay monetización: el schema tiene los campos básicos para suscripciones (`subscriptionMonthlyAmount`, `subscriptionNextPaymentDate`, `blockedAt`, `autoBlockAfterDays`) y un super-admin panel funcional en `/admin`, pero no hay integración con un PSP ni mecanismo para que el dueño del gym pague.

Existe un documento previo (`docs/billing-mercadopago.md`) que diseñaba un modelo más ambicioso (tarifa de alta + mensualidad + self-signup + máquina de estados rica). En esta iteración se simplifica deliberadamente: un único plan mensual, alta manual por super-admin, y un flag de exención para no romper los gyms actuales.

El stack relevante: Next.js 16 (App Router), Prisma 6, Postgres (Neon), NextAuth 5 beta, cron en `src/app/api/cron/`. El super-admin existe como rol (`SUPERADMIN`) y tiene panel propio en `/admin` con CRUD de gyms.

## Goals / Non-Goals

**Goals:**

- Cobrar automáticamente $60.000 ARS/mes a cada gym no exento que tenga suscripción activa en MP.
- Dar a cada gym un trial de 30 días desde su creación, durante el cual el dueño puede configurar su tarjeta sin que el cobro arranque.
- Permitir al super-admin marcar gyms como exentos del cobro y revertir esa exención.
- Bloquear automáticamente gyms cuyo trial expiró sin tener suscripción activa (y no estén exentos), reutilizando la lógica de `blockedAt` existente.
- Sincronizar el estado de la suscripción de cada gym con MP vía webhook firmado.
- Mantener funcionando sin interrupción a los cuatro gyms actuales (todos quedan exentos en el deploy).

**Non-Goals:**

- Tarifa de alta one-time o setup fee.
- Self-signup público: los gyms los sigue creando manualmente el super-admin.
- Múltiples planes / tiers / cupones aplicados al cobro del gym.
- Facturación electrónica / AFIP / comprobantes fiscales.
- Reportes de revenue, churn, MRR — eso vive en otro cambio futuro si hace falta.
- Refactor del campo `User.paymentExempt` (es un dominio distinto: pagos alumno→gym, no gym→Wody).

## Decisions

### 0. Alineación del free_trial de MP con el trial de Wody

El `preapproval_plan` en MP DEBE configurarse con `free_trial = 30 días` (campo "Prueba gratis" en el dashboard). Razón: cuando el dueño suscribe su tarjeta mid-trial (por ejemplo, día 5 de los 30), MP empieza a contar el free_trial desde la fecha de suscripción. Si ese free_trial es menor que el trial de Wody, MP cobra antes de que termine el trial de Wody y el dueño paga días que tenía gratis.

Con `free_trial = 30 días` en MP:
- Suscripción día 5 → primer cobro día 35 (Wody trial termina día 30, sin gap)
- Suscripción día 28 → primer cobro día 58
- Trade-off: suscriptores tempranos obtienen unos días extra gratis (max ~30 si suscriben día 1). Pequeño costo aceptado para mantener simple el modelo.

**Alternativa rechazada:** usar `preapproval` individual con `start_date = gym.createdAt + 30 días` por gym. Más justo (todos los gyms pagan exactamente desde día 30), pero requiere armar cada suscripción por API en vez de redirigir al checkout del plan, y agrega complejidad. Si en el futuro la "injusticia" se vuelve material, se migra a este modelo.

**Plan ID en producción:** `02dca3f44cc44c5e8089cd00c25a7f08` (`MP_PREAPPROVAL_PLAN_ID`).

### 1. Producto MP: `preapproval_plan` único, no `preapproval` por gym

Mercado Pago Suscripciones ofrece dos modelos:

- **`preapproval`**: cada suscripción es un acuerdo independiente con su propio monto y frecuencia. Apto cuando cada cliente tiene un precio negociado.
- **`preapproval_plan`**: se crea un plan único (en el dashboard de MP) y cada cliente se suscribe a ese plan; el monto y la frecuencia los hereda del plan.

Elegimos **`preapproval_plan`** porque:
- Hay un único precio estándar de $60.000/mes.
- Es más simple operar (un solo plan en el dashboard, no N).
- Cambios de precio futuros se hacen en un solo lugar.

Para los casos de precio especial (super-admin baja el monto a un gym específico): se sigue usando `preapproval_plan` para el cobro real, pero el campo `Gym.subscriptionMonthlyAmount` queda como **fuente informativa** del precio acordado en negociación. Si el precio negociado requiere efectivamente cobrar menos en MP, se crea un `preapproval` individual para ese gym (caso excepcional, no la norma). Esta excepción NO se implementa en este cambio — si aparece el caso, se decide en su momento.

### 2. Estado de la suscripción: campo string libre, no enum estricto

`Gym.mpSubscriptionStatus: String?` en vez de un enum Prisma. Rationale:

- MP usa varios estados (`pending`, `authorized`, `paused`, `cancelled`) y puede agregar más sin aviso.
- Un enum estricto en Prisma requiere migración cada vez que MP cambia.
- El string se valida en TypeScript con una union (`type MpSubStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'`) y un fallback "unknown" para valores no reconocidos (loggear y seguir).

### 3. Cron diario para fin de trial, no chequeo on-demand

Opciones consideradas:

- **A) Chequear `trialEndsAt` en cada request** (middleware o layout server-side). Más reactivo pero corre N veces por minuto por gym activo.
- **B) Cron diario** que recorre todos los gyms y aplica `blockedAt` donde corresponda.
- **C) `expires_at` schedulado en una cola** (BullMQ / Vercel Queues). Overkill para 4-50 gyms.

Elegimos **B (cron diario)**. Razones:
- Ya hay infra de cron en `src/app/api/cron/` (Vercel Cron Jobs).
- Para fin de trial, una latencia de hasta 24h es aceptable (es un bloqueo, no un cobro).
- Idempotente y simple de debuggear.

El cron corre una vez al día (sugerido: 03:00 ART → cron `0 6 * * *` en UTC) y aplica `blockedAt = now()` a los gyms que cumplen:
- `trialEndsAt < now()`
- `mpPreapprovalId IS NULL` (no se suscribió)
- `paymentExempt = false`
- `blockedAt IS NULL`

### 4. Webhook: validación de firma + idempotencia

MP firma sus webhooks con HMAC-SHA256 (header `x-signature`). Validar la firma con `MP_WEBHOOK_SECRET` antes de procesar.

Idempotencia: MP puede reenviar el mismo evento. El payload incluye un `id` por evento. Estrategia simple:
- Guardar el último `data.id` procesado en `Gym.mpLastEventId` (campo adicional NO incluido en este cambio inicial — si hace falta auditoría, se agrega en un follow-up con `BillingEvent`).
- Por ahora, las operaciones del handler son idempotentes por construcción: setear `mpSubscriptionStatus = 'authorized'` dos veces produce el mismo resultado.

### 5. Bloqueo: solo en cron, no en el webhook de "rechazo de pago"

Cuando MP marca una suscripción como `paused` o `cancelled` (por ejemplo, varios rebotes seguidos), el webhook actualiza `mpSubscriptionStatus` pero **NO** setea `blockedAt`. Eso lo decide el cron diario, que aplica:
- Trial vencido sin sub → `blockedAt`.
- Sub `cancelled` + trial vencido → `blockedAt`.
- Sub `paused` → no bloquea inmediatamente; espera a que el cron lo evalúe con un grace period implícito (la próxima ejecución diaria).

Razón: simplifica el flujo (un solo lugar decide bloqueos) y evita race conditions con el dueño que está reconfigurando tarjeta justo cuando llega un webhook.

### 6. Cancelación: super-admin only

La server action `cancelGymSubscription` solo es invocable por `SUPERADMIN`. El dueño del gym puede cambiar la tarjeta pero no cancelar. Esto se valida en la action server-side, **no** ocultando el botón en la UI (que también se oculta, pero la seguridad está en el server).

El dueño que quiera darse de baja debe contactar al super-admin. Trade-off aceptado: agrega fricción a la baja, pero evita cancelaciones por error o por compromiso emocional momentáneo. Si el churn por fricción se vuelve un problema, se revisa en un cambio futuro.

### 7. Marcado de gyms existentes como exentos en la migración

La data-migration de Prisma marca como exentos a todos los `Gym` con `createdAt < <fecha del deploy>`. Implementación: dentro del archivo SQL de la migración, después del `ALTER TABLE`, un `UPDATE "Gym" SET "paymentExempt" = true, "paymentExemptReason" = 'Gym pre-existente al lanzamiento del modelo de cobro (2026-05)' WHERE "createdAt" < CURRENT_TIMESTAMP`.

Alternativa rechazada: hacerlo en un script TS one-off post-deploy. Razón del rechazo: deja una ventana donde algún gym podría bloquearse entre que corre la migración y corre el script. Hacerlo en la misma transacción de la migración elimina ese riesgo.

### 8. Wody Personal: trato especial

El gym `personal` (`kind: PERSONAL`) ya tiene su propia lógica y no debería estar sujeto al modelo de cobro mensual (no es un cliente que paga). Se marca como exento en la migración como cualquier otro gym pre-existente, pero adicionalmente el cron debe **excluir** explícitamente `kind = 'PERSONAL'` de su query, para que no haya forma de bloquearlo accidentalmente aunque se desmarque la exención.

## Risks / Trade-offs

- **Plan único en MP requiere creación manual previa al deploy** → El `MP_PREAPPROVAL_PLAN_ID` debe existir antes de levantar la versión nueva en prod. Mitigación: paso explícito documentado en `docs/billing-mercadopago.md` y en el checklist de deploy de `tasks.md`. Si se olvida, el cobro falla pero el sistema no se rompe (los gyms exentos siguen funcionando, los nuevos no podrán suscribirse hasta que se cree el plan).
- **Webhook puede llegar tarde o no llegar** → Si MP rechaza el cobro y el webhook se pierde, el estado en Wody queda desactualizado. Mitigación: el cron diario actúa como red de seguridad (re-evalúa estado para cada gym con sub activa consultando la API de MP — esta consulta se hace solo para gyms con `mpPreapprovalId IS NOT NULL`, no para todos). Si el cron es demasiado caro, se reduce a chequear solo los que cumplen `trialEndsAt - 7d < now`.
- **`paymentExempt` puede usarse para evadir cobros legítimos** → Solo super-admin puede modificarlo. Quedará el registro en `paymentExemptReason`. Si en el futuro se necesita auditoría más rigurosa, se agrega un `BillingEvent` log.
- **Latencia de hasta 24h del bloqueo** → Un gym puede seguir funcionando un día completo después de vencer su trial. Trade-off aceptado para mantener simple el modelo. Si el churn por trial extendido se vuelve un problema, se agrega un chequeo en middleware.
- **Datos sensibles en logs del webhook** → MP envía info de pagos en el payload. El handler debe loggear solo IDs y status, no payload completo ni datos de tarjeta.
- **MP cambia el formato del webhook** → Verde para "noisy" mejor: el handler debe tolerar campos desconocidos y loggear un warning sin romper. Tests del handler con payloads de muestra de la doc de MP.

## Migration Plan

**Pre-deploy (manual, super-admin):**
1. Crear el `preapproval_plan` único en el dashboard de MP con monto $60.000 ARS/mes, periodicidad mensual, descripción "Suscripción mensual Wody". Anotar el `id` devuelto.
2. Generar `MP_ACCESS_TOKEN` (Production) y `MP_WEBHOOK_SECRET` desde el panel de MP.
3. Cargar las tres env vars en Vercel (Production + Preview).

**Deploy:**
1. Mergear el PR a `main`.
2. CI/Vercel hace build.
3. Correr `npx prisma migrate deploy` contra prod (la migración agrega columnas y marca exentos los gyms pre-existentes en la misma transacción).
4. Verificar en super-admin que los 4 gyms aparecen con badge "Exento".
5. Configurar la URL del webhook en el panel de MP apuntando a `https://<dominio>/api/webhooks/mercadopago`.

**Rollback:**
- Si algo sale mal: revertir el commit en `main`, revertir la migración (`prisma migrate resolve --rolled-back ...`).
- La columna `paymentExempt` puede quedar; los campos nuevos son nullable y no rompen el código viejo.
- Cancelar manualmente cualquier `preapproval` ya creado contactando MP si hace falta.

**Post-deploy:**
- Smoke test: crear un gym de prueba, verificar que `trialEndsAt = createdAt + 30d`, simular un cobro de MP con un usuario test de sandbox.
- Mantener el cron observado durante la primera semana (chequear logs de Vercel Cron).

## Open Questions

- **Zona horaria del cron**: ¿UTC o ART? Sugerido: cron en UTC (estándar Vercel) pero el cálculo de "trial vencido" se hace con `Date` server-side (UTC). El usuario ve la fecha en ART (zona del navegador). Si el cliente está en otra zona, no afecta porque solo se compara `now > trialEndsAt`.
- **¿Cuánto antes del fin de trial empezar el banner?** En el alcance dijimos 7 días — confirmar si querés probar con 14 o 10 después de ver cómo va.
- ~~**Push notifications**: están en el alcance como "opcional". Decidir en `tasks.md` si entran en este cambio o se difieren.~~ **Resuelto**: entran en este cambio. Se envían a todos los `ADMIN` del gym en hitos `daysLeft ∈ {7, 3, 1, 0}`, reutilizando `sendPushToUser` de `src/lib/push.ts`. Disparadas desde el mismo cron diario, en una segunda pasada después de la query de bloqueo.
- **¿Qué pasa si un gym exento intenta entrar a `/[gymSlug]/admin/billing`?** Sugerido: mostrar un panel informativo "Tu gym está exento del cobro. Cualquier consulta, contactanos." sin link a MP.

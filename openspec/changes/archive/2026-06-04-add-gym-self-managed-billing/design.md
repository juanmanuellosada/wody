## Context

`gym-billing` modela hoy dos estados de cobro a nivel gym:

1. **Suscripción MP** — el default. Trial de 30 días (`trialEndsAt`), luego suscripción de Mercado Pago (`mpPreapprovalId`, `mpSubscriptionStatus`). El cron diario (`src/app/api/cron/check-gym-trials/route.ts`) bloquea por trial vencido sin MP (Condición A) o por pago fallido en MP con gracia de 7 días (Condición B).
2. **Exento** — `paymentExempt = true`. No paga, nunca se bloquea por cron.

Atlas (`atlas-gym`) y Mila Fit (`mila-fit`) hoy están exentos (migración de pre-lanzamiento de mayo 2026). El super-admin les cobra a mano y quiere recordatorios automáticos, pero **no** quiere vincularlos a Mercado Pago.

Campos ya existentes y reutilizables:
- `Gym.subscriptionNextPaymentDate: DateTime?` — fecha de vencimiento, ya editable desde `GymForm`.
- `Gym.autoBlockAfterDays: Int @default(45)` — días de gracia ya usado para bloquear STUDENTs atrasados (`getBlockStatus` en `src/lib/blocking.ts`).
- `Gym.blockedAt: DateTime?` + `unblockGym()`/`blockGym()` + UI de desbloqueo en `GymForm`.
- `sendTrialEndingPush(gymId, daysLeft)` en `src/lib/push.ts` — manda push a todos los `ADMIN` del gym.
- `PaymentStatusBanner` (STUDENT, basado en `User.nextPaymentDate`) como referencia visual para el banner del ADMIN.

Restricciones del proyecto: multi-tenancy por `gymId`; no editar `schema.prisma` sin entender impacto; migraciones con `migrate deploy` (shadow DB no configurada); APIs de Next 16 verificadas contra `node_modules/next/dist/docs/`.

## Goals / Non-Goals

**Goals:**
- Tercer modo de cobro: **manual / self-managed** (paga, sin MP), gobernado por `subscriptionNextPaymentDate`.
- Recordatorios push a los `ADMIN` por hitos (10/7/3/1/0 días antes del vencimiento).
- Indicador in-app para el `ADMIN` (al día / por vencer / vencido).
- Bloqueo automático tras gracia (`subscriptionNextPaymentDate + autoBlockAfterDays`), con desbloqueo manual ya existente.
- Sacar a `atlas-gym` y `mila-fit` de exento y ponerlos en modo manual, sin que el cron los bloquee de inmediato.

**Non-Goals:**
- No se toca el flujo de Mercado Pago ni el webhook.
- No se construye UI nueva de desbloqueo (ya existe).
- No aplica a gyms `kind = PERSONAL`.
- No se cobra automáticamente nada: el avance de fecha al pagar es 100% manual del super-admin.
- No se agrega un email transaccional para el modo manual en esta iteración (solo push + indicador in-app).

## Decisions

### Decisión 1: Flag booleano `selfManagedBilling` en vez de un enum `billingMode`

Se agrega `Gym.selfManagedBilling Boolean @default(false)` en lugar de refactorizar a un enum `BillingMode { MP, MANUAL, EXEMPT }`.

- **Por qué**: el cambio es quirúrgico y no toca el código existente que lee `paymentExempt`/`mpPreapprovalId`. Los tres modos quedan derivables: `paymentExempt=true` → exento; `selfManagedBilling=true` → manual; resto → MP. El default `false` deja a todos los gyms actuales exactamente como están.
- **Alternativa descartada**: enum `billingMode`. Más limpio conceptualmente pero obliga a migrar datos de todos los gyms y reescribir todas las queries que hoy usan `paymentExempt`/`mpPreapprovalId`. Sobre-ingeniería para tres modos.
- **Invariante**: un gym no debería ser `paymentExempt=true` Y `selfManagedBilling=true` a la vez. Si ambos son true, **exento gana** (no se bloquea ni se notifica): se respeta agregando `paymentExempt: false` a los `where` de las nuevas fases.

### Decisión 2: La nueva lógica vive en el cron existente, no en un cron nuevo

Los recordatorios por hitos y el bloqueo por vencimiento se agregan como fases nuevas dentro de `check-gym-trials/route.ts` (ya corre 06:00 UTC / 03:00 ART).

- **Por qué**: el cron ya itera gyms y ya manda push por hitos para el trial (`sendTrialEndingPush`). Reusar evita un nuevo entry en `vercel.json` y mantiene toda la lógica de bloqueo de gyms en un solo lugar.
- **Cálculo de días**: análogo al de los STUDENTs en `notify-due-today` — usar el "hoy" en zona Argentina (`getTodayArgentina()` de `src/lib/blocking.ts` / el helper que ya usa el proyecto) para evitar drift por timezone. `díasHastaVencimiento = round((subscriptionNextPaymentDate - hoyART) / 1 día)`.

### Decisión 3: Hitos de recordatorio = {10, 7, 3, 1, 0}

Push solo en esos días exactos antes del vencimiento, no diario.

- **Por qué**: decisión del producto (evitar spam). Sigue el patrón de hitos ya usado para el trial (7/3/1/0), extendido a 10 para dar el aviso temprano pedido ("al menos 10 días antes").
- **Dedup**: el cron corre una vez por día, así que cada hito dispara como máximo una push por gym por día. No hace falta un campo `lastNotifiedOn` a nivel gym salvo que se quiera robustez extra; se documenta como riesgo menor (ver Riesgos).

### Decisión 4: Bloqueo por gracia reusa `autoBlockAfterDays`

Condición de bloqueo manual: `selfManagedBilling=true` AND `subscriptionNextPaymentDate IS NOT NULL` AND `subscriptionNextPaymentDate + autoBlockAfterDays días < now()` AND `blockedAt IS NULL` AND `paymentExempt=false` AND `kind != PERSONAL`.

- **Por qué**: `autoBlockAfterDays` ya es el "período de gracia" semántico del proyecto (default 45 días) y ya se usa para STUDENTs. Reusarlo evita un campo nuevo y da una perilla por-gym que el super-admin ya entiende.
- **Desbloqueo**: ya existe (`unblockGym` + botón en `GymForm`). Cuando el super-admin desbloquea, debe además mover `subscriptionNextPaymentDate` al futuro; si no, el cron re-bloquea al día siguiente. Se documenta en la spec como comportamiento esperado.

### Decisión 5: El indicador del ADMIN es un banner nuevo, no se reusa `PaymentStatusBanner`

`PaymentStatusBanner` es para STUDENT y lee `User.nextPaymentDate`. Se crea un banner para ADMIN que lee `subscriptionNextPaymentDate` vía `getMySubscriptionStatus` extendido.

- **Por qué**: distinto sujeto (gym vs alumno), distinto campo, distinta audiencia y copy. Reusar acoplaría dos flujos no relacionados. Se replica el patrón visual (estados al día / por vencer / vencido) para consistencia.
- **`getMySubscriptionStatus`** se extiende para devolver `subscriptionNextPaymentDate` y `selfManagedBilling`. El banner solo se monta cuando `selfManagedBilling=true`.

### Decisión 6: El cambio de datos de Atlas/Mila lo hace el super-admin desde el toggle

No se hardcodean slugs en una migración SQL. El super-admin entra a `/admin/gyms/[id]` de cada gym, desactiva exento, activa modo manual y carga `subscriptionNextPaymentDate`.

- **Por qué**: AGENTS.md prohíbe hardcodear slugs en el código y los seeds son de desarrollo. El toggle es la herramienta correcta y deja un solo camino de verdad.
- **Se documenta** el paso manual en `tasks.md` como checklist operativo post-deploy.

## Risks / Trade-offs

- **[Gym en modo manual con `subscriptionNextPaymentDate = null`]** → No recibe recordatorios ni se bloquea (no hay fecha de referencia). Mitigación: el toggle de modo manual en `GymForm` debe exigir/registrar una fecha de vencimiento; el banner muestra un estado neutro si falta. Se cubre con un scenario.
- **[Doble push si el cron corre dos veces el mismo día]** → Vercel podría reintentar. Mitigación: bajo impacto (a lo sumo una push duplicada); si molesta, se agrega `lastSelfBillingNotifiedOn` a futuro. Documentado, no bloqueante.
- **[Sacar el exento bloquea el gym de inmediato]** → riesgo central. Mitigación: activar `selfManagedBilling=true` **excluye** al gym de las Condiciones A y B; la única vía de bloqueo es la nueva (vencimiento + gracia), que no dispara mientras `subscriptionNextPaymentDate + autoBlockAfterDays` esté en el futuro. El orden operativo (activar manual y cargar fecha **antes** de quitar exento, o en la misma edición) se documenta en tasks.
- **[Conflicto exento + manual]** → ambos flags true. Mitigación: `paymentExempt` gana; las fases nuevas filtran `paymentExempt=false`. Cubierto por scenario.
- **[Re-bloqueo tras desbloqueo sin mover fecha]** → si el super-admin desbloquea pero no mueve `subscriptionNextPaymentDate`, el cron re-bloquea. Mitigación: documentado en spec; el desbloqueo y el avance de fecha van juntos.

## Migration Plan

1. Agregar `selfManagedBilling Boolean @default(false)` a `Gym` en `schema.prisma`.
2. Generar la migración y aplicarla con `prisma migrate deploy` (no `migrate dev`).
3. Deploy del código (cron + actions + UI).
4. Paso manual del super-admin: para `atlas-gym` y `mila-fit`, en `/admin/gyms/[id]` → activar modo manual, cargar `subscriptionNextPaymentDate`, y desactivar exento (en esa edición).
5. **Rollback**: el flag tiene default `false`; revertir el código deja el campo inerte (ningún gym en modo manual salvo los dos editados). Para revertir datos, volver a marcar exentos a los dos gyms desde el panel.

## Open Questions

- ¿Se quiere también email al dueño en el vencimiento (como en el flujo MP)? — Fuera de alcance de esta iteración; queda como posible follow-up.

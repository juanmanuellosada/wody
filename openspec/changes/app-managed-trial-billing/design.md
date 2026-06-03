## Context

El cobro del SaaS Wody (gyms y Wody Personal) usa Mercado Pago Suscripciones. Hoy:

- La app asigna `trialEndsAt = createdAt + 30 días` y un cron diario (`check-gym-trials`) bloquea al tenant si el trial venció sin suscripción, o si MP reporta `paused`/`cancelled` por más del grace de 7 días.
- El alta de tarjeta **redirige** al checkout hosteado de MP con un `preapproval_plan_id`. El plan tiene `free_trial = 30 días` configurado en el dashboard de MP.
- Existen dos planes por tenant-type (original con `free_trial = 30`, `RETURNING` con `free_trial = 0`) y la app elige según `mpPreapprovalId` previo.

El `free_trial` de MP arranca al momento de suscribirse, no en el alta del gym. Como el alta de tarjeta puede ocurrir en cualquier punto del trial de la app, un tenant que vincula tarde acumula hasta 60 días gratis. Este doble-trial fue documentado y aceptado como trade-off en `archive/2026-05-28-add-gym-mp-billing/design.md` (Decisión 0) "para no crear preapprovals individuales con `start_date`". Este cambio revierte esa decisión: la app pasa a ser la **única** dueña del trial.

Constraints: multi-tenant (filtrar por `gymId`/`gymSlug`); Next.js 16.2.2 (consultar `node_modules/next/dist/docs/` antes de tocar APIs de Next); no se modifica `prisma/schema.prisma` (los campos ya existen); el webhook y el cron deben mantener su semántica actual.

## Goals / Non-Goals

**Goals:**
- La app es la única fuente de verdad del período de prueba; MP no maneja `free_trial`.
- El primer cobro ocurre exactamente al fin del trial (vía `free_trial` dinámico = días restantes), sin cobro anticipado ni doble-trial, aunque la tarjeta se configure antes.
- Captura de tarjeta in-app (MP Bricks) sin que datos de tarjeta toquen el server de Wody.
- Eliminar el plan `RETURNING` y la selección de plan por historial.
- Aplicar el cambio de forma simétrica a gyms y a Wody Personal.
- No romper suscripciones ya creadas bajo el esquema viejo.

**Non-Goals:**
- Cambiar la duración del trial (sigue siendo 30 días).
- Cambiar la lógica del cron (bloqueo por trial vencido + grace de 7 días) ni la del webhook firmado.
- Cambiar el modelo de datos / `schema.prisma`.
- Cambiar montos ($40.000 ARS/mes gym, $7.000 ARS/mes Personal) ni la política de exención manual.
- Migrar las suscripciones MP existentes a la nueva forma.

## Decisions

### Decisión 1 — `preapproval` por API **sin plan asociado**, con `free_trial` dinámico en días

Se crea la suscripción con `preApproval.create(...)` del SDK `mercadopago@3.0.0` (ya instalado) usando el modelo de **suscripción sin plan asociado**: `POST /preapproval` **sin `preapproval_plan_id`**, pasando `card_token_id`, `payer_email`, `status = "authorized"`, `external_reference` (gymId, o `"user_<userId>"`), `reason`, `back_url`, y `auto_recurring` con `transaction_amount`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`, y un **`free_trial = { frequency: díasRestantes, frequency_type: "days" }`** calculado al momento de vincular la tarjeta (`díasRestantes = ceil((trialEndsAt - now)/día)`). **No** se usa `start_date`. `create` devuelve `{ id, status }` → se mapea a `mpPreapprovalId` y `parseMpSubscriptionStatus`.

- **Por qué `free_trial` dinámico y NO `start_date`**: la doc oficial de MP, en la página exacta de "suscripción sin plan + pago autorizado", afirma que el primer cobro ocurre **~1 hora después** de crear la suscripción y **no documenta `start_date` como mecanismo de diferimiento** (confirmado en 3 dominios de MP). Es decir, `start_date` futuro NO garantiza posponer el cobro. En cambio `free_trial` SÍ difiere el primer cobro exactamente por el período indicado: es el mismo mecanismo que **ya funciona hoy en la producción de Wody** (free_trial estático de 30 días). La única diferencia es calcularlo dinámicamente = días restantes del trial de la app, en vez de fijarlo en el plan. Confirmado: `free_trial` acepta `frequency_type: "days"` con cantidad arbitraria y va dentro de `auto_recurring` del preapproval sin plan (tipo `AutoRecurringWithFreeTrial` del SDK 3.0.0 + SDK oficial Go + doc de panel).
- **Por qué sin plan**: en modo sin-plan vos definís monto y ciclo en el payload, sin que el `free_trial` estático ni el ciclo de un plan del dashboard interfieran. Los 4 IDs de plan (`MP_PREAPPROVAL_PLAN_ID*`) salen por completo del flujo de cobro.
- **Alternativa descartada (`start_date` futuro)**: contradicha por la doc (primer cobro a la ~1h). Habría cobrado de inmediato al vincular la tarjeta. Descartada tras investigación documental.
- **Alternativa descartada (reusar un plan existente, ej. `_RETURNING`)**: el plan trae su propio ciclo/free_trial estático; volvería al problema del doble-trial o a precedencia no documentada. Innecesario yendo sin plan.
- **Alternativa descartada (statu quo)**: aceptar el doble-trial. Es el problema que motiva este cambio.

### Decisión 2 — Captura de tarjeta in-app con MP Bricks/CardForm (tokenización client-side)

El front monta el Card Payment Brick / CardForm de MP (`@mercadopago/sdk-js`, `new MercadoPago(PUBLIC_KEY)`) con la **public key**. MP tokeniza la tarjeta en el navegador y devuelve un `card_token_id`. Ese token (no los datos de la tarjeta) viaja a una server action que crea el `preapproval`.

- **Por qué**: PCI — la tarjeta nunca toca el server de Wody; Wody solo maneja el token efímero. Es el patrón recomendado por MP para suscripciones creadas por API con `card_token_id`.
- **Implicancia**: se agrega el SDK JS de MP en el cliente y se expone la public key de MP al front en una nueva env pública `NEXT_PUBLIC_MP_PUBLIC_KEY` (hoy no existe ninguna public key de MP en el repo). La server action queda como único punto que habla con la API privada de MP.
- **Gotcha confirmado**: el `card_token` es de **un solo uso y expira a los 7 días**. Debe consumirse en el `preApproval.create` inmediatamente después de tokenizar; no se guarda para después. Una vez creada la suscripción, MP guarda la tarjeta y cobra recurrente sin re-tokenizar.

### Decisión 3 — Cobro inmediato cuando la tarjeta se vincula con el trial ya vencido

Si al crear el `preapproval` el trial ya venció (`díasRestantes <= 0`), la implementación SHALL **omitir el objeto `free_trial`**. Una suscripción `authorized` sin `free_trial` cobra a la ~1h (comportamiento estándar documentado), que es exactamente lo deseado para un tenant que se reactiva después de bloqueado: paga ya. Solo se incluye `free_trial` cuando `díasRestantes >= 1`.

### Decisión 4 — Compatibilidad con suscripciones existentes (sin migración)

Los tenants con `mpPreapprovalId` ya seteado bajo el esquema viejo (plan + `free_trial`) **conviven** sin cambios: su suscripción sigue activa en MP y el webhook sigue sincronizando su estado. El nuevo flujo solo aplica a altas nuevas y reactivaciones desde el bloqueo.

- **Por qué**: migrar preapprovals vivos es riesgoso (re-tokenización, posible interrupción de cobro) y no aporta valor — el doble-trial solo afecta altas futuras.
- **Trade-off**: durante un tiempo coexisten suscripciones creadas por plan y por API. Como ambas terminan reflejadas en los mismos campos (`mpPreapprovalId`, `mpSubscriptionStatus`), el webhook y el cron las tratan igual.

### Decisión 5 — Manejo de errores de creación de `preapproval` y reintentos

La server action SHALL devolver un resultado tipado (ok / error con motivo) ante tarjeta rechazada, token inválido/expirado o fallo de la API de MP. La UI SHALL mostrar el error y permitir reintentar (re-tokenizar y volver a crear). No se persiste `mpPreapprovalId` si la creación falla; el tenant sigue en trial hasta resolverlo.

### Decisión 6 — Eliminación de TODOS los planes y de la selección por historial

Como el cobro va sin plan asociado (Decisión 1), los planes de MP salen por completo del flujo. Se eliminan `getSubscriptionCheckoutUrl`/`getPersonalSubscriptionCheckoutUrl` (y sus helpers `pickPlanIdForGym`/`pickPersonalPlanIdForUser` que elegían plan por `mpPreapprovalId` previo) y la dependencia de las 4 env de plan (`MP_PREAPPROVAL_PLAN_ID`, `MP_PREAPPROVAL_PLAN_ID_RETURNING`, `MP_PREAPPROVAL_PLAN_ID_PERSONAL`, `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`). El monto pasa a definirse en el payload del `preapproval` (`transaction_amount`). El dueño puede borrar los 4 planes del dashboard una vez en producción.

### Decisión 7 — Dos funciones espejo (gym y Personal), no una unificada

Se mantienen **dos funciones espejo** de creación de `preapproval` (una para gym, una para Personal), en lugar de una sola parametrizada. Decisión del usuario: prioriza claridad y simetría con el resto del código de billing (que ya está duplicado gym/Personal) sobre DRY.

## Risks / Trade-offs

- [El mecanismo de diferimiento no es confiable] → **Resuelto**: se usa `free_trial`, el mismo mecanismo ya validado en la producción de Wody (difiere el primer cobro por el período indicado). `start_date` quedó descartado por estar contradicho por la doc. No requiere sandbox.
- [`free_trial.frequency` máximo en días no está publicado oficialmente] → Mitigación: irrelevante para el caso de uso — `díasRestantes` siempre es ≤ duración del trial (30 días), muy por debajo de cualquier tope plausible.
- [Card token de un solo uso / expira a los 7 días] → Mitigación: crear el `preapproval` inmediatamente tras tokenizar; ante expiración/uso previo, re-tokenizar (Decisión 5).
- [Bricks expone la public key y agrega un script externo de MP en el cliente] → Mitigación: usar solo la public key (no el access token), cargar el SDK de MP de forma controlada, mantener toda llamada privada en la server action.
- [Desfase de 1 día en `díasRestantes` por redondeo / zona horaria] → Mitigación: usar `ceil` (favorece al cliente, nunca cobra antes de tiempo) y calcular contra `trialEndsAt` en UTC.
- [Coexistencia de suscripciones viejas (por plan) y nuevas (por API)] → Mitigación: el webhook/cron operan sobre los mismos campos; no se requiere ramificar lógica downstream.
- [Token de tarjeta de un solo uso / expira] → Mitigación: crear el `preapproval` inmediatamente tras tokenizar; ante expiración, re-tokenizar (Decisión 5).

## Migration Plan

1. Cargar la public key de MP para el front (`NEXT_PUBLIC_MP_PUBLIC_KEY`). No hay que crear ni tocar planes en MP — el cobro va sin plan asociado.
2. Implementar las dos funciones espejo de creación de `preapproval` por API (gym + Personal) en `src/lib/mercadopago.ts`, conservando `verifyMpWebhookSignature`, `parseMpSubscriptionStatus`, `cancelMpPreapproval`.
3. Reemplazar el CTA de redirect por el componente Bricks en las UIs de billing (dueño y Personal) y conectar la server action.
4. Verificar que webhook y cron no requieren cambios (smoke test).
5. Quitar las 4 env de plan de la config; el dueño borra los 4 planes del dashboard de MP tras el deploy.
6. Actualizar `docs/billing-mercadopago.md`.

**Rollback**: las suscripciones viejas no se tocan; revertir el código de UI + lib restaura el flujo de redirect por plan. Las env de plan solo se eliminan en el paso final, así que el rollback previo a ese paso es directo.

## Open Questions

_Resueltas durante la investigación:_

- ~~¿Cómo diferir el primer cobro a fecha futura sin sandbox?~~ → **Resuelto: `free_trial` dinámico en días** (Decisión 1). `start_date` descartado por estar contradicho por la doc oficial (primer cobro a la ~1h).
- ~~¿Sin plan asociado o reusar planes `_RETURNING`?~~ → **Resuelto: sin plan asociado** (Decisión 1).
- ~~¿Una función parametrizada o dos espejo?~~ → **Resuelto: dos funciones espejo** (Decisión 7).

_Pendiente (definir en implementación, no bloqueante):_

- Monto exacto a pasar en `transaction_amount` (¿se toma de `subscriptionMonthlyAmount` del gym o constante $40.000 / $7.000?).

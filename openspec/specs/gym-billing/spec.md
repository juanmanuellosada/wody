# gym-billing Specification

## Purpose
Cobro mensual del SaaS Wody a cada gym mediante suscripciones de Mercado Pago ($60.000 ARS/mes). Incluye un trial de 30 días desde la creación del gym, dos planes en MP (uno para gyms nuevos con free_trial de 30 días, otro para re-suscripciones sin free_trial), exención manual a nivel gym controlada solo por el super-admin, sincronización de estado vía webhook firmado, bloqueo automático por cron diario (tanto por trial vencido sin suscripción como por pago fallido con grace period de 7 días), push notifications a los `ADMIN` en hitos del fin del trial, y email transaccional al dueño cuando MP no puede cobrar.

## Requirements
### Requirement: Cada gym tiene un ciclo de trial de 30 días desde su creación

El sistema SHALL asignar a todo `Gym` recién creado un campo `trialEndsAt` igual a `createdAt + 30 días`. Durante el trial, el gym opera con todas las funcionalidades habilitadas sin requerir suscripción activa en Mercado Pago.

#### Scenario: Trial nuevo en alta de gym

- **WHEN** el super-admin crea un gym desde `/admin/gyms/new`
- **THEN** el sistema persiste `trialEndsAt = createdAt + 30 días`, `paymentExempt = false`, `mpPreapprovalId = null`, `mpSubscriptionStatus = null`, `blockedAt = null`

#### Scenario: Gyms pre-existentes al deploy quedan exentos

- **WHEN** se aplica la migración que introduce el modelo de cobro
- **THEN** todos los gyms con `createdAt` anterior al deploy quedan marcados con `paymentExempt = true` y `paymentExemptReason = "Gym pre-existente al lanzamiento del modelo de cobro (2026-05)"`, y conservan `blockedAt = null` si lo tenían

### Requirement: Plan único de $60.000 ARS/mes

El sistema SHALL usar **dos** `preapproval_plan` de Mercado Pago de $60.000 ARS/mes con la siguiente lógica de selección:

- **Plan original** (`MP_PREAPPROVAL_PLAN_ID`): `free_trial = 30 días`. Se usa cuando un gym se suscribe por primera vez (su `mpPreapprovalId IS NULL`).
- **Plan de re-activación** (`MP_PREAPPROVAL_PLAN_ID_RETURNING`): `free_trial = 0 días`. Se usa cuando un gym vuelve a suscribirse después de haber tenido al menos una suscripción anterior (`mpPreapprovalId IS NOT NULL`).

El `Gym.subscriptionMonthlyAmount` SHALL tener default `60000` y SHALL ser editable únicamente por el super-admin como referencia del precio negociado, sin afectar el monto que efectivamente cobra MP a través del plan elegido.

#### Scenario: Default de monto al crear gym

- **WHEN** el super-admin crea un gym sin especificar `subscriptionMonthlyAmount`
- **THEN** el sistema lo persiste con `subscriptionMonthlyAmount = 60000`

#### Scenario: Super-admin puede editar el monto de referencia

- **WHEN** el super-admin edita el campo `subscriptionMonthlyAmount` de un gym desde `/admin/gyms/[id]`
- **THEN** el sistema persiste el nuevo valor sin tocar la suscripción real en Mercado Pago

#### Scenario: Primer checkout usa el plan original

- **WHEN** un dueño con `Gym.mpPreapprovalId IS NULL` invoca `getSubscriptionCheckoutUrl(gymId)`
- **THEN** el sistema retorna una URL apuntando al `MP_PREAPPROVAL_PLAN_ID`

#### Scenario: Re-checkout usa plan RETURNING

- **WHEN** un dueño con `Gym.mpPreapprovalId IS NOT NULL` (al menos una suscripción anterior, sin importar su estado actual) invoca `getSubscriptionCheckoutUrl(gymId)`
- **THEN** el sistema retorna una URL apuntando al `MP_PREAPPROVAL_PLAN_ID_RETURNING`

### Requirement: Exención manual de pago a nivel gym

El sistema SHALL permitir al super-admin marcar y desmarcar un gym como exento del cobro mediante los campos `Gym.paymentExempt: Boolean` y `Gym.paymentExemptReason: String?`. Solo usuarios con `role = SUPERADMIN` SHALL poder modificar estos campos.

#### Scenario: Super-admin marca un gym como exento

- **WHEN** un usuario con `role = SUPERADMIN` invoca la server action `setGymPaymentExempt(gymId, true, reason)`
- **THEN** el sistema actualiza `paymentExempt = true` y `paymentExemptReason = reason` para ese gym

#### Scenario: Usuario sin rol super-admin no puede marcar exenciones

- **WHEN** un usuario con `role != SUPERADMIN` intenta invocar `setGymPaymentExempt`
- **THEN** la server action rechaza la operación con un error de autorización y no modifica datos

#### Scenario: Quitar exención requiere motivo nuevo

- **WHEN** el super-admin desmarca la exención (`exempt = false`)
- **THEN** el sistema persiste `paymentExempt = false` y `paymentExemptReason = null`

### Requirement: Suscripción del gym vía Mercado Pago Suscripciones

El sistema SHALL ofrecer al dueño de un gym un flujo para suscribirse a un plan de Mercado Pago. La suscripción se modela con los campos `Gym.mpPreapprovalId: String?` (id devuelto por MP) y `Gym.mpSubscriptionStatus: String?` (estado actual: `pending`, `authorized`, `paused`, `cancelled` o un valor desconocido tratado como "unknown"). El sistema SHALL elegir entre el plan original y el plan de re-activación según el `mpPreapprovalId` previo del gym (ver requirement "Plan único de $60.000 ARS/mes").

#### Scenario: Dueño del gym genera link de suscripción

- **WHEN** un usuario con `role = ADMIN` de un gym entra a `/[gymSlug]/admin/billing` y hace click en "Configurar tarjeta"
- **THEN** el sistema lo redirige al checkout de Mercado Pago con el plan correspondiente según historial

### Requirement: Webhook recibe autorización de suscripción

El sistema SHALL exponer un endpoint `POST /api/webhooks/mercadopago` que reciba notificaciones de Mercado Pago con firma HMAC validada contra `MP_WEBHOOK_SECRET`. Para cada evento `subscription_preapproval` o `subscription_authorized_payment`, el sistema SHALL consultar la API de MP por el `preapproval_id`, extraer `external_reference` (= gymId), `status`, y actualizar el gym correspondiente.

El sistema SHALL persistir `mpPreapprovalId` y `mpSubscriptionStatus` con el resultado. Cuando el `mpSubscriptionStatus` cambia respecto al valor anterior (transición de estado), el sistema SHALL **también** actualizar `mpSubscriptionStatusChangedAt = now()`. Si el status no cambió (idempotencia del webhook), el sistema NO SHALL modificar `mpSubscriptionStatusChangedAt`.

#### Scenario: Webhook recibe autorización de suscripción

- **WHEN** Mercado Pago notifica al endpoint `POST /api/webhooks/mercadopago` que la suscripción `preapproval_id = X` para el `external_reference = <gymId>` quedó `authorized`
- **AND** la firma HMAC del header `x-signature` es válida contra `MP_WEBHOOK_SECRET`
- **THEN** el sistema persiste `mpPreapprovalId = X` y `mpSubscriptionStatus = 'authorized'` en el gym correspondiente
- **AND** si el `mpSubscriptionStatus` anterior era distinto, también persiste `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Webhook con firma inválida es rechazado

- **WHEN** llega un POST a `/api/webhooks/mercadopago` con firma HMAC inválida o ausente
- **THEN** el sistema responde `401` y no modifica datos

#### Scenario: Estado desconocido se loggea pero no rompe

- **WHEN** MP envía un `status` no contemplado (por ejemplo, un valor nuevo agregado por MP)
- **THEN** el sistema persiste el string literal recibido y emite un warning en el log, sin tirar excepción

#### Scenario: Webhook idempotente no actualiza el changedAt

- **WHEN** llega un webhook con `status` idéntico al `mpSubscriptionStatus` actual del gym
- **THEN** el sistema NO modifica `mpSubscriptionStatusChangedAt`

### Requirement: Cancelación de suscripción restringida a super-admin

El sistema SHALL permitir cancelar la suscripción de un gym únicamente al super-admin mediante la server action `cancelGymSubscription(gymId)`. El dueño del gym (`role = ADMIN`) NO SHALL poder cancelar su propia suscripción desde Wody.

#### Scenario: Super-admin cancela una suscripción

- **WHEN** un usuario con `role = SUPERADMIN` invoca `cancelGymSubscription(gymId)`
- **THEN** el sistema invoca la API de Mercado Pago para cancelar el `preapproval` correspondiente, y al recibir éxito persiste `mpSubscriptionStatus = 'cancelled'`

#### Scenario: ADMIN del gym no puede cancelar

- **WHEN** un usuario con `role = ADMIN` intenta invocar `cancelGymSubscription`
- **THEN** la server action rechaza la operación con error de autorización

#### Scenario: Dueño puede reconfigurar tarjeta

- **WHEN** un usuario con `role = ADMIN` ya con suscripción activa hace click en "Reconfigurar tarjeta" en `/[gymSlug]/admin/billing`
- **THEN** el sistema genera un link de Mercado Pago que permite cambiar el medio de pago sin cancelar la suscripción

### Requirement: Bloqueo automático por fin de trial sin suscripción

El sistema SHALL ejecutar un cron job diario que evalúe el estado de cada gym y aplique `blockedAt = now()` a los gyms que cumplen una de las dos condiciones siguientes:

**Condición A (trial vencido)**: `trialEndsAt < now()` AND `mpPreapprovalId IS NULL` AND `paymentExempt = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

**Condición B (pago fallido con grace period)**: `mpSubscriptionStatus IN ('paused', 'cancelled')` AND `mpSubscriptionStatusChangedAt < now() - 7 días` AND `paymentExempt = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

#### Scenario: Gym con trial vencido y sin suscripción se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `trialEndsAt` en el pasado, sin `mpPreapprovalId`, sin exención, sin bloqueo previo y con `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 8 días, sin exención, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción cancelada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 10 días, sin exención, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada dentro del grace period NO se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 3 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym exento no se bloquea aunque tenga sub fallida

- **WHEN** el cron diario corre
- **AND** existe un gym con `paymentExempt = true`, `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 20 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym Wody Personal nunca se bloquea por cron

- **WHEN** el cron diario corre
- **AND** existe un gym con `kind = PERSONAL`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de su trial o status MP

#### Scenario: Gym con suscripción activa no se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'authorized'`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de `trialEndsAt`

### Requirement: Banner de fin de trial visible al dueño del gym

El sistema SHALL mostrar un banner persistente al usuario con `role = ADMIN` de un gym cuando faltan 7 días o menos para `trialEndsAt`, el gym NO está exento, y NO tiene suscripción activa en MP. El banner SHALL indicar los días restantes y ofrecer un link directo a `/[gymSlug]/admin/billing`.

#### Scenario: Banner aparece a falta de 7 días o menos

- **WHEN** el `ADMIN` del gym navega a cualquier página del gym
- **AND** `trialEndsAt - now() <= 7 días` y `> 0`
- **AND** `paymentExempt = false` y `mpSubscriptionStatus != 'authorized'`
- **THEN** el sistema renderiza un banner indicando los días restantes y un link a `/[gymSlug]/admin/billing`

#### Scenario: Banner no aparece si el gym está exento

- **WHEN** el `ADMIN` del gym navega a cualquier página del gym
- **AND** el gym tiene `paymentExempt = true`
- **THEN** el banner NO se renderiza

#### Scenario: Banner no aparece si el gym tiene suscripción activa

- **WHEN** el `ADMIN` del gym navega a cualquier página del gym
- **AND** `mpSubscriptionStatus = 'authorized'`
- **THEN** el banner NO se renderiza

### Requirement: Push notifications de fin de trial al dueño del gym

El sistema SHALL enviar push notifications a todos los usuarios con `role = ADMIN` de un gym en hitos específicos durante el fin del trial: a 7, 3 y 1 días antes de `trialEndsAt`, y el día del vencimiento (`daysLeft = 0`). El despacho SHALL ocurrir desde el cron diario, reutilizando la infraestructura de `src/lib/push.ts` (`sendPushToUser`). El gym NO SHALL recibir push si `paymentExempt = true`, si `mpSubscriptionStatus = 'authorized'`, o si `kind = PERSONAL`.

#### Scenario: Push en cada hito de aviso

- **WHEN** el cron diario corre
- **AND** existe un gym no exento, sin suscripción autorizada, con `kind != PERSONAL`
- **AND** `daysLeft = round((trialEndsAt - now) / 1 día)` es uno de los valores `7`, `3`, `1` o `0`
- **THEN** el sistema envía una push notification a cada usuario con `role = ADMIN` del gym, con un título y cuerpo correspondientes al hito y un CTA a `/[gymSlug]/admin/billing`

#### Scenario: Gym exento no recibe push de fin de trial

- **WHEN** el cron diario corre
- **AND** existe un gym con `paymentExempt = true` cuyo `daysLeft` cae en un hito de aviso
- **THEN** el sistema NO envía push notifications

#### Scenario: Gym con suscripción activa no recibe push

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'authorized'` cuyo `daysLeft` cae en un hito de aviso
- **THEN** el sistema NO envía push notifications

#### Scenario: Días intermedios no disparan push

- **WHEN** el cron diario corre
- **AND** existe un gym con `daysLeft` igual a 6, 5, 4 o 2 (no es hito)
- **THEN** el sistema NO envía push notifications a ese gym ese día

### Requirement: UI del super-admin muestra estado de suscripción y exención por gym

El sistema SHALL exponer en `/admin/gyms/[id]` una sección "Suscripción y exención" con los campos `paymentExempt` (toggle editable), `paymentExemptReason` (texto editable cuando `paymentExempt = true`), `trialEndsAt` (lectura), `mpSubscriptionStatus` (lectura), `mpPreapprovalId` (lectura, link a MP si aplica), y un botón "Cancelar suscripción" visible solo si `mpPreapprovalId != null`.

#### Scenario: Super-admin ve y edita la exención

- **WHEN** un `SUPERADMIN` abre `/admin/gyms/[id]`
- **THEN** la página muestra el estado actual de `paymentExempt`, `paymentExemptReason`, `trialEndsAt`, `mpSubscriptionStatus`, y permite togglear la exención

#### Scenario: Botón "Cancelar suscripción" no aparece si no hay suscripción

- **WHEN** un `SUPERADMIN` abre `/admin/gyms/[id]` para un gym con `mpPreapprovalId = null`
- **THEN** el botón "Cancelar suscripción" NO se renderiza

### Requirement: Notificación al dueño cuando MP no puede cobrar

El sistema SHALL enviar un email `payment-failed` a los usuarios con `role = ADMIN` de un gym cuando el `mpSubscriptionStatus` del gym entra **por primera vez** en `paused` o `cancelled` (transición desde otro estado). El email SHALL indicar que el cobro falló, que el gym sigue funcionando por ahora, y que hay 7 días para configurar una tarjeta nueva antes del bloqueo automático. El email SHALL incluir un link directo a `/<gymSlug>/admin/billing`.

#### Scenario: Email se dispara en transición a paused

- **WHEN** llega un webhook que cambia `mpSubscriptionStatus` de `'authorized'` (o cualquier valor distinto a paused/cancelled) a `'paused'`
- **THEN** el sistema envía el email `payment-failed` a todos los `ADMIN` del gym

#### Scenario: Email se dispara en transición a cancelled

- **WHEN** llega un webhook que cambia `mpSubscriptionStatus` de cualquier estado distinto a paused/cancelled a `'cancelled'`
- **THEN** el sistema envía el email `payment-failed` a todos los `ADMIN` del gym

#### Scenario: Email NO se dispara en idempotencia

- **WHEN** llega un webhook con `mpSubscriptionStatus = 'paused'` para un gym cuyo status actual ya era `'paused'`
- **THEN** el sistema NO envía el email `payment-failed`

#### Scenario: Email NO se dispara en transición de paused a cancelled

- **WHEN** llega un webhook con `mpSubscriptionStatus = 'cancelled'` para un gym cuyo status actual era `'paused'`
- **THEN** el sistema NO envía el email `payment-failed` (ambos son estados de "pago fallido" — no nueva información)

#### Scenario: Email se re-dispara en re-caída

- **WHEN** un gym tenía `mpSubscriptionStatus = 'cancelled'`, regulariza y pasa a `'authorized'`, después falla otra vez y vuelve a `'paused'`
- **THEN** el sistema envía nuevamente el email `payment-failed`

#### Scenario: Gym exento no recibe email

- **WHEN** un gym con `paymentExempt = true` recibe un webhook que cambia su status a `'paused'` o `'cancelled'`
- **THEN** el sistema persiste el cambio de status pero NO envía email (la exención implica que el cobro no aplica en el modelo Wody)

### Requirement: Tracking de cambios de estado de la suscripción

El sistema SHALL persistir el momento exacto en que el `mpSubscriptionStatus` de un gym cambió por última vez, en un nuevo campo `Gym.mpSubscriptionStatusChangedAt: DateTime?`. El campo SHALL ser actualizado solo cuando el status efectivamente cambia (no en eventos idempotentes con el mismo status que el actual).

#### Scenario: Campo se inicializa al primer cambio de status

- **WHEN** un gym recibe su primera notificación de status (típicamente desde `null` hacia `'authorized'`)
- **THEN** el sistema setea `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Campo se actualiza en cambio real

- **WHEN** un webhook cambia el `mpSubscriptionStatus` de un valor a otro distinto
- **THEN** el sistema actualiza `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Campo no se actualiza en webhook idempotente

- **WHEN** un webhook trae el mismo status que el gym ya tiene persistido
- **THEN** el sistema NO modifica `mpSubscriptionStatusChangedAt`

#### Scenario: Reactivación reinicia el reloj del grace period

- **WHEN** un gym estaba en `'paused'` hace 6 días, regulariza y el webhook lo pasa a `'authorized'`
- **THEN** el sistema actualiza `mpSubscriptionStatusChangedAt = now()`, y el gym NO se bloquea aunque la siguiente caída ocurra otra vez días después (el grace period se reinicia)

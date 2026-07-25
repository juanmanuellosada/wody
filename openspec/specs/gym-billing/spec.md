# gym-billing Specification

## Purpose
Cobro mensual del SaaS Wody a cada gym mediante suscripciones de Mercado Pago ($40.000 ARS/mes). Incluye un trial de 15 días desde la creación del gym, dos planes en MP (uno para gyms nuevos con free_trial de 15 días, otro para re-suscripciones sin free_trial), exención manual a nivel gym controlada solo por el super-admin, sincronización de estado vía webhook firmado, bloqueo automático por cron diario (tanto por trial vencido sin suscripción como por pago fallido con grace period de 7 días), push notifications a los `ADMIN` en hitos del fin del trial, y email transaccional al dueño cuando MP no puede cobrar.
## Requirements
### Requirement: Cada gym tiene un ciclo de trial de 15 días desde su creación

El sistema SHALL asignar a todo `Gym` recién creado un campo `trialEndsAt` igual a `createdAt + 15 días`. Durante el trial, el gym opera con todas las funcionalidades habilitadas sin requerir suscripción activa en Mercado Pago.

#### Scenario: Trial nuevo en alta de gym

- **WHEN** el super-admin crea un gym desde `/admin/gyms/new`
- **THEN** el sistema persiste `trialEndsAt = createdAt + 15 días`, `paymentExempt = false`, `mpPreapprovalId = null`, `mpSubscriptionStatus = null`, `blockedAt = null`

#### Scenario: Gyms pre-existentes al deploy quedan exentos

- **WHEN** se aplica la migración que introduce el modelo de cobro
- **THEN** todos los gyms con `createdAt` anterior al deploy quedan marcados con `paymentExempt = true` y `paymentExemptReason = "Gym pre-existente al lanzamiento del modelo de cobro (2026-05)"`, y conservan `blockedAt = null` si lo tenían

### Requirement: Plan único de $40.000 ARS/mes

El sistema SHALL cobrar $40.000 ARS/mes por gym mediante un único esquema de suscripción de Mercado Pago **sin `free_trial`**. El período de prueba es propiedad exclusiva de la app (`Gym.trialEndsAt`); Mercado Pago NO SHALL configurar ningún `free_trial`.

La suscripción SHALL crearse **sin plan asociado** (`POST /preapproval` sin `preapproval_plan_id`): el monto y el ciclo se definen en el payload (`auto_recurring.transaction_amount = 40000`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). El sistema NO SHALL usar ningún `preapproval_plan` para el cobro, NO SHALL mantener un plan de re-activación (`RETURNING`) ni elegir plan según historial.

El `Gym.subscriptionMonthlyAmount` SHALL tener default `40000` y SHALL ser editable únicamente por el super-admin como referencia del precio negociado, sin afectar el monto que efectivamente cobra MP.

#### Scenario: Default de monto al crear gym

- **WHEN** el super-admin crea un gym sin especificar `subscriptionMonthlyAmount`
- **THEN** el sistema lo persiste con `subscriptionMonthlyAmount = 40000`

#### Scenario: Super-admin puede editar el monto de referencia

- **WHEN** el super-admin edita el campo `subscriptionMonthlyAmount` de un gym desde `/admin/gyms/[id]`
- **THEN** el sistema persiste el nuevo valor sin tocar la suscripción real en Mercado Pago

#### Scenario: Ninguna suscripción usa free_trial de MP

- **WHEN** el sistema crea la suscripción de un gym en Mercado Pago
- **THEN** el payload NO incluye `free_trial` y el período de prueba se gobierna solo por `Gym.trialEndsAt`

#### Scenario: No hay selección de plan por historial

- **WHEN** un dueño con `Gym.mpPreapprovalId IS NULL` o `IS NOT NULL` inicia el alta de tarjeta
- **THEN** el sistema usa el mismo esquema de suscripción en ambos casos, sin distinguir un plan de re-activación

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

El sistema SHALL ofrecer al dueño de un gym un flujo **in-app** para suscribirse, sin redirigir al checkout hosteado de Mercado Pago. La captura de tarjeta SHALL realizarse con MP Bricks/CardForm, que tokeniza la tarjeta del lado del cliente; los datos de la tarjeta NO SHALL tocar el server de Wody, que SHALL recibir únicamente un `card_token_id`.

Con ese token, el sistema SHALL crear la suscripción mediante `POST /preapproval` **sin plan asociado** con `external_reference = gymId`, `status = "authorized"`, `payer_email`, y `auto_recurring.transaction_amount = 40000`. El primer cobro SHALL diferirse hasta el fin del trial mediante un **`free_trial` dinámico**: el sistema calcula `díasRestantes = ceil((Gym.trialEndsAt - now) / 1 día)` y, si `díasRestantes >= 1`, incluye `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`. El sistema NO SHALL usar `start_date` como mecanismo de diferimiento. La suscripción se modela con `Gym.mpPreapprovalId: String?` (id devuelto por MP) y `Gym.mpSubscriptionStatus: String?` (`pending`, `authorized`, `paused`, `cancelled` o un valor desconocido tratado como "unknown").

Si `Gym.trialEndsAt` ya pasó al momento de crear el `preapproval` (`díasRestantes <= 0`), el sistema SHALL omitir `free_trial`, de modo que el primer cobro sea inmediato.

Ante un fallo de la creación (tarjeta rechazada, token inválido/expirado o error de la API de MP), el sistema NO SHALL persistir `mpPreapprovalId`, SHALL devolver un resultado de error a la UI y SHALL permitir reintentar.

#### Scenario: Dueño del gym configura tarjeta in-app durante el trial

- **WHEN** un usuario con `role = ADMIN` entra a `/[gymSlug]/admin/billing`, carga su tarjeta en el componente de MP Bricks y confirma, con `Gym.trialEndsAt` en el futuro
- **THEN** el sistema crea el `preapproval` con `free_trial = { frequency: díasRestantes, frequency_type: "days" }` y persiste `mpPreapprovalId` y `mpSubscriptionStatus` devueltos por MP, sin cobrar todavía
- **AND** el primer cobro queda programado para el fin del trial

#### Scenario: Configuración de tarjeta con trial ya vencido cobra de inmediato

- **WHEN** un dueño configura la tarjeta cuando `Gym.trialEndsAt` ya pasó (`díasRestantes <= 0`)
- **THEN** el sistema crea el `preapproval` sin `free_trial` y el primer cobro se ejecuta de inmediato

#### Scenario: Tarjeta rechazada permite reintento

- **WHEN** la creación del `preapproval` falla por tarjeta rechazada o token inválido
- **THEN** el sistema no persiste `mpPreapprovalId`, muestra el error al dueño y le permite reintentar el alta de tarjeta

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

**Condición A (trial vencido)**: `trialEndsAt < now()` AND `mpPreapprovalId IS NULL` AND `paymentExempt = false` AND `subscriptionNextPaymentDate IS NULL` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

**Condición B (pago fallido con grace period)**: `mpSubscriptionStatus IN ('paused', 'cancelled')` AND `mpSubscriptionStatusChangedAt < now() - 7 días` AND `paymentExempt = false` AND `subscriptionNextPaymentDate IS NULL` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

Un gym con `subscriptionNextPaymentDate` cargada se considera **manejado por fecha de vencimiento** y SHALL quedar excluido de ambas condiciones; su bloqueo se rige por la regla de vencimiento + gracia. Un gym con `selfManagedBilling = true` también queda excluido de ambas condiciones aunque no tenga fecha cargada.

#### Scenario: Gym con trial vencido y sin suscripción se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `trialEndsAt` en el pasado, sin `mpPreapprovalId`, sin exención, sin fecha de vencimiento cargada, sin flag manual, sin bloqueo previo y con `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 8 días, sin exención, sin fecha cargada, sin flag manual, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción cancelada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 10 días, sin exención, sin fecha cargada, sin flag manual, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada dentro del grace period NO se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 3 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym exento no se bloquea aunque tenga sub fallida

- **WHEN** el cron diario corre
- **AND** existe un gym con `paymentExempt = true`, `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 20 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym con fecha de vencimiento cargada NO se bloquea por Condición A

- **WHEN** el cron diario corre
- **AND** existe un gym con `subscriptionNextPaymentDate` cargada, `trialEndsAt` en el pasado, sin `mpPreapprovalId`, sin exención, `kind != PERSONAL`
- **THEN** el sistema NO bloquea por la Condición A (su bloqueo se rige por vencimiento + gracia)

#### Scenario: Gym Wody Personal nunca se bloquea por cron

- **WHEN** el cron diario corre
- **AND** existe un gym con `kind = PERSONAL`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de su trial o status MP

#### Scenario: Gym con suscripción activa no se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'authorized'`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de `trialEndsAt`

### Requirement: Banner de fin de trial visible al dueño del gym

El sistema SHALL mostrar un banner persistente al usuario con `role = ADMIN` de un gym cuando faltan 7 días o menos para `trialEndsAt`, el gym NO está exento, NO tiene el flag `selfManagedBilling = true`, y NO tiene suscripción activa en MP. El banner SHALL indicar los días restantes y ofrecer un link directo a `/[gymSlug]/admin/billing`.

El banner de fin de trial y el flujo de configuración de tarjeta de Mercado Pago SHALL ocultarse cuando `selfManagedBilling = true` (el flag empuja a cobro fuera de MP). El indicador de vencimiento basado en `subscriptionNextPaymentDate` es independiente y se muestra según su propio requisito.

#### Scenario: Banner aparece a falta de 7 días o menos

- **WHEN** el `ADMIN` del gym navega a cualquier página del gym
- **AND** `trialEndsAt - now() <= 7 días` y `> 0`
- **AND** `paymentExempt = false`, `selfManagedBilling = false` y `mpSubscriptionStatus != 'authorized'`
- **THEN** el sistema renderiza un banner indicando los días restantes y un link a `/[gymSlug]/admin/billing`

#### Scenario: Gym con flag manual no ve el banner de trial ni el flujo de MP

- **WHEN** el `ADMIN` de un gym con `selfManagedBilling = true` navega a cualquier página del gym
- **THEN** el sistema NO renderiza el banner de fin de trial ni ofrece el flujo de configuración de tarjeta de Mercado Pago

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

### Requirement: Flag de cobro manual (self-managed) — oculta el flujo de Mercado Pago

El sistema SHALL soportar el campo `Gym.selfManagedBilling: Boolean` (default `false`). Su **único** efecto SHALL ser ocultar al `ADMIN` el flujo de pago por Mercado Pago: cuando `selfManagedBilling = true`, el sistema NO SHALL mostrar el botón de suscripción ("Suscribirme") ni la redirección a MP en `/[gymSlug]/admin/billing`, ni el banner de fin de trial que empuja a configurar tarjeta.

El flag NO SHALL gobernar los recordatorios, el indicador de vencimiento ni el bloqueo por vencimiento: esos comportamientos se rigen por `subscriptionNextPaymentDate` (ver requisitos siguientes), independientemente del valor del flag.

Solo usuarios con `role = SUPERADMIN` SHALL poder activar o desactivar `selfManagedBilling`. El sistema SHALL permitir editar `subscriptionNextPaymentDate` en el mismo flujo de administración del gym.

#### Scenario: Super-admin activa el flag de cobro manual

- **WHEN** un usuario con `role = SUPERADMIN` activa `selfManagedBilling` de un gym desde `/admin/gyms/[id]`
- **THEN** el sistema persiste `selfManagedBilling = true` y deja de ofrecer el flujo de Mercado Pago a ese gym

#### Scenario: Usuario sin rol super-admin no puede activar el flag

- **WHEN** un usuario con `role != SUPERADMIN` intenta activar `selfManagedBilling`
- **THEN** la operación es rechazada con error de autorización y no se modifican datos

#### Scenario: Default deja a todos los gyms actuales sin cambios

- **WHEN** se aplica la migración que agrega `selfManagedBilling`
- **THEN** todos los gyms existentes quedan con `selfManagedBilling = false` y su flujo de Mercado Pago se conserva

### Requirement: Recordatorios push de vencimiento a los ADMIN

El sistema SHALL enviar recordatorios de vencimiento a todos los usuarios con `role = ADMIN` de cualquier gym que cumpla: `subscriptionNextPaymentDate IS NOT NULL` AND `paymentExempt = false` AND `kind != 'PERSONAL'`. El comportamiento SHALL ser independiente de `selfManagedBilling`. El cálculo de días SHALL usar el día actual en zona horaria de Argentina. El envío SHALL ocurrir desde el cron diario existente.

El recordatorio SHALL emitirse por **dos canales, con hitos independientes**:

- **Push**, en los hitos de **10, 7, 3, 1 y 0 días** antes de `subscriptionNextPaymentDate`, a cada `ADMIN` del gym con al menos una `PushSubscription` registrada. Este canal conserva sus hitos y su disparador adicional en el inicio de sesión del `ADMIN`.
- **Email**, en los hitos de **2 y 0 días** antes de `subscriptionNextPaymentDate`, a cada `ADMIN` del gym con `email IS NOT NULL` y `deletedAt IS NULL`, y únicamente cuando el gym tiene además `blockedAt IS NULL`. El canal email SHALL emitirse exclusivamente desde el cron diario, nunca desde el inicio de sesión, y SHALL estar deduplicado por día. El detalle del canal email está especificado en la capability `payment-due-emails`.

La indisponibilidad de un canal no SHALL impedir el envío por el otro.

#### Scenario: Push en un hito de recordatorio

- **WHEN** el cron diario corre
- **AND** existe un gym sin exención, con `subscriptionNextPaymentDate` exactamente a 7 días del día actual (ART)
- **THEN** el sistema envía una push a cada `ADMIN` del gym indicando que la cuota vence en 7 días, sin importar el valor de `selfManagedBilling`

#### Scenario: Push el día del vencimiento

- **WHEN** el cron diario corre
- **AND** existe un gym no exento cuya `subscriptionNextPaymentDate` es el día actual (ART)
- **THEN** el sistema envía una push a cada `ADMIN` indicando que la cuota vence hoy

#### Scenario: Día fuera de los hitos no dispara push

- **WHEN** el cron diario corre
- **AND** existe un gym no exento con `subscriptionNextPaymentDate` a 5 días del día actual (ART)
- **THEN** el sistema NO envía push de recordatorio para ese gym

#### Scenario: Gym sin fecha de vencimiento no recibe recordatorios

- **WHEN** el cron diario corre
- **AND** existe un gym con `subscriptionNextPaymentDate = null` (por ejemplo, un gym que paga por Mercado Pago, donde la fecha la gobierna MP)
- **THEN** el sistema NO envía push de recordatorio para ese gym
- **AND** tampoco envía email de recordatorio para ese gym

#### Scenario: Los dos canales coinciden en los hitos 2 y 0

- **WHEN** el cron diario corre
- **AND** existe un gym no exento, no bloqueado, con `subscriptionNextPaymentDate` a 2 días del día actual (ART)
- **THEN** el sistema envía la push a los `ADMIN` con suscripción push
- **AND** envía el email a los `ADMIN` con email cargado

#### Scenario: En los hitos 10, 7 y 3 sale sólo la push

- **WHEN** el cron diario corre
- **AND** existe un gym no exento con `subscriptionNextPaymentDate` a 10 días del día actual (ART)
- **THEN** el sistema envía la push de recordatorio
- **AND** NO envía email, porque 10 no es un hito del canal email

#### Scenario: ADMIN sin push habilitada igualmente recibe el aviso en los hitos del email

- **WHEN** el cron diario corre en el hito de 2 días
- **AND** ningún `ADMIN` del gym tiene `PushSubscription` registrada
- **THEN** el envío de push no alcanza a nadie
- **AND** el sistema igualmente envía el email a los `ADMIN` con email cargado

### Requirement: Indicador in-app de vencimiento para el ADMIN

El sistema SHALL mostrar al usuario con `role = ADMIN` de cualquier gym con `subscriptionNextPaymentDate IS NOT NULL`, `paymentExempt = false` y `kind != 'PERSONAL'` un indicador persistente del estado de la cuota basado en `subscriptionNextPaymentDate`, al navegar cualquier página del gym. El indicador SHALL reflejar tres estados: **al día** (vencimiento a más de 7 días), **por vencer** (vencimiento dentro de 7 días, inclusive el día de hoy) y **vencido** (`subscriptionNextPaymentDate` en el pasado). El comportamiento SHALL ser independiente de `selfManagedBilling`.

Para alimentar el indicador y la página de suscripción, `getMySubscriptionStatus` SHALL devolver `subscriptionNextPaymentDate`, `subscriptionMonthlyAmount` y `selfManagedBilling` además de los campos actuales.

#### Scenario: Indicador "por vencer"

- **WHEN** el `ADMIN` de un gym no exento con fecha cargada navega a una página del gym
- **AND** `subscriptionNextPaymentDate` está dentro de los próximos 7 días
- **THEN** el sistema renderiza un indicador "por vencer" con la fecha/días restantes

#### Scenario: Indicador "vencido"

- **WHEN** el `ADMIN` de un gym no exento con fecha cargada navega a una página del gym
- **AND** `subscriptionNextPaymentDate` ya pasó
- **THEN** el sistema renderiza un indicador "vencido"

#### Scenario: Sin indicador para gyms sin fecha de vencimiento

- **WHEN** el `ADMIN` de un gym con `subscriptionNextPaymentDate = null` navega a una página del gym
- **THEN** el sistema NO renderiza el indicador de vencimiento (se conserva el comportamiento de banners existente)

### Requirement: Página de suscripción muestra el vencimiento; el flujo de MP depende del flag

El sistema SHALL mostrar en `/[gymSlug]/admin/billing` el estado de vencimiento (al día / por vencer / vencido, con fecha y `subscriptionMonthlyAmount`) de cualquier gym con `subscriptionNextPaymentDate IS NOT NULL` y `paymentExempt = false`. La oferta del flujo de pago por Mercado Pago (botón "Suscribirme" + redirección) SHALL mostrarse únicamente cuando `selfManagedBilling = false`, `paymentExempt = false` y `mpSubscriptionStatus != 'authorized'`.

#### Scenario: Gym no manual con fecha cargada ve vencimiento y la opción de MP

- **WHEN** el `ADMIN` de un gym con `selfManagedBilling = false`, no exento, sin MP autorizado y con `subscriptionNextPaymentDate` cargada abre la página de suscripción
- **THEN** el sistema muestra el estado de vencimiento y, además, la opción de suscribirse por Mercado Pago

#### Scenario: Gym manual con fecha cargada ve el vencimiento sin la opción de MP

- **WHEN** el `ADMIN` de un gym con `selfManagedBilling = true` y `subscriptionNextPaymentDate` cargada abre la página de suscripción
- **THEN** el sistema muestra el estado de vencimiento y NO ofrece el flujo de pago por Mercado Pago

### Requirement: Bloqueo automático por vencimiento con período de gracia

El sistema SHALL aplicar `blockedAt = now()` desde el cron diario a los gyms que cumplen: `subscriptionNextPaymentDate IS NOT NULL` AND `subscriptionNextPaymentDate + autoBlockAfterDays días < now()` AND `paymentExempt = false` AND `mpSubscriptionStatus != 'authorized'` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`. El comportamiento SHALL ser independiente de `selfManagedBilling`. Los gyms con suscripción de Mercado Pago autorizada SHALL quedar excluidos (su cobro lo gobierna MP).

El desbloqueo SHALL realizarse con el mecanismo existente (`unblockGym` / botón "Desbloquear" en el panel super-admin). Tras desbloquear, el super-admin SHALL mover `subscriptionNextPaymentDate` al futuro; de lo contrario el cron SHALL re-bloquear el gym en la siguiente corrida.

#### Scenario: Gym con fecha vencida se bloquea pasada la gracia

- **WHEN** el cron diario corre
- **AND** existe un gym no exento, sin MP autorizado, sin bloqueo previo, `kind != PERSONAL`, cuya `subscriptionNextPaymentDate + autoBlockAfterDays` ya pasó
- **THEN** el sistema setea `blockedAt = now()` en ese gym, sin importar el valor de `selfManagedBilling`

#### Scenario: Gym dentro de la gracia NO se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym cuya `subscriptionNextPaymentDate` ya pasó pero `subscriptionNextPaymentDate + autoBlockAfterDays` todavía está en el futuro
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym con MP autorizado y fecha cargada NO se bloquea por vencimiento

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'authorized'` y `subscriptionNextPaymentDate + autoBlockAfterDays` ya vencido
- **THEN** el sistema NO modifica `blockedAt` (su cobro lo gobierna Mercado Pago)

#### Scenario: Desbloqueo sin mover la fecha re-bloquea

- **WHEN** el super-admin desbloquea un gym con `subscriptionNextPaymentDate + autoBlockAfterDays` ya vencido y NO mueve la fecha
- **THEN** en la siguiente corrida del cron el sistema vuelve a setear `blockedAt = now()`


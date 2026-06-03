# personal-billing Specification

## Purpose
Cobro mensual del producto Wody Personal (B2C) a los usuarios individuales mediante suscripción de Mercado Pago ($7.000 ARS/mes). Opera a nivel `User` (no `Gym`), con un trial de 30 días desde el registro del user, dos planes en MP (uno con free_trial 30 días para users nuevos, otro con 0 días para re-activación), exención manual a nivel user controlada por el super-admin, sincronización vía webhook firmado con discriminador por prefix (`external_reference = "user_<userId>"`), bloqueo automático por cron diario (trial vencido + pago fallido con grace period de 7 días), **self-cancellation** desde el perfil del user (UX B2C, distinto a gym), push notifications en hitos del trial, y email transaccional al user cuando MP no puede cobrar.
## Requirements
### Requirement: Cada Personal user tiene un ciclo de trial de 30 días desde su creación

El sistema SHALL asignar a todo `User` recién creado dentro del gym Personal (con `role = STUDENT` y `canCreateOwnRoutines = true`) un campo `trialEndsAt` igual a `createdAt + 30 días`. Durante el trial, el user opera con todas las funcionalidades habilitadas sin requerir suscripción activa en Mercado Pago.

#### Scenario: Trial nuevo en registro Personal

- **WHEN** un visitante completa `/registro-personal` con un email whitelisteado y se crea su `User`
- **THEN** el sistema persiste `trialEndsAt = createdAt + 30 días`, `paymentExempt = false`, `mpPreapprovalId = null`, `mpSubscriptionStatus = null`, `blockedAt = null`

#### Scenario: Personal users pre-existentes al deploy quedan exentos

- **WHEN** se aplica la migración que introduce el modelo de cobro Personal
- **THEN** todos los users con `gymId = <personal-gym-id>`, `role = STUDENT`, `canCreateOwnRoutines = true`, `createdAt` anterior al deploy quedan marcados con `paymentExempt = true` y `paymentExemptReason = "Usuario Wody Personal pre-existente al lanzamiento del modelo de cobro (2026-05)"`

### Requirement: Dos planes Mercado Pago para Personal

El sistema SHALL cobrar $7.000 ARS/mes por Personal user mediante un único esquema de suscripción de Mercado Pago **sin `free_trial`**. El período de prueba es propiedad exclusiva de la app (`User.trialEndsAt`); Mercado Pago NO SHALL configurar ningún `free_trial`.

La suscripción SHALL crearse **sin plan asociado** (`POST /preapproval` sin `preapproval_plan_id`): el monto y el ciclo se definen en el payload (`auto_recurring.transaction_amount = 7000`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). El sistema NO SHALL usar ningún `preapproval_plan` para el cobro, NO SHALL mantener un plan de re-activación (`MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`) ni elegir plan según historial.

#### Scenario: Ninguna suscripción Personal usa free_trial de MP

- **WHEN** el sistema crea la suscripción de un Personal user en Mercado Pago
- **THEN** el payload NO incluye `free_trial` y el período de prueba se gobierna solo por `User.trialEndsAt`

#### Scenario: No hay selección de plan Personal por historial

- **WHEN** un Personal user con `mpPreapprovalId IS NULL` o `IS NOT NULL` inicia el alta de tarjeta
- **THEN** el sistema usa el mismo esquema de suscripción en ambos casos, sin distinguir un plan de re-activación

### Requirement: Exención manual de pago a nivel User Personal

El sistema SHALL permitir al super-admin marcar y desmarcar a un Personal user como exento del cobro mediante los campos `User.paymentExempt: Boolean` y `User.paymentExemptReason: String?` (ambos ya existentes). Esta acción se ejecuta desde el panel `/admin/wody-personal` (ya implementado) con su server action `setPersonalUserPaymentExempt`.

#### Scenario: Super-admin marca un Personal user como exento

- **WHEN** un `SUPERADMIN` invoca la action `setPersonalUserPaymentExempt(userId, true, reason)`
- **THEN** el sistema actualiza `paymentExempt = true` y `paymentExemptReason = reason` para ese user

### Requirement: Suscripción del Personal user vía Mercado Pago Suscripciones

El sistema SHALL ofrecer al Personal user un flujo **in-app** para suscribirse, sin redirigir al checkout hosteado de Mercado Pago. La captura de tarjeta SHALL realizarse con MP Bricks/CardForm, que tokeniza la tarjeta del lado del cliente; los datos de la tarjeta NO SHALL tocar el server de Wody, que SHALL recibir únicamente un `card_token_id`.

Con ese token, el sistema SHALL crear la suscripción mediante `POST /preapproval` **sin plan asociado** con `external_reference = "user_<userId>"`, `status = "authorized"`, `payer_email`, y `auto_recurring.transaction_amount = 7000`. El primer cobro SHALL diferirse hasta el fin del trial mediante un **`free_trial` dinámico**: el sistema calcula `díasRestantes = ceil((User.trialEndsAt - now) / 1 día)` y, si `díasRestantes >= 1`, incluye `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`. El sistema NO SHALL usar `start_date` como mecanismo de diferimiento. La suscripción se modela con `User.mpPreapprovalId: String?` y `User.mpSubscriptionStatus: String?`.

Si `User.trialEndsAt` ya pasó al momento de crear el `preapproval` (`díasRestantes <= 0`), el sistema SHALL omitir `free_trial`, de modo que el primer cobro sea inmediato.

Ante un fallo de la creación (tarjeta rechazada, token inválido/expirado o error de la API de MP), el sistema NO SHALL persistir `mpPreapprovalId`, SHALL devolver un resultado de error a la UI y SHALL permitir reintentar.

#### Scenario: Personal user configura tarjeta in-app durante el trial

- **WHEN** un user con `role = STUDENT` + `canCreateOwnRoutines = true` entra a `/personal/perfil/suscripcion`, carga su tarjeta en el componente de MP Bricks y confirma, con `User.trialEndsAt` en el futuro
- **THEN** el sistema crea el `preapproval` con `free_trial = { frequency: díasRestantes, frequency_type: "days" }` y `external_reference = "user_<userId>"`, y persiste `mpPreapprovalId` y `mpSubscriptionStatus` devueltos por MP, sin cobrar todavía
- **AND** el primer cobro queda programado para el fin del trial

#### Scenario: Configuración Personal con trial ya vencido cobra de inmediato

- **WHEN** un Personal user configura la tarjeta cuando `User.trialEndsAt` ya pasó (`díasRestantes <= 0`)
- **THEN** el sistema crea el `preapproval` sin `free_trial` y el primer cobro se ejecuta de inmediato

#### Scenario: Tarjeta rechazada permite reintento

- **WHEN** la creación del `preapproval` Personal falla por tarjeta rechazada o token inválido
- **THEN** el sistema no persiste `mpPreapprovalId`, muestra el error al user y le permite reintentar el alta de tarjeta

### Requirement: Webhook discrimina entre suscripciones de Gym y Personal por prefix

El sistema SHALL extender el handler de `POST /api/webhooks/mercadopago` para discriminar el tipo de suscripción según el prefix del `external_reference` recibido desde la API de MP:

- Si `external_reference` comienza con `"user_"`: el `<id>` siguiente al prefix es un `User.id`. El sistema actualiza el User correspondiente.
- En caso contrario: se asume que el `external_reference` es un `Gym.id` (comportamiento existente, backward compat).

Las actualizaciones de `mpPreapprovalId`, `mpSubscriptionStatus`, y `mpSubscriptionStatusChangedAt` siguen exactamente la misma semántica que para gyms (transición real ⇒ actualizar changedAt; idempotencia ⇒ no actualizar).

#### Scenario: Webhook recibe autorización de suscripción Personal

- **WHEN** llega un webhook firmado con `external_reference = "user_<userId>"` y `status = 'authorized'`
- **THEN** el sistema persiste en el `User` correspondiente: `mpPreapprovalId`, `mpSubscriptionStatus = 'authorized'`
- **AND** si el `mpSubscriptionStatus` anterior era distinto, también persiste `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Webhook recibe cancelación de suscripción Personal

- **WHEN** llega un webhook firmado con `external_reference = "user_<userId>"` y `status = 'cancelled'` para un user cuyo status anterior era `'authorized'`
- **THEN** el sistema actualiza el user: `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt = now()`
- **AND** el sistema dispara el email `PERSONAL_PAYMENT_FAILED` al user (siempre que no esté exento)

#### Scenario: Webhook con prefix user_ pero userId inexistente se loggea sin crash

- **WHEN** llega un webhook con `external_reference = "user_<id>"` que no corresponde a ningún user en DB
- **THEN** el sistema responde `200 ok`, loggea un warning con el `external_reference` y NO modifica datos

### Requirement: Self-cancellation de la suscripción Personal desde el perfil del user

El sistema SHALL permitir al Personal user cancelar su propia suscripción a Mercado Pago desde su perfil, mediante una server action `cancelMySubscription()` accesible desde un botón en `/personal/perfil/suscripcion`. Esta es la diferencia clave de UX con los gyms (donde la cancelación es solo super-admin).

#### Scenario: Self-cancel exitoso

- **WHEN** un user Personal con `mpPreapprovalId IS NOT NULL` y `mpSubscriptionStatus = 'authorized'` invoca `cancelMySubscription()`
- **THEN** el sistema invoca la API de MP para cancelar el `preapproval` correspondiente, y al recibir éxito persiste `mpSubscriptionStatus = 'cancelled'` y `mpSubscriptionStatusChangedAt = now()` en el user
- **AND** NO setea `blockedAt` inmediatamente (queda para el cron diario con grace 7d)

#### Scenario: Self-cancel cuando no hay sub activa

- **WHEN** un user con `mpPreapprovalId IS NULL` (nunca se suscribió, está en trial) invoca `cancelMySubscription()`
- **THEN** el sistema rechaza la operación con un mensaje informativo "No tenés ninguna suscripción activa para cancelar"

#### Scenario: Self-cancel cuando MP API falla

- **WHEN** un user invoca `cancelMySubscription()` y la llamada a MP API falla con error de red
- **THEN** el sistema retorna error al cliente y NO modifica el estado del user en DB

### Requirement: Bloqueo automático de Personal users por trial vencido o pago fallido

El sistema SHALL ejecutar fases adicionales en el cron diario `/api/cron/check-gym-trials` que evalúen Personal users y apliquen `User.blockedAt = now()` cuando cumplen alguna de estas condiciones:

**Condición A (trial vencido)**: el user pertenece al gym Personal, `role = STUDENT`, `canCreateOwnRoutines = true`, `deletedAt IS NULL`, `trialEndsAt < now()`, `mpPreapprovalId IS NULL`, `paymentExempt = false`, `blockedAt IS NULL`.

**Condición B (pago fallido con grace period)**: el user cumple lo mismo que la A pero además: `mpSubscriptionStatus IN ('paused', 'cancelled')`, `mpSubscriptionStatusChangedAt < now() - 7 días`, sin restricción sobre `mpPreapprovalId`.

#### Scenario: Personal user con trial vencido se bloquea

- **WHEN** el cron diario corre
- **AND** existe un Personal user con `trialEndsAt` en el pasado, sin `mpPreapprovalId`, no exento, no eliminado, sin bloqueo previo
- **THEN** el sistema setea `User.blockedAt = now()`

#### Scenario: Personal user con sub cancelada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un Personal user con `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 8 días, no exento, no eliminado
- **THEN** el sistema setea `User.blockedAt = now()`

#### Scenario: Personal user exento no se bloquea

- **WHEN** el cron diario corre
- **AND** existe un Personal user con `paymentExempt = true`, sin importar su `trialEndsAt` o `mpSubscriptionStatus`
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: User regular (no Personal) no se bloquea por estas fases

- **WHEN** el cron diario corre
- **AND** existe un user con `role = STUDENT` perteneciente a un gym REGULAR (no Personal) con condiciones que coincidirían con las fases Personal
- **THEN** el sistema NO modifica `blockedAt` de ese user (las fases Personal filtran explícitamente por `gymId = <personal-gym>` y `canCreateOwnRoutines = true`)

### Requirement: Notificación al user Personal cuando MP no puede cobrar

El sistema SHALL enviar un email `PERSONAL_PAYMENT_FAILED` al Personal user cuando su `mpSubscriptionStatus` entra **por primera vez** en `paused` o `cancelled` (transición desde otro estado), siguiendo la misma idempotencia que el flujo de gyms. El email SHALL indicar que el cobro falló, que el acceso sigue funcionando por ahora, y que hay 7 días para configurar una tarjeta nueva antes del bloqueo automático. El email SHALL incluir un link directo a `/personal/perfil/suscripcion`.

#### Scenario: Email se dispara en transición a paused

- **WHEN** llega un webhook que cambia `mpSubscriptionStatus` del user de `'authorized'` (o cualquier valor distinto a paused/cancelled) a `'paused'`
- **THEN** el sistema envía el email `PERSONAL_PAYMENT_FAILED` al email del user (siempre que `user.paymentExempt = false`)

#### Scenario: Email NO se dispara en idempotencia

- **WHEN** llega un webhook con `mpSubscriptionStatus = 'paused'` para un user cuyo status actual ya era `'paused'`
- **THEN** el sistema NO envía el email

#### Scenario: User exento no recibe email

- **WHEN** un user Personal con `paymentExempt = true` recibe un webhook que cambia su status a `'paused'` o `'cancelled'`
- **THEN** el sistema persiste el cambio de status pero NO envía email

### Requirement: Banner de fin de trial Personal

El sistema SHALL mostrar un banner persistente al Personal user cuando faltan 7 días o menos para `trialEndsAt`, el user NO está exento, y NO tiene suscripción activa en MP. El banner SHALL indicar los días restantes y ofrecer un link directo a `/personal/perfil/suscripcion`.

#### Scenario: Banner aparece a falta de 7 días o menos

- **WHEN** el Personal user navega a cualquier página de su sección
- **AND** `trialEndsAt - now() <= 7 días` y `> 0`
- **AND** `paymentExempt = false` y `mpSubscriptionStatus != 'authorized'`
- **THEN** el sistema renderiza un banner con los días restantes y CTA a `/personal/perfil/suscripcion`

#### Scenario: Banner no aparece si el user está exento

- **WHEN** el Personal user con `paymentExempt = true` navega a su sección
- **THEN** el banner NO se renderiza

#### Scenario: Banner no aparece si el user tiene sub activa

- **WHEN** el Personal user con `mpSubscriptionStatus = 'authorized'` navega a su sección
- **THEN** el banner NO se renderiza

### Requirement: Push notifications de fin de trial al Personal user

El sistema SHALL enviar push notifications al Personal user en hitos específicos durante el fin del trial: a 7, 3 y 1 días antes de `trialEndsAt`, y el día del vencimiento (`daysLeft = 0`). El despacho SHALL ocurrir desde el cron diario, reutilizando la infraestructura de `src/lib/push.ts` (`sendPushToUser`). El user NO SHALL recibir push si `paymentExempt = true`, si `mpSubscriptionStatus = 'authorized'`, o si está bloqueado/eliminado.

#### Scenario: Push en cada hito Personal

- **WHEN** el cron diario corre
- **AND** existe un Personal user no exento, sin sub autorizada, no bloqueado, no eliminado
- **AND** `daysLeft` es uno de los valores `7`, `3`, `1`, `0`
- **THEN** el sistema envía una push notification al user con un mensaje correspondiente al hito y CTA a `/personal/perfil/suscripcion`

#### Scenario: Días intermedios no disparan push

- **WHEN** el cron diario corre
- **AND** un Personal user tiene `daysLeft` igual a 6, 5, 4 o 2
- **THEN** el sistema NO envía push notifications a ese user ese día

### Requirement: UI Personal user para gestión de su suscripción

El sistema SHALL exponer la ruta `/personal/perfil/suscripcion` accesible solo a Personal users (`role = STUDENT`, `canCreateOwnRoutines = true`, gym personal). La página SHALL renderizar 3 casos según el estado del user:

- **Exento** (`paymentExempt = true`): panel informativo "Tu cuenta está exenta del cobro de Wody Personal".
- **En trial / sin suscripción activa** (`paymentExempt = false`, `mpSubscriptionStatus != 'authorized'`): card con días restantes del trial, precio ($7.000 ARS/mes), botón "Configurar tarjeta" que redirige al checkout de MP.
- **Suscripción activa** (`mpSubscriptionStatus = 'authorized'`): estado, botón "Reconfigurar tarjeta", y botón "Cancelar suscripción" (self-service).

#### Scenario: User exento ve panel info

- **WHEN** un Personal user exento entra a `/personal/perfil/suscripcion`
- **THEN** la página renderiza un panel verde con "Tu cuenta está exenta..." y opcionalmente la razón

#### Scenario: User en trial ve card con días restantes

- **WHEN** un Personal user no exento, sin sub activa, con `trialEndsAt > now` entra a la página
- **THEN** la página renderiza una card con el número de días restantes y un botón primario "Configurar tarjeta"

#### Scenario: User con sub activa ve botón de cancelar

- **WHEN** un Personal user con `mpSubscriptionStatus = 'authorized'` entra a la página
- **THEN** la página renderiza un panel "Tu suscripción está activa", un botón secundario "Reconfigurar tarjeta", y un botón "Cancelar suscripción"
- **AND** click en "Cancelar suscripción" pide confirmación antes de invocar `cancelMySubscription()`

### Requirement: Modelo de datos User extendido con campos MP para Personal

El sistema SHALL extender el modelo `User` con 4 campos nuevos para soportar la suscripción Personal:

- `mpPreapprovalId: String?` (id del preapproval en MP)
- `mpSubscriptionStatus: String?` (`pending`, `authorized`, `paused`, `cancelled`, `unknown`)
- `mpSubscriptionStatusChangedAt: DateTime?` (timestamp del último cambio real de status)
- `trialEndsAt: DateTime?` (fecha de fin del trial del Personal user)

Los campos `paymentExempt: Boolean` y `paymentExemptReason: String?` YA existen en `User` y se reutilizan tal cual.

#### Scenario: Migración agrega campos sin afectar users existentes

- **WHEN** se aplica la migración del cambio
- **THEN** los nuevos campos quedan en NULL para todos los users existentes
- **AND** la migración SHALL marcar exentos a los Personal users pre-existentes en la misma transacción


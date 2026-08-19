## MODIFIED Requirements

### Requirement: Webhook discrimina entre suscripciones de Gym y Personal por prefix

El sistema SHALL extender el handler de `POST /api/webhooks/mercadopago` para discriminar el tipo de suscripción según el prefix del `external_reference` recibido desde la API de MP:

- Si `external_reference` comienza con `"user_"`: el `<id>` siguiente al prefix es un `User.id`. El sistema actualiza el User correspondiente.
- En caso contrario: se asume que el `external_reference` es un `Gym.id` (comportamiento existente, backward compat).

La resolución del preapproval a partir del evento SHALL seguir las mismas reglas definidas para gyms: `subscription_preapproval` trae el `preapproval_id` directo, mientras que `subscription_authorized_payment` trae el id de un invoice del que se extrae el `preapproval_id`. La validación de firma SHALL aceptar el `data.id` tanto del query param como del body.

Las actualizaciones de `mpPreapprovalId`, `mpSubscriptionStatus`, y `mpSubscriptionStatusChangedAt` siguen exactamente la misma semántica que para gyms (transición real ⇒ actualizar changedAt; idempotencia ⇒ no actualizar).

El sistema SHALL persistir la fecha de próximo cobro informada por Mercado Pago en `User.subscriptionNextPaymentDate`. El sistema NO SHALL escribirla en `User.nextPaymentDate`: ese campo representa la cuota del alumno a su gym —que gobierna el bloqueo automático y los recordatorios de vencimiento— y no la suscripción del usuario Personal a Wody.

#### Scenario: Webhook recibe autorización de suscripción Personal

- **WHEN** llega un webhook firmado con `external_reference = "user_<userId>"` y `status = 'authorized'`
- **THEN** el sistema persiste en el `User` correspondiente: `mpPreapprovalId`, `mpSubscriptionStatus = 'authorized'`
- **AND** si el `mpSubscriptionStatus` anterior era distinto, también persiste `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Webhook recibe cancelación de suscripción Personal

- **WHEN** llega un webhook firmado con `external_reference = "user_<userId>"` y `status = 'cancelled'` para un user cuyo status anterior era `'authorized'`
- **THEN** el sistema actualiza el user: `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt = now()`
- **AND** el sistema dispara el email `PERSONAL_PAYMENT_FAILED` al user (siempre que no esté exento)

#### Scenario: Cobro mensual Personal se resuelve vía el invoice

- **WHEN** llega un evento `subscription_authorized_payment` de una suscripción Personal
- **THEN** el sistema resuelve el `preapproval_id` a partir del invoice y actualiza el `mpSubscriptionStatus` del user correspondiente
- **AND** persiste la fecha informada por MP en `User.subscriptionNextPaymentDate`
- **AND** NO modifica `User.nextPaymentDate`

#### Scenario: Webhook con prefix user_ pero userId inexistente se loggea sin crash

- **WHEN** llega un webhook con `external_reference = "user_<id>"` que no corresponde a ningún user en DB
- **THEN** el sistema responde `200 ok`, loggea un warning con el `external_reference` y NO modifica datos

### Requirement: Modelo de datos User extendido con campos MP para Personal

El sistema SHALL extender el modelo `User` con 5 campos para soportar la suscripción Personal:

- `mpPreapprovalId: String?` (id del preapproval en MP)
- `mpSubscriptionStatus: String?` (`pending`, `authorized`, `paused`, `cancelled`, `unknown`)
- `mpSubscriptionStatusChangedAt: DateTime?` (timestamp del último cambio real de status)
- `trialEndsAt: DateTime?` (fecha de fin del trial del Personal user)
- `subscriptionNextPaymentDate: DateTime?` (fecha del próximo cobro de la suscripción a Wody, informada por Mercado Pago)

Los campos `paymentExempt: Boolean` y `paymentExemptReason: String?` YA existen en `User` y se reutilizan tal cual. El campo `nextPaymentDate: DateTime` YA existe y representa la cuota del alumno a su gym: es un concepto distinto y NO SHALL usarse para la suscripción a Wody.

#### Scenario: Migración agrega campos sin afectar users existentes

- **WHEN** se aplica la migración del cambio
- **THEN** los nuevos campos quedan en NULL para todos los users existentes
- **AND** la migración SHALL marcar exentos a los Personal users pre-existentes en la misma transacción

#### Scenario: La fecha de suscripción no interfiere con el bloqueo del alumno

- **WHEN** un usuario Personal tiene `subscriptionNextPaymentDate` cargada por el webhook
- **THEN** el bloqueo automático por cuota vencida sigue evaluándose exclusivamente contra `nextPaymentDate`, sin verse afectado

## ADDED Requirements

### Requirement: La creación del preapproval Personal declara la URL de notificación

El sistema SHALL incluir una `notification_url` explícita en el request de creación del preapproval de las suscripciones Personal, con las mismas reglas definidas para gyms: apunta al endpoint `POST /api/webhooks/mercadopago` sobre el host canónico, y se omite cuando la URL resuelta no es HTTPS.

#### Scenario: Suscripción Personal creada en producción declara su notification_url

- **WHEN** un usuario Personal inicia su suscripción y el sistema crea el preapproval en Mercado Pago
- **THEN** el request incluye `notification_url` apuntando al endpoint de webhooks sobre el host canónico HTTPS

### Requirement: La página de suscripción Personal muestra la fecha del próximo cobro

El sistema SHALL mostrar al usuario Personal con suscripción `authorized` la fecha de su próximo cobro, tomada de `subscriptionNextPaymentDate`, en la página de gestión de su suscripción.

#### Scenario: Usuario Personal ve cuándo le vuelven a cobrar

- **WHEN** un usuario Personal con suscripción autorizada abre la página de su suscripción
- **AND** el sistema tiene cargada la fecha de próximo cobro informada por Mercado Pago
- **THEN** la página muestra esa fecha

#### Scenario: Sin fecha informada la página no muestra un dato inventado

- **WHEN** el sistema no tiene `subscriptionNextPaymentDate` para ese usuario
- **THEN** la página omite la fecha en lugar de mostrar un valor por defecto

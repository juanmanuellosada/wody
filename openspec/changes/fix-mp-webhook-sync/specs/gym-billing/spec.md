## MODIFIED Requirements

### Requirement: Webhook recibe autorización de suscripción

El sistema SHALL exponer un endpoint `POST /api/webhooks/mercadopago` que reciba notificaciones de Mercado Pago con firma HMAC validada contra `MP_WEBHOOK_SECRET`. Para armar el manifest de la firma, el sistema SHALL tomar el `data.id` del query param `data.id`, y si ese query param está ausente SHALL usar `data.id` del body de la notificación.

El sistema SHALL resolver el preapproval correspondiente según el tipo de evento:

- Para `subscription_preapproval`, el `data.id` recibido **es** el `preapproval_id`, y el sistema SHALL consultar la API de MP directamente con él.
- Para `subscription_authorized_payment`, el `data.id` recibido identifica a un *authorized payment* (invoice), NO a un preapproval. El sistema SHALL consultar primero el invoice, extraer su `preapproval_id`, y recién entonces consultar el preapproval.

Obtenido el preapproval, el sistema SHALL extraer `external_reference` (= gymId), `status`, y actualizar el gym correspondiente. El sistema SHALL persistir `mpPreapprovalId` y `mpSubscriptionStatus` con el resultado. Cuando el `mpSubscriptionStatus` cambia respecto al valor anterior (transición de estado), el sistema SHALL **también** actualizar `mpSubscriptionStatusChangedAt = now()`. Si el status no cambió (idempotencia del webhook), el sistema NO SHALL modificar `mpSubscriptionStatusChangedAt`.

#### Scenario: Webhook recibe autorización de suscripción

- **WHEN** Mercado Pago notifica al endpoint `POST /api/webhooks/mercadopago` que la suscripción `preapproval_id = X` para el `external_reference = <gymId>` quedó `authorized`
- **AND** la firma HMAC del header `x-signature` es válida contra `MP_WEBHOOK_SECRET`
- **THEN** el sistema persiste `mpPreapprovalId = X` y `mpSubscriptionStatus = 'authorized'` en el gym correspondiente
- **AND** si el `mpSubscriptionStatus` anterior era distinto, también persiste `mpSubscriptionStatusChangedAt = now()`

#### Scenario: Notificación sin el query param data.id valida la firma igual

- **WHEN** llega una notificación firmada cuyo `data.id` viene únicamente en el body y no como query param
- **THEN** el sistema arma el manifest HMAC con el `data.id` del body, valida la firma correctamente y procesa el evento
- **AND** NO responde `401`

#### Scenario: Evento de cobro autorizado se resuelve vía el invoice

- **WHEN** llega un evento `subscription_authorized_payment` cuyo `data.id` es el id de un invoice
- **THEN** el sistema consulta el invoice, obtiene su `preapproval_id`, consulta ese preapproval y actualiza el gym con el `status` resultante
- **AND** NO intenta consultar el preapproval usando el id del invoice

#### Scenario: Webhook con firma inválida es rechazado

- **WHEN** llega un POST a `/api/webhooks/mercadopago` con firma HMAC inválida o ausente
- **THEN** el sistema responde `401` y no modifica datos

#### Scenario: Estado desconocido se loggea pero no rompe

- **WHEN** MP envía un `status` no contemplado (por ejemplo, un valor nuevo agregado por MP)
- **THEN** el sistema persiste el string literal recibido y emite un warning en el log, sin tirar excepción

#### Scenario: Webhook idempotente no actualiza el changedAt

- **WHEN** llega un webhook con `status` idéntico al `mpSubscriptionStatus` actual del gym
- **THEN** el sistema NO modifica `mpSubscriptionStatusChangedAt`

#### Scenario: Invoice sin preapproval_id se descarta sin romper

- **WHEN** llega un evento `subscription_authorized_payment` cuyo invoice no expone `preapproval_id`
- **THEN** el sistema responde `200 ok`, emite un warning con el id recibido y NO modifica datos

### Requirement: Bloqueo automático por fin de trial sin suscripción

El sistema SHALL ejecutar un cron job diario que evalúe el estado de cada gym y aplique `blockedAt = now()` a los gyms que cumplen una de las dos condiciones siguientes:

**Condición A (trial vencido)**: `trialEndsAt < now()` AND `mpPreapprovalId IS NULL` AND `paymentExempt = false` AND `subscriptionNextPaymentDate IS NULL` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

**Condición B (pago fallido con grace period)**: `mpSubscriptionStatus IN ('paused', 'cancelled')` AND `mpSubscriptionStatusChangedAt < now() - 7 días` AND `paymentExempt = false` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`. La Condición B SHALL aplicar con independencia de `subscriptionNextPaymentDate`.

El criterio que determina qué regla gobierna a cada gym SHALL ser **quién le cobra**, no si tiene una fecha cargada:

- Un gym **con `mpPreapprovalId` y sin `selfManagedBilling`** lo cobra Mercado Pago: su bloqueo se rige por la Condición B, a partir del estado del preapproval. Como el webhook mantiene su `subscriptionNextPaymentDate` al día, ese campo ya no lo excluye.
- Un gym **sin `mpPreapprovalId`**, o con `selfManagedBilling = true` aunque conserve un preapproval anterior, se considera **manejado por fecha de vencimiento**: su bloqueo se rige por la regla de vencimiento + gracia.

Un gym con `selfManagedBilling = true` queda excluido de ambas condiciones aunque no tenga fecha cargada.

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

#### Scenario: Gym de MP con suscripción pausada se bloquea aunque tenga fecha cargada

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpPreapprovalId` cargado, `mpSubscriptionStatus = 'paused'` desde hace 8 días, con `subscriptionNextPaymentDate` cargada por el webhook, sin exención, sin flag manual, sin bloqueo previo
- **THEN** el sistema setea `blockedAt = now()` en ese gym por Condición B
- **AND** NO espera a que venza el `autoBlockAfterDays` de la fecha

### Requirement: Bloqueo automático por vencimiento con período de gracia

El sistema SHALL aplicar `blockedAt = now()` desde el cron diario a los gyms que cumplen: `subscriptionNextPaymentDate IS NOT NULL` AND `subscriptionNextPaymentDate + autoBlockAfterDays días < now()` AND `paymentExempt = false` AND (`mpPreapprovalId IS NULL` OR `selfManagedBilling = true`) AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`. Los gyms **cobrados activamente por Mercado Pago** SHALL quedar excluidos con independencia del estado de su suscripción: su cobro lo gobierna MP y su bloqueo se rige por la Condición B. Un gym pasado a cobro manual SHALL seguir gobernado por su fecha aunque conserve un `mpPreapprovalId` anterior, para que no quede fuera de ambas reglas y nunca se bloquee.

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

#### Scenario: Gym de MP no autorizado tampoco se bloquea por esta regla

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpPreapprovalId` cargado y `mpSubscriptionStatus = 'paused'`, cuya `subscriptionNextPaymentDate + autoBlockAfterDays` ya venció
- **THEN** el sistema NO modifica `blockedAt` por esta regla; el bloqueo de ese gym se rige por la Condición B y su gracia de 7 días

#### Scenario: Desbloqueo sin mover la fecha re-bloquea

- **WHEN** el super-admin desbloquea un gym con `subscriptionNextPaymentDate + autoBlockAfterDays` ya vencido y NO mueve la fecha
- **THEN** en la siguiente corrida del cron el sistema vuelve a setear `blockedAt = now()`

## ADDED Requirements

### Requirement: La creación del preapproval declara la URL de notificación

El sistema SHALL incluir una `notification_url` explícita en el request de creación del preapproval de Mercado Pago, apuntando al endpoint `POST /api/webhooks/mercadopago` sobre el host canónico de la aplicación. El sistema NO SHALL depender de que la URL esté configurada manualmente en el panel de la aplicación de Mercado Pago.

El sistema SHALL omitir el campo cuando la URL resuelta no sea HTTPS, de modo que la creación del preapproval siga funcionando en entornos de desarrollo.

#### Scenario: Suscripción creada en producción declara su notification_url

- **WHEN** un ADMIN inicia la suscripción de su gym y el sistema crea el preapproval en Mercado Pago
- **THEN** el request incluye `notification_url` apuntando al endpoint de webhooks sobre el host canónico HTTPS

#### Scenario: En desarrollo se omite la notification_url

- **WHEN** el host resuelto para la aplicación no es HTTPS
- **THEN** el sistema crea el preapproval sin el campo `notification_url` y la operación no falla

### Requirement: El webhook mantiene actualizada la fecha del próximo cobro

El sistema SHALL persistir en `Gym.subscriptionNextPaymentDate` el `next_payment_date` que devuelve Mercado Pago al consultar el preapproval, de modo que la fecha avance sola con cada ciclo de cobro sin intervención del super-admin.

Si la respuesta de Mercado Pago no incluye `next_payment_date`, el sistema NO SHALL modificar el valor almacenado.

#### Scenario: Un cobro mensual adelanta la fecha del próximo pago

- **WHEN** Mercado Pago notifica un cobro de la suscripción y el preapproval devuelve `next_payment_date` correspondiente al mes siguiente
- **THEN** el sistema persiste esa fecha en `subscriptionNextPaymentDate`
- **AND** el ADMIN del gym deja de ver el banner de vencimiento y el modal de suscripción vencida

#### Scenario: Respuesta sin next_payment_date no pisa la fecha existente

- **WHEN** llega una notificación cuyo preapproval no incluye `next_payment_date`
- **THEN** el sistema conserva el `subscriptionNextPaymentDate` que ya tenía el gym

### Requirement: El ciclo de reintentos de cobro no marca al gym como moroso

Cuando un intento de cobro falla, Mercado Pago mantiene la suscripción vigente y reintenta el cobro, dejando el invoice en estado de reintento. El sistema SHALL determinar el estado del gym exclusivamente a partir del `status` del **preapproval**, y NO SHALL marcar una falla de pago a partir del resultado de un invoice individual.

El sistema SHALL disparar el email de pago fallido únicamente cuando el preapproval transiciona a `paused` o `cancelled`, conservando la semántica ya existente.

#### Scenario: Primer intento rechazado y reintento exitoso deja todo normal

- **WHEN** el primer intento de cobro del mes es rechazado y Mercado Pago lo reintenta más tarde con éxito
- **AND** el preapproval permanece `authorized` durante todo el ciclo
- **THEN** el gym conserva `mpSubscriptionStatus = 'authorized'`, no recibe el email de pago fallido, y su `subscriptionNextPaymentDate` queda apuntando al siguiente ciclo

#### Scenario: Reintentos agotados sí notifican

- **WHEN** Mercado Pago agota los reintentos y mueve el preapproval a `paused`
- **THEN** el sistema persiste `mpSubscriptionStatus = 'paused'` con su `mpSubscriptionStatusChangedAt`
- **AND** dispara el email de pago fallido al dueño del gym, siempre que no esté exento

### Requirement: Sincronización manual del estado de suscripción desde el super-admin

El sistema SHALL exponer una acción "Sincronizar con Mercado Pago" en el panel de super-admin de cada gym, que consulte el preapproval real usando el `mpPreapprovalId` almacenado y persista el `status` y la fecha de próximo cobro resultantes. La acción SHALL estar restringida a usuarios con `role = SUPERADMIN`, y SHALL reusar la misma lógica de persistencia que el webhook.

#### Scenario: Super-admin repara un gym desincronizado

- **WHEN** un super-admin dispara "Sincronizar con Mercado Pago" sobre un gym cuya suscripción figura `authorized` en Mercado Pago pero `pending` en Wody
- **THEN** el sistema persiste `mpSubscriptionStatus = 'authorized'` y la fecha de próximo cobro informada por Mercado Pago

#### Scenario: Gym sin preapproval no puede sincronizarse

- **WHEN** un super-admin dispara la acción sobre un gym sin `mpPreapprovalId`
- **THEN** el sistema no llama a Mercado Pago y devuelve un error explicando que el gym no tiene suscripción

#### Scenario: Un usuario que no es super-admin no puede sincronizar

- **WHEN** un usuario con `role` distinto de `SUPERADMIN` intenta invocar la acción
- **THEN** la server action rechaza la operación con error de autorización

### Requirement: Una suscripción reactivada restaura el estado normal del gym

Cuando una suscripción vuelve a `authorized` desde `paused` o `cancelled`, el sistema SHALL persistir el nuevo estado junto con la fecha de próximo cobro informada por Mercado Pago, dejando al gym fuera del alcance del bloqueo por pago fallido.

El sistema NO SHALL desbloquear automáticamente un gym que ya tenía `blockedAt` cargado: el desbloqueo SHALL seguir siendo una acción explícita del super-admin, porque el bloqueo puede responder a causas ajenas al pago.

#### Scenario: Suscripción reactivada deja de ser candidata a bloqueo

- **WHEN** un gym con `mpSubscriptionStatus = 'paused'` recibe una notificación que lo devuelve a `authorized`
- **THEN** el sistema persiste `mpSubscriptionStatus = 'authorized'`, su `mpSubscriptionStatusChangedAt` y la fecha de próximo cobro
- **AND** en la siguiente corrida del cron ese gym NO es bloqueado por la Condición B

#### Scenario: Un gym ya bloqueado no se desbloquea solo

- **WHEN** un gym con `blockedAt` cargado recibe una notificación que devuelve su suscripción a `authorized`
- **THEN** el sistema actualiza el estado y la fecha de la suscripción
- **AND** NO modifica `blockedAt`

### Requirement: Un gym con débito automático no recibe avisos de vencimiento

Cuando el sistema conoce la fecha de próximo cobro de un gym cuya suscripción de Mercado Pago está `authorized`, esa fecha SHALL comunicarse como información del débito automático y NO como un vencimiento accionable. El gym no tiene ninguna acción que tomar: el cobro es automático y la fecha la informa Mercado Pago.

En concreto, para un gym con suscripción `authorized`:

- El sistema NO SHALL mostrar el modal de suscripción vencida, aunque la fecha almacenada haya quedado en el pasado a la espera de que Mercado Pago informe el cobro.
- El sistema NO SHALL enviar los recordatorios push ni los emails de vencimiento próximo asociados a la fecha.
- El indicador in-app SHALL mostrar la fecha del próximo cobro sin tono de alerta.

#### Scenario: El día después del cobro no aparece el modal de vencida

- **WHEN** un gym con suscripción `authorized` tiene `subscriptionNextPaymentDate` en el día de ayer porque Mercado Pago aún no notificó el cobro
- **THEN** el sistema NO muestra el modal de suscripción vencida al ADMIN
- **AND** el indicador in-app sigue informando la fecha sin alertar

#### Scenario: Débito automático no dispara recordatorios de vencimiento

- **WHEN** el cron diario evalúa los recordatorios de vencimiento
- **AND** un gym tiene `mpPreapprovalId` cargado
- **THEN** el sistema NO le envía push ni email de vencimiento próximo

#### Scenario: Un gym de cobro manual sigue recibiendo sus avisos

- **WHEN** el cron diario evalúa los recordatorios de vencimiento
- **AND** un gym sin `mpPreapprovalId` tiene una fecha de vencimiento próxima
- **THEN** el sistema le envía los recordatorios como hasta ahora

#### Scenario: Gym pasado a cobro manual con preapproval viejo sigue bloqueándose por fecha

- **WHEN** el cron diario corre
- **AND** existe un gym con `selfManagedBilling = true` que conserva un `mpPreapprovalId` de cuando lo cobraba Mercado Pago, cuya `subscriptionNextPaymentDate + autoBlockAfterDays` ya venció
- **THEN** el sistema setea `blockedAt = now()` en ese gym
- **AND** el gym también sigue recibiendo los recordatorios de vencimiento

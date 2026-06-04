## ADDED Requirements

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

El sistema SHALL enviar push notifications a todos los usuarios con `role = ADMIN` de cualquier gym que cumpla: `subscriptionNextPaymentDate IS NOT NULL` AND `paymentExempt = false` AND `kind != 'PERSONAL'`, en los hitos de **10, 7, 3, 1 y 0 días** antes de `subscriptionNextPaymentDate`. El comportamiento SHALL ser independiente de `selfManagedBilling`. El cálculo de días SHALL usar el día actual en zona horaria de Argentina. El envío SHALL ocurrir desde el cron diario existente.

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

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Modo de cobro manual (self-managed) a nivel gym

El sistema SHALL soportar un modo de cobro **manual** a nivel gym mediante el campo `Gym.selfManagedBilling: Boolean` (default `false`). Un gym en modo manual paga el SaaS por fuera de Mercado Pago: NO SHALL tener ni requerir `mpPreapprovalId`, y su vencimiento lo gobierna `Gym.subscriptionNextPaymentDate`, que el super-admin mueve manualmente cada vez que el dueño paga.

Solo usuarios con `role = SUPERADMIN` SHALL poder activar o desactivar `selfManagedBilling`. El sistema SHALL permitir editar `subscriptionNextPaymentDate` en el mismo flujo de administración del gym.

Cuando `paymentExempt = true` y `selfManagedBilling = true` coexisten, la exención SHALL prevalecer: el gym no recibe recordatorios ni se bloquea por cron.

#### Scenario: Super-admin activa el modo manual

- **WHEN** un usuario con `role = SUPERADMIN` activa el modo manual de un gym desde `/admin/gyms/[id]` y carga una `subscriptionNextPaymentDate`
- **THEN** el sistema persiste `selfManagedBilling = true` y la `subscriptionNextPaymentDate` indicada

#### Scenario: Usuario sin rol super-admin no puede activar el modo manual

- **WHEN** un usuario con `role != SUPERADMIN` intenta activar `selfManagedBilling`
- **THEN** la operación es rechazada con error de autorización y no se modifican datos

#### Scenario: Gym pasa de exento a modo manual

- **WHEN** el super-admin desactiva la exención (`paymentExempt = false`) y activa el modo manual (`selfManagedBilling = true`) con una `subscriptionNextPaymentDate` en el futuro
- **THEN** el gym deja de estar exento, queda en modo manual, y el cron NO lo bloquea mientras `subscriptionNextPaymentDate + autoBlockAfterDays` esté en el futuro

#### Scenario: Default deja a todos los gyms actuales sin cambios

- **WHEN** se aplica la migración que agrega `selfManagedBilling`
- **THEN** todos los gyms existentes quedan con `selfManagedBilling = false` y su comportamiento de cobro no cambia

### Requirement: Recordatorios push de vencimiento a los ADMIN en modo manual

El sistema SHALL enviar push notifications a todos los usuarios con `role = ADMIN` de un gym en modo manual (`selfManagedBilling = true`, `paymentExempt = false`, `subscriptionNextPaymentDate IS NOT NULL`, `kind != 'PERSONAL'`) en los hitos de **10, 7, 3, 1 y 0 días** antes de `subscriptionNextPaymentDate`. El cálculo de días SHALL usar el día actual en zona horaria de Argentina. El envío SHALL ocurrir desde el cron diario existente.

#### Scenario: Push en un hito de recordatorio

- **WHEN** el cron diario corre
- **AND** existe un gym con `selfManagedBilling = true`, sin exención, con `subscriptionNextPaymentDate` exactamente a 7 días del día actual (ART)
- **THEN** el sistema envía una push a cada `ADMIN` del gym indicando que la cuota vence en 7 días

#### Scenario: Push el día del vencimiento

- **WHEN** el cron diario corre
- **AND** existe un gym en modo manual cuya `subscriptionNextPaymentDate` es el día actual (ART)
- **THEN** el sistema envía una push a cada `ADMIN` indicando que la cuota vence hoy

#### Scenario: Día fuera de los hitos no dispara push

- **WHEN** el cron diario corre
- **AND** existe un gym en modo manual con `subscriptionNextPaymentDate` a 5 días del día actual (ART)
- **THEN** el sistema NO envía push de recordatorio para ese gym

#### Scenario: Gym en modo manual sin fecha de vencimiento no recibe recordatorios

- **WHEN** el cron diario corre
- **AND** existe un gym con `selfManagedBilling = true` y `subscriptionNextPaymentDate = null`
- **THEN** el sistema NO envía push de recordatorio para ese gym

### Requirement: Indicador in-app de vencimiento para el ADMIN en modo manual

El sistema SHALL mostrar al usuario con `role = ADMIN` de un gym en modo manual un indicador persistente del estado de la cuota basado en `subscriptionNextPaymentDate`, al navegar cualquier página del gym. El indicador SHALL reflejar tres estados: **al día** (vencimiento a más de 7 días), **por vencer** (vencimiento dentro de 7 días, inclusive el día de hoy) y **vencido** (`subscriptionNextPaymentDate` en el pasado). El indicador NO SHALL ofrecer flujo de Mercado Pago.

Para alimentar el indicador, `getMySubscriptionStatus` SHALL devolver `subscriptionNextPaymentDate` y `selfManagedBilling` además de los campos actuales.

#### Scenario: Indicador "por vencer"

- **WHEN** el `ADMIN` de un gym en modo manual navega a una página del gym
- **AND** `subscriptionNextPaymentDate` está dentro de los próximos 7 días
- **THEN** el sistema renderiza un indicador "por vencer" con la fecha/días restantes, sin link a Mercado Pago

#### Scenario: Indicador "vencido"

- **WHEN** el `ADMIN` de un gym en modo manual navega a una página del gym
- **AND** `subscriptionNextPaymentDate` ya pasó
- **THEN** el sistema renderiza un indicador "vencido"

#### Scenario: Sin indicador para gyms que no están en modo manual

- **WHEN** el `ADMIN` de un gym con `selfManagedBilling = false` navega a una página del gym
- **THEN** el sistema NO renderiza el indicador de cobro manual (se conserva el comportamiento de banners existente)

### Requirement: Bloqueo automático por vencimiento en modo manual con período de gracia

El sistema SHALL aplicar `blockedAt = now()` desde el cron diario a los gyms que cumplen: `selfManagedBilling = true` AND `subscriptionNextPaymentDate IS NOT NULL` AND `subscriptionNextPaymentDate + autoBlockAfterDays días < now()` AND `paymentExempt = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

El desbloqueo SHALL realizarse con el mecanismo existente (`unblockGym` / botón "Desbloquear" en el panel super-admin). Tras desbloquear, el super-admin SHALL mover `subscriptionNextPaymentDate` al futuro; de lo contrario el cron SHALL re-bloquear el gym en la siguiente corrida.

#### Scenario: Gym en modo manual se bloquea pasada la gracia

- **WHEN** el cron diario corre
- **AND** existe un gym con `selfManagedBilling = true`, sin exención, sin bloqueo previo, `kind != PERSONAL`, cuya `subscriptionNextPaymentDate + autoBlockAfterDays` ya pasó
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym en modo manual dentro de la gracia NO se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym en modo manual cuya `subscriptionNextPaymentDate` ya pasó pero `subscriptionNextPaymentDate + autoBlockAfterDays` todavía está en el futuro
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Desbloqueo sin mover la fecha re-bloquea

- **WHEN** el super-admin desbloquea un gym en modo manual con `subscriptionNextPaymentDate + autoBlockAfterDays` ya vencido y NO mueve la fecha
- **THEN** en la siguiente corrida del cron el sistema vuelve a setear `blockedAt = now()`

## MODIFIED Requirements

### Requirement: Bloqueo automático por fin de trial sin suscripción

El sistema SHALL ejecutar un cron job diario que evalúe el estado de cada gym y aplique `blockedAt = now()` a los gyms que cumplen una de las dos condiciones siguientes:

**Condición A (trial vencido)**: `trialEndsAt < now()` AND `mpPreapprovalId IS NULL` AND `paymentExempt = false` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

**Condición B (pago fallido con grace period)**: `mpSubscriptionStatus IN ('paused', 'cancelled')` AND `mpSubscriptionStatusChangedAt < now() - 7 días` AND `paymentExempt = false` AND `selfManagedBilling = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`.

Los gyms en modo manual (`selfManagedBilling = true`) SHALL quedar excluidos de ambas condiciones; su bloqueo se rige exclusivamente por la condición de vencimiento + gracia del modo manual.

#### Scenario: Gym con trial vencido y sin suscripción se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `trialEndsAt` en el pasado, sin `mpPreapprovalId`, sin exención, sin modo manual, sin bloqueo previo y con `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 8 días, sin exención, sin modo manual, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción cancelada se bloquea después del grace period

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 10 días, sin exención, sin modo manual, sin bloqueo previo, `kind != PERSONAL`
- **THEN** el sistema setea `blockedAt = now()` en ese gym

#### Scenario: Gym con suscripción pausada dentro del grace period NO se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'paused'`, `mpSubscriptionStatusChangedAt` hace 3 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym exento no se bloquea aunque tenga sub fallida

- **WHEN** el cron diario corre
- **AND** existe un gym con `paymentExempt = true`, `mpSubscriptionStatus = 'cancelled'`, `mpSubscriptionStatusChangedAt` hace 20 días
- **THEN** el sistema NO modifica `blockedAt`

#### Scenario: Gym en modo manual con trial vencido y sin MP NO se bloquea por Condición A

- **WHEN** el cron diario corre
- **AND** existe un gym con `selfManagedBilling = true`, `trialEndsAt` en el pasado, sin `mpPreapprovalId`, sin exención, `kind != PERSONAL`
- **THEN** el sistema NO bloquea por la Condición A (su bloqueo se rige solo por vencimiento + gracia del modo manual)

#### Scenario: Gym Wody Personal nunca se bloquea por cron

- **WHEN** el cron diario corre
- **AND** existe un gym con `kind = PERSONAL`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de su trial o status MP

#### Scenario: Gym con suscripción activa no se bloquea

- **WHEN** el cron diario corre
- **AND** existe un gym con `mpSubscriptionStatus = 'authorized'`
- **THEN** el sistema NO modifica `blockedAt`, independientemente de `trialEndsAt`

### Requirement: Banner de fin de trial visible al dueño del gym

El sistema SHALL mostrar un banner persistente al usuario con `role = ADMIN` de un gym cuando faltan 7 días o menos para `trialEndsAt`, el gym NO está exento, NO está en modo manual (`selfManagedBilling = false`), y NO tiene suscripción activa en MP. El banner SHALL indicar los días restantes y ofrecer un link directo a `/[gymSlug]/admin/billing`.

Los gyms en modo manual NO SHALL ver el banner de fin de trial ni el flujo de configuración de tarjeta de Mercado Pago; en su lugar ven el indicador de vencimiento del modo manual.

#### Scenario: Banner aparece a falta de 7 días o menos

- **WHEN** el `ADMIN` del gym navega a cualquier página del gym
- **AND** `trialEndsAt - now() <= 7 días` y `> 0`
- **AND** `paymentExempt = false`, `selfManagedBilling = false` y `mpSubscriptionStatus != 'authorized'`
- **THEN** el sistema renderiza un banner indicando los días restantes y un link a `/[gymSlug]/admin/billing`

#### Scenario: Gym en modo manual no ve el banner de trial ni el flujo de MP

- **WHEN** el `ADMIN` de un gym con `selfManagedBilling = true` navega a cualquier página del gym
- **THEN** el sistema NO renderiza el banner de fin de trial ni ofrece el flujo de configuración de tarjeta de Mercado Pago

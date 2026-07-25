## MODIFIED Requirements

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

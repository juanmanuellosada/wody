## ADDED Requirements

### Requirement: Selección de reservas candidatas para recordatorio

El sistema SHALL considerar candidata a recordatorio toda `ActivityBooking` con `status = CONFIRMED`, `reminderSentAt = null`, cuya `ActivitySession.startsAt` caiga dentro de la ventana de aviso configurada, y cuya sesión no esté cancelada.

#### Scenario: Reserva confirmada dentro de la ventana es candidata

- **WHEN** el cron de recordatorios de turnos corre
- **AND** existe una `ActivityBooking` con `status = CONFIRMED`, `reminderSentAt = null`, cuya sesión arranca dentro de la ventana de aviso
- **THEN** el sistema la incluye entre los candidatos a notificar

#### Scenario: Reserva fuera de la ventana no es candidata

- **WHEN** el cron de recordatorios de turnos corre
- **AND** existe una `ActivityBooking` confirmada cuya sesión arranca fuera de la ventana de aviso
- **THEN** el sistema NO la notifica en esta corrida

### Requirement: Idempotencia del recordatorio por reserva

El sistema SHALL enviar el recordatorio como máximo una vez por `ActivityBooking`, estampando `reminderSentAt` únicamente cuando el envío resultó exitoso.

#### Scenario: Una reserva ya notificada no se vuelve a notificar

- **WHEN** el cron de recordatorios de turnos corre
- **AND** existe una `ActivityBooking` con `reminderSentAt` distinto de `null`
- **THEN** el sistema NO le envía un segundo recordatorio

#### Scenario: El cron corriendo dos veces en la ventana no duplica el envío

- **WHEN** el cron de recordatorios de turnos ya envió el recordatorio de una reserva en una corrida anterior
- **AND** el cron vuelve a correr mientras la sesión sigue dentro de la ventana de aviso
- **THEN** el sistema NO reenvía el recordatorio para esa reserva

#### Scenario: Un envío fallido no estampa el sello

- **WHEN** el sistema intenta enviar el recordatorio de una reserva y el envío falla
- **THEN** `reminderSentAt` permanece `null`
- **AND** una corrida posterior del cron vuelve a intentar el envío para esa reserva

### Requirement: Reserva o sesión cancelada no genera recordatorio

El sistema NO SHALL enviar recordatorio para una `ActivityBooking` con `status = CANCELLED`, ni para una reserva cuya `ActivitySession` fue cancelada por el gym.

#### Scenario: Una reserva cancelada por el alumno queda excluida

- **WHEN** el cron de recordatorios de turnos corre
- **AND** existe una `ActivityBooking` con `status = CANCELLED` cuya sesión arranca dentro de la ventana de aviso
- **THEN** el sistema NO le envía recordatorio

#### Scenario: Una sesión cancelada por el gym no notifica a sus reservas

- **WHEN** el cron de recordatorios de turnos corre
- **AND** existe una `ActivitySession` cancelada por el gym con reservas `CONFIRMED` asociadas
- **THEN** el sistema NO envía recordatorio para ninguna de esas reservas

### Requirement: Push como único canal del recordatorio

El sistema SHALL enviar el recordatorio de turno exclusivamente por push (`web-push`). El sistema NO SHALL enviar recordatorios de turno por email.

#### Scenario: Alumno con push activa recibe la notificación

- **WHEN** el cron de recordatorios de turnos procesa una reserva candidata
- **AND** el alumno de la reserva tiene al menos una `PushSubscription` activa
- **THEN** el sistema le envía el recordatorio por push

#### Scenario: Alumno sin push activa no recibe recordatorio por otro canal

- **WHEN** el cron de recordatorios de turnos procesa una reserva candidata
- **AND** el alumno de la reserva no tiene ninguna `PushSubscription` activa
- **THEN** el sistema NO le envía el recordatorio por email ni por ningún otro canal
- **AND** continúa procesando al resto de los candidatos

### Requirement: Antelación del recordatorio configurable por gym

El sistema SHALL determinar la ventana de aviso a partir de un valor configurable a nivel gym (`Gym.reminderLeadHours`, default `2`). El sistema SHALL usar ese valor para decidir qué sesiones entran en la ventana de aviso de cada tenant.

#### Scenario: Cada gym usa su propia antelación

- **WHEN** el cron de recordatorios de turnos corre
- **AND** un gym tiene `reminderLeadHours = 2` y otro tiene `reminderLeadHours = 24`
- **THEN** el sistema notifica las reservas del primer gym cuyas sesiones arrancan dentro de las 2 horas siguientes
- **AND** notifica las del segundo gym cuyas sesiones arrancan dentro de las 24 horas siguientes

#### Scenario: Gym sin configuración explícita usa el default

- **WHEN** un gym nunca modificó `reminderLeadHours`
- **THEN** el sistema aplica una ventana de aviso de 2 horas para las reservas de ese gym

### Requirement: Aislamiento multi-tenant del cron de recordatorios

El sistema SHALL procesar y notificar únicamente reservas cuya `ActivitySession` y alumno pertenezcan al mismo gym, sin cruzar datos entre tenants.

#### Scenario: El recordatorio de un gym no incluye reservas de otro gym

- **WHEN** el cron de recordatorios de turnos corre con gyms distintos que tienen sesiones dentro de la ventana de aviso al mismo tiempo
- **THEN** cada alumno recibe únicamente el recordatorio de las reservas de su propio gym

### Requirement: Resiliencia del cron ante fallos individuales de envío

El sistema SHALL continuar procesando al resto de las reservas candidatas cuando el envío del recordatorio de una de ellas falla.

#### Scenario: Un fallo de envío no aborta el resto del cron

- **WHEN** el cron de recordatorios de turnos procesa varias reservas candidatas
- **AND** el envío a una de ellas falla
- **THEN** el sistema continúa procesando y notificando al resto de las reservas candidatas

## ADDED Requirements

### Requirement: Mail de recordatorio de vencimiento de cuota al alumno

El sistema SHALL enviar un email al alumno cuya cuota está por vencer, en los hitos de **2 y 0 días** antes de `User.nextPaymentDate`, calculados sobre el día actual en zona horaria de Argentina. El día 1 NO es un hito de envío.

El destinatario SHALL cumplir todas estas condiciones: `role = STUDENT`, `deletedAt IS NULL`, `blockedAt IS NULL`, `paymentExempt = false`, `email IS NOT NULL`, su gym tiene `blockedAt IS NULL` y `kind != 'PERSONAL'`.

El mail SHALL usar el branding del gym del alumno (logo, `primaryColor`, nombre) y el vocabulario correspondiente a `gym.kind` — "box" para `BOX`, "gym" para `GYM`. El mail SHALL registrarse en `EmailLog` con `type = PAYMENT_DUE_STUDENT`.

#### Scenario: Alumno con cuota a 2 días recibe el mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno activo, no exento, con email, cuya `nextPaymentDate` es exactamente 2 días posterior al día actual (ART)
- **THEN** el sistema le envía un email indicando que su cuota vence en 2 días
- **AND** registra el envío en `EmailLog` con `type = PAYMENT_DUE_STUDENT`

#### Scenario: Alumno con cuota que vence hoy recibe el mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno activo cuya `nextPaymentDate` es el día actual (ART)
- **THEN** el sistema le envía un email indicando que su cuota vence hoy

#### Scenario: Alumno con cuota a 1 día no recibe mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno cuya `nextPaymentDate` es el día siguiente al día actual (ART)
- **THEN** el sistema NO le envía email, porque el día 1 no es un hito del canal email
- **AND** el canal push sí le envía su recordatorio, porque su ventana no cambia

#### Scenario: Alumno con cuota a 3 días no recibe mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno cuya `nextPaymentDate` es 3 días posterior al día actual (ART)
- **THEN** el sistema NO le envía email

#### Scenario: Alumno con cuota vencida no recibe mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno cuya `nextPaymentDate` es anterior al día actual (ART)
- **THEN** el sistema NO le envía email

#### Scenario: Alumno exento de pago no recibe mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno con `paymentExempt = true` cuya `nextPaymentDate` cae dentro de la ventana de recordatorio
- **THEN** el sistema NO le envía email

#### Scenario: Alumno sin email queda excluido

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno con `email IS NULL` cuya `nextPaymentDate` cae dentro de la ventana de recordatorio
- **THEN** el sistema NO intenta enviarle email y continúa procesando al resto de los candidatos

#### Scenario: Alumno de un gym bloqueado no recibe mail

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un alumno cuya `nextPaymentDate` cae dentro de la ventana, pero su gym tiene `blockedAt` distinto de null
- **THEN** el sistema NO le envía email

#### Scenario: El mail usa el vocabulario del tipo de gym

- **WHEN** el sistema envía el recordatorio a un alumno de un gym con `kind = 'BOX'`
- **THEN** el cuerpo del mail se refiere a la instalación como "box"
- **AND** cuando el gym tiene `kind = 'GYM'`, se refiere a la instalación como "gym"

#### Scenario: Usuario de Wody Personal no recibe el mail de alumno

- **WHEN** el cron diario de vencimientos corre
- **AND** existe un usuario del tenant `personal` con `role = STUDENT` y una `nextPaymentDate` real cargada por el super-admin, dentro de la ventana de recordatorio
- **THEN** el sistema NO le envía el mail de recordatorio de alumno
- **AND** ese usuario queda cubierto por el recordatorio de cuota de Wody Personal

### Requirement: Mail de recordatorio de vencimiento de cuota del gym a Wody

El sistema SHALL enviar un email a todos los usuarios con `role = ADMIN`, `deletedAt IS NULL` y `email IS NOT NULL` de cualquier gym que cumpla `subscriptionNextPaymentDate IS NOT NULL` AND `paymentExempt = false` AND `blockedAt IS NULL` AND `kind != 'PERSONAL'`, en los hitos de **2 y 0 días** antes de `subscriptionNextPaymentDate`, calculados sobre el día actual en zona horaria de Argentina. Los hitos del canal email son independientes de los del canal push, que conserva sus cinco hitos.

El comportamiento SHALL ser independiente de `selfManagedBilling`. El mail SHALL incluir la fecha de vencimiento, el monto mensual de la suscripción y un enlace a la página de suscripción del gym. El mail SHALL registrarse en `EmailLog` con `type = PAYMENT_DUE_GYM`.

#### Scenario: Mail a los ADMIN en un hito de recordatorio

- **WHEN** el cron diario corre
- **AND** existe un gym sin exención, no bloqueado, con `subscriptionNextPaymentDate` exactamente a 2 días del día actual (ART)
- **THEN** el sistema envía un email a cada `ADMIN` del gym que tenga email, indicando que la cuota vence en 2 días
- **AND** registra cada envío en `EmailLog` con `type = PAYMENT_DUE_GYM`

#### Scenario: Mail a los ADMIN el día del vencimiento

- **WHEN** el cron diario corre
- **AND** existe un gym no exento, no bloqueado, cuya `subscriptionNextPaymentDate` es el día actual (ART)
- **THEN** el sistema envía un email a cada `ADMIN` del gym que tenga email, indicando que la cuota vence hoy

#### Scenario: Un hito del canal push que no lo es del canal email no dispara mail

- **WHEN** el cron diario corre
- **AND** existe un gym no exento con `subscriptionNextPaymentDate` a 7 días del día actual (ART)
- **THEN** el sistema envía la push de recordatorio, porque 7 es uno de sus hitos
- **AND** NO envía email de recordatorio para ese gym

#### Scenario: Día fuera de los hitos no dispara mail

- **WHEN** el cron diario corre
- **AND** existe un gym no exento con `subscriptionNextPaymentDate` a 5 días del día actual (ART)
- **THEN** el sistema NO envía email de recordatorio para ese gym

#### Scenario: Gym sin fecha de vencimiento no recibe mail

- **WHEN** el cron diario corre
- **AND** existe un gym con `subscriptionNextPaymentDate = null`
- **THEN** el sistema NO envía email de recordatorio para ese gym

#### Scenario: Gym exento no recibe mail

- **WHEN** el cron diario corre
- **AND** existe un gym con `paymentExempt = true` cuya `subscriptionNextPaymentDate` cae en un hito
- **THEN** el sistema NO envía email de recordatorio para ese gym

#### Scenario: El monto se muestra en pesos, no en centavos

- **WHEN** el sistema envía el recordatorio de un gym con `subscriptionMonthlyAmount = 4000000`
- **THEN** el mail muestra el monto como $40.000

#### Scenario: ADMIN sin email no interrumpe al resto

- **WHEN** el cron diario corre para un gym en un hito de recordatorio
- **AND** uno de sus `ADMIN` tiene `email IS NULL`
- **THEN** el sistema envía el email a los demás `ADMIN` del gym y omite al que no tiene email

### Requirement: Mail de recordatorio de vencimiento de cuota al usuario de Wody Personal

El sistema SHALL enviar un email al usuario de Wody Personal cuya cuota está por vencer, en los hitos de **2 y 0 días** antes de `User.nextPaymentDate`, calculados sobre el día actual en zona horaria de Argentina.

El destinatario SHALL cumplir todas estas condiciones: pertenecer al gym con `kind = 'PERSONAL'`, `role = STUDENT`, `canCreateOwnRoutines = true`, `deletedAt IS NULL`, `blockedAt IS NULL`, `paymentExempt = false`, `email IS NOT NULL`, `nextPaymentDate` distinta del valor centinela `9999-12-31`, y `mpSubscriptionStatus` distinto de `"authorized"`.

El mail SHALL usar el branding de Wody (no el del tenant `personal`) e incluir un enlace a la página de suscripción del usuario. El mail SHALL registrarse en `EmailLog` con `type = PAYMENT_DUE_PERSONAL`.

#### Scenario: Usuario Personal cobrado a mano recibe el mail en un hito

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal activo, no exento, con email, cuya `nextPaymentDate` está exactamente a 2 días del día actual (ART)
- **THEN** el sistema le envía un email indicando que su cuota de Wody Personal vence en 2 días
- **AND** registra el envío en `EmailLog` con `type = PAYMENT_DUE_PERSONAL`

#### Scenario: Usuario Personal recibe el mail el día del vencimiento

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal activo, no exento, con email, cuya `nextPaymentDate` es el día actual (ART)
- **THEN** el sistema le envía un email indicando que su cuota de Wody Personal vence hoy

#### Scenario: Día fuera de los hitos no dispara mail a Personal

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal cuya `nextPaymentDate` está a 5 días del día actual (ART)
- **THEN** el sistema NO le envía email de recordatorio

#### Scenario: Usuario Personal nunca cobrado a mano no recibe mail

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal cuya `nextPaymentDate` conserva el valor centinela `9999-12-31` asignado en el registro
- **THEN** el sistema NO le envía email de recordatorio

#### Scenario: Usuario Personal en débito automático no recibe mail

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal con `mpSubscriptionStatus = "authorized"` y una `nextPaymentDate` que cae en un hito
- **THEN** el sistema NO le envía email de recordatorio, porque Mercado Pago cobra automáticamente

#### Scenario: Usuario Personal exento no recibe mail

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal con `paymentExempt = true` cuya `nextPaymentDate` cae en un hito
- **THEN** el sistema NO le envía email de recordatorio

#### Scenario: El copy no menciona ir al gimnasio

- **WHEN** el sistema envía el recordatorio a un usuario de Wody Personal
- **THEN** el cuerpo del mail se refiere a su suscripción a Wody Personal
- **AND** NO le indica pasar por un gimnasio o box a renovar

### Requirement: Deduplicación diaria del canal email

El sistema SHALL garantizar que ninguno de los tres mails de recordatorio se envíe más de una vez por día al mismo destinatario, incluso si el cron se ejecuta más de una vez en la misma jornada.

La deduplicación SHALL usar campos persistidos de tipo fecha, independientes de los campos de deduplicación del canal push: `User.lastDueEmailedOn` para el recordatorio de alumno y el de Wody Personal, y `Gym.lastBillingEmailedOn` para el recordatorio del gym. El campo SHALL actualizarse al día actual (ART) **únicamente si el envío resultó exitoso**.

#### Scenario: Segunda corrida del cron en el mismo día no reenvía

- **WHEN** el cron ya envió el recordatorio a un destinatario en el día de hoy (ART)
- **AND** el cron vuelve a ejecutarse el mismo día
- **THEN** el sistema NO le envía un segundo email
- **AND** el destinatario no se cuenta como enviado en la segunda corrida

#### Scenario: Un envío fallido no marca el dedup

- **WHEN** el sistema intenta enviar el recordatorio y el envío falla
- **THEN** el campo de deduplicación NO se actualiza
- **AND** una corrida posterior del cron el mismo día o al día siguiente vuelve a intentar el envío

#### Scenario: El dedup del email es independiente del dedup de la push

- **WHEN** un alumno recibe con éxito la push de vencimiento, lo que actualiza `lastDueNotifiedOn`
- **THEN** el sistema igualmente le envía el email de recordatorio ese día
- **AND** actualiza `lastDueEmailedOn` de forma independiente

#### Scenario: Registro nuevo sin dedup previo habilita el envío

- **WHEN** el cron evalúa a un destinatario cuyo campo de deduplicación es `null`
- **THEN** el sistema lo considera "nunca notificado" y procede con el envío

### Requirement: El canal email se emite únicamente desde los crons diarios

El sistema SHALL enviar los tres mails de recordatorio exclusivamente desde los crons diarios de vencimientos. Ningún flujo de inicio de sesión SHALL disparar el envío de estos emails.

#### Scenario: El login de un ADMIN no dispara el mail

- **WHEN** un usuario con `role = ADMIN` de un gym cuya cuota vence en 5 días inicia sesión
- **THEN** el sistema NO le envía email de recordatorio
- **AND** el comportamiento del canal push en el login permanece sin cambios

#### Scenario: El login de un alumno no dispara el mail

- **WHEN** un alumno cuya cuota vence en 2 días inicia sesión
- **THEN** el sistema NO le envía email de recordatorio
- **AND** el comportamiento del canal push en el login permanece sin cambios

### Requirement: Resiliencia del cron ante fallos de envío

El sistema SHALL continuar procesando al resto de los destinatarios cuando el envío de un email falla, y SHALL exponer contadores de envíos exitosos y fallidos en la respuesta del cron.

#### Scenario: Un fallo de Resend no aborta el cron

- **WHEN** el cron procesa 50 destinatarios y el envío al décimo falla
- **THEN** el sistema procesa los 40 restantes
- **AND** la respuesta del cron reporta 49 envíos exitosos y 1 fallido

#### Scenario: Falta de configuración de email no rompe el cron

- **WHEN** el cron corre en un entorno sin `RESEND_API_KEY` configurada
- **THEN** ningún envío se concreta
- **AND** el cron termina con éxito y reporta los envíos como fallidos, sin lanzar excepción
- **AND** las fases de push del cron se ejecutan normalmente

### Requirement: Los recordatorios cuentan para el monitoreo de cuota mensual

El sistema SHALL incluir los tipos `PAYMENT_DUE_STUDENT`, `PAYMENT_DUE_GYM` y `PAYMENT_DUE_PERSONAL` en el conteo mensual de emails que alimenta las alertas de cuota al 80% y 95% del límite configurado.

#### Scenario: Los recordatorios suman al contador de cuota

- **WHEN** el cron de monitoreo de cuota calcula el consumo del mes en curso
- **THEN** cuenta los `EmailLog` con `status = SENT` de tipo `INVITE`, `RESET`, `PAYMENT_DUE_STUDENT`, `PAYMENT_DUE_GYM` y `PAYMENT_DUE_PERSONAL`

#### Scenario: La alerta se dispara considerando los recordatorios

- **WHEN** los recordatorios de vencimiento llevan el consumo mensual total por encima del 80% del límite configurado
- **THEN** el sistema envía la alerta de cuota correspondiente

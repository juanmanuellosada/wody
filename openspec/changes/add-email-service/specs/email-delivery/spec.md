## ADDED Requirements

### Requirement: Envío de mails transaccionales vía Resend

El sistema SHALL exponer un servicio interno `sendEmail({ to, gymId, type, subject, react })` que envía mails transaccionales a través de Resend. La función SHALL renderizar el componente React Email a HTML antes de invocar Resend, SHALL incluir un `from` configurado por la variable de entorno `EMAIL_FROM`, y SHALL incluir un `reply-to` si `EMAIL_REPLY_TO` está definido.

#### Scenario: Envío exitoso

- **GIVEN** `RESEND_API_KEY` y `EMAIL_FROM` están configuradas
- **WHEN** la aplicación invoca `sendEmail` con destinatario válido y un componente React Email
- **THEN** el sistema llama a Resend, recibe un `resendId`, y crea un row en `EmailLog` con `status = SENT`, `sentAt = now()`, `to`, `type`, `gymId`, `resendId`

#### Scenario: Resend devuelve error (cuota agotada o transitorio)

- **WHEN** la API de Resend responde con error
- **THEN** el sistema NO SHALL relanzar la excepción al caller del flujo de alta o reset (esos flujos no deben caer)
- **AND** crea un row en `EmailLog` con `status = FAILED`, `errorMessage` y `to`
- **AND** el caller recibe un resultado que indica fallo de envío para que la UI pueda mostrar "no pudimos enviar el mail, intentá de nuevo"

#### Scenario: Variables de entorno faltantes

- **GIVEN** `RESEND_API_KEY` no está configurada
- **WHEN** la aplicación invoca `sendEmail`
- **THEN** el sistema lanza un error explícito en server logs (`EMAIL_NOT_CONFIGURED`) y devuelve fallo al caller
- **AND** NO SHALL crear row en `EmailLog`

### Requirement: Templates con branding por tenant

Los templates de email SHALL aceptar un objeto `gym: { name, primaryColor, logo, kind }` como prop y aplicar `primaryColor` a los elementos visuales primarios (botón CTA, links, header), incluir `logo` si está disponible, y mostrar `name` como remitente visible en el cuerpo.

#### Scenario: Render con branding del gym

- **GIVEN** un gym con `primaryColor = "#0066FF"` y `logo = "https://.../atlas.png"`
- **WHEN** el sistema renderiza un template para ese gym
- **THEN** el HTML resultante usa `#0066FF` en el botón CTA y muestra el logo en el header

#### Scenario: Gym sin logo

- **GIVEN** un gym con `logo = null`
- **WHEN** el sistema renderiza un template para ese gym
- **THEN** el header muestra el `name` del gym como texto y omite la imagen sin romper el layout

#### Scenario: primaryColor inválido o ausente

- **GIVEN** un gym con `primaryColor = null`
- **WHEN** el sistema renderiza un template
- **THEN** usa el color por defecto `#E31414` (mismo fallback que el layout web actual)

### Requirement: Copy adaptado por `Gym.kind`

Los templates SHALL adaptar el vocabulario visible al usuario según `Gym.kind`. Para `BOX` SHALL usar términos de CrossFit (WOD, RM, box). Para `GYM` SHALL usar términos generales (rutina, PR, gimnasio).

#### Scenario: Mail de invitación a un BOX

- **GIVEN** un gym con `kind = "BOX"` y `name = "CrossFit Atlas"`
- **WHEN** el sistema envía la invitación
- **THEN** el cuerpo incluye términos como "WOD", "RM" y "box" donde corresponda

#### Scenario: Mail de invitación a un GYM

- **GIVEN** un gym con `kind = "GYM"` y `name = "Mila Fit"`
- **WHEN** el sistema envía la invitación
- **THEN** el cuerpo incluye "rutina", "PR" y "gimnasio" donde corresponda

### Requirement: Registro de cada envío en `EmailLog`

El sistema SHALL persistir cada intento de envío en la tabla `EmailLog` con: `id`, `gymId` (opcional, para mails sin gym contextual como `QUOTA_ALERT`), `to`, `type` (`INVITE` | `RESET` | `QUOTA_ALERT_80` | `QUOTA_ALERT_95` | etc.), `resendId` (opcional), `status` (`SENT` | `FAILED`), `errorMessage` (opcional), `sentAt`.

#### Scenario: Lookup por usuario para "última invitación enviada"

- **WHEN** la UI del panel de admin renderiza un alumno con invitación pendiente
- **THEN** puede consultar el último `EmailLog` con `type = INVITE` y `to = user.email` para mostrar "Invitado el {fecha}" o "No se ha enviado aún"

### Requirement: Monitoreo de cuota mensual con alertas

El sistema SHALL ejecutar un cron diario en `src/app/api/cron/email-quota/route.ts` que cuenta envíos exitosos del mes en curso (`EmailLog WHERE status = 'SENT' AND sentAt >= startOfMonth()`). Si el conteo supera el 80% de `EMAIL_QUOTA_MONTHLY_LIMIT` SHALL enviar un mail de alerta a `EMAIL_QUOTA_ALERT_TO`. Si supera el 95% SHALL enviar una segunda alerta. La dedup mensual SHALL prevenir reenvíos repetidos en el mismo mes.

#### Scenario: Alcance del 80% en el mes

- **GIVEN** `EMAIL_QUOTA_MONTHLY_LIMIT = 3000` y el conteo del mes es 2400
- **WHEN** el cron ejecuta
- **THEN** envía un `QuotaAlertEmail` a `EMAIL_QUOTA_ALERT_TO` indicando "80% alcanzado, 2400/3000"
- **AND** registra el envío en `EmailLog` con `type = QUOTA_ALERT_80`

#### Scenario: Dedup en ejecuciones posteriores del mismo mes

- **GIVEN** ya existe un `EmailLog` con `type = QUOTA_ALERT_80` en el mes en curso
- **WHEN** el cron ejecuta de nuevo y el conteo sigue por encima del 80% pero por debajo del 95%
- **THEN** NO envía un segundo mail de 80%

#### Scenario: Salto del 80% al 95% en el mismo día

- **GIVEN** el conteo pasa de 2700 a 2900 en un día
- **WHEN** el cron del día siguiente ejecuta
- **THEN** envía la alerta de 95% (independiente de que la de 80% haya sido o no enviada en este mes)

#### Scenario: Reset al cambiar de mes

- **GIVEN** estamos en un mes nuevo y el conteo es 0
- **WHEN** el cron ejecuta
- **THEN** las alertas vuelven a estar disponibles (la dedup es por mes calendario)

### Requirement: Autorización del cron

El endpoint del cron SHALL exigir el header `Authorization: Bearer ${CRON_SECRET}` (igual que los crons existentes del proyecto). Sin ese header, SHALL responder 401 sin ejecutar la lógica.

#### Scenario: Llamada sin secret

- **WHEN** un request llega a `/api/cron/email-quota` sin `Authorization` o con un valor incorrecto
- **THEN** el endpoint responde 401 y no ejecuta el conteo ni envía mails

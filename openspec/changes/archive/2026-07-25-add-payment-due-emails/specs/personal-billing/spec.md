## ADDED Requirements

### Requirement: Recordatorio de vencimiento de cuota al usuario Personal

El sistema SHALL avisar al usuario de Wody Personal que su cuota está por vencer, en los hitos de **2 y 0 días** antes de `User.nextPaymentDate`, calculados sobre el día actual en zona horaria de Argentina, y SHALL emitir ese aviso por email desde el cron diario.

Este recordatorio aplica únicamente al usuario Personal **cobrado manualmente** por el super-admin, es decir, aquel cuya `nextPaymentDate` fue asignada al registrar un pago y por lo tanto es distinta del valor centinela `9999-12-31` que se asigna en el registro. El usuario Personal con suscripción activa de Mercado Pago (`mpSubscriptionStatus = "authorized"`) NO SHALL recibir este recordatorio, porque el cobro es automático y su caso de fallo ya está cubierto por el aviso de cobro fallido.

El recordatorio es independiente de las push notifications de fin de trial: el trial es un evento único de onboarding, la cuota es recurrente. El detalle del canal email está especificado en la capability `payment-due-emails`.

#### Scenario: Usuario Personal cobrado a mano recibe el recordatorio

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal activo, no exento, con email, cuya `nextPaymentDate` está exactamente a 2 días del día actual (ART)
- **THEN** el sistema le envía un email indicando que su cuota de Wody Personal vence en 2 días

#### Scenario: Usuario Personal con suscripción de Mercado Pago no recibe el recordatorio

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal con `mpSubscriptionStatus = "authorized"`
- **THEN** el sistema NO le envía el recordatorio de vencimiento

#### Scenario: Usuario Personal recién registrado no recibe el recordatorio

- **WHEN** el cron diario corre
- **AND** existe un usuario Personal cuya `nextPaymentDate` conserva el valor centinela `9999-12-31`
- **THEN** el sistema NO le envía el recordatorio de vencimiento

#### Scenario: El recordatorio de cuota no reemplaza al de fin de trial

- **WHEN** un usuario Personal está en período de trial y todavía no fue cobrado
- **THEN** sigue recibiendo las push notifications de fin de trial en sus hitos
- **AND** no recibe el recordatorio de vencimiento de cuota

#### Scenario: El usuario Personal no recibe el copy de alumno

- **WHEN** el cron diario procesa a un usuario Personal con `nextPaymentDate` dentro de la ventana de recordatorio de alumnos
- **THEN** el sistema NO le envía el mail de recordatorio de cuota de alumno
- **AND** le envía únicamente el recordatorio de cuota de Wody Personal

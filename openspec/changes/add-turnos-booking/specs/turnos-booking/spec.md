## ADDED Requirements

### Requirement: Calendario de actividades disponibles

El sistema SHALL mostrar a un `STUDENT` con sesión iniciada el calendario de `ActivitySession` futuras de las `Activity` activas de su propio gym. El sistema NO SHALL mostrar actividades ni sesiones de otro gym.

#### Scenario: Un alumno ve las sesiones futuras de su gym

- **WHEN** un `STUDENT` abre el calendario de Turnos
- **THEN** ve las `ActivitySession` futuras de las `Activity` activas de su gym

#### Scenario: Un alumno no ve actividades de otro gym

- **GIVEN** el alumno pertenece al gym A
- **WHEN** abre el calendario de Turnos
- **THEN** no aparece ninguna `Activity` ni `ActivitySession` del gym B

### Requirement: Inscripción recurrente con confirmación

Al anotarse por primera vez a un `ActivitySlot` cuya `Activity` tiene `allowsRecurring = true`, el sistema SHALL preguntar al `STUDENT` si quiere anotarse "a todas" (crear una `ActivityEnrollment` sobre el slot) o "solo a esta" (crear únicamente la `ActivityBooking` de la fecha elegida, sin `ActivityEnrollment`). Si `allowsRecurring = false`, el sistema NO SHALL ofrecer la opción de inscripción recurrente y SHALL reservar únicamente la fecha elegida.

#### Scenario: El alumno elige inscribirse a todas las sesiones

- **GIVEN** un `ActivitySlot` de una `Activity` con `allowsRecurring = true`
- **WHEN** el alumno se anota y elige "a todas"
- **THEN** se crea una `ActivityEnrollment` activa sobre ese `ActivitySlot`
- **AND** se crean `ActivityBooking` para las sesiones futuras ya materializadas de ese slot

#### Scenario: El alumno elige inscribirse solo a una fecha

- **GIVEN** un `ActivitySlot` de una `Activity` con `allowsRecurring = true`
- **WHEN** el alumno se anota a una fecha puntual y elige "solo a esta"
- **THEN** se crea la `ActivityBooking` de esa `ActivitySession`
- **AND** no se crea ninguna `ActivityEnrollment`

#### Scenario: Actividad sin recurrencia solo permite reserva puntual

- **GIVEN** una `Activity` con `allowsRecurring = false`
- **WHEN** el alumno se anota a una `ActivitySession`
- **THEN** el sistema no le pregunta "a todas o solo a esta" y reserva únicamente esa fecha

### Requirement: Actividades de fecha única no admiten inscripción recurrente

Una `Activity` con `scheduleKind = ONE_OFF` NO SHALL admitir `ActivityEnrollment`, sin importar el valor de `allowsRecurring` (que es un flag distinto y queda irrelevante en este modo). El sistema NO SHALL ofrecer la pregunta "¿a todas o solo a esta?" para estas actividades, y el server action de inscripción recurrente SHALL rechazar el intento aunque se lo invoque directamente, no solo ocultarlo en la interfaz.

#### Scenario: El calendario no ofrece inscripción recurrente en una actividad de fecha única

- **GIVEN** una `Activity` con `scheduleKind = ONE_OFF`
- **WHEN** el alumno se anota a su `ActivitySession`
- **THEN** el sistema no le pregunta "a todas o solo a esta" y reserva únicamente esa fecha

#### Scenario: El server action rechaza la inscripción recurrente sobre una actividad de fecha única

- **GIVEN** un `ActivitySlot` de una `Activity` con `scheduleKind = ONE_OFF`
- **WHEN** se invoca la inscripción recurrente sobre ese slot, aunque no se pase por la UI
- **THEN** el sistema rechaza la operación con un error de negocio
- **AND** no se crea ninguna `ActivityEnrollment`

### Requirement: Cancelación de una fecha no afecta la inscripción recurrente

Cancelar la `ActivityBooking` de una fecha concreta SHALL dejar intacta la `ActivityEnrollment` del alumno sobre ese `ActivitySlot`, si existe. Cancelar la `ActivityEnrollment` SHALL cancelar todas las `ActivityBooking` futuras derivadas de esa inscripción, pero NO SHALL afectar reservas de otros slots ni reservas puntuales del alumno.

#### Scenario: Cancelar una fecha puntual conserva la inscripción

- **GIVEN** un alumno con `ActivityEnrollment` activa sobre un slot y varias `ActivityBooking` futuras derivadas
- **WHEN** cancela la reserva de una fecha puntual, dentro de la ventana permitida
- **THEN** esa `ActivityBooking` queda cancelada
- **AND** la `ActivityEnrollment` sigue activa
- **AND** las demás `ActivityBooking` futuras del slot no se ven afectadas

#### Scenario: Cancelar la inscripción baja las reservas futuras

- **GIVEN** un alumno con `ActivityEnrollment` activa y reservas futuras derivadas
- **WHEN** cancela la `ActivityEnrollment`
- **THEN** la inscripción queda inactiva
- **AND** todas las `ActivityBooking` futuras derivadas de esa inscripción quedan canceladas

### Requirement: Validación de cupo

El sistema SHALL rechazar una reserva sobre una `ActivitySession` cuyo `capacity` no es `null` y cuyo `bookedCount` ya alcanzó `capacity`. La verificación y el incremento de `bookedCount` SHALL ejecutarse de forma atómica, de modo que dos solicitudes concurrentes por el último lugar disponible NO SHALL resultar ambas confirmadas.

#### Scenario: Se rechaza reservar una sesión llena

- **GIVEN** una `ActivitySession` con `capacity = 10` y `bookedCount = 10`
- **WHEN** un `STUDENT` intenta reservar esa sesión
- **THEN** el sistema rechaza la reserva con un error de negocio
- **AND** `bookedCount` no cambia

#### Scenario: Dos alumnos compiten por el último lugar

- **GIVEN** una `ActivitySession` con `capacity = 10` y `bookedCount = 9`
- **WHEN** dos `STUDENT` distintos intentan reservar esa sesión simultáneamente
- **THEN** solo uno de los dos obtiene la `ActivityBooking` confirmada
- **AND** el otro recibe un error de cupo agotado
- **AND** `bookedCount` termina en 10, no en 11

#### Scenario: Sesión sin límite acepta cualquier cantidad de reservas

- **GIVEN** una `ActivitySession` con `capacity = null`
- **WHEN** múltiples alumnos reservan esa sesión
- **THEN** todas las reservas se confirman sin validar cupo

### Requirement: No se puede reservar dos veces la misma sesión

El sistema NO SHALL permitir que un mismo `User` tenga más de una `ActivityBooking` activa sobre la misma `ActivitySession`.

#### Scenario: Reserva duplicada es rechazada

- **GIVEN** un alumno con `ActivityBooking` confirmada en una `ActivitySession`
- **WHEN** el mismo alumno intenta reservar la misma sesión de nuevo
- **THEN** el sistema rechaza la operación

### Requirement: Ventana de cancelación

El sistema SHALL rechazar la cancelación de una `ActivityBooking` cuando el tiempo restante hasta el `startsAt` de la `ActivitySession` es menor que `cancelWindowHours` de la `Activity`. Esta validación SHALL ejecutarse en el server, independientemente de lo que la interfaz permita intentar.

#### Scenario: Cancelación dentro de la ventana permitida

- **GIVEN** una `Activity` con `cancelWindowHours = 2` y una sesión que empieza en 5 horas
- **WHEN** el alumno cancela su `ActivityBooking`
- **THEN** la cancelación se confirma

#### Scenario: Cancelación fuera de la ventana permitida

- **GIVEN** una `Activity` con `cancelWindowHours = 2` y una sesión que empieza en 1 hora
- **WHEN** el alumno intenta cancelar su `ActivityBooking`
- **THEN** el sistema rechaza la cancelación con un error de negocio

### Requirement: Solo usuarios del gym pueden reservar

El sistema SHALL exigir un `User` autenticado y perteneciente al `gymId` de la `Activity` para crear una `ActivityEnrollment` o una `ActivityBooking`. NO SHALL existir ningún flujo de reserva público ni anónimo.

#### Scenario: Un visitante anónimo no puede reservar

- **WHEN** una solicitud sin sesión intenta crear una `ActivityBooking`
- **THEN** el sistema la rechaza

#### Scenario: Un usuario de otro gym no puede reservar

- **GIVEN** un `User` del gym A y una `Activity` del gym B
- **WHEN** ese usuario intenta reservar una sesión de la actividad del gym B
- **THEN** el sistema rechaza la operación por aislamiento multi-tenant

### Requirement: Cuentas LITE no pueden auto-reservar

El sistema NO SHALL permitir que un `User` con `AccountKind.LITE` cree por sí mismo una `ActivityEnrollment` ni una `ActivityBooking`. Para estas cuentas, la inscripción y la reserva SHALL depender exclusivamente del alta manual por parte de un `ADMIN` o `TEACHER`, según el requerimiento de gestión de Actividades.

#### Scenario: Un usuario LITE no tiene flujo de auto-reserva

- **GIVEN** un `User` con `AccountKind.LITE`
- **WHEN** se evalúa su capacidad de reservar por sí mismo una `ActivitySession`
- **THEN** el sistema no expone la acción de reservar para ese usuario

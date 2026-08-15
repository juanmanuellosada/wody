## ADDED Requirements

### Requirement: Alta de Actividad

El sistema SHALL permitir a un `ADMIN` crear una `Activity` dentro de su gym con `name`, `description` (opcional), `teacherId` a cargo (opcional), `color`, `allowsRecurring` (booleano) y `cancelWindowHours` (numérico, horas). Un `TEACHER` SHALL poder crear una `Activity` únicamente asignándose a sí mismo como `teacherId` a cargo. La `Activity` creada SHALL quedar asociada al `gymId` del creador.

#### Scenario: Un ADMIN crea una actividad sin profe asignado

- **WHEN** un `ADMIN` crea una `Activity` con `teacherId = null`
- **THEN** el sistema la crea con `gymId` del admin y sin profe a cargo

#### Scenario: Un TEACHER crea una actividad y queda a cargo

- **WHEN** un `TEACHER` crea una `Activity`
- **THEN** el sistema la crea con `teacherId` igual al del `TEACHER` que la creó

#### Scenario: Un TEACHER no puede asignar a otro profe como responsable

- **WHEN** un `TEACHER` intenta crear una `Activity` con `teacherId` de otro usuario
- **THEN** el sistema rechaza la operación

### Requirement: Edición y desactivación de Actividad

El sistema SHALL permitir editar los campos de una `Activity` (`name`, `description`, `teacherId`, `color`, `allowsRecurring`, `cancelWindowHours`) y desactivarla (`active = false`). Desactivar una `Activity` NO SHALL borrar sus `ActivitySlot` ni sus `ActivitySession` existentes. Una `Activity` desactivada NO SHALL aparecer en el calendario de reserva del alumno ni admitir nuevas inscripciones o reservas.

#### Scenario: Desactivar una actividad oculta la reserva pero conserva el historial

- **GIVEN** una `Activity` con sesiones pasadas y futuras
- **WHEN** un `ADMIN` la desactiva
- **THEN** la actividad deja de listarse en el calendario del alumno
- **AND** las `ActivitySession` y `ActivityBooking` existentes no se eliminan

#### Scenario: No se puede reservar en una actividad desactivada

- **GIVEN** una `Activity` con `active = false`
- **WHEN** un `STUDENT` intenta reservar una sesión de esa actividad
- **THEN** el sistema rechaza la operación

### Requirement: Horarios recurrentes semanales

El sistema SHALL permitir definir uno o más `ActivitySlot` por `Activity`, cada uno con día de la semana, hora de inicio, hora de fin y `capacity` opcional. `capacity = null` SHALL significar sin límite de cupo. El sistema SHALL permitir editar y eliminar un `ActivitySlot` existente.

#### Scenario: Un slot sin cupo admite reservas ilimitadas

- **GIVEN** un `ActivitySlot` con `capacity = null`
- **WHEN** se materializa una `ActivitySession` de ese slot
- **THEN** la sesión no aplica límite de reservas

#### Scenario: Una actividad admite varios horarios en la misma semana

- **WHEN** un `ADMIN` agrega un `ActivitySlot` los lunes 14:00–15:00 y otro los miércoles 14:00–15:00 a la misma `Activity`
- **THEN** el sistema guarda ambos horarios asociados a esa actividad

### Requirement: Materialización de sesiones por cron

El sistema SHALL ejecutar un proceso programado que, para cada `ActivitySlot` activo, genere las `ActivitySession` correspondientes a las próximas 4 semanas que aún no existan. El proceso SHALL ser idempotente: ejecutarlo repetidamente sobre el mismo horizonte NO SHALL crear sesiones duplicadas. Cada `ActivitySession` materializada SHALL tomar un snapshot del `capacity` vigente del slot al momento de crearse.

#### Scenario: Corridas repetidas no duplican sesiones

- **GIVEN** el cron ya materializó las sesiones de un slot hasta 4 semanas hacia adelante
- **WHEN** el cron vuelve a correr el mismo día
- **THEN** no se crean `ActivitySession` adicionales para fechas ya materializadas

#### Scenario: Cambiar el cupo del slot no afecta sesiones ya materializadas

- **GIVEN** una `ActivitySession` ya materializada con `capacity` snapshot en 10
- **WHEN** un `ADMIN` cambia el `capacity` del `ActivitySlot` a 5
- **THEN** la `ActivitySession` ya materializada conserva `capacity = 10`

### Requirement: Cancelación de una sesión puntual

El sistema SHALL permitir a un `ADMIN`, o a un `TEACHER` a cargo de la actividad, cancelar una `ActivitySession` puntual sin eliminar el `ActivitySlot` que la originó. Cancelar una sesión SHALL dejar sin efecto las `ActivityBooking` confirmadas de esa sesión, notificando su cancelación, y NO SHALL impedir que el slot siga generando sesiones futuras.

#### Scenario: Cancelar una sesión no borra el horario recurrente

- **GIVEN** un `ActivitySlot` de los lunes con sesiones futuras materializadas
- **WHEN** un `ADMIN` cancela la sesión de un lunes puntual
- **THEN** esa `ActivitySession` queda cancelada
- **AND** las sesiones de los lunes siguientes no se ven afectadas

### Requirement: Vista de inscriptos y alta manual por gestión

El sistema SHALL permitir a un `ADMIN`, o a un `TEACHER` a cargo de la actividad, ver la lista de alumnos con `ActivityBooking` confirmado en una `ActivitySession` dada. El sistema SHALL permitir a esos mismos roles anotar y desanotar manualmente a un alumno del gym en una sesión, registrando en `ActivityBooking.createdById` quién originó la reserva.

#### Scenario: Gestión anota manualmente a un alumno LITE

- **GIVEN** un alumno `AccountKind.LITE` del gym, que no tiene login
- **WHEN** un `ADMIN` lo anota manualmente en una `ActivitySession`
- **THEN** se crea la `ActivityBooking` con `createdById` del `ADMIN`
- **AND** el alumno queda listado entre los inscriptos de esa sesión

#### Scenario: Gestión desanota a un alumno

- **GIVEN** un alumno con `ActivityBooking` confirmado en una sesión
- **WHEN** un `ADMIN` o el `TEACHER` a cargo lo desanota manualmente
- **THEN** la `ActivityBooking` deja de contar como confirmada
- **AND** el alumno deja de aparecer en la lista de inscriptos

### Requirement: Permisos de gestión de Actividades

El sistema SHALL permitir a un `ADMIN` gestionar (crear, editar, desactivar, definir horarios, cancelar sesiones, anotar/desanotar) todas las `Activity` de su gym. El sistema SHALL permitir a un `TEACHER` gestionar únicamente las `Activity` donde figura como `teacherId` a cargo. Un `STUDENT` o `ACCESS` NO SHALL tener acceso a la gestión de Actividades.

#### Scenario: Un TEACHER no puede gestionar la actividad de otro profe

- **GIVEN** dos `Activity` del mismo gym, cada una a cargo de un `TEACHER` distinto
- **WHEN** el `TEACHER` A intenta editar la actividad a cargo del `TEACHER` B
- **THEN** el sistema rechaza la operación

#### Scenario: Un STUDENT no accede a la gestión de Actividades

- **WHEN** un `STUDENT` intenta acceder a la vista de gestión de Actividades
- **THEN** el sistema lo redirige fuera de la sección

### Requirement: Aislamiento multi-tenant en la gestión de Actividades

Toda operación de gestión sobre `Activity`, `ActivitySlot`, `ActivitySession` y `ActivityBooking` SHALL acotarse al `gymId` del usuario que la ejecuta. Un `ADMIN` o `TEACHER` de un gym NO SHALL poder leer ni modificar actividades, horarios, sesiones o reservas de otro gym.

#### Scenario: Un ADMIN no puede gestionar actividades de otro gym

- **GIVEN** una `Activity` que pertenece al gym B
- **WHEN** un `ADMIN` del gym A intenta editarla o cancelar una de sus sesiones
- **THEN** el sistema rechaza la operación por aislamiento multi-tenant

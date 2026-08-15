## ADDED Requirements

### Requirement: Alta de Actividad

El sistema SHALL permitir a un `ADMIN` crear una `Activity` dentro de su gym con `name`, `description` (opcional), `teacherId` a cargo (opcional), `scheduleKind` (`WEEKLY` o `ONE_OFF`), `allowsRecurring` (booleano), `cancelWindowHours` (numérico, horas) y `capacity` (opcional, cupo por defecto de la actividad). Un `TEACHER` SHALL poder crear una `Activity` únicamente asignándose a sí mismo como `teacherId` a cargo. La `Activity` creada SHALL quedar asociada al `gymId` del creador. `scheduleKind` NO SHALL poder modificarse después del alta: editar una `Activity` (ver "Edición de Actividad y cupo por defecto") no permite cambiar su `scheduleKind`.

#### Scenario: Un ADMIN crea una actividad sin profe asignado

- **WHEN** un `ADMIN` crea una `Activity` con `teacherId = null`
- **THEN** el sistema la crea con `gymId` del admin y sin profe a cargo

#### Scenario: Un TEACHER crea una actividad y queda a cargo

- **WHEN** un `TEACHER` crea una `Activity`
- **THEN** el sistema la crea con `teacherId` igual al del `TEACHER` que la creó

#### Scenario: Un TEACHER no puede asignar a otro profe como responsable

- **WHEN** un `TEACHER` intenta crear una `Activity` con `teacherId` de otro usuario
- **THEN** el sistema rechaza la operación

#### Scenario: El modo de agenda no se puede cambiar después del alta

- **GIVEN** una `Activity` creada con `scheduleKind = WEEKLY`
- **WHEN** un `ADMIN` edita esa actividad
- **THEN** el sistema conserva `scheduleKind = WEEKLY` sin importar lo que se envíe en la edición

### Requirement: Modo de agenda y coherencia del horario

Cada `Activity` SHALL tener un `scheduleKind`: `WEEKLY` (horarios recurrentes semanales) u `ONE_OFF` (fechas únicas). Un `ActivitySlot` SHALL ser coherente con el `scheduleKind` de su `Activity`: si es `WEEKLY`, el slot SHALL tener `dayOfWeek` (0-6) y NO SHALL tener `date`; si es `ONE_OFF`, el slot SHALL tener `date` y NO SHALL tener `dayOfWeek`. El sistema SHALL rechazar cualquier alta o edición de `ActivitySlot` que no respete esta coherencia. Una `Activity` `ONE_OFF` SHALL poder tener varios `ActivitySlot`, cada uno con su propia fecha (por ejemplo, un seminario de dos días). En toda vista donde se muestre un horario de una `Activity` `ONE_OFF` (gestión, calendario del alumno, Mis turnos), el sistema SHALL mostrar la fecha concreta del horario, y NO SHALL mostrar un nombre de día de la semana suelto.

#### Scenario: La gestión de horarios muestra la fecha concreta de un slot ONE_OFF

- **GIVEN** un `ActivitySlot` de una `Activity` `ONE_OFF` con `date = 2026-08-20`
- **WHEN** un `ADMIN` o `TEACHER` ve el horario en la vista de gestión de la actividad
- **THEN** el sistema muestra "20/08/2026", no un nombre de día de la semana

#### Scenario: Un horario semanal no puede tener fecha

- **GIVEN** una `Activity` con `scheduleKind = WEEKLY`
- **WHEN** un `ADMIN` intenta crear un `ActivitySlot` para esa actividad con `date` cargada
- **THEN** el sistema rechaza la operación

#### Scenario: Un horario de fecha única no puede tener día de la semana

- **GIVEN** una `Activity` con `scheduleKind = ONE_OFF`
- **WHEN** un `ADMIN` intenta crear un `ActivitySlot` para esa actividad con `dayOfWeek` cargado
- **THEN** el sistema rechaza la operación

#### Scenario: Una actividad de fecha única admite varios slots con fechas distintas

- **GIVEN** una `Activity` con `scheduleKind = ONE_OFF`
- **WHEN** un `ADMIN` agrega un `ActivitySlot` para el 20 de agosto y otro para el 21 de agosto
- **THEN** el sistema guarda ambos horarios asociados a esa actividad

### Requirement: Edición de Actividad y cupo por defecto

El sistema SHALL permitir editar los campos de una `Activity` (`name`, `description`, `teacherId`, `allowsRecurring`, `cancelWindowHours`, `capacity`). `Activity.capacity` es el cupo por defecto de la actividad: un `ActivitySlot` sin cupo propio (`capacity = null`) SHALL tomar el de su `Activity` al materializar la sesión (`slot.capacity ?? activity.capacity ?? null`); si tampoco la actividad tiene cupo, la sesión queda sin límite. `active = false` se establece únicamente a través del flujo de eliminación (ver "Eliminación de Actividad"), nunca como una acción de edición independiente. Una `Activity` con `active = false` NO SHALL aparecer en el calendario de reserva del alumno ni admitir nuevas inscripciones o reservas, y sus `ActivitySlot` y `ActivitySession` existentes NO SHALL borrarse.

#### Scenario: Un slot sin cupo propio hereda el cupo de la actividad

- **GIVEN** una `Activity` con `capacity = 20` y un `ActivitySlot` con `capacity = null`
- **WHEN** se materializa una `ActivitySession` de ese slot
- **THEN** la sesión toma `capacity = 20`

#### Scenario: El cupo del slot tiene prioridad sobre el de la actividad

- **GIVEN** una `Activity` con `capacity = 20` y un `ActivitySlot` con `capacity = 5`
- **WHEN** se materializa una `ActivitySession` de ese slot
- **THEN** la sesión toma `capacity = 5`

#### Scenario: No se puede reservar en una actividad desactivada

- **GIVEN** una `Activity` con `active = false`
- **WHEN** un `STUDENT` intenta reservar una sesión de esa actividad
- **THEN** el sistema rechaza la operación

### Requirement: Vigencia de una actividad recurrente

Toda `Activity` con `scheduleKind = WEEKLY` SHALL tener `startsOn` (fecha, obligatoria) y `endsOn` (fecha, opcional). El sistema NO SHALL materializar ninguna `ActivitySession` con `date < startsOn`. Si `endsOn` está seteada, el sistema NO SHALL materializar ninguna `ActivitySession` con `date > endsOn`. `endsOn = null` SHALL significar sin fecha de fin: la actividad se repite indefinidamente. Una `Activity` con `scheduleKind = ONE_OFF` NO SHALL tener `startsOn` ni `endsOn`: ambos SHALL quedar en `null`, y el sistema SHALL rechazar cualquier alta o edición que intente cargarlos.

El sistema SHALL permitir editar `startsOn` y `endsOn` de una `Activity` `WEEKLY` ya creada, a diferencia de `scheduleKind`, que es inmutable. Si `endsOn` está seteada, SHALL ser mayor o igual a `startsOn`; el sistema SHALL rechazar la edición en caso contrario.

Si al editar la vigencia de una `Activity` `WEEKLY` alguna `ActivitySession` futura y no cancelada queda con `date` fuera de la nueva ventana (`date < startsOn` o, si aplica, `date > endsOn`), el sistema SHALL cancelar esa sesión con el mismo mecanismo que la cancelación de una sesión puntual: sus `ActivityBooking` confirmadas quedan `CANCELLED` y se notifica por push a los alumnos afectados. El fallo de un envío individual NO SHALL abortar la operación ni las cancelaciones ya confirmadas.

En toda vista donde se liste o muestre el detalle de una `Activity` `WEEKLY` (gestión y calendario), el sistema SHALL mostrar la vigencia de forma legible junto a los horarios: con `endsOn = null`, una indicación de que se repite desde `startsOn` sin fecha de fin; con `endsOn` seteada, el rango completo entre `startsOn` y `endsOn`.

`startsOn` NO SHALL ser un límite inferior arbitrario: representa la primera clase de la actividad. En una `Activity` `WEEKLY`, el día de la semana de `startsOn` SHALL coincidir con el `dayOfWeek` de al menos un `ActivitySlot` activo de esa actividad. El sistema SHALL rechazar cualquier alta o edición de `Activity` que deje `startsOn` sin ningún `ActivitySlot` activo en ese día de la semana, con un mensaje que indique en qué días sí puede empezar. El sistema SHALL rechazar también el alta, la edición o la desactivación de un `ActivitySlot` que dejaría a la `Activity` en ese mismo estado inconsistente (el `startsOn` vigente sin ningún `ActivitySlot` activo que caiga en su día de la semana): la operación se rechaza explicando que primero hay que ajustar `startsOn`, nunca se corrige en silencio. Si la `Activity` no tiene ningún `ActivitySlot` activo, esta regla no aplica (no hay nada con qué `startsOn` deba ser consistente).

#### Scenario: Una actividad WEEKLY nueva exige fecha de inicio

- **WHEN** un `ADMIN` crea una `Activity` con `scheduleKind = WEEKLY` sin cargar `startsOn`
- **THEN** el sistema rechaza la operación

#### Scenario: Una actividad ONE_OFF no admite vigencia

- **WHEN** un `ADMIN` intenta crear o editar una `Activity` con `scheduleKind = ONE_OFF` cargando `startsOn` o `endsOn`
- **THEN** el sistema rechaza la operación

#### Scenario: No se materializan sesiones antes del inicio de vigencia

- **GIVEN** un `ActivitySlot` de una `Activity` `WEEKLY` con `startsOn` en dos semanas
- **WHEN** el cron de materialización corre hoy
- **THEN** no se crea ninguna `ActivitySession` con fecha anterior a `startsOn`

#### Scenario: No se materializan sesiones después del fin de vigencia

- **GIVEN** un `ActivitySlot` de una `Activity` `WEEKLY` con `endsOn` seteada
- **WHEN** el cron de materialización corre
- **THEN** no se crea ninguna `ActivitySession` con fecha posterior a `endsOn`

#### Scenario: endsOn nulo repite la actividad indefinidamente

- **GIVEN** una `Activity` `WEEKLY` con `startsOn` en el pasado y `endsOn = null`
- **WHEN** el cron de materialización corre
- **THEN** sigue generando `ActivitySession` hasta el horizonte de 4 semanas, sin límite superior propio

#### Scenario: Editar la vigencia de una actividad ya creada es posible

- **GIVEN** una `Activity` `WEEKLY` con `endsOn = null`
- **WHEN** un `ADMIN` la edita y carga `endsOn` con una fecha futura
- **THEN** el sistema guarda la nueva `endsOn`

#### Scenario: endsOn anterior a startsOn se rechaza

- **WHEN** un `ADMIN` edita una `Activity` `WEEKLY` cargando `endsOn` anterior a `startsOn`
- **THEN** el sistema rechaza la operación

#### Scenario: Achicar la vigencia cancela y notifica las sesiones que quedan afuera

- **GIVEN** una `Activity` `WEEKLY` con `ActivitySession` futuras materializadas y alumnos con `ActivityBooking` `CONFIRMED` en algunas de ellas
- **WHEN** un `ADMIN` edita `endsOn` a una fecha anterior a alguna de esas sesiones
- **THEN** esas `ActivitySession` quedan `cancelled`
- **AND** sus `ActivityBooking` `CONFIRMED` quedan `CANCELLED`
- **AND** el sistema intenta notificar por push a cada alumno afectado
- **AND** un fallo de envío a un alumno no impide notificar al resto ni revierte la edición

#### Scenario: startsOn coincide con un día con horario

- **GIVEN** una `Activity` `WEEKLY` con `ActivitySlot` activos los lunes y miércoles
- **WHEN** un `ADMIN` la crea o la edita con `startsOn` en un lunes
- **THEN** el sistema acepta la operación

#### Scenario: startsOn no coincide con ningún día con horario

- **GIVEN** una `Activity` `WEEKLY` con `ActivitySlot` activos los lunes y miércoles
- **WHEN** un `ADMIN` intenta crear o editar la actividad con `startsOn` en un martes
- **THEN** el sistema rechaza la operación
- **AND** el mensaje de error indica que `startsOn` debe caer en lunes o miércoles

#### Scenario: Editar los horarios deja startsOn sin ningún día que coincida

- **GIVEN** una `Activity` `WEEKLY` con `startsOn` en lunes y un único `ActivitySlot` activo los lunes
- **WHEN** un `ADMIN` cambia ese `ActivitySlot` a los martes, o lo desactiva
- **THEN** el sistema rechaza la operación
- **AND** el mensaje de error indica que primero hay que ajustar `startsOn`

### Requirement: Horarios recurrentes semanales

El sistema SHALL permitir definir uno o más `ActivitySlot` por `Activity` con `scheduleKind = WEEKLY`, cada uno con día de la semana, hora de inicio, hora de fin y `capacity` opcional. `capacity = null` SHALL significar sin límite propio (ver "Edición de Actividad y cupo por defecto" para la resolución contra el cupo de la actividad). El sistema SHALL permitir editar y eliminar un `ActivitySlot` existente.

#### Scenario: Un slot sin cupo propio ni cupo de actividad admite reservas ilimitadas

- **GIVEN** un `ActivitySlot` con `capacity = null` cuya `Activity` también tiene `capacity = null`
- **WHEN** se materializa una `ActivitySession` de ese slot
- **THEN** la sesión no aplica límite de reservas

#### Scenario: Una actividad admite varios horarios en la misma semana

- **WHEN** un `ADMIN` agrega un `ActivitySlot` los lunes 14:00–15:00 y otro los miércoles 14:00–15:00 a la misma `Activity`
- **THEN** el sistema guarda ambos horarios asociados a esa actividad

### Requirement: Alta de Actividad con horarios en un solo paso

El sistema SHALL permitir crear una `Activity` junto con uno o más `ActivitySlot` en una única operación transaccional, sin requerir un paso separado posterior. Si `scheduleKind = WEEKLY`, cada horario cargado en el alta SHALL repetirse todas las semanas (misma semántica que "Horarios recurrentes semanales"; el alta en un paso no introduce otra frecuencia). Si `scheduleKind = ONE_OFF`, cada horario cargado en el alta SHALL tener su propia fecha (misma semántica que "Modo de agenda y coherencia del horario"). El sistema SHALL rechazar el alta si no se especifica al menos un horario, si algún horario tiene hora de fin anterior o igual a la de inicio, o si dos horarios de la misma actividad se solapan en el mismo día de la semana (`WEEKLY`) o en la misma fecha (`ONE_OFF`). La edición de horarios después del alta SHALL seguir haciéndose desde la vista de detalle de la actividad (`ActivitySlotManager`), que no se ve afectada por este requerimiento.

#### Scenario: Alta con horarios crea la actividad y sus slots juntos

- **WHEN** un `ADMIN` crea una `Activity` con dos horarios (lunes 09:00–10:00 y miércoles 09:00–10:00)
- **THEN** el sistema crea la `Activity` y ambos `ActivitySlot` en la misma operación

#### Scenario: El alta rechaza una actividad sin ningún horario

- **WHEN** un `ADMIN` intenta crear una `Activity` sin cargar ningún horario
- **THEN** el sistema rechaza la operación

#### Scenario: El alta rechaza horarios superpuestos el mismo día

- **WHEN** un `ADMIN` intenta crear una `Activity` con dos horarios los lunes que se superponen en el tiempo
- **THEN** el sistema rechaza la operación

#### Scenario: Alta de una actividad de fecha única con dos días de seminario

- **WHEN** un `ADMIN` crea una `Activity` con `scheduleKind = ONE_OFF` y dos horarios, uno el 20 de agosto y otro el 21 de agosto
- **THEN** el sistema crea la `Activity` y ambos `ActivitySlot`, cada uno con su propia fecha

#### Scenario: El alta rechaza horarios superpuestos en la misma fecha

- **WHEN** un `ADMIN` intenta crear una `Activity` con `scheduleKind = ONE_OFF` y dos horarios en la misma fecha que se superponen en el tiempo
- **THEN** el sistema rechaza la operación

### Requirement: Eliminación de Actividad

El sistema SHALL permitir a un `ADMIN`, o a un `TEACHER` a cargo de la actividad, eliminar una `Activity` mediante una única acción ("Eliminar"). Si la `Activity` nunca tuvo ninguna `ActivityBooking` (ni `CONFIRMED` ni `CANCELLED`, en ninguna de sus sesiones), el sistema SHALL borrarla junto con sus `ActivitySlot` y `ActivitySession` (borrado en cascada, sin historial que preservar). Si la `Activity` tuvo alguna vez al menos una `ActivityBooking`, el sistema NO SHALL borrarla: SHALL archivarla (`active = false`), preservando su historial, y la actividad archivada SHALL desaparecer de toda vista de gestión (listados de ADMIN/TEACHER) y del calendario de reserva del alumno. En ambos casos el sistema SHALL informar al cliente cuál de las dos operaciones ocurrió. Antes de ejecutar la eliminación, el sistema SHALL permitir consultar cuántos alumnos tienen reservas confirmadas futuras en esa actividad, para mostrarlo en una confirmación explícita previa. Si al archivar existían `ActivityBooking` `CONFIRMED` en sesiones futuras, el sistema SHALL cancelarlas y notificar por push a los alumnos afectados, con el mismo mecanismo que la cancelación de una sesión puntual; el fallo de un envío individual NO SHALL abortar la operación.

#### Scenario: Eliminar una actividad sin historial la borra por completo

- **GIVEN** una `Activity` que nunca tuvo ninguna `ActivityBooking`
- **WHEN** un `ADMIN` la elimina
- **THEN** el sistema borra la `Activity` junto con sus `ActivitySlot` y `ActivitySession`
- **AND** informa al cliente que la operación fue un borrado

#### Scenario: Eliminar una actividad con historial la archiva en su lugar

- **GIVEN** una `Activity` que tuvo al menos una `ActivityBooking` alguna vez
- **WHEN** un `ADMIN` la elimina
- **THEN** el sistema la marca `active = false` en lugar de borrarla
- **AND** la actividad deja de listarse en la gestión y en el calendario del alumno
- **AND** informa al cliente que la operación fue un archivado, preservando el historial

#### Scenario: Archivar una actividad notifica a los alumnos con reservas futuras

- **GIVEN** una `Activity` con `ActivityBooking` `CONFIRMED` en sesiones futuras
- **WHEN** un `ADMIN` la elimina y el sistema la archiva
- **THEN** esas `ActivityBooking` quedan `CANCELLED`
- **AND** el sistema intenta notificar por push a cada alumno afectado
- **AND** un fallo de envío a un alumno no impide notificar al resto ni revierte el archivado

#### Scenario: Un TEACHER no puede eliminar la actividad de otro profe

- **GIVEN** dos `Activity` del mismo gym, cada una a cargo de un `TEACHER` distinto
- **WHEN** el `TEACHER` A intenta eliminar la actividad a cargo del `TEACHER` B
- **THEN** el sistema rechaza la operación

### Requirement: Materialización de sesiones por cron

El sistema SHALL ejecutar un proceso programado que, para cada `ActivitySlot` activo con `scheduleKind = WEEKLY`, genere las `ActivitySession` correspondientes a las próximas 4 semanas que aún no existan. El proceso SHALL ser idempotente: ejecutarlo repetidamente sobre el mismo horizonte NO SHALL crear sesiones duplicadas. Cada `ActivitySession` materializada SHALL tomar un snapshot del `capacity` vigente del slot al momento de crearse.

#### Scenario: Corridas repetidas no duplican sesiones

- **GIVEN** el cron ya materializó las sesiones de un slot hasta 4 semanas hacia adelante
- **WHEN** el cron vuelve a correr el mismo día
- **THEN** no se crean `ActivitySession` adicionales para fechas ya materializadas

#### Scenario: Cambiar el cupo del slot no afecta sesiones ya materializadas

- **GIVEN** una `ActivitySession` ya materializada con `capacity` snapshot en 10
- **WHEN** un `ADMIN` cambia el `capacity` del `ActivitySlot` a 5
- **THEN** la `ActivitySession` ya materializada conserva `capacity = 10`

### Requirement: Materialización de sesiones de fecha única

Para cada `ActivitySlot` activo con `scheduleKind = ONE_OFF`, el sistema SHALL generar exactamente una `ActivitySession` en `slot.date`, sin importar el horizonte de 4 semanas usado para `WEEKLY`: una fecha única a meses vista SHALL poder materializarse igual. El proceso SHALL ser idempotente (una vez materializada, no SHALL regenerarse ni duplicarse). La sesión SHALL tomar un snapshot del `capacity` vigente del slot al momento de crearse, con la misma resolución `slot.capacity ?? activity.capacity ?? null`.

#### Scenario: Una fecha única a meses vista se materializa igual

- **GIVEN** un `ActivitySlot` con `scheduleKind = ONE_OFF` y `date` a 3 meses de hoy
- **WHEN** el cron de materialización corre
- **THEN** se crea la `ActivitySession` de esa fecha, aunque esté fuera del horizonte de 4 semanas usado para horarios semanales

#### Scenario: Materializar dos veces la misma fecha única no duplica la sesión

- **GIVEN** un `ActivitySlot` `ONE_OFF` cuya `ActivitySession` ya fue materializada
- **WHEN** el cron de materialización vuelve a correr
- **THEN** no se crea una segunda `ActivitySession` para ese slot

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

El sistema SHALL permitir a un `ADMIN` gestionar (crear con horarios, editar, eliminar, definir horarios, cancelar sesiones, anotar/desanotar) todas las `Activity` de su gym. El sistema SHALL permitir a un `TEACHER` gestionar únicamente las `Activity` donde figura como `teacherId` a cargo. Un `STUDENT` o `ACCESS` NO SHALL tener acceso a la gestión de Actividades.

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

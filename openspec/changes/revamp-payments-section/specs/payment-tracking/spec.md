## ADDED Requirements

### Requirement: Registro persistente de pagos

El sistema SHALL persistir cada cobro como un registro `Payment` independiente, con importe, fecha de registro (`paidAt`), alumno, gym y usuario que lo cargó (`recordedById`). Un alumno PUEDE tener múltiples pagos a lo largo del tiempo.

#### Scenario: Un pago queda registrado con todos sus datos

- **WHEN** un `ADMIN` o `TEACHER` registra un pago de un alumno
- **THEN** el sistema crea un `Payment` con el importe, la fecha del momento del registro, el `gymId` del gym, el `studentId` del alumno y el `recordedById` del usuario que lo cargó

#### Scenario: El historial conserva pagos previos

- **WHEN** se registra un nuevo pago de un alumno que ya tenía pagos anteriores
- **THEN** el pago anterior se conserva y el alumno queda con ambos registros en su historial

### Requirement: Flujo "Registrar pago"

El sistema SHALL ofrecer un botón "Registrar pago" arriba de la sección de pagos y un acceso equivalente en cada fila de la lista de alumnos. Ambos abren el mismo popup con los campos alumno, importe y próxima fecha de pago. El flujo "Marcar pagado" por fila SHALL dejar de existir.

#### Scenario: Registrar pago desde el botón principal

- **WHEN** el usuario abre el popup desde el botón "Registrar pago" de arriba de la sección
- **THEN** el popup muestra un selector de alumno sin pre-seleccionar, un campo de importe y un campo de próxima fecha de pago

#### Scenario: Registrar pago desde una fila

- **WHEN** el usuario abre el popup desde el acceso de la fila de un alumno
- **THEN** el popup se abre con ese alumno ya pre-seleccionado

#### Scenario: El importe se pre-llena con el último pago del alumno

- **WHEN** se selecciona un alumno que tiene pagos previos
- **THEN** el campo de importe se pre-llena con el monto de su último pago

#### Scenario: La próxima fecha sugiere el vencimiento + 1 mes

- **WHEN** se selecciona un alumno
- **THEN** el campo de próxima fecha de pago se pre-llena con el `nextPaymentDate` actual del alumno más un mes, y el usuario PUEDE editarlo

#### Scenario: Confirmar crea el pago y corre el vencimiento atómicamente

- **WHEN** el usuario confirma el popup con un alumno, un importe y una próxima fecha válidos
- **THEN** el sistema crea el `Payment` y actualiza `nextPaymentDate` del alumno a la próxima fecha indicada, dentro de una única transacción que se revierte por completo si alguna parte falla

### Requirement: Corrección y eliminación de pagos

El sistema SHALL permitir que un `ADMIN` edite el importe de un pago registrado o lo elimine. Un `TEACHER` NO SHALL poder editar ni eliminar pagos. Eliminar un pago NO SHALL modificar el `nextPaymentDate` del alumno.

#### Scenario: Un ADMIN corrige el importe de un pago

- **WHEN** un `ADMIN` edita el importe de un `Payment` existente
- **THEN** el sistema actualiza el importe del registro y las estadísticas reflejan el nuevo valor

#### Scenario: Un ADMIN elimina un pago mal cargado

- **WHEN** un `ADMIN` elimina un `Payment`
- **THEN** el registro deja de existir y deja de contar en las estadísticas, y el `nextPaymentDate` del alumno permanece sin cambios

#### Scenario: Un TEACHER no puede corregir ni eliminar pagos

- **WHEN** un `TEACHER` intenta editar o eliminar un `Payment`
- **THEN** el sistema rechaza la operación

### Requirement: Edición manual de la fecha de pago

El sistema SHALL conservar la edición manual del `nextPaymentDate` de un alumno (corrección administrativa). Mover esa fecha a mano NO SHALL crear un `Payment` ni contar como ingreso en las estadísticas.

#### Scenario: Mover la fecha a mano no genera ingreso

- **WHEN** un `ADMIN` o `TEACHER` cambia manualmente la fecha de próximo pago de un alumno desde el editor de alumno
- **THEN** el `nextPaymentDate` se actualiza y no se crea ningún `Payment` ni se altera la recaudación

### Requirement: Estadísticas de recaudación

La sección `/[gymSlug]/pagos` SHALL mostrar un panel de estadísticas arriba de la lista de alumnos. El panel SHALL exponer la recaudación total, la cantidad de pagos, el ticket promedio del período y un gráfico de evolución mensual de la recaudación. El panel SHALL permitir filtrar por período, por profesor y por alumno, y comparar el período seleccionado contra el período anterior.

#### Scenario: Métricas del período seleccionado

- **WHEN** el usuario consulta el panel con un período seleccionado
- **THEN** el panel muestra la suma de importes, la cantidad de pagos y el ticket promedio de los pagos cuyo `paidAt` cae en ese período

#### Scenario: Vista mensual por defecto y rango personalizado

- **WHEN** el usuario abre la sección de pagos sin elegir un período
- **THEN** el panel muestra el mes en curso por defecto, y el usuario PUEDE seleccionar un rango de fechas personalizado

#### Scenario: Comparación contra el período anterior

- **WHEN** el panel muestra las métricas de un período
- **THEN** también muestra la variación respecto del período inmediatamente anterior de la misma duración

#### Scenario: Filtro por profesor

- **WHEN** el usuario filtra las estadísticas por un profesor
- **THEN** el panel considera solo los pagos de los alumnos asignados a ese profesor según la relación `TeacherStudent` vigente

#### Scenario: Filtro por alumno

- **WHEN** el usuario filtra las estadísticas por un alumno
- **THEN** el panel considera solo los pagos de ese alumno

### Requirement: Alcance de pagos por rol

El sistema SHALL limitar el alcance de los pagos y las estadísticas según el rol. Un `ADMIN` SHALL ver la recaudación de todo el gym; un `TEACHER` SHALL ver únicamente la de sus alumnos asignados.

#### Scenario: Un ADMIN ve toda la recaudación del gym

- **WHEN** un `ADMIN` consulta la sección de pagos
- **THEN** las estadísticas y el listado incluyen a todos los alumnos del gym

#### Scenario: Un TEACHER ve solo sus alumnos

- **WHEN** un `TEACHER` consulta la sección de pagos
- **THEN** las estadísticas y el listado incluyen únicamente a los alumnos asignados a ese profesor

### Requirement: Aislamiento multi-tenant de pagos

Toda consulta, creación, edición o eliminación de un `Payment` SHALL filtrarse por `gymId`. Un usuario NO SHALL poder acceder ni registrar pagos de un gym al que no pertenece.

#### Scenario: Las consultas de pagos se acotan al gym

- **WHEN** se consultan pagos o estadísticas dentro de un `gymSlug`
- **THEN** el resultado incluye solo `Payment` cuyo `gymId` corresponde a ese gym

#### Scenario: No se puede registrar un pago en otro gym

- **WHEN** un usuario intenta registrar o modificar un pago de un alumno de un gym distinto al suyo
- **THEN** el sistema rechaza la operación

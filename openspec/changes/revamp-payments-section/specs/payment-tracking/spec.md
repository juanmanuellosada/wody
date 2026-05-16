## ADDED Requirements

### Requirement: Registro persistente de pagos

El sistema SHALL persistir cada cobro como un registro `Payment` independiente, con importe, fecha de pago (`paidAt`), método de pago (opcional), alumno, gym y usuario que lo cargó (`recordedById`). Un alumno PUEDE tener múltiples pagos a lo largo del tiempo.

#### Scenario: Un pago queda registrado con todos sus datos

- **WHEN** un `ADMIN` o `TEACHER` registra un pago de un alumno
- **THEN** el sistema crea un `Payment` con el importe, la fecha de pago indicada (o la fecha actual si no se indicó una), el método de pago (si fue provisto), el `gymId` del gym, el `studentId` del alumno y el `recordedById` del usuario que lo cargó

#### Scenario: El historial conserva pagos previos

- **WHEN** se registra un nuevo pago de un alumno que ya tenía pagos anteriores
- **THEN** el pago anterior se conserva y el alumno queda con ambos registros en su historial

### Requirement: Flujo "Registrar pago"

El sistema SHALL ofrecer un botón "Registrar pago" prominente en el bloque de estadísticas y un acceso equivalente en cada fila de la lista de alumnos. Ambos abren el mismo popup con los campos alumno, importe y próxima fecha de pago. El flujo "Marcar pagado" por fila SHALL dejar de existir.

#### Scenario: Registrar pago desde el botón principal

- **WHEN** el usuario abre el popup desde el botón "Registrar pago" del bloque de estadísticas
- **THEN** el popup muestra un buscador de alumno sin pre-seleccionar, un campo de importe y un campo de próxima fecha de pago

#### Scenario: Buscador de alumno con typeahead

- **WHEN** el usuario escribe en el campo de alumno del popup
- **THEN** la lista de alumnos se filtra en tiempo real por nombre y el usuario puede elegir uno haciendo clic en la coincidencia; al elegir, se mantiene el pre-llenado de importe y fecha

#### Scenario: Registrar pago desde una fila

- **WHEN** el usuario abre el popup desde el acceso de la fila de un alumno
- **THEN** el popup se abre con ese alumno ya pre-seleccionado en el buscador

#### Scenario: El importe se pre-llena con el último pago del alumno

- **WHEN** se selecciona un alumno que tiene pagos previos
- **THEN** el campo de importe se pre-llena con el monto de su último pago

#### Scenario: La próxima fecha sugiere el vencimiento + 1 mes

- **WHEN** se selecciona un alumno
- **THEN** el campo de próxima fecha de pago se pre-llena con el `nextPaymentDate` actual del alumno más un mes, y el usuario PUEDE editarlo

#### Scenario: Campo "Fecha del pago" editable, default hoy, sin fechas futuras

- **WHEN** el usuario abre el popup
- **THEN** el campo "Fecha del pago" se inicializa con la fecha de hoy; el usuario PUEDE retroceder la fecha para registrar pagos del pasado; los días futuros están deshabilitados en el calendario y la server action rechaza fechas futuras

#### Scenario: Campo "Método de pago" obligatorio para pagos nuevos

- **WHEN** el usuario abre el popup
- **THEN** el campo "Método de pago" se inicializa en "Efectivo" y el usuario DEBE seleccionar uno de los valores disponibles: Efectivo, Transferencia, Tarjeta (débito/crédito), Mercado Pago

#### Scenario: Guardia de pago duplicado

- **WHEN** el usuario confirma el popup y el alumno ya tiene un `Payment` con `paidAt` en el mismo día calendario
- **THEN** el sistema NO crea el pago y muestra una pantalla de confirmación indicando "Ya hay un pago de {nombre} con fecha {fecha}. ¿Registrar otro de todas formas?"
- **WHEN** el usuario confirma la pantalla de confirmación
- **THEN** el sistema crea el segundo pago independientemente del duplicado

#### Scenario: Confirmar crea el pago y corre el vencimiento atómicamente

- **WHEN** el usuario confirma el popup con un alumno, un importe, una fecha del pago válida, un método de pago y una próxima fecha válidos
- **THEN** el sistema crea el `Payment` (con fecha y método) y actualiza `nextPaymentDate` del alumno a la próxima fecha indicada, dentro de una única transacción que se revierte por completo si alguna parte falla

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

La sección `/[gymSlug]/pagos` SHALL mostrar un panel de estadísticas arriba de la lista de alumnos. El panel SHALL exponer la recaudación total y la cantidad de pagos del período, junto con un gráfico de evolución mensual de la recaudación. El panel SHALL permitir filtrar por período (siempre un rango de fechas) y por profesor, y comparar el período seleccionado contra el período anterior.

#### Scenario: Métricas del período seleccionado

- **WHEN** el usuario consulta el panel con un período seleccionado
- **THEN** el panel muestra la suma de importes y la cantidad de pagos cuyo `paidAt` cae en ese período

#### Scenario: Rango de fechas por defecto (mes actual completo)

- **WHEN** el usuario abre la sección de pagos sin elegir un período
- **THEN** el panel muestra como período por defecto el mes en curso completo (primer día → último día del mes actual), y el usuario PUEDE ajustar el rango con los controles de fecha Desde / Hasta

#### Scenario: Comparación contra el período anterior

- **WHEN** el panel muestra las métricas de un período
- **THEN** también muestra la variación respecto del período inmediatamente anterior de la misma duración

#### Scenario: Filtro por profesor (uno o varios)

- **WHEN** el usuario selecciona uno o varios profesores en el filtro
- **THEN** el panel considera solo los pagos de los alumnos asignados a cualquiera de los profesores seleccionados según la relación `TeacherStudent` vigente; sin selección el panel considera todos los alumnos del gym

#### Scenario: Filtro por método de pago (uno o varios)

- **WHEN** el usuario selecciona uno o varios métodos de pago en el filtro (pills multi-select, search param `statsMethods` coma-separado)
- **THEN** el panel considera solo los pagos cuyo `paymentMethod` coincide con alguno de los seleccionados; los pagos con `paymentMethod` null no matchean ningún filtro de método concreto; sin selección el panel considera todos los métodos

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

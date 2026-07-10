## MODIFIED Requirements

### Requirement: Flujo "Registrar pago"

El sistema SHALL ofrecer un botón "Registrar pago" prominente en la sección `/[gymSlug]/caja` (disponible para `ADMIN` y `TEACHER`). El registro de pagos NO SHALL estar disponible en `/[gymSlug]/pagos` (ni botón standalone ni acceso por fila). El botón abre un popup con los campos alumno, importe y próxima fecha de pago. El flujo "Marcar pagado" por fila SHALL dejar de existir.

#### Scenario: Registrar pago desde el botón principal en Caja

- **WHEN** el usuario abre el popup desde el botón "Registrar pago" de la sección Caja
- **THEN** el popup muestra un buscador de alumno sin pre-seleccionar, un campo de importe y un campo de próxima fecha de pago

#### Scenario: Buscador de alumno con typeahead

- **WHEN** el usuario escribe en el campo de alumno del popup
- **THEN** la lista de alumnos se filtra en tiempo real por nombre y el usuario puede elegir uno haciendo clic en la coincidencia; al elegir, se mantiene el pre-llenado de importe y fecha

#### Scenario: No se puede registrar un pago desde /pagos

- **WHEN** un usuario abre el Control de Pagos en `/[gymSlug]/pagos`
- **THEN** no encuentra ningún botón ni acceso para registrar un pago; el registro solo está disponible en `/[gymSlug]/caja`

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

### Requirement: Estadísticas de recaudación

La sección `/[gymSlug]/caja` SHALL mostrar el panel de estadísticas de recaudación, visible únicamente a usuarios `ADMIN` con `canViewRevenue = true`. El panel SHALL exponer la recaudación total y la cantidad de pagos del período, junto con un gráfico de evolución mensual de la recaudación, y SHALL incluir el historial de pagos. El panel SHALL permitir filtrar por período (siempre un rango de fechas), por profesor, por método de pago y por tipo de alumno (`StudentType`), y comparar el período seleccionado contra el período anterior. La sección `/[gymSlug]/pagos` NO SHALL mostrar este panel, sus gráficos ni el historial de pagos.

#### Scenario: El panel de recaudación vive en Caja y está gateado

- **WHEN** un `ADMIN` con `canViewRevenue = true` abre `/[gymSlug]/caja`
- **THEN** ve el panel de estadísticas de recaudación con sus métricas, el gráfico de evolución y el historial de pagos
- **WHEN** el mismo usuario abre `/[gymSlug]/pagos`
- **THEN** no ve el panel de recaudación, ni el gráfico, ni el historial de pagos

#### Scenario: Métricas del período seleccionado

- **WHEN** el usuario consulta el panel con un período seleccionado
- **THEN** el panel muestra la suma de importes y la cantidad de pagos cuyo `paidAt` cae en ese período

#### Scenario: Rango de fechas por defecto (mes actual completo)

- **WHEN** el usuario abre la sección Caja sin elegir un período
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

#### Scenario: Filtro por tipo de alumno

- **WHEN** el usuario selecciona un tipo de alumno (`StudentType`) en el filtro
- **THEN** el panel considera solo los pagos de alumnos de ese `studentType`; sin selección considera todos los tipos; la opción `MUSCULACION_LIBRE` se ofrece solo en gyms `kind = GYM`

## ADDED Requirements

### Requirement: Control de Pagos en `/pagos`

La sección `/[gymSlug]/pagos` SHALL mostrar el "Control de Pagos": la lista de alumnos con su estado de cuota (al día, atrasado, por vencer, exento), la edición de alumno y el bloqueo, sin exponer la recaudación agregada, el historial de pagos ni el registro de pagos. El sistema SHALL permitir filtrar esta lista por estado de cuota y por tipo de alumno (`StudentType`), de forma combinable.

#### Scenario: /pagos muestra solo el Control de Pagos

- **WHEN** un `ADMIN` o `TEACHER` abre `/[gymSlug]/pagos`
- **THEN** ve la lista de alumnos con su estado de cuota, la edición y el bloqueo por fila, y no ve recaudación, gráficos, historial ni acción de registrar pago

#### Scenario: Filtrar el Control de Pagos por tipo de alumno

- **WHEN** el usuario selecciona un tipo de alumno (`StudentType`) en el filtro del Control de Pagos
- **THEN** la lista muestra únicamente alumnos de ese `studentType`

#### Scenario: Filtros de estado y tipo combinables

- **WHEN** el usuario selecciona a la vez un estado de cuota y un tipo de alumno
- **THEN** la lista muestra los alumnos que cumplen ambos criterios; la opción `MUSCULACION_LIBRE` se ofrece solo en gyms `kind = GYM`

# payment-tracking Specification

## Purpose
Registrar los cobros de cuota de cada gym como transacciones con importe, fecha, método y autor, y exponer la recaudación en estadísticas por período, profesor y método de pago. Cubre el alta de pagos, su corrección, el alcance por rol y el aislamiento multi-tenant.
## Requirements
### Requirement: Registro persistente de pagos

El sistema SHALL persistir cada cobro como un registro `Payment` independiente, con importe, fecha de pago (`paidAt`), método de pago (opcional), alumno, gym y usuario que lo cargó (`recordedById`). Un alumno PUEDE tener múltiples pagos a lo largo del tiempo.

#### Scenario: Un pago queda registrado con todos sus datos

- **WHEN** un `ADMIN` o `TEACHER` registra un pago de un alumno
- **THEN** el sistema crea un `Payment` con el importe, la fecha de pago indicada (o la fecha actual si no se indicó una), el método de pago (si fue provisto), el `gymId` del gym, el `studentId` del alumno y el `recordedById` del usuario que lo cargó

#### Scenario: El historial conserva pagos previos

- **WHEN** se registra un nuevo pago de un alumno que ya tenía pagos anteriores
- **THEN** el pago anterior se conserva y el alumno queda con ambos registros en su historial

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

### Requirement: Exención de pago de un alumno

El sistema SHALL permitir marcar a un alumno como **exento de pago**, indicando que no se le cobra cuota recurrente. La exención SHALL persistirse en el modelo `User` mediante un campo booleano `paymentExempt` (default `false`) y un campo opcional `paymentExemptReason` (texto libre con el motivo). La exención SHALL ser per-gym: el mismo email en otro gym mantiene su flag propio.

#### Scenario: Marcar a un alumno como exento

- **WHEN** un `ADMIN` marca a un alumno como exento (opcionalmente con un motivo)
- **THEN** el `User` queda persistido con `paymentExempt = true` y `paymentExemptReason` con el texto provisto (o null si se omitió), y el cambio se ve reflejado de inmediato en la sección de pagos y en el editor del alumno

#### Scenario: Desmarcar la exención

- **WHEN** un `ADMIN` desmarca a un alumno previamente exento
- **THEN** `paymentExempt` queda en `false` y el alumno vuelve a regirse por su `nextPaymentDate` actual; el sistema NO modifica `nextPaymentDate` automáticamente al desmarcar

#### Scenario: Backfill de usuarios existentes

- **WHEN** se aplica la migración que agrega los campos `paymentExempt` y `paymentExemptReason`
- **THEN** todos los usuarios existentes quedan con `paymentExempt = false` y `paymentExemptReason = null`

### Requirement: Permisos para togglear la exención

Solo un `ADMIN` SHALL poder marcar o desmarcar la exención de pago de un alumno. Un `TEACHER` NO SHALL poder cambiar la exención, incluso de sus propios alumnos. La server action SHALL filtrarse por `gymId` exactamente como el resto de operaciones sobre `User`, rechazando intentos de modificar un alumno de otro gym.

#### Scenario: Un ADMIN togglea la exención de un alumno de su gym

- **WHEN** un `ADMIN` invoca la server action para marcar o desmarcar la exención de un alumno del mismo gym
- **THEN** el sistema actualiza el flag y devuelve éxito

#### Scenario: Un TEACHER intenta togglear la exención

- **WHEN** un `TEACHER` intenta marcar o desmarcar a un alumno como exento
- **THEN** el sistema rechaza la operación con un error de autorización y no modifica al alumno

#### Scenario: Aislamiento multi-tenant en el toggle de exención

- **WHEN** un `ADMIN` intenta togglear la exención de un alumno de otro gym
- **THEN** el sistema rechaza la operación y no modifica al alumno

### Requirement: Efecto de la exención sobre la cobranza

Un alumno marcado como exento NO SHALL aparecer como "Atrasado" ni "Por vencer" en los contadores ni en los filtros principales del listado de pagos; NO SHALL recibir el recordatorio push de cuota próxima a vencer; y SHALL resolver como "al día" en el check-in (salvo `blockedAt`). El `nextPaymentDate` del alumno NO SHALL ser modificado por el sistema al marcarlo o desmarcarlo.

#### Scenario: El alumno exento no cuenta en "Atrasados" ni "Por vencer"

- **WHEN** un alumno tiene `paymentExempt = true` y su `nextPaymentDate` ya pasó (o está por vencer)
- **THEN** los contadores y los filtros "Atrasados" y "Por vencer" del listado de pagos NO lo incluyen

#### Scenario: El cron de recordatorios omite a los exentos

- **WHEN** el cron diario `notify-due-today` busca alumnos a notificar y un candidato tiene `paymentExempt = true`
- **THEN** el cron NO le envía el push de vencimiento, aunque su `nextPaymentDate` caiga en la ventana de notificación

#### Scenario: El check-in de un exento resuelve OK

- **WHEN** un alumno con `paymentExempt = true` y `blockedAt = null` hace check-in en la puerta
- **THEN** el sistema lo considera al día y el check-in resuelve `OK` (no `PENDING`), sin importar el valor de `nextPaymentDate`

#### Scenario: Un exento bloqueado sigue bloqueado

- **WHEN** un alumno con `paymentExempt = true` tiene `blockedAt` no nulo
- **THEN** el sistema NO lo considera al día y el check-in lo rechaza igual que a cualquier alumno bloqueado

#### Scenario: Marcar o desmarcar exento no toca `nextPaymentDate`

- **WHEN** un `ADMIN` marca o desmarca a un alumno como exento
- **THEN** el `nextPaymentDate` del alumno queda intacto

### Requirement: Visibilidad de la exención en la UI

El sistema SHALL exponer el estado de exento de un alumno de forma visible en los puntos donde se muestra el estado de pago. La sección de pagos SHALL ofrecer un filtro dedicado "Exentos" que liste a los alumnos con `paymentExempt = true`. El banner de estado de pago del alumno SHALL mostrar "Exento de pago" en lugar del estado al día / atrasado / por vencer. El editor de alumno SHALL exponer un toggle visible y un campo de motivo para el `ADMIN`.

#### Scenario: Filtro "Exentos" en la sección de pagos

- **WHEN** el usuario activa el filtro "Exentos" en la sección `/[gymSlug]/pagos`
- **THEN** la lista muestra únicamente a los alumnos con `paymentExempt = true`, marcados con un badge "Exento"

#### Scenario: Banner del alumno exento

- **WHEN** un alumno con `paymentExempt = true` consulta su propio panel
- **THEN** el banner de estado de pago muestra "Exento de pago" (con la leyenda de motivo si está disponible) en lugar de la fecha de próximo pago o el estado de mora

#### Scenario: Editor de alumno con toggle de exención

- **WHEN** un `ADMIN` abre el editor de un alumno
- **THEN** el formulario incluye un toggle "Exento de pago" con su estado actual y un campo opcional "Motivo"; al guardar, el cambio se persiste vía la server action correspondiente

#### Scenario: Editor de alumno sin toggle para TEACHER

- **WHEN** un `TEACHER` abre el editor de un alumno propio
- **THEN** el formulario NO muestra el toggle de exención (o lo muestra deshabilitado), reflejando que solo `ADMIN` puede cambiarlo

### Requirement: Registro de pago de un alumno exento

El sistema SHALL permitir registrar un `Payment` a un alumno marcado como exento (por ejemplo, si decide aportar puntualmente), pero SHALL mostrar una advertencia clara en el popup de "Registrar pago" cuando se selecciona un alumno exento. Registrar el pago NO SHALL modificar automáticamente el flag `paymentExempt`.

#### Scenario: Advertencia al registrar pago de un exento

- **WHEN** un `ADMIN` o `TEACHER` selecciona en el popup "Registrar pago" a un alumno con `paymentExempt = true`
- **THEN** el popup muestra un aviso visible indicando que el alumno está marcado como exento; el botón de confirmar sigue habilitado

#### Scenario: Confirmar el pago de un exento mantiene el flag

- **WHEN** el usuario confirma el pago de un alumno exento
- **THEN** el sistema crea el `Payment` normalmente, actualiza `nextPaymentDate` y el flag `paymentExempt` queda en `true` sin cambios; si el usuario quiere desactivar la exención, lo hace explícito desde el editor del alumno

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


## MODIFIED Requirements

### Requirement: Validación del form

La server action `submitJoinRequest({ gymSlug, name, email, password, passwordConfirmation, teacherIds?, nextPaymentDate, honeypot })` SHALL validar:

- `name` no vacío y máximo 200 caracteres.
- `email` con formato válido (regex básico).
- `password` mínimo 6 caracteres.
- `password === passwordConfirmation`.
- `teacherIds` si vino con elementos, todos deben pertenecer al mismo gym y tener `role = TEACHER` o `role = ADMIN`.
- `nextPaymentDate` SHALL venir como string en formato `YYYY-MM-DD`. SHALL parsearse a `Date` con interpretación UTC midnight (`new Date(\`${str}T00:00:00.000Z\`)`). SHALL ser ≥ `getTodayArgentina()`. Una fecha en el pasado, mal formada, o ausente SHALL fallar la validación.

Si la validación falla, SHALL devolver `{ ok: false, error: <mensaje específico> }` para que la UI lo renderice en el form. Las fallas de validación NO SHALL crear `JoinRequest`.

#### Scenario: Password corta

- **WHEN** el submit llega con `password = "abc"`
- **THEN** el sistema devuelve `{ ok: false, error: "La contraseña debe tener al menos 6 caracteres" }`

#### Scenario: Passwords no coinciden

- **WHEN** `password !== passwordConfirmation`
- **THEN** el sistema devuelve `{ ok: false, error: "Las contraseñas no coinciden" }`

#### Scenario: Teacher de otro gym

- **WHEN** `teacherIds` contiene un id que pertenece a otro gym
- **THEN** el sistema devuelve `{ ok: false, error: "Profe inválido" }` y NO crea la request

#### Scenario: nextPaymentDate ausente

- **WHEN** el submit llega sin `nextPaymentDate` o con string vacío
- **THEN** el sistema devuelve `{ ok: false, error: "La fecha de pago es obligatoria" }` y NO crea la request

#### Scenario: nextPaymentDate mal formada

- **WHEN** el submit llega con `nextPaymentDate = "2026-13-99"` o cualquier string que no parsee a `Date` válido
- **THEN** el sistema devuelve `{ ok: false, error: "Fecha de pago inválida" }` y NO crea la request

#### Scenario: nextPaymentDate en el pasado

- **GIVEN** `getTodayArgentina()` devuelve `2026-05-08`
- **WHEN** el submit llega con `nextPaymentDate = "2026-05-07"`
- **THEN** el sistema devuelve `{ ok: false, error: "La fecha de pago no puede ser anterior a hoy" }` y NO crea la request

#### Scenario: nextPaymentDate igual a hoy

- **GIVEN** `getTodayArgentina()` devuelve `2026-05-08`
- **WHEN** el submit llega con `nextPaymentDate = "2026-05-08"` (y el resto válido, sin conflictos)
- **THEN** el sistema crea la `JoinRequest` con `nextPaymentDate = 2026-05-08` y devuelve `{ ok: true }`

### Requirement: Persistencia con password hasheada

Cuando la validación pasa y no hay conflicto, el sistema SHALL crear un `JoinRequest` con: `gymId`, `name`, `email`, `passwordHash` (bcryptjs con 10 rounds, mismo que `User.password`), `teacherIds` (vía `JoinRequestTeacher` rows), `nextPaymentDate` (parseada del input, almacenada como `@db.Date`), `status = PENDING`, `createdAt = now()`. La password en plain text NO SHALL persistirse en ningún log ni column.

#### Scenario: Submit válido

- **GIVEN** un form completo válido con `nextPaymentDate = "2026-06-01"`
- **WHEN** el submit pasa todas las validaciones y no hay conflicto
- **THEN** el sistema crea un `JoinRequest` con todos los campos requeridos, `passwordHash = bcrypt.hash(password, 10)` y `nextPaymentDate = 2026-06-01`
- **AND** devuelve `{ ok: true }`

### Requirement: Sección admin de invitaciones

El sistema SHALL exponer `/{gymSlug}/admin/invitaciones` accesible solo para `role = ADMIN` del gym. La página SHALL listar `JoinRequest` con tabs "Pendientes" (default), "Aprobadas", "Rechazadas". Cada fila muestra `name`, `email`, `teacher.name` si está, `createdAt` formateado en es-AR. En filas pendientes SHALL renderizar botones "Aprobar" y "Rechazar". En filas aprobadas o rechazadas SHALL mostrar `reviewedAt` y el nombre del admin que revisó.

Al clickear "Aprobar" en una fila pendiente, el sistema SHALL abrir un modal con: el resumen de la solicitud (nombre, email, profe elegido, **próxima fecha de pago elegida por el alumno** formateada en es-AR), un botón primario "Aprobar" y un botón secundario "Editar antes de aprobar". El botón "Editar antes de aprobar" SHALL desplegar dentro del mismo modal un mini-form con los siguientes campos editables:

- `name` (text input, default = `request.name`)
- `studentType` (select con opciones `GENERAL` y `PERSONALIZED`, default = `PERSONALIZED`)
- `teacherIds` (multi-select de profes activos del gym + opción "Sin profe", default = `request.teacherIds`; oculto si `studentType = GENERAL`)
- `canCreateOwnRoutines` (checkbox, default = `false`; oculto si `studentType = GENERAL`; forzado a `true` y deshabilitado con label "Obligatorio" si `studentType = PERSONALIZED` y `teacherIds` vacío)
- `nextPaymentDate` (date input, default = `request.nextPaymentDate`, atributo `min` = hoy en formato `YYYY-MM-DD` calculado en cliente al render del modal)

El `email` SHALL renderizarse como read-only y NO SHALL ser editable. La password de la request NO SHALL exponerse en la UI bajo ninguna forma.

#### Scenario: Admin entra a la sección

- **GIVEN** un ADMIN del gym G con sesión activa
- **WHEN** abre `/atlas-gym/admin/invitaciones`
- **THEN** el sistema renderiza la lista con tab "Pendientes" activa por default
- **AND** muestra solo `JoinRequest` con `gymId = G.id`

#### Scenario: TEACHER intenta entrar

- **GIVEN** un TEACHER (no ADMIN) con sesión activa
- **WHEN** abre `/atlas-gym/admin/invitaciones`
- **THEN** el proxy redirige al dashboard correspondiente al rol (ya cubierto por la lógica existente del proxy)

#### Scenario: Aislamiento multi-tenant

- **WHEN** un ADMIN del gym A abre la sección admin de invitaciones del gym A
- **THEN** SHALL ver solo `JoinRequest` con `gymId = A.id`
- **AND** NO SHALL ver requests del gym B

#### Scenario: Aprobar sin editar

- **GIVEN** una `JoinRequest` pendiente con `nextPaymentDate = 2026-06-15`
- **WHEN** el admin clickea "Aprobar" en el modal sin abrir el form de edición
- **THEN** el sistema invoca `approveJoinRequest({ requestId })` sin overrides
- **AND** el alumno se crea con los defaults del request (incluyendo `nextPaymentDate = 2026-06-15`)

#### Scenario: Editar antes de aprobar

- **GIVEN** una `JoinRequest` pendiente con `name = "Lucia"`, `teacherIds = [T1]`, `nextPaymentDate = 2026-06-15`
- **WHEN** el admin clickea "Editar antes de aprobar", cambia `name` a `"Lucía"`, `studentType` a `GENERAL`, `nextPaymentDate` a `"2026-07-01"`, y luego clickea "Aprobar"
- **THEN** el sistema invoca `approveJoinRequest({ requestId, overrides: { name: "Lucía", studentType: "GENERAL", nextPaymentDate: "2026-07-01" } })`

#### Scenario: PERSONALIZED sin profe fuerza canCreateOwnRoutines

- **GIVEN** el form de edición está abierto
- **WHEN** el admin selecciona `studentType = PERSONALIZED` y `teacherIds = []` ("Sin profe")
- **THEN** el checkbox `canCreateOwnRoutines` SHALL aparecer marcado, deshabilitado, y con label que indique que es obligatorio

#### Scenario: GENERAL oculta profe y canCreateOwnRoutines

- **WHEN** el admin selecciona `studentType = GENERAL`
- **THEN** los campos `teacherIds` y `canCreateOwnRoutines` SHALL ocultarse del form

#### Scenario: Email no editable

- **WHEN** el form de edición está abierto
- **THEN** el campo `email` SHALL renderizarse como read-only y NO SHALL incluirse en el payload de overrides enviado al server

#### Scenario: Resumen muestra fecha elegida por el alumno

- **GIVEN** una `JoinRequest` pendiente con `nextPaymentDate = 2026-06-15`
- **WHEN** el admin abre el modal "Aprobar" sin desplegar la edición
- **THEN** el resumen renderiza la fila "Próxima fecha de pago: 15/06/2026" (formato es-AR)

#### Scenario: Date picker del modal admin tiene min = hoy

- **GIVEN** `getTodayArgentina()` devuelve `2026-05-08`
- **WHEN** el admin abre el sub-form "Editar antes de aprobar"
- **THEN** el `<input type="date" name="nextPaymentDate">` renderizado SHALL tener atributo `min="2026-05-08"`

### Requirement: Aprobación crea User

La server action `approveJoinRequest({ requestId, overrides? })` SHALL: validar que el caller es ADMIN del mismo gym de la request; verificar que la request está `PENDING`; resolver los campos del `User` aplicando los `overrides` opcionales sobre los defaults de la request; validar que `nextPaymentDate` resuelto sea ≥ `getTodayArgentina()`; crear un `User` con `email` y `gymId` de la request, `password = passwordHash` de la request (sin re-hashear), `role = STUDENT`, los campos resueltos `name`, `studentType`, `teacherIds`, `canCreateOwnRoutines`, y `nextPaymentDate` resuelto (NO el default del schema); crear las asociaciones `TeacherStudent` para cada teacher de `teacherIds` resuelto; marcar la request `APPROVED` con `reviewedAt = now()` y `reviewedById = caller.id`; persistir en el `JoinRequest` los valores finales de `name`, `teacherIds` y `nextPaymentDate`; invocar `sendEmail` con `JoinApprovedEmail` al `email` de la request. Toda la operación SHALL ser atómica: si la creación del user falla por unique constraint `(email, gymId)`, ni el `User`, ni el `JoinRequest`, ni los `TeacherStudent` SHALL quedar parcialmente persistidos y el admin recibe error.

`overrides` SHALL ser un objeto opcional con campos opcionales `name`, `studentType` (`"GENERAL" | "PERSONALIZED"`), `teacherIds` (`string[]`), `canCreateOwnRoutines` (`boolean`), `nextPaymentDate` (`string` en formato `YYYY-MM-DD`). El `email` y la `password` de la request NO SHALL aceptar overrides.

La regla de resolución SHALL ser:

- `studentType` final = `overrides.studentType ?? "PERSONALIZED"`.
- Si `studentType = GENERAL`: `teacherIds` final = `[]` y `canCreateOwnRoutines` final = `false`, **independientemente** de lo que venga en `overrides`.
- Si `studentType = PERSONALIZED`:
  - `teacherIds` final = `overrides.teacherIds` si la propiedad fue explícitamente provista (incluso si es array vacío); sino, `request.teacherIds`.
  - Si `teacherIds` final está vacío: `canCreateOwnRoutines` final = `true` (forzado).
  - Si `teacherIds` final no está vacío: `canCreateOwnRoutines` final = `overrides.canCreateOwnRoutines ?? false`.
- `name` final = `overrides.name ?? request.name`.
- `nextPaymentDate` final = parseDate(`overrides.nextPaymentDate`) si la propiedad fue provista; sino, `request.nextPaymentDate`. Tanto en presencia como en ausencia de override, el resultado SHALL ser ≥ `getTodayArgentina()`. Si la fecha resuelta es del pasado, la operación SHALL rechazarse con error y NO SHALL modificar el `JoinRequest`.

Si `overrides.teacherIds` contiene un id que no pertenece al mismo gym, no es `TEACHER` ni `ADMIN`, o está borrado lógicamente, la operación SHALL rechazarse con error y NO SHALL modificar el `JoinRequest`. Si `overrides.nextPaymentDate` viene mal formada, la operación SHALL rechazarse con error.

#### Scenario: Aprobación exitosa sin overrides

- **GIVEN** una `JoinRequest` con `status = PENDING`, `name = "Lucia"`, `teacherIds = [T1]`, `nextPaymentDate = 2026-06-15` en el gym G y un caller ADMIN del gym G; `getTodayArgentina()` = `2026-05-08`
- **WHEN** el admin invoca `approveJoinRequest({ requestId })` sin overrides
- **THEN** el sistema crea un `User` con `name = "Lucia"`, `studentType = PERSONALIZED`, teachers `[T1]`, `canCreateOwnRoutines = false`, `nextPaymentDate = 2026-06-15`
- **AND** marca la request `APPROVED`
- **AND** envía mail "cuenta aprobada"

#### Scenario: Aprobación con override de nombre

- **GIVEN** una `JoinRequest` pendiente con `name = "lucia perez"`, `nextPaymentDate = 2026-06-15`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { name: "Lucía Pérez" } })`
- **THEN** el `User` creado tiene `name = "Lucía Pérez"` y `nextPaymentDate = 2026-06-15`
- **AND** el `JoinRequest` queda con `name = "Lucía Pérez"` (audit trail)

#### Scenario: Override a GENERAL anula profe y permiso

- **GIVEN** una `JoinRequest` pendiente con `teacherIds = [T1]` y `nextPaymentDate = 2026-06-15`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { studentType: "GENERAL", teacherIds: [T1], canCreateOwnRoutines: true } })`
- **THEN** el `User` creado tiene `studentType = GENERAL`, sin teachers, `canCreateOwnRoutines = false`, `nextPaymentDate = 2026-06-15`
- **AND** NO SHALL crearse `TeacherStudent`
- **AND** el `JoinRequest` queda sin teachers

#### Scenario: PERSONALIZED sin profe fuerza canCreateOwnRoutines

- **GIVEN** una `JoinRequest` pendiente con `teacherIds = [T1]`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { teacherIds: [], canCreateOwnRoutines: false } })`
- **THEN** el `User` creado tiene `studentType = PERSONALIZED`, sin teachers, `canCreateOwnRoutines = true` (el `false` de overrides se ignora porque no hay profes)
- **AND** el `JoinRequest` queda sin teachers

#### Scenario: PERSONALIZED con profe respeta canCreateOwnRoutines

- **GIVEN** una `JoinRequest` pendiente con `teacherIds = []`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { teacherIds: [T1], canCreateOwnRoutines: true } })`
- **THEN** el `User` creado tiene teachers `[T1]` y `canCreateOwnRoutines = true`
- **AND** SHALL crearse la asociación `TeacherStudent(teacherId=T1, studentId=userCreado.id)`
- **AND** el `JoinRequest` queda con teachers `[T1]`

#### Scenario: Override de teacherId a uno de otro gym

- **GIVEN** una `JoinRequest` del gym A
- **WHEN** el admin del gym A invoca `approveJoinRequest({ requestId, overrides: { teacherIds: [<id de un TEACHER del gym B>] } })`
- **THEN** la operación falla con error
- **AND** el `JoinRequest` queda `PENDING` sin cambios

#### Scenario: Email ya existe en User

- **GIVEN** una `JoinRequest` válida pero entre que llegó y fue aprobada se creó un `User` con el mismo email en ese gym (otro flujo)
- **WHEN** el admin aprueba (con o sin overrides)
- **THEN** la creación del User falla con conflict
- **AND** la request queda `PENDING` (no se actualiza)
- **AND** el admin recibe error "Ya existe un usuario con ese email en el gym. Rechazá la solicitud manualmente."

#### Scenario: ADMIN de otro gym

- **WHEN** un ADMIN del gym A invoca `approveJoinRequest({ requestId, overrides? })` con un `requestId` del gym B
- **THEN** la operación se rechaza por aislamiento multi-tenant
- **AND** la request queda intacta

#### Scenario: Aprobar request ya procesada

- **GIVEN** una `JoinRequest` con `status = APPROVED` o `REJECTED`
- **WHEN** el admin invoca `approveJoinRequest` (con o sin overrides)
- **THEN** el sistema rechaza la operación con `{ ok: false, error: "Esta solicitud ya fue procesada" }`

#### Scenario: Tampering del email vía overrides

- **WHEN** el admin (o un payload manipulado) invoca `approveJoinRequest({ requestId, overrides: { email: "otro@x.com" } as any })`
- **THEN** el sistema ignora cualquier campo no whitelisteado en el sub-objeto `overrides`
- **AND** el `User` se crea con el `email` original del `JoinRequest`

#### Scenario: Aprobación con override de fecha de pago

- **GIVEN** una `JoinRequest` pendiente con `nextPaymentDate = 2026-06-15` y `getTodayArgentina()` = `2026-05-08`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { nextPaymentDate: "2026-07-01" } })`
- **THEN** el `User` creado tiene `nextPaymentDate = 2026-07-01`
- **AND** el `JoinRequest` queda con `nextPaymentDate = 2026-07-01` (audit trail)

#### Scenario: Aprobación sin override pero con fecha vencida en la request

- **GIVEN** una `JoinRequest` pendiente con `nextPaymentDate = 2026-04-30` (la request quedó dormida) y `getTodayArgentina()` = `2026-05-08`
- **WHEN** el admin invoca `approveJoinRequest({ requestId })` sin overrides
- **THEN** la operación falla con `{ ok: false, error: "La fecha de pago no puede ser anterior a hoy. Editala antes de aprobar." }`
- **AND** el `JoinRequest` queda `PENDING` sin cambios

#### Scenario: Override con fecha vencida

- **GIVEN** `getTodayArgentina()` = `2026-05-08`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { nextPaymentDate: "2026-05-07" } })`
- **THEN** la operación falla con `{ ok: false, error: "La fecha de pago no puede ser anterior a hoy" }`
- **AND** el `JoinRequest` queda `PENDING` sin cambios

#### Scenario: Override con fecha mal formada

- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { nextPaymentDate: "no-es-fecha" } })`
- **THEN** la operación falla con `{ ok: false, error: "Fecha de pago inválida" }`
- **AND** el `JoinRequest` queda `PENDING` sin cambios

#### Scenario: Aprobación pasa nextPaymentDate explícito al user.create

- **GIVEN** una `JoinRequest` con `nextPaymentDate = 2026-06-15` aprobada sin overrides
- **WHEN** el `tx.user.create` ejecuta
- **THEN** el data del create incluye explícitamente `nextPaymentDate: <Date 2026-06-15>` y NO depende del default `now()` del schema

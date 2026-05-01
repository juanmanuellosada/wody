## MODIFIED Requirements

### Requirement: Sección admin de invitaciones

El sistema SHALL exponer `/{gymSlug}/admin/invitaciones` accesible solo para `role = ADMIN` del gym. La página SHALL listar `JoinRequest` con tabs "Pendientes" (default), "Aprobadas", "Rechazadas". Cada fila muestra `name`, `email`, `teacher.name` si está, `createdAt` formateado en es-AR. En filas pendientes SHALL renderizar botones "Aprobar" y "Rechazar". En filas aprobadas o rechazadas SHALL mostrar `reviewedAt` y el nombre del admin que revisó.

Al clickear "Aprobar" en una fila pendiente, el sistema SHALL abrir un modal con: el resumen de la solicitud (nombre, email, profe elegido), un botón primario "Aprobar" y un botón secundario "Editar antes de aprobar". El botón "Editar antes de aprobar" SHALL desplegar dentro del mismo modal un mini-form con los siguientes campos editables:

- `name` (text input, default = `request.name`)
- `studentType` (select con opciones `GENERAL` y `PERSONALIZED`, default = `PERSONALIZED`)
- `teacherId` (select de profes activos del gym + opción "Sin profe", default = `request.teacherId`; oculto si `studentType = GENERAL`)
- `canCreateOwnRoutines` (checkbox, default = `false`; oculto si `studentType = GENERAL`; forzado a `true` y deshabilitado con label "Obligatorio" si `studentType = PERSONALIZED` y `teacherId` es null)

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

- **GIVEN** una `JoinRequest` pendiente
- **WHEN** el admin clickea "Aprobar" en el modal sin abrir el form de edición
- **THEN** el sistema invoca `approveJoinRequest({ requestId })` sin overrides
- **AND** el alumno se crea con los defaults del request

#### Scenario: Editar antes de aprobar

- **GIVEN** una `JoinRequest` pendiente con `name = "Lucia"`, `teacherId = T1`
- **WHEN** el admin clickea "Editar antes de aprobar", cambia `name` a `"Lucía"`, `studentType` a `GENERAL`, y luego clickea "Aprobar"
- **THEN** el sistema invoca `approveJoinRequest({ requestId, overrides: { name: "Lucía", studentType: "GENERAL" } })`

#### Scenario: PERSONALIZED sin profe fuerza canCreateOwnRoutines

- **GIVEN** el form de edición está abierto
- **WHEN** el admin selecciona `studentType = PERSONALIZED` y `teacherId = null` ("Sin profe")
- **THEN** el checkbox `canCreateOwnRoutines` SHALL aparecer marcado, deshabilitado, y con label que indique que es obligatorio

#### Scenario: GENERAL oculta profe y canCreateOwnRoutines

- **WHEN** el admin selecciona `studentType = GENERAL`
- **THEN** los campos `teacherId` y `canCreateOwnRoutines` SHALL ocultarse del form

#### Scenario: Email no editable

- **WHEN** el form de edición está abierto
- **THEN** el campo `email` SHALL renderizarse como read-only y NO SHALL incluirse en el payload de overrides enviado al server

### Requirement: Aprobación crea User

La server action `approveJoinRequest({ requestId, overrides? })` SHALL: validar que el caller es ADMIN del mismo gym de la request; verificar que la request está `PENDING`; resolver los campos del `User` aplicando los `overrides` opcionales sobre los defaults de la request; crear un `User` con `email` y `gymId` de la request, `password = passwordHash` de la request (sin re-hashear), `role = STUDENT`, y los campos resueltos `name`, `studentType`, `teacherId`, `canCreateOwnRoutines`; crear la asociación `TeacherStudent` si `teacherId` resuelto no es null; marcar la request `APPROVED` con `reviewedAt = now()` y `reviewedById = caller.id`; persistir en el `JoinRequest` los valores finales de `name` y `teacherId`; invocar `sendEmail` con `JoinApprovedEmail` al `email` de la request. Toda la operación SHALL ser atómica: si la creación del user falla por unique constraint `(email, gymId)`, ni el `User`, ni el `JoinRequest`, ni el `TeacherStudent` SHALL quedar parcialmente persistidos y el admin recibe error.

`overrides` SHALL ser un objeto opcional con campos opcionales `name`, `studentType` (`"GENERAL" | "PERSONALIZED"`), `teacherId` (`string | null`), `canCreateOwnRoutines` (`boolean`). El `email` y la `password` de la request NO SHALL aceptar overrides.

La regla de resolución SHALL ser:

- `studentType` final = `overrides.studentType ?? "PERSONALIZED"`.
- Si `studentType = GENERAL`: `teacherId` final = `null` y `canCreateOwnRoutines` final = `false`, **independientemente** de lo que venga en `overrides`.
- Si `studentType = PERSONALIZED`:
  - `teacherId` final = `overrides.teacherId` si la propiedad fue explícitamente provista (incluso si es `null`); sino, `request.teacherId`.
  - Si `teacherId` final es `null`: `canCreateOwnRoutines` final = `true` (forzado).
  - Si `teacherId` final no es `null`: `canCreateOwnRoutines` final = `overrides.canCreateOwnRoutines ?? false`.
- `name` final = `overrides.name ?? request.name`.

Si `overrides.teacherId` apunta a un user que no pertenece al mismo gym, no es `TEACHER` ni `ADMIN`, o está borrado lógicamente, la operación SHALL rechazarse con error y NO SHALL modificar el `JoinRequest`.

#### Scenario: Aprobación exitosa sin overrides

- **GIVEN** una `JoinRequest` con `status = PENDING`, `name = "Lucia"`, `teacherId = T1` en el gym G y un caller ADMIN del gym G
- **WHEN** el admin invoca `approveJoinRequest({ requestId })` sin overrides
- **THEN** el sistema crea un `User` con `name = "Lucia"`, `studentType = PERSONALIZED`, `teacherId = T1`, `canCreateOwnRoutines = false`
- **AND** marca la request `APPROVED`
- **AND** envía mail "cuenta aprobada"

#### Scenario: Aprobación con override de nombre

- **GIVEN** una `JoinRequest` pendiente con `name = "lucia perez"`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { name: "Lucía Pérez" } })`
- **THEN** el `User` creado tiene `name = "Lucía Pérez"`
- **AND** el `JoinRequest` queda con `name = "Lucía Pérez"` (audit trail)

#### Scenario: Override a GENERAL anula profe y permiso

- **GIVEN** una `JoinRequest` pendiente con `teacherId = T1` (el alumno había elegido un profe)
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { studentType: "GENERAL", teacherId: T1, canCreateOwnRoutines: true } })`
- **THEN** el `User` creado tiene `studentType = GENERAL`, `teacherId = null`, `canCreateOwnRoutines = false`
- **AND** NO SHALL crearse `TeacherStudent`
- **AND** el `JoinRequest` queda con `teacherId = null`

#### Scenario: PERSONALIZED sin profe fuerza canCreateOwnRoutines

- **GIVEN** una `JoinRequest` pendiente con `teacherId = T1`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { teacherId: null, canCreateOwnRoutines: false } })`
- **THEN** el `User` creado tiene `studentType = PERSONALIZED`, `teacherId = null`, `canCreateOwnRoutines = true` (el `false` de overrides se ignora porque no hay profe)
- **AND** el `JoinRequest` queda con `teacherId = null`

#### Scenario: PERSONALIZED con profe respeta canCreateOwnRoutines

- **GIVEN** una `JoinRequest` pendiente con `teacherId = null`
- **WHEN** el admin invoca `approveJoinRequest({ requestId, overrides: { teacherId: T1, canCreateOwnRoutines: true } })`
- **THEN** el `User` creado tiene `teacherId = T1` y `canCreateOwnRoutines = true`
- **AND** SHALL crearse la asociación `TeacherStudent(teacherId=T1, studentId=userCreado.id)`
- **AND** el `JoinRequest` queda con `teacherId = T1`

#### Scenario: Override de teacherId a uno de otro gym

- **GIVEN** una `JoinRequest` del gym A
- **WHEN** el admin del gym A invoca `approveJoinRequest({ requestId, overrides: { teacherId: <id de un TEACHER del gym B> } })`
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

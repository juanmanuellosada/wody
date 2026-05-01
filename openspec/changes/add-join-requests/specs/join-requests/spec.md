## ADDED Requirements

### Requirement: Form público de auto-registro por gym

El sistema SHALL exponer una página pública en `/{gymSlug}/invitarme` con un form que recibe `name`, `email`, `password`, `passwordConfirmation`, `teacherId` (opcional), y un campo honeypot oculto. La página NO SHALL requerir sesión. El proxy de Next.js SHALL incluir esta ruta en su lista de rutas públicas.

#### Scenario: Acceso anónimo al form

- **GIVEN** un gym `atlas-gym` existe
- **WHEN** un visitante anónimo abre `/atlas-gym/invitarme`
- **THEN** el sistema renderiza el form con todos los campos visibles excepto el honeypot
- **AND** NO redirige a `/login`

#### Scenario: Gym inexistente

- **WHEN** un visitante abre `/{slug}/invitarme` con un slug que no existe
- **THEN** el sistema responde 404

#### Scenario: Honeypot completado por bot

- **GIVEN** el form tiene un campo honeypot oculto vía CSS
- **WHEN** un submit llega con el honeypot no vacío
- **THEN** el sistema responde "solicitud recibida" sin crear ningún `JoinRequest`

### Requirement: Validación del form

La server action `submitJoinRequest({ gymSlug, name, email, password, passwordConfirmation, teacherId?, honeypot })` SHALL validar:

- `name` no vacío y máximo 200 caracteres.
- `email` con formato válido (regex básico).
- `password` mínimo 6 caracteres.
- `password === passwordConfirmation`.
- `teacherId` si vino, debe pertenecer al mismo gym y tener `role = TEACHER` o `role = ADMIN`.

Si la validación falla, SHALL devolver `{ ok: false, error: <mensaje específico> }` para que la UI lo renderice en el form. Las fallas de validación NO SHALL crear `JoinRequest`.

#### Scenario: Password corta

- **WHEN** el submit llega con `password = "abc"`
- **THEN** el sistema devuelve `{ ok: false, error: "La contraseña debe tener al menos 6 caracteres" }`

#### Scenario: Passwords no coinciden

- **WHEN** `password !== passwordConfirmation`
- **THEN** el sistema devuelve `{ ok: false, error: "Las contraseñas no coinciden" }`

#### Scenario: Teacher de otro gym

- **WHEN** `teacherId` apunta a un user que pertenece a otro gym
- **THEN** el sistema devuelve `{ ok: false, error: "Profe inválido" }` y NO crea la request

### Requirement: Anti-enumeration en el submit

Si la validación pasa pero el `email` ya existe en `User` del mismo gym o ya hay un `JoinRequest` con `status = PENDING` para ese `(gymId, email)`, el sistema SHALL devolver el mismo objeto `{ ok: true }` que devuelve un submit exitoso, y la UI SHALL mostrar el mismo mensaje "Solicitud recibida, te avisamos por mail cuando el admin la apruebe". Internamente, el sistema NO SHALL crear un nuevo `JoinRequest` en estos casos.

#### Scenario: Email ya existe como User aprobado

- **GIVEN** existe un `User` con `email = a@b.com` en el gym G
- **WHEN** un visitante envía `submitJoinRequest({ gymSlug = G.slug, email = "a@b.com", ... })`
- **THEN** el sistema devuelve `{ ok: true }`
- **AND** NO crea un nuevo `JoinRequest`

#### Scenario: JoinRequest pendiente para el mismo email

- **GIVEN** existe un `JoinRequest` con `status = PENDING`, `gymId = G.id`, `email = a@b.com`
- **WHEN** llega un nuevo submit con el mismo email
- **THEN** el sistema devuelve `{ ok: true }`
- **AND** NO crea un segundo `JoinRequest` pendiente

#### Scenario: JoinRequest rechazada anteriormente

- **GIVEN** existe un `JoinRequest` con `status = REJECTED`, `gymId = G.id`, `email = a@b.com`
- **WHEN** llega un nuevo submit con el mismo email
- **THEN** el sistema crea un nuevo `JoinRequest` con `status = PENDING` (permite reintentos después de rechazo)
- **AND** devuelve `{ ok: true }`

### Requirement: Persistencia con password hasheada

Cuando la validación pasa y no hay conflicto, el sistema SHALL crear un `JoinRequest` con: `gymId`, `name`, `email`, `passwordHash` (bcryptjs con 10 rounds, mismo que `User.password`), `teacherId?`, `status = PENDING`, `createdAt = now()`. La password en plain text NO SHALL persistirse en ningún log ni column.

#### Scenario: Submit válido

- **GIVEN** un form completo válido
- **WHEN** el submit pasa todas las validaciones y no hay conflicto
- **THEN** el sistema crea un `JoinRequest` con todos los campos requeridos y `passwordHash = bcrypt.hash(password, 10)`
- **AND** devuelve `{ ok: true }`

### Requirement: Sección admin de invitaciones

El sistema SHALL exponer `/{gymSlug}/admin/invitaciones` accesible solo para `role = ADMIN` del gym. La página SHALL listar `JoinRequest` con tabs "Pendientes" (default), "Aprobadas", "Rechazadas". Cada fila muestra `name`, `email`, `teacher.name` si está, `createdAt` formateado en es-AR. En filas pendientes SHALL renderizar botones "Aprobar" y "Rechazar". En filas aprobadas o rechazadas SHALL mostrar `reviewedAt` y el nombre del admin que revisó.

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

### Requirement: URL pública compartible

La sección admin SHALL mostrar arriba de la lista un input read-only con la URL completa del form público (`https://www.wody.com.ar/{gymSlug}/invitarme`) y un botón "Copiar" que copia esa URL al portapapeles del admin.

#### Scenario: Copiar al portapapeles

- **WHEN** el admin clickea "Copiar"
- **THEN** la UI copia la URL al portapapeles
- **AND** muestra feedback temporal "Copiado" durante ~2 segundos

### Requirement: Aprobación crea User

La server action `approveJoinRequest({ requestId })` SHALL: validar que el caller es ADMIN del mismo gym de la request; verificar que la request está `PENDING`; crear un `User` con `name`, `email`, `gymId` de la request, `password = passwordHash` de la request (sin re-hashear), `role = STUDENT`, `teacherId` de la request si existe (creando la asociación de `TeacherStudent` si el modelo lo requiere); marcar la request `APPROVED` con `reviewedAt = now()` y `reviewedById = caller.id`; invocar `sendEmail` con `JoinApprovedEmail` al `email` de la request. Toda la operación SHALL ser atómica: si la creación del user falla por unique constraint `(email, gymId)`, la request NO se actualiza y el admin recibe error.

#### Scenario: Aprobación exitosa

- **GIVEN** una `JoinRequest` con `status = PENDING` en el gym G y un caller ADMIN del gym G
- **WHEN** el admin clickea "Aprobar"
- **THEN** el sistema crea un `User` con los datos de la request
- **AND** marca la request `APPROVED`
- **AND** envía mail "cuenta aprobada" al email de la request
- **AND** la UI refresca la lista (la fila desaparece de "Pendientes" y aparece en "Aprobadas")

#### Scenario: Email ya existe en User

- **GIVEN** una `JoinRequest` válida pero entre que llegó y fue aprobada se creó un `User` con el mismo email en ese gym (otro flujo)
- **WHEN** el admin aprueba
- **THEN** la creación del User falla con conflict
- **AND** la request queda `PENDING` (no se actualiza)
- **AND** el admin recibe error "Ya existe un usuario con ese email en el gym. Rechazá la solicitud manualmente."

#### Scenario: ADMIN de otro gym

- **WHEN** un ADMIN del gym A invoca `approveJoinRequest({ requestId })` con un `requestId` del gym B
- **THEN** la operación se rechaza por aislamiento multi-tenant
- **AND** la request queda intacta

#### Scenario: Aprobar request ya procesada

- **GIVEN** una `JoinRequest` con `status = APPROVED` o `REJECTED`
- **WHEN** el admin invoca `approveJoinRequest`
- **THEN** el sistema rechaza la operación con `{ ok: false, error: "Esta solicitud ya fue procesada" }`

### Requirement: Rechazo silencioso

La server action `rejectJoinRequest({ requestId })` SHALL: validar caller ADMIN del mismo gym; verificar status `PENDING`; marcar la request `REJECTED` con `reviewedAt = now()` y `reviewedById = caller.id`. NO SHALL enviar mail al alumno. NO SHALL borrar el row.

#### Scenario: Rechazo exitoso

- **GIVEN** una `JoinRequest` `PENDING` y un ADMIN del mismo gym
- **WHEN** el admin clickea "Rechazar"
- **THEN** la request queda `REJECTED` con `reviewedById` y `reviewedAt`
- **AND** NO se envía mail
- **AND** la fila aparece en la tab "Rechazadas"

#### Scenario: Rechazo permite reintento del alumno

- **GIVEN** una request del alumno X fue rechazada
- **WHEN** el alumno X envía un nuevo submit con los mismos datos
- **THEN** se crea una nueva request `PENDING` (no se reactiva la rechazada)

### Requirement: Mail de cuenta aprobada

El sistema SHALL tener un template `JoinApprovedEmail` que: usa `EmailLayout` (con branding del gym + logo de Wody en footer), saluda al alumno por nombre, anuncia que la cuenta fue aprobada, e incluye un link al login del gym (`{APP_URL}/{gymSlug}/login`). El subject SHALL ser `"Cuenta aprobada en {gym.name}"`. El `EmailLogType` `JOIN_APPROVED` SHALL existir y contar para la cuota mensual de Resend.

#### Scenario: Render del mail

- **GIVEN** una request aprobada para el alumno Lucía en el gym Atlas
- **WHEN** el sistema renderiza `JoinApprovedEmail`
- **THEN** el HTML contiene el nombre "Lucía", el nombre "Atlas", el link al login con slug correcto
- **AND** el footer tiene el logo de Wody en negro

#### Scenario: Logging del envío

- **WHEN** el mail se envía exitosamente
- **THEN** el sistema crea un row en `EmailLog` con `type = JOIN_APPROVED`, `status = SENT`, `gymId`, `to`, `resendId`

### Requirement: Badge de pendientes en navbar

La navbar del admin SHALL mostrar un badge con el count de `JoinRequest` con `status = PENDING` y `gymId` del admin. El badge SHALL aparecer al lado del item "Invitaciones" del menú (o equivalente). El count SHALL ser un read-only del server, refrescado en cada navegación (no requiere realtime).

#### Scenario: Hay pendientes

- **GIVEN** existen 3 `JoinRequest` `PENDING` en el gym G
- **WHEN** un ADMIN del gym G abre cualquier página
- **THEN** la navbar muestra "Invitaciones" con badge "3"

#### Scenario: No hay pendientes

- **GIVEN** no hay requests pendientes
- **WHEN** un ADMIN abre la página
- **THEN** la navbar muestra "Invitaciones" sin badge (o con un cero discreto, según diseño visual)

#### Scenario: Solo ADMIN ve el badge

- **GIVEN** un TEACHER o STUDENT con sesión
- **WHEN** abre la página
- **THEN** el item "Invitaciones" NO aparece en la navbar (es ADMIN-only)

### Requirement: Solo crea STUDENTs

El form público NO SHALL exponer un selector de rol. Toda `JoinRequest` aprobada SHALL crear un `User` con `role = STUDENT` independientemente de cualquier campo del request.

#### Scenario: Tampering de rol

- **WHEN** un atacante intenta enviar `role = "ADMIN"` en el form (vía dev tools o curl directo)
- **THEN** el sistema ignora el campo y crea (en aprobación) un STUDENT

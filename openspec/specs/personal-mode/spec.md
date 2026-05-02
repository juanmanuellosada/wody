# personal-mode Specification

## Purpose
TBD - created by archiving change add-personal-mode. Update Purpose after archive.
## Requirements
### Requirement: Tenant `PERSONAL` único y compartido

El sistema SHALL incorporar un nuevo valor `PERSONAL` al enum `GymKind`. SHALL existir exactamente UNA fila en la tabla `Gym` con `kind = PERSONAL` y `slug = "personal"`. Todos los `User` que se registren por el flujo de modo personal SHALL apuntar su `gymId` a esa fila.

El sistema NO SHALL permitir crear más de un `Gym` con `kind = PERSONAL`. La creación de gyms con `kind` distinto a `PERSONAL` NO SHALL aceptar el slug `"personal"`.

#### Scenario: Inicialización del gym personal por seed

- **GIVEN** un entorno donde no existe ninguna fila `Gym` con `kind = PERSONAL`
- **WHEN** se ejecuta el seed `prisma/seed-personal.ts`
- **THEN** el sistema crea una fila `Gym` con `kind = PERSONAL`, `slug = "personal"`, `name = "Wody Personal"`
- **AND** el seed es idempotente: ejecutarlo de nuevo no crea una segunda fila ni falla

#### Scenario: Intento de crear un segundo gym personal

- **WHEN** un seed o action intenta crear una segunda fila `Gym` con `kind = PERSONAL`
- **THEN** el sistema rechaza la operación con error explícito (no la ignora silenciosamente)

#### Scenario: Intento de crear un gym tradicional con slug reservado

- **WHEN** un seed o action intenta crear un `Gym` con `kind` distinto a `PERSONAL` y `slug = "personal"` (u otro slug en la lista de reservados)
- **THEN** el sistema rechaza la operación con error explícito

---

### Requirement: Whitelist de acceso al modo personal

El sistema SHALL mantener una tabla `PersonalAccessWhitelist` con los emails autorizados a registrarse en el modo personal. Cada fila SHALL tener `email` único (en lowercase), `note` opcional, `createdAt`, `createdById` opcional, `consumedAt` opcional.

Solo emails presentes en `PersonalAccessWhitelist` con `consumedAt = null` SHALL poder consumir el flujo de registro personal y dar lugar a la creación de un `User`. Los emails que ya fueron consumidos (`consumedAt != null`) NO SHALL volver a generar un nuevo `User` aunque el formulario se reenvíe.

#### Scenario: Email autorizado y no consumido

- **GIVEN** un email `e@e.com` con fila en `PersonalAccessWhitelist` y `consumedAt = null`
- **WHEN** un operador llama a la lógica de creación con ese email
- **THEN** el sistema crea el `User` y marca `consumedAt = now()` para esa fila de whitelist en la misma transacción

#### Scenario: Email no presente en la whitelist

- **GIVEN** un email `x@x.com` que no tiene fila en `PersonalAccessWhitelist`
- **WHEN** un operador llama a la lógica de creación con ese email
- **THEN** el sistema NO crea ningún `User`
- **AND** NO crea ninguna fila en `PersonalAccessWhitelist`
- **AND** NO envía ningún email

#### Scenario: Email ya consumido

- **GIVEN** un email `e@e.com` con fila en `PersonalAccessWhitelist` y `consumedAt != null`
- **WHEN** un operador llama a la lógica de creación con ese email
- **THEN** el sistema NO crea un nuevo `User`
- **AND** NO modifica `consumedAt`

---

### Requirement: Flujo público de registro personal con anti-enumeración

El sistema SHALL exponer un endpoint público (server action `submitPersonalRegistration`) en `/registro-personal` que recibe `name`, `email`, `password`. El action SHALL responder **siempre** con el mismo resultado de éxito (`{ ok: true }`) y el mismo mensaje al usuario, independientemente de si el email está o no en la whitelist, ya fue consumido, o falló alguna validación interna posterior a las validaciones de formato.

Las validaciones de formato (email válido, password >= 6 chars, password y confirmación coinciden, honeypot vacío) SHALL ejecutarse antes y SHALL devolver errores de formato visibles al usuario (no se cubren bajo el blindaje anti-enumeración).

El envío del email de confirmación SHALL ejecutarse asincrónicamente (fuera del path de respuesta al cliente) para evitar señales de timing observables entre la rama "email autorizado" y "email no autorizado".

#### Scenario: Submit con email autorizado

- **GIVEN** un email `e@e.com` en la whitelist con `consumedAt = null`
- **WHEN** el usuario envía el formulario con `name`, `email = e@e.com`, `password` válido y confirmación coincidente
- **THEN** el sistema crea un `User` (ver Requirement: Forma del User personal)
- **AND** marca la entrada de whitelist como consumida
- **AND** genera un `VerificationToken` tipo `INVITE` asociado al User
- **AND** encola el envío del email de bienvenida con el link de confirmación
- **AND** responde al cliente con `{ ok: true }` y el mensaje uniforme de éxito

#### Scenario: Submit con email no autorizado

- **WHEN** el usuario envía el formulario con un email que no está en la whitelist
- **THEN** el sistema NO crea ningún User ni token ni email
- **AND** responde al cliente con `{ ok: true }` y exactamente el mismo mensaje uniforme de éxito que en el caso autorizado

#### Scenario: Submit con email autorizado pero ya consumido

- **WHEN** el usuario envía el formulario con un email cuya entrada de whitelist tiene `consumedAt != null`
- **THEN** el sistema NO crea un nuevo User
- **AND** responde al cliente con `{ ok: true }` y el mismo mensaje uniforme de éxito

#### Scenario: Submit con datos de formato inválido

- **WHEN** el usuario envía el formulario con email malformado, o password < 6 chars, o passwords que no coinciden, o honeypot populado
- **THEN** el sistema rechaza la operación devolviendo el error de formato específico (excepto honeypot, que devuelve éxito uniforme silenciosamente)
- **AND** NO consulta la whitelist ni crea registros

---

### Requirement: Forma del `User` creado por el flujo personal

Cuando el sistema crea un `User` desde el flujo de registro personal, el registro SHALL tener:

- `gymId = <id del único gym personal>`
- `role = STUDENT`
- `studentType = PERSONALIZED`
- `canCreateOwnRoutines = true`
- `password` seteado al hash bcrypt de la contraseña recibida en el formulario
- `emailVerifiedAt = null` (hasta que el usuario consume el token de confirmación)
- `nextPaymentDate = '9999-12-31'` (fecha tope que evita disparar bloqueo automático por cuota vencida)
- `memberNumber` asignado por el contador `Gym.nextMemberNumber` del gym personal, igual que cualquier otro alta
- `teacherId = null` (no aplica)
- `groupId = null` (no aplica)
- `blockedAt = null`
- `deletedAt = null`

#### Scenario: Defaults aplicados al crear User personal

- **WHEN** el sistema crea un `User` por el flujo personal (email autorizado, no consumido)
- **THEN** todos los campos listados arriba toman los valores indicados
- **AND** la fila se persiste en una transacción que también incrementa `Gym.nextMemberNumber` y marca la whitelist como consumida

---

### Requirement: Confirmación de cuenta personal por token

El sistema SHALL exponer una página `/registro-personal/confirmar/[token]` que recibe un `VerificationToken` tipo `INVITE` y lo consume marcando `User.emailVerifiedAt = now()`. El consumo SHALL revocar el token (no reusable) y redirigir al usuario a `/login`.

Si el token no existe, está expirado, o ya fue consumido, el sistema SHALL mostrar un mensaje de error y un link para reintentar el registro en `/registro-personal`. El sistema NO SHALL crear un nuevo User en esta ruta — solo activa uno preexistente.

#### Scenario: Confirmación exitosa

- **GIVEN** un User personal con `emailVerifiedAt = null` y un `VerificationToken` válido y no consumido
- **WHEN** el usuario accede a `/registro-personal/confirmar/{token}`
- **THEN** el sistema setea `User.emailVerifiedAt = now()`
- **AND** revoca el token
- **AND** redirige a `/login`

#### Scenario: Token inválido o expirado

- **WHEN** el usuario accede a `/registro-personal/confirmar/{token}` con un token inexistente, expirado o ya consumido
- **THEN** el sistema muestra un mensaje de error
- **AND** ofrece un link a `/registro-personal` para reintentar
- **AND** NO crea ni modifica ningún User

---

### Requirement: Login y autenticación de usuarios personales

El usuario personal SHALL poder loguearse vía el flujo de credenciales existente de NextAuth (`/login`), usando email + password. La sesión resultante SHALL incluir `gymSlug = "personal"` y reflejar `gym.kind = PERSONAL` en cualquier consumidor que lo necesite.

El sistema NO SHALL bloquear el login del usuario personal por cuota vencida (la fecha tope `9999-12-31` garantiza que nunca se cumpla la condición de `nextPaymentDate + autoBlockAfterDays < now()`).

El sistema SHALL bloquear el login del usuario personal si `emailVerifiedAt = null` (no completó la confirmación). En ese caso devuelve un error que indica que debe revisar su email.

#### Scenario: Login con cuenta confirmada

- **GIVEN** un User personal con `password` seteado y `emailVerifiedAt != null`
- **WHEN** el usuario envía email + password al endpoint de login
- **THEN** NextAuth crea sesión con `gymSlug = "personal"`, `role = STUDENT`, `canCreateOwnRoutines = true`

#### Scenario: Login con cuenta no confirmada

- **GIVEN** un User personal con `password` seteado y `emailVerifiedAt = null`
- **WHEN** el usuario envía email + password al endpoint de login
- **THEN** el sistema rechaza el login con un mensaje que indica que debe confirmar su cuenta vía el email recibido

---

### Requirement: UI del modo personal — secciones visibles y ocultas

Cuando un usuario está logueado y `gym.kind === "PERSONAL"`, la UI SHALL mostrar **únicamente** estas secciones de navegación:

- "Mis WODs" (rutinas que el propio usuario crea y edita)
- "Mis RMs"
- "Cronómetros"
- "Beneficios" (link a la sección de cupones)

La UI NO SHALL mostrar para usuarios personales:

- Panel Admin
- Invitaciones (join requests)
- Dashboard Profe
- Pagos
- Ingresos / Control de accesos / Historial
- "Mi WOD" (la rutina del día asignada por un profe)
- WhatsApp FAB
- PaymentStatusBanner

#### Scenario: Navbar de un usuario personal

- **GIVEN** un User logueado con `gym.kind === "PERSONAL"`
- **WHEN** se renderiza el Navbar
- **THEN** el menú contiene exactamente los items "Mis WODs", "Mis RMs", "Cronómetros", "Beneficios"
- **AND** NO contiene Admin, Invitaciones, Dashboard Profe, Pagos, Ingresos, ni "Mi WOD"

#### Scenario: Layout de un usuario personal

- **GIVEN** un User logueado con `gym.kind === "PERSONAL"` viendo cualquier página de `/personal/*`
- **THEN** NO se renderiza `PaymentStatusBanner`
- **AND** NO se renderiza `WhatsAppFab`

#### Scenario: Navbar de un usuario de gym tradicional no se ve afectado

- **GIVEN** un User logueado con `gym.kind === "GYM"` o `"BOX"`
- **WHEN** se renderiza el Navbar
- **THEN** el menú es idéntico al comportamiento previo a la introducción del modo personal (sin regresiones)

---

### Requirement: Creación de rutinas y RMs por un usuario personal

El sistema SHALL permitir a un User personal (`role = STUDENT`, `canCreateOwnRoutines = true`, `gym.kind = PERSONAL`) ejecutar las server actions `createWod`, `updateWod`, `deleteWod`, `createRm`, `updateRm`, `deleteRm` para sus propios WODs y RMs.

Para `createWod` invocado por un usuario personal:
- `teacherId` SHALL ser el `id` del propio User personal (es autor de su rutina).
- `targetType` SHALL ser `STUDENT` y `targetStudentId` SHALL ser el `id` del propio User personal.
- Las validaciones existentes que requieren rol `TEACHER` o `ADMIN` SHALL aceptar al STUDENT cuando `canCreateOwnRoutines = true` (este branch ya existe en el código actual; verificar no regresar).

#### Scenario: Usuario personal crea una rutina propia

- **GIVEN** un User personal logueado
- **WHEN** invoca `createWod({ title, content, date })`
- **THEN** el sistema crea un `Wod` con `teacherId = user.id`, `targetType = "STUDENT"`, `targetStudentId = user.id`, `deletedAt = null`

#### Scenario: Usuario personal crea un RM propio

- **WHEN** un User personal invoca `createRm({ exercise, weight, date })`
- **THEN** el sistema crea un `RM` con `studentId = user.id`

#### Scenario: Usuario personal NO puede operar sobre WODs/RMs ajenos

- **GIVEN** un User personal A y otro User personal B
- **WHEN** A intenta `updateWod`, `deleteWod`, `updateRm` o `deleteRm` sobre filas cuyo `teacherId` o `studentId` es B
- **THEN** el sistema rechaza la operación

---

### Requirement: Gestión de la whitelist por DB

La gestión de `PersonalAccessWhitelist` (alta, baja, listado de emails) SHALL realizarse exclusivamente vía operaciones directas sobre la base de datos. NO SHALL existir UI ni server actions para administrar la whitelist desde la app en este alcance.

#### Scenario: Operador agrega email vía DB

- **GIVEN** un operador con acceso a la base de datos
- **WHEN** inserta una fila en `PersonalAccessWhitelist` con un email único en lowercase
- **THEN** ese email queda autorizado a completar el flujo de registro personal (ver Requirement: Flujo público de registro personal con anti-enumeración)

#### Scenario: Operador remueve email vía DB

- **GIVEN** un email en la whitelist
- **WHEN** el operador borra la fila
- **THEN** el User personal asociado (si fue creado a partir de esa entrada) sigue existiendo y operativo


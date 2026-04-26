## ADDED Requirements

### Requirement: Alta de alumnos sin contraseña manual

La server action `createUser` SHALL crear un usuario sin contraseña (`User.password = null`) y SHALL emitir un mail de invitación con un link único hacia `/{gymSlug}/activar?token=xxx`. La action NO SHALL aceptar un campo `password` en su input. El alumno define su contraseña recién en el flujo de activación.

#### Scenario: Alta exitosa de alumno

- **GIVEN** un ADMIN autenticado en el gym G
- **WHEN** invoca `createUser` con `name`, `email`, `role = STUDENT`, sin `password`
- **THEN** el sistema crea el `User` con `password = null` y `emailVerifiedAt = null`
- **AND** crea un `VerificationToken` con `userId`, `tokenHash` (sha256 del token plano), `type = INVITE`, `expiresAt = now + 7 días`, `consumedAt = null`
- **AND** llama a `sendEmail` con el template `InviteEmail` y el link `/{gymSlug}/activar?token={tokenPlano}`

#### Scenario: Email duplicado dentro del mismo gym

- **WHEN** un ADMIN intenta crear un alumno con un email que ya existe en su gym (ya sea con o sin contraseña seteada)
- **THEN** el sistema rechaza la operación con error explícito y NO crea token ni envía mail

#### Scenario: Falla de envío de mail

- **GIVEN** Resend devuelve error al enviar la invitación
- **WHEN** se completa la transacción de `createUser`
- **THEN** el `User` y el `VerificationToken` quedan creados (no se rollbackean)
- **AND** la UI muestra "Usuario creado pero el mail de invitación no se pudo enviar — usá Reenviar invitación"

### Requirement: Activación de cuenta con token

La página `/{gymSlug}/activar?token=xxx` SHALL validar el token y permitir al usuario setear su contraseña inicial. La server action `activateAccount({ token, password })` SHALL aceptar el token solo si: existe en la base con `tokenHash = sha256(token)`, `type = INVITE`, `consumedAt = null`, `expiresAt > now()`, y el `User` asociado pertenece al gym del slug.

#### Scenario: Activación exitosa

- **GIVEN** un token válido y no consumido
- **WHEN** el usuario submite el form con `password` (mínimo 6 caracteres)
- **THEN** el sistema setea `User.password = hash(password, 10)`, `User.emailVerifiedAt = now()`
- **AND** marca el token como consumido (`consumedAt = now()`)
- **AND** redirige al login del gym con un flash message "Cuenta activada, iniciá sesión"

#### Scenario: Token expirado

- **GIVEN** un token con `expiresAt < now()`
- **WHEN** el usuario abre `/{gymSlug}/activar?token=xxx`
- **THEN** la página muestra "Este link expiró. Pedile a tu admin que reenvíe la invitación"
- **AND** NO permite setear contraseña

#### Scenario: Token ya consumido

- **GIVEN** un token con `consumedAt != null`
- **WHEN** el usuario intenta usarlo de nuevo
- **THEN** la página muestra "Este link ya fue usado. Si olvidaste tu contraseña, usá 'Olvidé mi contraseña' en el login"

#### Scenario: Token inexistente o malformado

- **WHEN** el usuario abre `/{gymSlug}/activar?token=basura` o sin token
- **THEN** la página muestra "Link inválido" y NO permite setear contraseña

#### Scenario: Token de otro gym

- **GIVEN** un token válido cuyo usuario pertenece al gym A
- **WHEN** alguien lo intenta usar en `/{gymSlug=B}/activar?token=xxx`
- **THEN** el sistema rechaza la activación como link inválido (no se filtra que el token sea de otro gym)

### Requirement: Reset de contraseña self-service

La server action `requestPasswordReset({ gymSlug, email })` SHALL responder éxito al cliente independientemente de si el email existe en el gym. Si el `(email, gymId)` existe, SHALL invalidar tokens RESET previos no consumidos del mismo usuario, generar un nuevo `VerificationToken` con `type = RESET`, `expiresAt = now + 1 hora`, y enviar un mail con link a `/{gymSlug}/recuperar?token=xxx`. Si no existe, SHALL hacer nada y devolver el mismo éxito.

#### Scenario: Email existente en el gym

- **GIVEN** un `User` con `email = a@b.com` en el gym G
- **WHEN** el sistema recibe `requestPasswordReset({ gymSlug = G.slug, email = "a@b.com" })`
- **THEN** invalida cualquier token RESET activo previo del usuario (marca `consumedAt = now()`)
- **AND** crea un nuevo `VerificationToken` (type RESET, expira en 1h)
- **AND** envía el mail
- **AND** devuelve éxito al cliente

#### Scenario: Email inexistente en el gym

- **WHEN** el sistema recibe `requestPasswordReset` con un email que no existe en el gym
- **THEN** NO crea token ni envía mail
- **AND** devuelve el mismo objeto de éxito que el caso existente (anti-enumeration)

#### Scenario: Mismo email en otro gym

- **GIVEN** un `User a@b.com` existe en el gym A pero no en B
- **WHEN** el sistema recibe `requestPasswordReset({ gymSlug = "B", email = "a@b.com" })`
- **THEN** NO genera token ni envía mail
- **AND** devuelve éxito (anti-enumeration)

#### Scenario: Rate limit por email

- **GIVEN** ya se enviaron 5 requests de reset para el mismo `(email, gymId)` en la última hora
- **WHEN** llega un sexto request
- **THEN** el sistema NO envía nuevo mail
- **AND** sigue devolviendo éxito al cliente (no se filtra el límite)

### Requirement: Aplicación de la nueva contraseña en reset

La página `/{gymSlug}/recuperar?token=xxx` SHALL validar el token (igual que activación, pero con `type = RESET`) y permitir definir una nueva contraseña. La server action `resetPassword({ token, password })` SHALL setear `User.password = hash(password, 10)`, marcar el token como consumido, y dejar `emailVerifiedAt` sin tocar (no es una activación).

#### Scenario: Reset exitoso

- **GIVEN** un token RESET válido
- **WHEN** el usuario submite la nueva password
- **THEN** se actualiza el hash y se redirige al login con flash "Contraseña actualizada"

#### Scenario: Token RESET expirado o consumido

- **GIVEN** un token RESET con `expiresAt < now()` o `consumedAt != null`
- **WHEN** el usuario abre la página
- **THEN** muestra "Link inválido o expirado, pedí uno nuevo"

### Requirement: Login bloquea usuarios sin contraseña

El callback `authorize` de NextAuth SHALL rechazar el login de cualquier `User` con `password = null`, devolviendo un error code `PENDING_ACTIVATION`. La página de login SHALL detectar ese error y mostrar el mensaje "Tu invitación está pendiente. Pedile al admin que reenvíe el mail".

#### Scenario: Login con email de cuenta no activada

- **GIVEN** un `User` con `password = null`
- **WHEN** intenta hacer login con `email + password` cualquiera
- **THEN** `authorize` rechaza la sesión con `PENDING_ACTIVATION`
- **AND** la UI muestra el mensaje específico

### Requirement: Reenvío de invitación desde el panel de admin

El panel de admin SHALL exponer un botón "Reenviar invitación" en la fila de cualquier alumno con `password = null`. La server action `resendInvitation({ userId })` SHALL invalidar tokens INVITE previos no consumidos del usuario, generar uno nuevo (TTL 7 días), y enviar el mail.

#### Scenario: Reenvío exitoso

- **GIVEN** un alumno con invitación pendiente (sin password)
- **WHEN** un ADMIN del mismo gym hace click en "Reenviar invitación"
- **THEN** se invalida cualquier token INVITE previo no consumido del usuario
- **AND** se crea uno nuevo y se envía el mail
- **AND** la UI muestra "Invitación reenviada"

#### Scenario: Botón ausente para alumnos ya activos

- **WHEN** la UI renderiza un alumno con `password != null`
- **THEN** NO muestra el botón de reenvío

#### Scenario: ADMIN de otro gym

- **WHEN** un ADMIN del gym A invoca `resendInvitation` con un `userId` del gym B
- **THEN** la operación se rechaza por aislamiento multi-tenant

### Requirement: Migración no destructiva de usuarios existentes

Los `User` que ya tienen `password != null` al momento de aplicar el cambio SHALL seguir operando sin cambios: pueden iniciar sesión normalmente y NO se les fuerza activación por mail. El campo `User.emailVerifiedAt` SHALL permanecer en `null` para esos usuarios hasta que (eventualmente) usen el flujo de reset, momento en el cual queda como `null` igual (no es una activación).

#### Scenario: Login de usuario preexistente

- **GIVEN** un `User` creado antes del cambio con `password != null`
- **WHEN** inicia sesión
- **THEN** el flujo es idéntico al previo al cambio

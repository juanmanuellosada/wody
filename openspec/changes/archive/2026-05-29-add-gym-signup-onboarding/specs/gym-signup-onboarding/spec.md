## ADDED Requirements

### Requirement: Visitante puede enviar un lead desde la landing pública

El sistema SHALL exponer en la landing pública una sección de pricing con un form de contacto que cualquier visitante (sin autenticación) pueda enviar para solicitar el alta de un gym. El form SHALL solicitar como mínimo: nombre de contacto, email, nombre del gym, tipo sugerido (GYM o BOX), y opcionalmente teléfono, cantidad estimada de alumnos y un mensaje libre.

#### Scenario: Envío exitoso del form de contacto

- **WHEN** un visitante completa el form con los campos requeridos y lo envía
- **THEN** el sistema crea un registro `GymSignupRequest` con `status = PENDING`, persistiendo todos los campos del form
- **AND** el sistema dispara un email automático al visitante confirmando la recepción
- **AND** el visitante recibe un mensaje de éxito en la UI

#### Scenario: Form rechaza email duplicado en estado PENDING o APPROVED

- **WHEN** un visitante envía el form con un email que ya tiene una `GymSignupRequest` en estado `PENDING` o `APPROVED`
- **THEN** el sistema responde con éxito aparente al visitante (no informa el duplicado)
- **AND** el sistema NO crea una request nueva ni dispara email
- **AND** el sistema NO sobrescribe la request existente

#### Scenario: Rate limiting bloquea spam desde una IP

- **WHEN** una IP envía más de 5 requests al endpoint público en menos de 1 hora
- **THEN** el sistema responde `429 Too Many Requests` y no crea más registros

### Requirement: Super-admin puede ver y filtrar las signup requests

El sistema SHALL exponer una página `/admin/signup-requests` accesible solo a usuarios con `role = SUPERADMIN` que liste todas las `GymSignupRequest` con filtros por estado y ordenadas por fecha de creación descendente.

#### Scenario: Super-admin accede al panel y ve la lista

- **WHEN** un usuario con `role = SUPERADMIN` navega a `/admin/signup-requests`
- **THEN** el sistema renderiza una tabla con todas las requests, mostrando email, nombre de contacto, nombre del gym, estado, fecha de creación y un link al detalle

#### Scenario: Usuario no super-admin no puede acceder

- **WHEN** un usuario con `role != SUPERADMIN` intenta acceder a `/admin/signup-requests`
- **THEN** el sistema redirige a `/` y no expone ninguna información

#### Scenario: Filtrar por estado

- **WHEN** un super-admin selecciona el filtro "PENDING"
- **THEN** la tabla muestra solo las requests con `status = PENDING`

### Requirement: Super-admin puede aprobar una signup request

El sistema SHALL permitir al super-admin aprobar una `GymSignupRequest` que esté en estado `PENDING` o `APPROVED` (re-aprobación tras expiración). La aprobación SHALL generar un `onboardingToken` único (cuid), setear `approvedAt`, `tokenExpiresAt = now + 7 días`, cambiar `status` a `APPROVED`, y disparar el email de aprobación al dueño.

#### Scenario: Aprobación de un lead pendiente

- **WHEN** un super-admin invoca `approveSignupRequest(id)` para una request con `status = PENDING`
- **THEN** el sistema persiste `status = APPROVED`, `approvedAt = now`, `tokenExpiresAt = now + 7d`, `onboardingToken` con un nuevo cuid
- **AND** el sistema dispara el email de aprobación con el link `/onboarding/<token>` al email del lead

#### Scenario: Re-aprobación de una request expirada

- **WHEN** un super-admin aprueba una request con `status = EXPIRED`
- **THEN** el sistema genera un nuevo `onboardingToken`, actualiza `tokenExpiresAt` y vuelve a `status = APPROVED`
- **AND** dispara el email de aprobación con el nuevo link

### Requirement: Super-admin puede rechazar una signup request con email opcional

El sistema SHALL permitir al super-admin rechazar una `GymSignupRequest` con un motivo opcional (`rejectionReason`). La acción SHALL cambiar `status` a `REJECTED`, setear `rejectedAt`, y disparar un email de cortesía al lead.

#### Scenario: Rechazo con email automático

- **WHEN** un super-admin invoca `rejectSignupRequest(id, reason?)` para una request en estado `PENDING` o `APPROVED`
- **THEN** el sistema persiste `status = REJECTED`, `rejectedAt = now`, `rejectionReason` si fue provisto
- **AND** dispara el email de cortesía al email del lead, incluyendo `rejectionReason` si está disponible

### Requirement: Super-admin puede agregar entries directamente como whitelist

El sistema SHALL permitir al super-admin crear `GymSignupRequest` directamente en estado `APPROVED`, sin pasar por la fase `PENDING`. Esto cubre el caso "ya hablé con el dueño por afuera, mandale el link de onboarding". El registro SHALL llevar `createdByAdminId` apuntando al super-admin que lo creó.

#### Scenario: Creación de whitelist entry

- **WHEN** un super-admin invoca `createWhitelistEntry({ email, gymName, gymKindSuggested, contactName, message? })`
- **THEN** el sistema crea una `GymSignupRequest` con `status = APPROVED`, `createdByAdminId = currentUser.id`, `onboardingToken` nuevo, `tokenExpiresAt = now + 7d`
- **AND** dispara el email de aprobación al email indicado, igual que en un lead aprobado normal

### Requirement: Super-admin puede re-emitir el email de onboarding

El sistema SHALL permitir al super-admin re-disparar el email de aprobación de una request en estado `APPROVED` con token aún válido, sin generar un nuevo token. Si el token ya expiró, la acción de re-emisión SHALL ofrecer re-aprobar (que sí genera token nuevo).

#### Scenario: Re-emitir email con token válido

- **WHEN** un super-admin invoca `resendOnboardingEmail(id)` para una request con `status = APPROVED` y `tokenExpiresAt > now`
- **THEN** el sistema dispara el mismo email con el mismo link de onboarding, sin tocar el token ni la expiración

#### Scenario: Re-emitir con token expirado

- **WHEN** un super-admin invoca `resendOnboardingEmail(id)` para una request con `tokenExpiresAt < now`
- **THEN** el sistema rechaza la operación con un mensaje indicando que debe re-aprobar para generar un nuevo token

### Requirement: Dueño aprobado completa el onboarding con un token válido

El sistema SHALL exponer una ruta pública `/onboarding/[token]` que validate el token y permita al dueño completar la configuración inicial: slug del gym, password del primer admin, kind (GYM o BOX), opcional logo, opcional color primario. Al completar, el sistema SHALL crear `Gym` + primer `User` ADMIN + marcar la request como `COMPLETED`, todo en una sola transacción.

#### Scenario: Onboarding exitoso

- **WHEN** un dueño visita `/onboarding/<token>` con un token válido, no expirado y status `APPROVED`
- **AND** completa el form con un slug válido (único, no reservado), password >= 8 caracteres, kind seleccionado
- **AND** envía el form
- **THEN** el sistema crea, en una transacción, un `Gym` con `trialEndsAt = now + 30d`, `paymentExempt = false`, y los datos del form
- **AND** crea un `User` con `role = ADMIN`, email del lead, password hasheado, `gymId` del gym recién creado, `memberNumber = 1`
- **AND** actualiza la request a `status = COMPLETED`, `completedAt = now`, `gymId` linkeado
- **AND** auto-loguea al nuevo admin via NextAuth `signIn`
- **AND** redirige al panel `/<slug>/admin`

#### Scenario: Token inexistente o ya usado

- **WHEN** un visitante accede a `/onboarding/<token>` con un token que no existe o cuyo `status != APPROVED`
- **THEN** el sistema renderiza una página de error con mensaje "el link no es válido o ya fue utilizado" y CTA a contacto

#### Scenario: Token expirado

- **WHEN** un visitante accede a `/onboarding/<token>` con un token cuyo `tokenExpiresAt < now`
- **THEN** el sistema renderiza una página de error con mensaje "el link expiró" y CTA a contacto

#### Scenario: Slug elegido ya existe o está reservado

- **WHEN** un dueño envía el form con un slug que ya existe en `Gym` o está en `isReservedSlug`
- **THEN** el sistema rechaza el submit, mantiene el form abierto y muestra un error específico en el campo de slug

### Requirement: Cron diario expira tokens de onboarding sin uso

El sistema SHALL ejecutar dentro del cron diario `/api/cron/check-gym-trials` una fase adicional que actualice todas las `GymSignupRequest` con `status = APPROVED` y `tokenExpiresAt < now` a `status = EXPIRED`.

#### Scenario: Token expirado se marca como EXPIRED

- **WHEN** el cron diario corre
- **AND** existe una request con `status = APPROVED` y `tokenExpiresAt` en el pasado
- **THEN** el sistema actualiza `status = EXPIRED` y deja el resto de los campos intactos

#### Scenario: Token válido no se toca

- **WHEN** el cron diario corre
- **AND** existe una request con `status = APPROVED` y `tokenExpiresAt > now`
- **THEN** el sistema NO modifica el registro

### Requirement: Sistema de emails transaccionales para el funnel

El sistema SHALL disparar tres emails transaccionales según el estado de la `GymSignupRequest`:

- `lead-received`: cuando se crea una request en `PENDING` (al visitante).
- `lead-approved`: cuando se aprueba una request (al dueño, con link de onboarding).
- `lead-rejected`: cuando se rechaza una request (al lead, con `rejectionReason` si existe).

Los emails SHALL usar la infraestructura de email definida en el cambio `add-email-service`.

#### Scenario: Email "lead-received" al crear lead

- **WHEN** se crea una `GymSignupRequest` con `status = PENDING` desde el endpoint público
- **THEN** el sistema dispara un email a `email` de la request con el template `lead-received`

#### Scenario: Email "lead-approved" al aprobar

- **WHEN** una request pasa a estado `APPROVED` (vía aprobación de lead o creación de whitelist)
- **THEN** el sistema dispara un email a `email` de la request con el template `lead-approved`, incluyendo el link `/onboarding/<token>`

#### Scenario: Email "lead-rejected" al rechazar

- **WHEN** una request pasa a `REJECTED` por acción explícita del super-admin
- **THEN** el sistema dispara un email a `email` de la request con el template `lead-rejected`, incluyendo `rejectionReason` si fue provisto

### Requirement: Modelo de datos `GymSignupRequest` y enum `SignupRequestStatus`

El sistema SHALL persistir las solicitudes de alta en un nuevo modelo Prisma `GymSignupRequest` con los siguientes campos (mínimo):

- `id: String @id @default(cuid())`
- `email: String`
- `contactName: String`
- `gymName: String`
- `gymKindSuggested: String` (almacena `"GYM"` o `"BOX"`)
- `phone: String?`
- `expectedStudents: Int?`
- `message: String?`
- `status: SignupRequestStatus @default(PENDING)`
- `createdAt: DateTime @default(now())`
- `approvedAt: DateTime?`
- `rejectedAt: DateTime?`
- `completedAt: DateTime?`
- `onboardingToken: String? @unique`
- `tokenExpiresAt: DateTime?`
- `rejectionReason: String?`
- `gymId: String?` (FK opcional a `Gym`, settled cuando completed)
- `createdByAdminId: String?` (FK opcional a `User`, settled cuando creado por whitelist)

Y un nuevo enum `SignupRequestStatus { PENDING, APPROVED, REJECTED, COMPLETED, EXPIRED }`.

#### Scenario: Migración agrega la tabla sin afectar datos existentes

- **WHEN** se aplica la migración del cambio en una DB con datos productivos
- **THEN** se crea la tabla `GymSignupRequest` y el enum `SignupRequestStatus` sin tocar otras tablas
- **AND** no hay rows iniciales — la tabla queda vacía

### Requirement: Transiciones de estado válidas en `GymSignupRequest`

El sistema SHALL rechazar transiciones de estado inválidas en `GymSignupRequest`. Las transiciones válidas son:

- `PENDING → APPROVED`
- `PENDING → REJECTED`
- `APPROVED → COMPLETED`
- `APPROVED → REJECTED`
- `APPROVED → EXPIRED` (solo desde el cron)
- `EXPIRED → APPROVED` (re-aprobación con nuevo token)

#### Scenario: Intento de transición inválida es rechazado

- **WHEN** se intenta cambiar el estado de una request en `COMPLETED` a `PENDING` (u otra transición no listada)
- **THEN** la operación retorna error sin modificar el registro

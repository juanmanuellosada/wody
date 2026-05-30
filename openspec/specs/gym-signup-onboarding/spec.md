# gym-signup-onboarding Specification

## Purpose
Funnel de adquisición unificado para **gimnasios (B2B)** y **usuarios de Wody Personal (B2C)** — soporta dos tipos de leads en la misma tabla (`GymSignupRequest.type`), con form de contacto público para cada uno en la landing, revisión humana del super-admin, y dos flujos de aprobación diferenciados: para GYM se genera un token de onboarding con expiración de 7 días que lleva a un wizard de setup (`/onboarding/[token]`); para PERSONAL se promueve el email a `PersonalAccessWhitelist` y se envía link directo a `/registro-personal`. Incluye también un flujo de whitelist donde el super-admin crea entries directamente en estado `APPROVED`. Rate limiting básico por IP y 7 emails transaccionales (3 GYM + 3 PERSONAL + 1 payment-failed compartido con `gym-billing`/`personal-billing`).

## Requirements
### Requirement: Visitante puede enviar un lead desde la landing pública

El sistema SHALL exponer en la landing pública **dos secciones** de pricing con sus respectivos forms de contacto que cualquier visitante (sin autenticación) pueda enviar para solicitar el alta:

- **Sección GYM**: para gimnasios y boxes. El form SHALL solicitar como mínimo: nombre de contacto, email, nombre del gym, tipo sugerido (GYM o BOX), y opcionalmente teléfono, cantidad estimada de alumnos y un mensaje libre.
- **Sección PERSONAL**: para usuarios individuales de Wody Personal. El form SHALL solicitar como mínimo: nombre de contacto, email, y opcionalmente teléfono y un mensaje libre. NO pide nombre del gym ni kind (no aplican).

Cada submit SHALL incluir un campo `type` (`GYM` o `PERSONAL`) que el endpoint usa para discriminar el flujo de aprobación posterior.

#### Scenario: Envío exitoso del form GYM

- **WHEN** un visitante completa el form GYM con los campos requeridos y lo envía
- **THEN** el sistema crea un registro `GymSignupRequest` con `type = 'GYM'`, `status = PENDING`, persistiendo todos los campos del form (incluidos los gym-específicos)
- **AND** el sistema dispara un email automático `LEAD_RECEIVED` al visitante

#### Scenario: Envío exitoso del form PERSONAL

- **WHEN** un visitante completa el form PERSONAL con `contactName` y `email`, lo envía
- **THEN** el sistema crea un registro `GymSignupRequest` con `type = 'PERSONAL'`, `status = PENDING`, persistiendo los campos comunes y dejando los gym-específicos en `null`
- **AND** el sistema dispara un email automático `PERSONAL_LEAD_RECEIVED` al visitante

#### Scenario: Form rechaza email duplicado en estado activo (cualquier tipo)

- **WHEN** un visitante envía el form con un email que ya tiene una `GymSignupRequest` en estado `PENDING` o `APPROVED` (independientemente del tipo)
- **THEN** el sistema responde con éxito aparente al visitante (no informa el duplicado)
- **AND** el sistema NO crea una request nueva ni dispara email
- **AND** el sistema NO sobrescribe la request existente

#### Scenario: Rate limiting bloquea spam desde una IP

- **WHEN** una IP envía más de 5 requests al endpoint público en menos de 1 hora
- **THEN** el sistema responde `429 Too Many Requests` y no crea más registros

### Requirement: Super-admin puede ver y filtrar las signup requests

El sistema SHALL exponer una página `/admin/signup-requests` accesible solo a usuarios con `role = SUPERADMIN` que liste todas las `GymSignupRequest` con filtros por **estado y tipo**, y ordenadas por fecha de creación descendente.

#### Scenario: Super-admin accede al panel y ve la lista

- **WHEN** un usuario con `role = SUPERADMIN` navega a `/admin/signup-requests`
- **THEN** el sistema renderiza una tabla con todas las requests, mostrando email, nombre de contacto, **tipo** (badge GYM o PERSONAL), nombre del gym (vacío si es PERSONAL), estado, fecha de creación y un link al detalle

#### Scenario: Filtrar por tipo

- **WHEN** un super-admin selecciona el filtro "PERSONAL"
- **THEN** la tabla muestra solo las requests con `type = 'PERSONAL'`

#### Scenario: Filtrar por estado

- **WHEN** un super-admin selecciona el filtro "PENDING"
- **THEN** la tabla muestra solo las requests con `status = PENDING` (de cualquier tipo)

#### Scenario: Usuario no super-admin no puede acceder

- **WHEN** un usuario con `role != SUPERADMIN` intenta acceder a `/admin/signup-requests`
- **THEN** el sistema redirige a `/` y no expone ninguna información

### Requirement: Super-admin puede aprobar una signup request

El sistema SHALL permitir al super-admin aprobar una `GymSignupRequest` con comportamientos distintos según el `type` de la request:

**Para `type = GYM`**: genera un `onboardingToken` (cuid), setea `approvedAt`, `tokenExpiresAt = now + 7 días`, cambia `status` a `APPROVED`, y dispara el email `LEAD_APPROVED` con el link `/onboarding/<token>`.

**Para `type = PERSONAL`**: el sistema NO genera token de onboarding (`onboardingToken` queda null). En su lugar:

1. Crea una entry en `PersonalAccessWhitelist` con el email del lead, si no existe ya.
2. Setea `approvedAt`, cambia `status` a `APPROVED`.
3. Dispara el email `PERSONAL_LEAD_APPROVED` con un link a `https://wody.com.ar/registro-personal` para que el user se registre.

#### Scenario: Aprobación de un lead GYM

- **WHEN** un super-admin invoca `approveSignupRequest(id)` para una request con `type = 'GYM'` y `status = PENDING`
- **THEN** el sistema genera token, setea expiración, status APPROVED, y manda email `LEAD_APPROVED` con link `/onboarding/<token>`

#### Scenario: Aprobación de un lead PERSONAL

- **WHEN** un super-admin invoca `approveSignupRequest(id)` para una request con `type = 'PERSONAL'` y `status = PENDING`
- **THEN** el sistema crea entry en `PersonalAccessWhitelist` con el email del lead, setea `approvedAt`, status APPROVED, y manda email `PERSONAL_LEAD_APPROVED` con link a `/registro-personal`
- **AND** el `onboardingToken` y `tokenExpiresAt` quedan en null

#### Scenario: Aprobación de PERSONAL ya con email en whitelist

- **WHEN** un super-admin aprueba una request PERSONAL cuyo email ya está en `PersonalAccessWhitelist`
- **THEN** el sistema NO duplica la entry, igualmente setea `status = APPROVED` y manda el email
- **AND** el `PersonalAccessWhitelist` queda con la entry existente intacta

### Requirement: Super-admin puede rechazar una signup request con email opcional

El sistema SHALL permitir al super-admin rechazar una `GymSignupRequest` con un motivo opcional. La acción SHALL cambiar `status` a `REJECTED`, setear `rejectedAt`, y disparar un email de cortesía según el tipo de la request:

- `type = GYM` → email `LEAD_REJECTED`
- `type = PERSONAL` → email `PERSONAL_LEAD_REJECTED`

#### Scenario: Rechazo de GYM con email automático

- **WHEN** un super-admin invoca `rejectSignupRequest(id, reason?)` para una request GYM
- **THEN** el sistema persiste `status = REJECTED`, `rejectedAt`, `rejectionReason` si fue provisto, y dispara el email `LEAD_REJECTED`

#### Scenario: Rechazo de PERSONAL con email automático

- **WHEN** un super-admin invoca `rejectSignupRequest(id, reason?)` para una request PERSONAL
- **THEN** el sistema persiste `status = REJECTED`, `rejectedAt`, `rejectionReason` si fue provisto, y dispara el email `PERSONAL_LEAD_REJECTED`

### Requirement: Super-admin puede agregar entries directamente como whitelist

El sistema SHALL permitir al super-admin crear `GymSignupRequest` directamente en estado `APPROVED`, sin pasar por la fase `PENDING`. El comportamiento depende del tipo elegido en el form de creación:

- **`type = GYM`**: crea con `onboardingToken`, `tokenExpiresAt = now + 7d`, dispara email `LEAD_APPROVED`.
- **`type = PERSONAL`**: crea sin token, agrega entry a `PersonalAccessWhitelist` con el email, dispara email `PERSONAL_LEAD_APPROVED`.

#### Scenario: Creación de whitelist GYM

- **WHEN** un super-admin invoca `createWhitelistEntry({ type: 'GYM', email, gymName, gymKindSuggested, contactName, message? })`
- **THEN** el sistema crea una `GymSignupRequest` GYM en `APPROVED`, con `createdByAdminId = currentUser.id`, `onboardingToken` nuevo, `tokenExpiresAt = now + 7d`
- **AND** dispara el email `LEAD_APPROVED`

#### Scenario: Creación de whitelist PERSONAL

- **WHEN** un super-admin invoca `createWhitelistEntry({ type: 'PERSONAL', email, contactName, message? })`
- **THEN** el sistema crea una `GymSignupRequest` PERSONAL en `APPROVED`, con `createdByAdminId = currentUser.id`, sin token
- **AND** crea entry en `PersonalAccessWhitelist` con el email (si no existe)
- **AND** dispara el email `PERSONAL_LEAD_APPROVED` con link a `/registro-personal`

### Requirement: Super-admin puede re-emitir el email de onboarding

El sistema SHALL permitir al super-admin re-disparar el email de aprobación de una request en estado `APPROVED`. Para GYM, requiere token vigente (sin generar uno nuevo); si el token ya expiró, ofrece re-aprobar para generar uno nuevo. Para PERSONAL, no hay token y la re-emisión siempre funciona mientras esté en `APPROVED`.

#### Scenario: Re-emitir email GYM con token válido

- **WHEN** un super-admin invoca `resendOnboardingEmail(id)` para una request GYM con `status = APPROVED` y `tokenExpiresAt > now`
- **THEN** el sistema dispara el mismo email con el mismo link de onboarding, sin tocar el token ni la expiración

#### Scenario: Re-emitir email GYM con token expirado

- **WHEN** un super-admin invoca `resendOnboardingEmail(id)` para una request GYM con `tokenExpiresAt < now`
- **THEN** el sistema rechaza la operación con un mensaje indicando que debe re-aprobar para generar un nuevo token

#### Scenario: Re-emitir email PERSONAL

- **WHEN** un super-admin invoca `resendOnboardingEmail(id)` para una request PERSONAL en `APPROVED`
- **THEN** el sistema re-dispara `PERSONAL_LEAD_APPROVED` con el link a `/registro-personal` (sin restricción de expiración — no hay token)

### Requirement: Dueño aprobado completa el onboarding con un token válido

El sistema SHALL exponer una ruta pública `/onboarding/[token]` que valide el token y permita al dueño completar la configuración inicial del gym: slug, password del primer admin, kind (GYM o BOX), opcional logo, opcional color primario. Al completar, el sistema SHALL crear `Gym` + primer `User` ADMIN + marcar la request como `COMPLETED`, todo en una sola transacción. **Esta ruta aplica solo a leads `type = GYM`** — los leads PERSONAL no usan token, se registran vía `/registro-personal` con la whitelist.

#### Scenario: Onboarding exitoso (GYM)

- **WHEN** un dueño visita `/onboarding/<token>` con un token válido, no expirado, status `APPROVED` y `type = GYM`
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

El sistema SHALL ejecutar dentro del cron diario `/api/cron/check-gym-trials` una fase que actualice todas las `GymSignupRequest` GYM con `status = APPROVED` y `tokenExpiresAt < now` a `status = EXPIRED`. Las requests PERSONAL no tienen token y por lo tanto no se expiran por esta fase.

#### Scenario: Token GYM expirado se marca como EXPIRED

- **WHEN** el cron diario corre
- **AND** existe una request GYM con `status = APPROVED` y `tokenExpiresAt` en el pasado
- **THEN** el sistema actualiza `status = EXPIRED` y deja el resto de los campos intactos

#### Scenario: Token GYM válido no se toca

- **WHEN** el cron diario corre
- **AND** existe una request GYM con `status = APPROVED` y `tokenExpiresAt > now`
- **THEN** el sistema NO modifica el registro

#### Scenario: Request PERSONAL nunca expira

- **WHEN** el cron diario corre
- **AND** existe una request PERSONAL con `status = APPROVED` (sin `tokenExpiresAt`)
- **THEN** el sistema NO modifica el registro

### Requirement: Sistema de emails transaccionales para el funnel

El sistema SHALL disparar 6 emails transaccionales según el estado y tipo de la `GymSignupRequest`:

- **GYM**: `LEAD_RECEIVED` (al crear), `LEAD_APPROVED` (al aprobar, con link onboarding), `LEAD_REJECTED` (al rechazar).
- **PERSONAL**: `PERSONAL_LEAD_RECEIVED`, `PERSONAL_LEAD_APPROVED` (con link a `/registro-personal`), `PERSONAL_LEAD_REJECTED`.

Los emails SHALL usar la infraestructura de email del cambio `add-email-service` (`sendEmail` API + `EmailLog` persistence).

#### Scenario: Email correspondiente al crear lead

- **WHEN** se crea una `GymSignupRequest` con `status = PENDING` desde el endpoint público
- **THEN** el sistema dispara `LEAD_RECEIVED` si `type = GYM` o `PERSONAL_LEAD_RECEIVED` si `type = PERSONAL`

#### Scenario: Email correspondiente al aprobar

- **WHEN** una request pasa a estado `APPROVED`
- **THEN** el sistema dispara `LEAD_APPROVED` o `PERSONAL_LEAD_APPROVED` según `type`

#### Scenario: Email correspondiente al rechazar

- **WHEN** una request pasa a `REJECTED` por acción explícita del super-admin
- **THEN** el sistema dispara `LEAD_REJECTED` o `PERSONAL_LEAD_REJECTED` según `type`, incluyendo `rejectionReason` si fue provisto

### Requirement: Modelo de datos `GymSignupRequest` y enum `SignupRequestStatus`

El sistema SHALL persistir las solicitudes de alta en el modelo Prisma `GymSignupRequest` con (mínimo):

- `id: String @id @default(cuid())`
- `email: String`
- `contactName: String`
- `type: SignupRequestType @default(GYM)` — discrimina el flujo
- `gymName: String?` (nullable — solo aplica a GYM)
- `gymKindSuggested: String?` (nullable — solo aplica a GYM, almacena `"GYM"` o `"BOX"`)
- `phone: String?`
- `expectedStudents: Int?` (nullable — solo aplica a GYM)
- `message: String?`
- `status: SignupRequestStatus @default(PENDING)`
- `createdAt: DateTime @default(now())`
- `approvedAt: DateTime?`
- `rejectedAt: DateTime?`
- `completedAt: DateTime?`
- `onboardingToken: String? @unique` (solo se usa para GYM)
- `tokenExpiresAt: DateTime?` (solo se usa para GYM)
- `rejectionReason: String?`
- `gymId: String?` (FK opcional a `Gym`, settled cuando GYM completa onboarding)
- `createdByAdminId: String?` (FK opcional a `User`, settled cuando creado por whitelist)

Y dos enums:
- `SignupRequestStatus { PENDING, APPROVED, REJECTED, COMPLETED, EXPIRED }`
- `SignupRequestType { GYM, PERSONAL }`

#### Scenario: Migración inicial crea la tabla sin afectar datos existentes

- **WHEN** se aplica la migración del cambio inicial
- **THEN** se crea la tabla `GymSignupRequest`, los dos enums, sin tocar otras tablas

#### Scenario: Migración de extensión PERSONAL preserva rows existentes

- **WHEN** se aplica la migración que agrega `type` y nullea `gymName`/`gymKindSuggested`
- **THEN** todas las rows existentes quedan con `type = 'GYM'` por default y mantienen sus campos gym intactos

#### Scenario: Lead PERSONAL crea row con campos gym vacíos

- **WHEN** se crea una `GymSignupRequest` desde la API con `type = 'PERSONAL'`
- **THEN** los campos `gymName`, `gymKindSuggested`, `expectedStudents`, `onboardingToken`, `tokenExpiresAt` quedan en NULL

### Requirement: Transiciones de estado válidas en `GymSignupRequest`

El sistema SHALL rechazar transiciones de estado inválidas en `GymSignupRequest`. Las transiciones válidas son:

- `PENDING → APPROVED`
- `PENDING → REJECTED`
- `APPROVED → COMPLETED` (solo para GYM — implica completar el wizard de onboarding)
- `APPROVED → REJECTED`
- `APPROVED → EXPIRED` (solo desde el cron, solo para GYM con token vencido)
- `EXPIRED → APPROVED` (re-aprobación con nuevo token, solo para GYM)

#### Scenario: Intento de transición inválida es rechazado

- **WHEN** se intenta cambiar el estado de una request en `COMPLETED` a `PENDING` (u otra transición no listada)
- **THEN** la operación retorna error sin modificar el registro

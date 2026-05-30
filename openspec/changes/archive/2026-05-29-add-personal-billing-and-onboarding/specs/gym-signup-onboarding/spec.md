## MODIFIED Requirements

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

**Para `type = GYM`** (comportamiento existente): genera un `onboardingToken` (cuid), setea `approvedAt`, `tokenExpiresAt = now + 7 días`, cambia `status` a `APPROVED`, y dispara el email `LEAD_APPROVED` con el link `/onboarding/<token>`.

**Para `type = PERSONAL`** (nuevo): el sistema NO genera token de onboarding (`onboardingToken` queda null). En su lugar:

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

- **`type = GYM`** (existente): crea con `onboardingToken`, `tokenExpiresAt = now + 7d`, dispara email `LEAD_APPROVED`.
- **`type = PERSONAL`** (nuevo): crea sin token, agrega entry a `PersonalAccessWhitelist` con el email, dispara email `PERSONAL_LEAD_APPROVED`.

#### Scenario: Creación de whitelist GYM

- **WHEN** un super-admin invoca `createWhitelistEntry({ type: 'GYM', email, gymName, gymKindSuggested, contactName, message? })`
- **THEN** el sistema crea una `GymSignupRequest` GYM en `APPROVED`, con `createdByAdminId = currentUser.id`, `onboardingToken` nuevo, `tokenExpiresAt = now + 7d`
- **AND** dispara el email `LEAD_APPROVED`

#### Scenario: Creación de whitelist PERSONAL

- **WHEN** un super-admin invoca `createWhitelistEntry({ type: 'PERSONAL', email, contactName, message? })`
- **THEN** el sistema crea una `GymSignupRequest` PERSONAL en `APPROVED`, con `createdByAdminId = currentUser.id`, sin token
- **AND** crea entry en `PersonalAccessWhitelist` con el email (si no existe)
- **AND** dispara el email `PERSONAL_LEAD_APPROVED` con link a `/registro-personal`

### Requirement: Modelo de datos `GymSignupRequest` extendido con tipo

El sistema SHALL extender el modelo `GymSignupRequest` con un campo nuevo:

- `type: SignupRequestType @default(GYM)`

Y SHALL hacer **nullable** los campos gym-específicos para que sigan siendo válidos cuando `type = PERSONAL`:

- `gymName: String?` (antes `String NOT NULL`)
- `gymKindSuggested: String?` (antes `String NOT NULL`)

Y SHALL agregar un nuevo enum `SignupRequestType { GYM, PERSONAL }`.

#### Scenario: Migración agrega type con default y rows existentes se preservan

- **WHEN** se aplica la migración que agrega `type` al modelo
- **THEN** todas las rows existentes quedan con `type = 'GYM'` por default
- **AND** los rows existentes mantienen `gymName` y `gymKindSuggested` no nulos
- **AND** los campos no-nulables que se vuelven nullable no rompen la lectura de los rows existentes

#### Scenario: Lead PERSONAL crea row con campos gym vacíos

- **WHEN** se crea una `GymSignupRequest` desde la API con `type = 'PERSONAL'`
- **THEN** los campos `gymName`, `gymKindSuggested`, `expectedStudents` quedan en NULL

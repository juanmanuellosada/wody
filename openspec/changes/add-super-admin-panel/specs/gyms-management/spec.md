## ADDED Requirements

### Requirement: Alta de gym desde el panel SUPERADMIN

El sistema SHALL exponer una operación en `/admin/gyms/new` que cree un nuevo `Gym` en la base de datos junto con un usuario `ADMIN` inicial, en una transacción atómica. La operación SHALL estar disponible solo para usuarios con `role === 'SUPERADMIN'`.

Campos requeridos en el formulario:
- `name` (string, no vacío)
- `slug` (string, kebab-case, único en la tabla `Gym`, NO igual a ninguno de los slugs reservados — al menos `"personal"`)
- `kind` (uno de `GYM` o `BOX` — `PERSONAL` NO SHALL aceptarse desde el panel; el gym personal es único y se inicializa solo por seed)
- `primaryColor` (string hex `#RRGGBB`)
- `logo` (archivo, subido a Vercel Blob; opcional pero recomendado)
- `adminEmail` (string, formato email válido)
- `adminPassword` (string, mínimo 8 caracteres)
- `adminName` (string, no vacío)

Campos opcionales:
- `subscriptionNextPaymentDate` (DateTime)
- `subscriptionMonthlyAmount` (Int, centavos ARS)
- `autoBlockAfterDays` (Int)

#### Scenario: Alta válida crea gym + admin

- **GIVEN** una sesión SUPERADMIN y un formulario válido con `name = "Nuevo Gym"`, `slug = "nuevo-gym"`, `kind = "GYM"`, `adminEmail = "admin@nuevo.com"`, `adminPassword = "secret123"`
- **WHEN** el super admin envía el formulario
- **THEN** el sistema crea una fila `Gym` con los campos provistos y `blockedAt = null`
- **AND** crea una fila `User` con `gymId = gym.id`, `role = ADMIN`, `email = adminEmail`, `password` hasheado con bcryptjs, `name = adminName`, `memberNumber = 1` (o el siguiente disponible para ese gym)
- **AND** ambas filas se persisten en una sola transacción
- **AND** el super admin queda redirigido a la lista de gyms

#### Scenario: Slug reservado rechazado

- **GIVEN** una sesión SUPERADMIN
- **WHEN** el super admin envía el formulario con `slug = "personal"`
- **THEN** el sistema rechaza la operación con un error explícito ("slug reservado")
- **AND** ningún `Gym` ni `User` se crea

#### Scenario: kind = PERSONAL rechazado

- **GIVEN** una sesión SUPERADMIN
- **WHEN** el formulario envía `kind = "PERSONAL"`
- **THEN** el sistema rechaza la operación con un error explícito ("kind PERSONAL no se crea desde el panel")
- **AND** ningún `Gym` ni `User` se crea

#### Scenario: Email del admin colisiona con un usuario existente del mismo gym

- **GIVEN** que el gym a crear tiene `slug = "test"` y no existen filas en `User` con ese gym, pero un email queda libre globalmente
- **WHEN** el sistema crea el gym y el admin en transacción
- **THEN** la inserción de `User` respeta `@@unique([email, gymId])` (vacío para ese gym nuevo) y no falla por colisión

#### Scenario: Transacción falla a mitad

- **GIVEN** una sesión SUPERADMIN y un formulario válido
- **WHEN** ocurre un error después de crear `Gym` pero antes de crear `User`
- **THEN** la transacción hace rollback completo
- **AND** ni el `Gym` ni el `User` quedan persistidos

### Requirement: Edición de gym desde el panel

El sistema SHALL permitir al SUPERADMIN editar los siguientes campos de un `Gym` existente desde `/admin/gyms/[id]`: `name`, `kind`, `logo`, `primaryColor`, `autoBlockAfterDays`, `subscriptionNextPaymentDate`, `subscriptionMonthlyAmount`, `blockedAt`. El `slug` SHALL ser inmutable después del alta.

#### Scenario: Edición de campos editables

- **GIVEN** un gym existente
- **WHEN** el super admin edita `name`, `primaryColor` y `subscriptionNextPaymentDate`, y guarda
- **THEN** el sistema actualiza esos campos
- **AND** preserva `slug`, `createdAt`, `id` y todas las relaciones

#### Scenario: Intento de cambiar slug

- **GIVEN** un gym existente con `slug = "atlas"`
- **WHEN** la server action recibe `slug = "atlas-nuevo"` para ese gym
- **THEN** el sistema ignora el campo `slug` (no lo persiste) o rechaza con error explícito
- **AND** `Gym.slug` permanece igual

#### Scenario: Bloqueo de gym

- **GIVEN** un gym existente con `blockedAt = null`
- **WHEN** el super admin lo marca como bloqueado
- **THEN** `Gym.blockedAt` queda con la fecha actual
- **AND** el gym desaparece de la landing pública
- **AND** sus usuarios siguen existiendo (no se borran)

#### Scenario: Desbloqueo de gym

- **GIVEN** un gym con `blockedAt` distinto de null
- **WHEN** el super admin lo desbloquea
- **THEN** `Gym.blockedAt` vuelve a null
- **AND** el gym reaparece en la landing

### Requirement: Eliminación de gym (soft delete)

El sistema SHALL implementar la eliminación de gyms como soft-delete vía `blockedAt`. El hard-delete NO SHALL exponerse desde el panel. Para casos excepcionales de hard-delete, el operador SHALL recurrir a la DB directamente (fuera del flujo del panel).

#### Scenario: Eliminación desde el panel

- **GIVEN** un gym con `blockedAt = null`
- **WHEN** el super admin confirma la eliminación
- **THEN** el sistema setea `Gym.blockedAt = now()`
- **AND** no borra ninguna fila relacionada (User, Wod, etc.)

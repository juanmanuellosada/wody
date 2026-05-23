## ADDED Requirements

### Requirement: ABM de `PersonalAccessWhitelist` desde el panel SUPERADMIN

El sistema SHALL exponer en `/admin/personal-whitelist` operaciones de listar, crear, editar y eliminar entradas de la tabla `PersonalAccessWhitelist`. Solo usuarios con `role === 'SUPERADMIN'` SHALL poder invocar las server actions correspondientes.

Campos manipulables desde el panel:
- `email` (string, formato email válido, único)
- `note` (string opcional)

Campos de solo lectura mostrados:
- `id`
- `createdAt`
- `consumedAt` (null si no consumida; con fecha si ya se usó para registrarse en modo personal)

#### Scenario: Listado

- **GIVEN** una sesión SUPERADMIN y tres filas en `PersonalAccessWhitelist`
- **WHEN** el super admin navega a `/admin/personal-whitelist`
- **THEN** el sistema lista las tres entradas con `email`, `note`, `createdAt`, `consumedAt`
- **AND** las entradas con `consumedAt = null` se diferencian visualmente de las consumidas

#### Scenario: Alta de entrada

- **GIVEN** una sesión SUPERADMIN
- **WHEN** el super admin envía `email = "pedro@ejemplo.com"`, `note = "amigo del gym X"`
- **THEN** el sistema crea una fila con `email`, `note`, `createdAt = now()`, `consumedAt = null`

#### Scenario: Email duplicado

- **GIVEN** una entrada existente con `email = "pedro@ejemplo.com"`
- **WHEN** el super admin intenta crear otra con el mismo email
- **THEN** el sistema rechaza la operación con error explícito
- **AND** ninguna fila nueva se crea

#### Scenario: Edición de `note`

- **GIVEN** una entrada existente
- **WHEN** el super admin edita `note` y guarda
- **THEN** el sistema actualiza `note`
- **AND** preserva `email`, `createdAt`, `consumedAt`

#### Scenario: Edición de `email` cuando la entrada ya fue consumida

- **GIVEN** una entrada con `consumedAt` distinto de null
- **WHEN** el super admin intenta cambiar `email`
- **THEN** el sistema rechaza la operación con error explícito
- **AND** `email` permanece igual

#### Scenario: Eliminación de entrada no consumida

- **GIVEN** una entrada con `consumedAt = null`
- **WHEN** el super admin confirma la eliminación
- **THEN** el sistema borra la fila

#### Scenario: Eliminación de entrada consumida

- **GIVEN** una entrada con `consumedAt` distinto de null
- **WHEN** el super admin intenta eliminarla
- **THEN** el sistema rechaza la operación con error explícito (la entrada queda como registro de auditoría del registro original)
- **AND** la fila permanece

## ADDED Requirements

### Requirement: Permiso por usuario para ver la recaudación

El sistema SHALL soportar un permiso booleano por usuario `canViewRevenue` (default `false`) que habilita ver la recaudación y el historial de pagos del gym en la sección Caja. El permiso SHALL ser semánticamente válido solo en usuarios `role = ADMIN`. En cada gym (excepto `kind = PERSONAL`) SHALL existir en todo momento al menos un `ADMIN` con `canViewRevenue = true`.

#### Scenario: Valor por defecto sembrado por gym

- **WHEN** se aplica el cambio sobre la base existente
- **THEN** en cada gym el `ADMIN` designado queda con `canViewRevenue = true`; si un gym no tiene admin designado explícito, lo recibe su `ADMIN` más antiguo (`createdAt` ascendente, no eliminado)

#### Scenario: Usuarios nuevos arrancan sin el permiso

- **WHEN** se crea un usuario
- **THEN** su `canViewRevenue` es `false` salvo asignación explícita posterior

### Requirement: Asignación y revocación de `canViewRevenue`

El sistema SHALL exponer una operación para habilitar o deshabilitar `canViewRevenue` sobre un usuario. El caller SHALL tener `role = ADMIN` y `canViewRevenue = true`. El target SHALL tener `role = ADMIN` y pertenecer al mismo `gymId` que el caller. La operación NO SHALL aceptar un target con rol distinto de `ADMIN`. Al revocar, el sistema SHALL rechazar la operación si el target es el único `ADMIN` del gym con `canViewRevenue = true`.

#### Scenario: Un admin designado habilita a otro admin

- **WHEN** un `ADMIN` con `canViewRevenue = true` habilita el permiso sobre otro `ADMIN` del mismo gym
- **THEN** el target queda con `canViewRevenue = true`

#### Scenario: Un admin designado revoca a otro admin (queda al menos uno)

- **WHEN** un `ADMIN` con `canViewRevenue = true` revoca el permiso sobre otro `ADMIN` del mismo gym y queda al menos un `ADMIN` con el permiso
- **THEN** el target queda con `canViewRevenue = false`

#### Scenario: No se puede revocar al último designado

- **WHEN** se intenta revocar `canViewRevenue` del único `ADMIN` del gym que lo tiene
- **THEN** el sistema rechaza la operación sin modificar nada

#### Scenario: Un admin sin el permiso no puede designar

- **WHEN** un `ADMIN` con `canViewRevenue = false`, un `TEACHER`, un `STUDENT`, un `ACCESS` o una request sin sesión invoca la operación
- **THEN** el sistema la rechaza sin modificar nada

#### Scenario: El target debe ser ADMIN

- **WHEN** un `ADMIN` designado intenta asignar `canViewRevenue` a un usuario cuyo `role` es `TEACHER`, `STUDENT` o `ACCESS`
- **THEN** el sistema rechaza la operación

### Requirement: Aislamiento multi-tenant de la designación de recaudación

El sistema SHALL garantizar que un `ADMIN` solo pueda asignar o revocar `canViewRevenue` sobre usuarios cuyo `gymId` coincide con el suyo.

#### Scenario: Admin del gym A apunta a un admin del gym B

- **WHEN** un `ADMIN` del gym A invoca la operación con un `userId` cuyo `gymId` es B (B ≠ A)
- **THEN** el sistema rechaza la operación sin modificar al usuario del gym B

#### Scenario: userId inexistente

- **WHEN** un `ADMIN` invoca la operación con un `userId` que no existe
- **THEN** el sistema rechaza la operación

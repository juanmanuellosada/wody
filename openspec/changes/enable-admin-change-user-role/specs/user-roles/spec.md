## ADDED Requirements

### Requirement: ADMIN puede promover a un TEACHER del mismo gym a ADMIN

El sistema SHALL exponer una operación que permita a un usuario con `role = ADMIN` cambiar el `role` de un usuario `TEACHER` del mismo `gymId` al valor `ADMIN`. La operación NO SHALL aceptar ningún rol destino distinto de `ADMIN`, ni ningún rol origen distinto de `TEACHER`.

#### Scenario: Promoción exitosa de TEACHER a ADMIN

- **GIVEN** un ADMIN A y un TEACHER T en el mismo gym, con `T.blockedAt === null`
- **WHEN** A invoca la operación pasando `T.id`
- **THEN** el sistema actualiza `T.role` a `ADMIN`
- **AND** preserva todos los demás campos de T (incluidas las filas de `TeacherStudent` donde T figura como `teacherId`, sus `Wod`, sus flags `canCreateOwnRoutines`, `studentType`, `groupId`, `memberNumber`)

#### Scenario: Operación con rol origen distinto de TEACHER

- **WHEN** un ADMIN invoca la operación sobre un usuario cuyo `role` es `ADMIN`, `STUDENT` o `ACCESS`
- **THEN** el sistema rechaza la operación con error explícito (no lo trata como no-op)

### Requirement: Caller no-ADMIN no puede promover

El sistema SHALL rechazar la operación cuando el caller no tenga `role = ADMIN`.

#### Scenario: TEACHER intenta promover a otro TEACHER

- **WHEN** un TEACHER autenticado invoca la operación
- **THEN** el sistema rechaza la operación sin modificar nada

#### Scenario: STUDENT, ACCESS o llamada sin sesión

- **WHEN** un STUDENT, un ACCESS o una request sin sesión invoca la operación
- **THEN** el sistema rechaza la operación sin modificar nada

### Requirement: Aislamiento multi-tenant

El sistema SHALL garantizar que un ADMIN solo pueda promover usuarios cuyo `gymId` coincide con el suyo.

#### Scenario: ADMIN del gym A apunta a un TEACHER del gym B

- **WHEN** un ADMIN del gym A invoca la operación con un `userId` cuyo `gymId` es B (B ≠ A)
- **THEN** el sistema rechaza la operación sin modificar al usuario del gym B

#### Scenario: `userId` inexistente

- **WHEN** un ADMIN invoca la operación con un `userId` que no existe
- **THEN** el sistema rechaza la operación

### Requirement: No promover a un usuario bloqueado

El sistema SHALL rechazar la operación cuando el target tenga `blockedAt != null`. Esto preserva la invariante implícita del sistema (sostenida por `setUserBlocked` en `src/actions/user.ts:316-351`) de que ningún ADMIN está bloqueado.

#### Scenario: Promoción de TEACHER bloqueado

- **GIVEN** un TEACHER T con `T.blockedAt != null`
- **WHEN** un ADMIN invoca la operación sobre T
- **THEN** el sistema rechaza la operación con error indicando que el usuario debe ser desbloqueado primero
- **AND** no modifica `T.role`

### Requirement: La sesión activa del usuario promovido conserva el rol previo

El sistema NO SHALL invalidar la sesión JWT activa del usuario promovido. El nuevo rol `ADMIN` SHALL reflejarse en su sesión únicamente tras el próximo login.

#### Scenario: Usuario promovido conserva sesión actual con rol anterior

- **GIVEN** un TEACHER T con sesión activa
- **WHEN** un ADMIN promueve a T a ADMIN
- **THEN** la sesión actual de T sigue exponiendo `role = TEACHER` hasta que T cierre sesión y vuelva a iniciar

### Requirement: UI del panel de admin expone el botón de promoción

El panel de administración del gym (`src/app/[gymSlug]/admin/page.tsx`) SHALL exponer un botón "Promover a admin" en cada fila de usuario cuyo rol actual sea `TEACHER`. La UI SHALL mostrar un diálogo de confirmación antes de aplicar la operación, indicando explícitamente que el cambio se reflejará en la sesión del promovido al volver a iniciar sesión.

#### Scenario: Botón visible en fila de TEACHER

- **WHEN** un ADMIN ve la lista de usuarios del gym y hay un TEACHER T en ella
- **THEN** la fila de T muestra el botón "Promover a admin"

#### Scenario: Botón ausente en filas no-TEACHER

- **WHEN** un ADMIN ve la lista de usuarios y hay un usuario con rol `ADMIN`, `STUDENT` o `ACCESS`
- **THEN** la fila de ese usuario no muestra el botón "Promover a admin"

#### Scenario: Botón deshabilitado para TEACHER bloqueado

- **GIVEN** un TEACHER T con `T.blockedAt != null` listado en el panel
- **WHEN** un ADMIN ve la fila de T
- **THEN** el botón "Promover a admin" se renderiza pero deshabilitado, con un indicador (tooltip o texto) que aclara que el usuario está bloqueado

#### Scenario: Confirmación antes de aplicar

- **WHEN** un ADMIN hace clic en "Promover a admin" sobre un TEACHER no bloqueado
- **THEN** la UI muestra un diálogo de confirmación con el nombre del target y la advertencia sobre la sesión
- **AND** la operación solo se ejecuta si el ADMIN confirma

# user-soft-delete Specification

## Purpose
TBD - created by archiving change add-user-soft-delete. Update Purpose after archive.
## Requirements
### Requirement: Modelo de soft-delete con `deletedAt`

El sistema SHALL marcar entidades `User`, `Group` y `Wod` como borradas mediante un campo `deletedAt` de tipo timestamp opcional. Una fila con `deletedAt != null` SHALL considerarse borrada lógicamente; una con `deletedAt == null` SHALL considerarse activa.

El sistema NO SHALL borrar físicamente filas de `User`, `Group` ni `Wod` desde flujos de producto. El borrado físico SHALL quedar reservado a operaciones manuales del operador sobre la base de datos.

#### Scenario: Marcado de un usuario como borrado lógicamente

- **GIVEN** un usuario `U` con `U.deletedAt == null`
- **WHEN** el sistema invoca la operación de baja de usuario sobre `U`
- **THEN** `U.deletedAt` se establece al timestamp del momento de la operación
- **AND** la fila de `U` permanece presente en la tabla `User`

#### Scenario: Restauración manual por DB

- **GIVEN** un usuario `U` con `U.deletedAt != null`
- **WHEN** el operador establece `U.deletedAt = NULL` directamente en base de datos
- **THEN** el sistema SHALL tratar a `U` como activo a partir de la siguiente lectura, sin requerir ninguna operación adicional

### Requirement: Unicidades por gym se liberan al soft-deletar

El sistema SHALL mantener `(email, gymId)` y `(memberNumber, gymId)` únicos **únicamente** entre filas activas (`deletedAt IS NULL`) de `User`. El sistema SHALL mantener `(teacherId, name)` único **únicamente** entre filas activas de `Group`.

Esto SHALL implementarse mediante índices únicos parciales de PostgreSQL (`WHERE "deletedAt" IS NULL`), creados vía SQL en la migration porque Prisma no expone unicidades parciales en el modelo.

#### Scenario: Reuso de email tras soft-delete

- **GIVEN** un gym `G` y un usuario `U1` con `email = "x@y.com"`, `gymId = G`, `U1.deletedAt != null`
- **WHEN** el sistema crea un nuevo usuario `U2` con `email = "x@y.com"`, `gymId = G` y `deletedAt = null`
- **THEN** la creación SHALL ser exitosa
- **AND** ambas filas (`U1` y `U2`) SHALL coexistir en la tabla

#### Scenario: Reuso de memberNumber tras soft-delete

- **GIVEN** un gym `G` y un usuario `U1` con `memberNumber = 42`, `gymId = G`, `U1.deletedAt != null`
- **WHEN** el sistema crea un nuevo usuario `U2` con `memberNumber = 42`, `gymId = G`, `deletedAt = null`
- **THEN** la creación SHALL ser exitosa

#### Scenario: Conflicto entre dos activos sigue rechazado

- **GIVEN** un gym `G` y un usuario `U1` con `email = "x@y.com"`, `gymId = G`, `deletedAt = null`
- **WHEN** el sistema intenta crear `U2` con `email = "x@y.com"`, `gymId = G`, `deletedAt = null`
- **THEN** la operación SHALL fallar por violación de unicidad

### Requirement: Cascada al borrar un TEACHER o ADMIN

Cuando el sistema soft-deleta un usuario con `role` igual a `TEACHER` o `ADMIN`, SHALL ejecutar las siguientes operaciones en una **única transacción** de base de datos:

1. Establecer `deletedAt` en el `User` borrado.
2. Establecer `deletedAt` en cada `Group` cuyo `teacherId` coincida con el usuario borrado y esté activo.
3. Establecer `deletedAt` en cada `Wod` cuyo `teacherId` coincida con el usuario borrado y esté activo.
4. Eliminar físicamente cada fila de `TeacherStudent` donde el usuario figure como `teacherId` o como `studentId`.
5. Eliminar físicamente cada `PushSubscription` cuyo `userId` sea el del usuario borrado.
6. Establecer `decidedById = null` en cada `AccessLog` donde `decidedById` sea el del usuario borrado.
7. Establecer `groupId = null` en cada `User` cuyo `groupId` apunte a un `Group` que acabe de soft-deletarse en esta misma operación.

El sistema NO SHALL borrar ni soft-deletar `RM`, `AccessLog.userId` ni `CouponRedemption` del usuario borrado en este flujo (no aplica al rol teacher/admin típicamente, pero se enuncia para descartarlo explícitamente).

Si cualquier paso falla, la transacción SHALL revertir todos los cambios y la operación SHALL devolver error.

#### Scenario: Borrado de profe deja a sus alumnos sin profe asignado y sin grupo del profe

- **GIVEN** un profe `P` con alumnos `A1`, `A2` (vía `TeacherStudent`)
- **AND** `P` tiene un grupo `G` con `A1.groupId = G.id`
- **AND** `P` tiene rutinas `W1`, `W2` activas
- **WHEN** el sistema borra a `P`
- **THEN** `P.deletedAt != null`
- **AND** `G.deletedAt != null`
- **AND** `W1.deletedAt != null` y `W2.deletedAt != null`
- **AND** las filas `TeacherStudent(P, A1)` y `TeacherStudent(P, A2)` no existen
- **AND** `A1.deletedAt == null` y `A2.deletedAt == null` (los alumnos siguen activos)
- **AND** `A1.groupId == null` (el grupo del profe quedó borrado)

#### Scenario: Borrado de profe que registró ingresos desvincula los logs

- **GIVEN** un profe `P` y un `AccessLog` `L` con `L.decidedById = P.id`
- **WHEN** el sistema borra a `P`
- **THEN** `L.decidedById == null`
- **AND** `L.userId` y el resto de campos del log permanecen intactos

#### Scenario: Borrado idempotente de un profe ya borrado

- **GIVEN** un profe `P` con `P.deletedAt != null`
- **WHEN** el sistema borra a `P` nuevamente
- **THEN** la operación SHALL completar sin error
- **AND** `P.deletedAt` SHALL preservarse (o actualizarse al nuevo timestamp; ambas son aceptables — la primera es preferible)
- **AND** ningún `Group` ni `Wod` activo del gym SHALL soft-deletarse por error

### Requirement: Cascada al borrar un STUDENT o ACCESS

Cuando el sistema soft-deleta un usuario con `role` igual a `STUDENT` o `ACCESS`, SHALL ejecutar en una transacción:

1. Establecer `deletedAt` en el `User` borrado.
2. Eliminar físicamente toda fila de `TeacherStudent` donde el usuario figure como `studentId`.
3. Eliminar físicamente toda `PushSubscription` cuyo `userId` sea el del usuario borrado.
4. Establecer `targetStudentId = null` en cada `Wod` cuyo `targetStudentId` sea el del usuario borrado.
5. Establecer `decidedById = null` en cada `AccessLog` cuyo `decidedById` sea el del usuario borrado.

El sistema NO SHALL borrar `RM`, `AccessLog` (registros donde el alumno figura como `userId`), ni `CouponRedemption` del usuario. Esos registros SHALL permanecer en base de datos como historia.

#### Scenario: Borrado de alumno preserva su historia

- **GIVEN** un alumno `A` con RMs `R1`, `R2`, accesos `L1`, `L2` y canjes de cupón `C1`
- **WHEN** el sistema borra a `A`
- **THEN** `A.deletedAt != null`
- **AND** `R1`, `R2`, `L1`, `L2`, `C1` siguen presentes en base de datos sin modificaciones (excepto `decidedById` si apuntaba a otro user borrado)
- **AND** las filas de `TeacherStudent` donde `A` era student no existen
- **AND** las `PushSubscription` de `A` no existen

#### Scenario: Borrado de un alumno con rutina individual asignada

- **GIVEN** una rutina `W` con `W.targetStudentId = A.id` y `W.deletedAt == null`
- **WHEN** el sistema borra a `A`
- **THEN** `W.targetStudentId == null`
- **AND** `W.deletedAt == null` (la rutina sigue viva, sin alumno objetivo)

#### Scenario: Borrado de un ACCESS desvincula los logs que aprobó

- **GIVEN** un usuario `U` con `role = ACCESS` y un `AccessLog` `L` con `L.decidedById = U.id`
- **WHEN** el sistema borra a `U`
- **THEN** `L.decidedById == null`
- **AND** `L` permanece en base de datos

### Requirement: Login bloqueado para usuarios soft-deleted

El sistema SHALL rechazar intentos de inicio de sesión cuyo target sea un usuario con `deletedAt != null`. La razón del rechazo SHALL ser indistinguible de "credenciales inválidas" desde la perspectiva del cliente, para no filtrar información sobre la existencia de usuarios borrados.

#### Scenario: Login con email de usuario borrado

- **GIVEN** un usuario `U` con `deletedAt != null` y contraseña conocida
- **WHEN** un cliente intenta autenticarse con `U.email` y la contraseña correcta
- **THEN** el sistema SHALL rechazar el login
- **AND** la respuesta SHALL ser equivalente al rechazo por credenciales inválidas

#### Scenario: Login del nuevo usuario que reusa email

- **GIVEN** un usuario `U1` borrado con `email = "x@y.com"` y un usuario nuevo `U2` con `email = "x@y.com"`, `deletedAt = null`, en el mismo gym
- **WHEN** un cliente se autentica con `"x@y.com"` y la contraseña de `U2`
- **THEN** el login SHALL ser exitoso para `U2`

### Requirement: Sesiones activas dentro de `[gymSlug]` se invalidan

El sistema SHALL invalidar las sesiones activas de un usuario soft-deleted en su próxima request a una ruta bajo `[gymSlug]/`. La invalidación SHALL realizarse mediante el mismo mecanismo que ya existe para `blockedAt` (chequeo en el layout y redirect a `/api/auth/kick`).

El sistema NO SHALL implementar revocación inmediata de JWT vía `tokenVersion` ni listas de revocación. Rutas que no carguen el `User` desde DB durante su procesamiento (APIs sueltas) SHALL agregar el filtro `deletedAt: null` al lookup correspondiente.

#### Scenario: Profe borrado intenta navegar a su panel

- **GIVEN** un profe `P` con sesión JWT activa y `P.deletedAt` recién establecido
- **WHEN** `P` navega a cualquier ruta bajo `/[gymSlug]/`
- **THEN** el layout `[gymSlug]/layout.tsx` SHALL detectar `P.deletedAt != null` y redirigir a `/api/auth/kick`
- **AND** el cliente SHALL terminar deslogueado

#### Scenario: API que carga User filtra borrados

- **GIVEN** un usuario `U` con `U.deletedAt != null` y JWT aún válido
- **WHEN** `U` invoca una server action o API route que consulta `prisma.user.findUnique({ where: { id: U.id } })`
- **THEN** la query SHALL incluir el filtro `deletedAt: null` y por lo tanto NO devolver a `U`
- **AND** el handler SHALL tratar el caso como "usuario no existe" o "no autorizado"

### Requirement: Listados y búsquedas filtran usuarios, grupos y rutinas borradas

Toda lectura de `User`, `Group` o `Wod` desde flujos de producto (server actions, páginas, API routes, crons) SHALL incluir el filtro `deletedAt: null` por defecto. Esto aplica a `findUnique`, `findFirst`, `findMany`, `count`, `aggregate` y queries equivalentes.

Excepciones: scripts de operador y herramientas de debugging que necesiten ver datos borrados explícitamente. Estas SHALL omitir el filtro de manera intencional y no SHALL exponerse al usuario final.

#### Scenario: Panel de admin no muestra usuarios borrados

- **GIVEN** un gym `G` con usuarios `U1` (activo) y `U2` (borrado)
- **WHEN** un ADMIN navega al panel de administración de `G`
- **THEN** la lista de usuarios SHALL contener a `U1`
- **AND** la lista SHALL NO contener a `U2`

#### Scenario: Listado de alumnos de un profe omite alumnos borrados

- **GIVEN** un profe `P` con alumnos `A1` (activo) y `A2` (borrado, asociación `TeacherStudent` ya eliminada como parte del borrado de `A2`)
- **WHEN** el sistema lista los alumnos de `P`
- **THEN** SHALL devolver `A1`
- **AND** SHALL NO devolver `A2`

#### Scenario: Lista de rutinas de un profe omite rutinas borradas

- **GIVEN** un profe `P` con rutinas `W1` (activa) y `W2` (borrada)
- **WHEN** el sistema lista las rutinas de `P`
- **THEN** SHALL devolver `W1`
- **AND** SHALL NO devolver `W2`

#### Scenario: Cron de notificaciones de pago omite alumnos borrados

- **GIVEN** un alumno `A` con `A.deletedAt != null` y un pago vencido en su histórico
- **WHEN** el cron de notificaciones de pagos vencidos se ejecuta
- **THEN** `A` SHALL NO recibir notificación

### Requirement: Borrado manual de un grupo es soft-delete con cascada equivalente

Cuando el sistema ejecuta `deleteGroup(groupId)`, SHALL realizar las siguientes operaciones en una **única transacción**:

1. Establecer `deletedAt` en el `Group` borrado.
2. Establecer `groupId = null` en cada `User` cuyo `groupId` coincida con el grupo borrado (replica el `onDelete: SetNull` que la DB aplicaría en un hard delete).
3. Establecer `targetGroupId = null` en cada `Wod` cuyo `targetGroupId` coincida con el grupo borrado (replica el `onDelete: SetNull` declarado en `Wod.targetGroup`).

El sistema NO SHALL borrar físicamente el `Group`. Si `deleteGroup` es invocado sobre un grupo con `deletedAt != null`, SHALL devolver "Grupo no encontrado" (el check previo `findFirst({ where: { deletedAt: null } })` ya cubre la idempotencia).

#### Scenario: Soft-delete del grupo desvincula a sus alumnos

- **GIVEN** un grupo `G` con alumnos `A1`, `A2` con `groupId = G.id`
- **WHEN** el sistema ejecuta `deleteGroup(G.id)`
- **THEN** `G.deletedAt != null`
- **AND** `A1.groupId == null` y `A2.groupId == null`
- **AND** `A1.deletedAt == null` y `A2.deletedAt == null` (los alumnos siguen activos)

#### Scenario: Soft-delete del grupo desvincula rutinas que lo tenían como target

- **GIVEN** un grupo `G` y una rutina `W` con `W.targetGroupId = G.id` y `W.deletedAt == null`
- **WHEN** el sistema ejecuta `deleteGroup(G.id)`
- **THEN** `W.targetGroupId == null`
- **AND** `W.deletedAt == null` (la rutina sigue viva, sin grupo objetivo; replica `onDelete: SetNull`)


## ADDED Requirements

### Requirement: Rol `SUPERADMIN` con alcance cross-tenant

El sistema SHALL incorporar un nuevo valor `SUPERADMIN` al enum `Role`. Un usuario con `role = SUPERADMIN` SHALL representar un operador de la plataforma sin pertenencia a ningún gym.

#### Scenario: Existencia del enum

- **WHEN** se inspecciona el enum `Role` en `prisma/schema.prisma` después de la migración
- **THEN** los valores son exactamente: `ADMIN`, `TEACHER`, `STUDENT`, `ACCESS`, `SUPERADMIN`

#### Scenario: Creación de un super admin

- **WHEN** se inserta una fila `User` con `role = SUPERADMIN`, `gymId = null`, `email`, `password`, `name`
- **THEN** la inserción es válida
- **AND** ninguna restricción referencial falla

### Requirement: `User.gymId` opcional con regla por rol

El sistema SHALL aceptar `User.gymId = null` SOLO cuando `User.role = SUPERADMIN`. Para cualquier otro rol (`ADMIN`, `TEACHER`, `STUDENT`, `ACCESS`), `User.gymId` SHALL ser no-null.

Esta regla SHALL aplicarse:
- En el schema Prisma: `gymId String?` (la base de datos permite null).
- En toda server action que cree o actualice usuarios: validación explícita.

#### Scenario: Crear ADMIN sin gymId

- **WHEN** una server action intenta crear un `User` con `role = ADMIN` y `gymId = null`
- **THEN** el sistema rechaza la operación con error explícito
- **AND** ninguna fila se persiste

#### Scenario: Crear SUPERADMIN con gymId

- **WHEN** una server action intenta crear un `User` con `role = SUPERADMIN` y `gymId` igual al id de un gym existente
- **THEN** el sistema rechaza la operación con error explícito
- **AND** ninguna fila se persiste

#### Scenario: Crear SUPERADMIN sin gymId

- **WHEN** una server action intenta crear un `User` con `role = SUPERADMIN` y `gymId = null`
- **THEN** la inserción es válida

### Requirement: SUPERADMIN no figura como miembro de ningún gym

El sistema SHALL excluir a los usuarios con `role = SUPERADMIN` de cualquier listado de miembros de un gym (alumnos, profes, admins por gym, ingresos, RMs, grupos, etc.). Toda query que itere usuarios de un gym SHALL filtrarse por `gymId = <gymId concreto>`, lo que ya excluye SUPERADMIN porque tienen `gymId = null`.

#### Scenario: Listado de alumnos de un gym

- **GIVEN** un gym con varios `STUDENT` y un `SUPERADMIN` global
- **WHEN** una página de admin lista los alumnos del gym
- **THEN** el `SUPERADMIN` no aparece
- **AND** los `STUDENT` aparecen normalmente

#### Scenario: Conteo de admins de un gym

- **GIVEN** un gym con 2 `ADMIN` y un `SUPERADMIN` global
- **WHEN** se consulta `prisma.user.count({ where: { gymId: gym.id, role: 'ADMIN' } })`
- **THEN** el resultado es 2

### Requirement: SUPERADMIN no puede invocar operaciones intra-gym sin contexto

El sistema NO SHALL permitir a un usuario con `role = SUPERADMIN` invocar server actions que asumen un `gymId` de la sesión (ej. promover a un teacher, registrar un pago de un alumno, abrir la puerta) sin pasar explícitamente el `gymId` como parámetro de la operación. Las operaciones intra-gym están diseñadas para `ADMIN`/`TEACHER`/`ACCESS` con un gym en su sesión.

#### Scenario: SUPERADMIN intenta promover a un TEACHER usando una action de admin

- **GIVEN** una sesión SUPERADMIN
- **WHEN** invoca la server action "promover TEACHER a ADMIN" (que asume `session.user.gymId` no-null)
- **THEN** el sistema rechaza la operación con error explícito
- **AND** ninguna fila se modifica

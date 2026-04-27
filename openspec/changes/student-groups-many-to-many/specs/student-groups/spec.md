## ADDED Requirements

### Requirement: Membership solo para alumnos PERSONALIZED

El sistema SHALL aceptar memberships en `GroupMember` únicamente cuando el `User` referenciado por `userId` tenga `studentType = "PERSONALIZED"` y `role = "STUDENT"`. Cualquier intento de crear membership con un alumno `GENERAL` o un usuario no-`STUDENT` SHALL fallar con error de autorización.

#### Scenario: Asignar alumno PERSONALIZED a grupo
- **WHEN** un profe ejecuta `assignStudentToGroup(studentId, groupId)` y el alumno tiene `studentType = "PERSONALIZED"`
- **THEN** se crea una fila en `GroupMember(userId, groupId)` y la operación retorna `{ success: true }`

#### Scenario: Asignar alumno GENERAL es rechazado
- **WHEN** un profe ejecuta `assignStudentToGroup(studentId, groupId)` y el alumno tiene `studentType = "GENERAL"`
- **THEN** la operación retorna `{ success: false, error: "Solo alumnos personalizados pueden pertenecer a un grupo." }` y no se crea membership

#### Scenario: Cambiar studentType a GENERAL elimina memberships
- **WHEN** un admin ejecuta `toggleStudentType(userId)` sobre un alumno PERSONALIZED que tiene N memberships y lo cambia a GENERAL
- **THEN** se eliminan las N filas correspondientes en `GroupMember` en la misma transacción

### Requirement: Pertenencia many-to-many

El sistema SHALL permitir que un mismo alumno PERSONALIZED tenga simultáneamente múltiples filas en `GroupMember`, es decir pertenezca a varios grupos a la vez. La PK compuesta `(userId, groupId)` SHALL evitar duplicados de la misma pareja.

#### Scenario: Alumno en múltiples grupos
- **WHEN** un alumno PERSONALIZED ya pertenece al grupo A y se ejecuta `assignStudentToGroup(studentId, groupB.id)`
- **THEN** se crea la membership en grupo B sin afectar la pertenencia al grupo A

#### Scenario: Reasignar al mismo grupo es idempotente
- **WHEN** un alumno ya pertenece al grupo X y se vuelve a ejecutar `assignStudentToGroup(studentId, X)`
- **THEN** la operación retorna `{ success: true }` sin crear duplicados (PK compuesta protege contra `INSERT` repetidos; el código SHALL tratar el conflicto como éxito)

### Requirement: Coherencia alumno-profe-grupo

El sistema SHALL aceptar `assignStudentToGroup(studentId, groupId)` ejecutado por un usuario con rol `TEACHER` solo si existe una fila en `TeacherStudent` con `(teacherId = sessionUser.id, studentId)` Y el grupo pertenece a ese profe (`Group.teacherId = sessionUser.id`). Los usuarios con rol `ADMIN` SHALL poder asignar a cualquier grupo del gym sin restricción de `TeacherStudent`.

#### Scenario: Profe asigna a su propio grupo, alumno asignado a él
- **WHEN** un TEACHER asigna a un alumno que tiene `TeacherStudent(teacherId=él, studentId=alumno)` a un grupo donde `Group.teacherId = él`
- **THEN** la operación tiene éxito

#### Scenario: Profe intenta asignar a grupo de otro profe
- **WHEN** un TEACHER ejecuta `assignStudentToGroup` contra un grupo cuyo `teacherId` no es el suyo
- **THEN** la operación retorna `{ success: false, error: "Grupo no encontrado." }`

#### Scenario: Profe intenta asignar a un alumno no vinculado
- **WHEN** un TEACHER ejecuta `assignStudentToGroup` con un `studentId` que no está en `TeacherStudent` para él
- **THEN** la operación retorna `{ success: false, error: "Este alumno no está asignado a vos." }`

#### Scenario: Admin asigna sin restricciones de TeacherStudent
- **WHEN** un ADMIN ejecuta `assignStudentToGroup` contra un alumno que no está en su `TeacherStudent` pero sí pertenece al mismo gym
- **THEN** la operación tiene éxito

### Requirement: Remoción de membership puntual

El sistema SHALL exponer `removeStudentFromGroup(studentId, groupId)` que elimine **únicamente** la fila `GroupMember(userId=studentId, groupId)`, sin afectar las otras memberships del alumno. La autorización SHALL aplicar las mismas reglas que `assignStudentToGroup` (TEACHER dueño del grupo o ADMIN).

#### Scenario: Quitar a un alumno de un grupo específico preserva los demás
- **WHEN** un alumno pertenece a los grupos A, B, C y se ejecuta `removeStudentFromGroup(studentId, B)`
- **THEN** queda con memberships en A y C, y la fila de B desaparece

#### Scenario: Quitar de un grupo donde no era miembro
- **WHEN** se ejecuta `removeStudentFromGroup(studentId, groupId)` y no existe esa fila
- **THEN** la operación retorna `{ success: true }` (idempotente)

### Requirement: Borrado de grupo cascadea memberships

Cuando un grupo se borra (soft-delete via `Group.deletedAt`), el sistema SHALL eliminar todas las filas de `GroupMember` con ese `groupId` dentro de la misma transacción. Igualmente, cuando un profe se borra (soft-delete via `User.deletedAt`), el sistema SHALL eliminar todas las memberships de los grupos que ese profe poseía.

#### Scenario: Soft-delete de grupo limpia memberships
- **WHEN** un profe ejecuta `deleteGroup(groupId)` sobre un grupo con N memberships
- **THEN** se actualiza `Group.deletedAt = now`, se borran las N filas de `GroupMember`, y se nullea `Wod.targetGroupId` en los WODs que apuntaban a ese grupo, todo en una sola transacción

#### Scenario: Soft-delete de profe limpia memberships de sus grupos
- **WHEN** un admin ejecuta `softDeleteUser(teacherId)` sobre un profe con M grupos activos
- **THEN** se ponen `deletedAt` en `User`, `Group`s del profe y `Wod`s del profe, se borran todas las memberships donde `groupId IN (grupos del profe)`, y se borran los `TeacherStudent` del profe, todo en una sola transacción

### Requirement: Visibilidad de WODs por grupo via memberships

Para WODs con `targetType = "GROUP"`, el sistema SHALL mostrar el WOD a un alumno PERSONALIZED si y solo si: (a) el `Wod.targetGroupId` está dentro del conjunto de memberships del alumno, AND (b) `Wod.teacherId` está dentro de los profes vinculados al alumno via `TeacherStudent`, AND (c) `Wod.deletedAt IS NULL`.

#### Scenario: Alumno en grupo destinatario ve el WOD
- **WHEN** existe `GroupMember(userId=alumno, groupId=G)` y un WOD con `targetType="GROUP"`, `targetGroupId=G`, `teacherId=T` y existe `TeacherStudent(teacherId=T, studentId=alumno)`
- **THEN** el WOD aparece en el feed del alumno (`/dashboard/athlete` y `/dashboard/athlete/wod`)

#### Scenario: Alumno fuera del grupo destinatario no ve el WOD
- **WHEN** un WOD apunta a `targetGroupId=G` y el alumno no tiene `GroupMember` para `G`
- **THEN** el WOD no aparece en su feed aunque comparta profe

#### Scenario: Alumno GENERAL no recibe WODs de grupo
- **WHEN** un alumno con `studentType="GENERAL"` consulta su feed
- **THEN** no aparecen WODs con `targetType="GROUP"` aunque exista membership huérfana (regla: GENERAL no puede tener memberships, ver requisito anterior)

### Requirement: Selector "agregar alumno" excluye solo el grupo actual

La UI de gestión de grupos (`GroupManager`) SHALL exponer, para cada grupo `G`, un selector "Agregar alumno..." que liste todos los alumnos PERSONALIZED vinculados al profe (via `TeacherStudent`) que aún no son miembros de `G`. Un mismo alumno PUEDE aparecer como opción en múltiples selectores (uno por grupo donde aún no es miembro).

#### Scenario: Alumno disponible para grupo donde no está
- **WHEN** un profe tiene grupos A y B, y un alumno PERSONALIZED es miembro solo de A
- **THEN** el alumno NO aparece en el selector de A, pero SÍ aparece en el selector de B

#### Scenario: Alumno PERSONALIZED sin memberships aparece en todos los grupos
- **WHEN** un alumno PERSONALIZED del profe no tiene ninguna membership
- **THEN** aparece en el selector de cada grupo del profe

#### Scenario: Alumno GENERAL no aparece en ningún selector
- **WHEN** un alumno con `studentType="GENERAL"` está vinculado al profe
- **THEN** no aparece en ningún selector de "Agregar alumno"

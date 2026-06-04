## ADDED Requirements

### Requirement: Tipo de alumno "musculación libre"

Esta capability SHALL aplicar **únicamente a gyms con `kind = GYM`** (gimnasios tradicionales). NO SHALL aplicar a `kind = BOX` ni `kind = PERSONAL`.

El sistema SHALL soportar un tipo de alumno **musculación libre** mediante un valor nuevo `MUSCULACION_LIBRE` en el enum `StudentType`. Un alumno con `studentType = MUSCULACION_LIBRE` NO SHALL recibir las WOD diarias (ni `ALL`, ni `PERSONALIZED`, ni `GROUP`); en su lugar SHALL ver su rutina fija activa. Solo usuarios con `role = TEACHER` o `role = ADMIN` de un gym con `kind = GYM` SHALL poder marcar a un alumno como musculación libre.

#### Scenario: Marcar un alumno como musculación libre

- **WHEN** un `TEACHER` o `ADMIN` de un gym con `kind = GYM` setea `studentType = MUSCULACION_LIBRE` en un alumno del gym
- **THEN** el sistema persiste el tipo y el alumno deja de recibir las WOD diarias

#### Scenario: No disponible en boxes ni en PERSONAL

- **WHEN** se intenta marcar a un alumno como `MUSCULACION_LIBRE` en un gym con `kind = BOX` o `kind = PERSONAL`
- **THEN** la operación es rechazada y la opción no se ofrece en la UI de esos tenants

#### Scenario: Alumno musculación libre no ve WODs diarias

- **WHEN** un alumno con `studentType = MUSCULACION_LIBRE` abre su dashboard
- **THEN** el sistema NO le muestra WODs diarias (`ALL`/`PERSONALIZED`/`GROUP`/`STUDENT`)
- **AND** le muestra su rutina fija activa si existe

### Requirement: Asignación de rutina fija a un alumno

El sistema SHALL permitir a un usuario con `role = TEACHER` o `role = ADMIN`, vinculado al alumno por `TeacherStudent` (o al alumno de su gym), en un gym con `kind = GYM`, crear una `FixedRoutine` para un alumno de su gym, con `title`, `content` (markdown) y `renewAt`. En gyms con `kind = BOX` o `kind = PERSONAL` la operación SHALL ser rechazada. El sistema SHALL persistir `teacherId` = el profe que la crea, `gymId` = el gym del alumno, `assignedAt = now()` y `renewAt` (default `assignedAt + 30 días`, editable). Toda la operación SHALL respetar multi-tenancy por `gymId`.

#### Scenario: Profe asigna una rutina fija

- **WHEN** un `TEACHER` del gym, vinculado al alumno, crea una rutina fija con título, contenido y fecha de renovación
- **THEN** el sistema crea una `FixedRoutine` con `teacherId` del profe, `gymId` del alumno, `assignedAt = now()` y el `renewAt` indicado

#### Scenario: Default de renewAt a 30 días

- **WHEN** el profe crea una rutina fija sin especificar `renewAt`
- **THEN** el sistema persiste `renewAt = assignedAt + 30 días`

#### Scenario: Rechazo por gym distinto

- **WHEN** un `TEACHER` intenta crear una rutina fija para un alumno de **otro** gym
- **THEN** la operación es rechazada con error de autorización y no se crean datos

### Requirement: Renovación de la rutina fija

El sistema SHALL tratar la **renovación** como la creación de una nueva `FixedRoutine` para el alumno, conservando las anteriores como historial (no se borran). La rutina **activa** de un alumno SHALL ser la `FixedRoutine` con `deletedAt = null` más reciente por `assignedAt`. La renovación SHALL reiniciar el ciclo de recordatorios (la nueva rutina tiene su propio `renewAt`).

#### Scenario: Renovar crea una nueva rutina activa

- **WHEN** el profe renueva la rutina de un alumno cargando una nueva
- **THEN** el sistema crea una nueva `FixedRoutine`, que pasa a ser la activa, y la anterior queda como historial

#### Scenario: Alumno ve la rutina más reciente

- **WHEN** un alumno musculación libre con varias `FixedRoutine` en su historial abre su dashboard
- **THEN** el sistema muestra únicamente la rutina activa (la más reciente no borrada)

### Requirement: Vista persistente de la rutina fija para el alumno

El sistema SHALL mostrar al alumno con `studentType = MUSCULACION_LIBRE` su rutina fija activa de forma **persistente** (no fechada por día), renderizando el `content` markdown con el renderer existente. Si el alumno no tiene rutina activa, el sistema SHALL mostrar un estado vacío indicando que aún no tiene rutina cargada.

#### Scenario: Alumno con rutina activa

- **WHEN** el alumno musculación libre abre su dashboard cualquier día
- **THEN** el sistema muestra el título y contenido de su rutina fija activa, sin depender de la fecha del día

#### Scenario: Alumno sin rutina activa

- **WHEN** el alumno musculación libre no tiene ninguna `FixedRoutine` activa
- **THEN** el sistema muestra un estado vacío ("todavía no tenés una rutina cargada")

### Requirement: Recordatorio de renovación al profe por hitos

El sistema SHALL ejecutar, en el cron diario, una evaluación que para cada rutina **activa** (la más reciente no borrada por alumno) cuya `renewAt` esté a **7, 3, 1 o 0 días** del día actual (zona horaria de Argentina) envíe una push notification al profe dueño (`teacherId`) indicando el alumno y los días restantes. El cálculo de días SHALL usar el día actual en zona Argentina. El sistema SHALL deduplicar el envío por día mediante `lastRenewalNotifiedOn`.

#### Scenario: Push al profe en un hito

- **WHEN** el cron diario corre
- **AND** existe una rutina fija activa cuya `renewAt` está exactamente a 3 días del día actual (ART)
- **THEN** el sistema envía una push al `teacherId` indicando que la rutina de ese alumno vence en 3 días

#### Scenario: Push el día del vencimiento

- **WHEN** el cron diario corre
- **AND** la `renewAt` de una rutina activa es el día actual (ART)
- **THEN** el sistema envía una push al `teacherId` indicando que la rutina vence hoy

#### Scenario: Día fuera de los hitos no dispara push

- **WHEN** el cron diario corre
- **AND** la `renewAt` de una rutina activa está a 5 días del día actual (ART)
- **THEN** el sistema NO envía push para esa rutina

#### Scenario: Dedup por día

- **WHEN** el cron corre dos veces el mismo día
- **AND** ya se envió el recordatorio de una rutina ese día (`lastRenewalNotifiedOn = hoy`)
- **THEN** el sistema NO envía un segundo push para esa rutina

#### Scenario: Solo se recuerda la rutina activa

- **WHEN** el cron diario corre
- **AND** un alumno tiene rutinas en su historial además de la activa
- **THEN** el sistema evalúa el recordatorio solo sobre la rutina activa, no sobre las del historial

### Requirement: Indicador "rutinas por renovar" en el panel del profe

El sistema SHALL mostrar al profe, en su dashboard, una lista/indicador de sus rutinas fijas activas que están **por vencer** (`renewAt` dentro de los próximos 7 días) o **vencidas** (`renewAt` en el pasado), con el nombre del alumno y la fecha de renovación. Una rutina vencida no renovada NO SHALL bloquear al alumno ni afectar su acceso; permanece visible para el alumno hasta que se renueve.

#### Scenario: Lista de rutinas por renovar

- **WHEN** el profe abre su dashboard
- **AND** tiene rutinas activas con `renewAt` dentro de 7 días o ya vencidas
- **THEN** el sistema las lista indicando alumno y fecha de renovación, marcando las vencidas

#### Scenario: Rutina vencida no bloquea al alumno

- **WHEN** una rutina fija tiene `renewAt` en el pasado y no fue renovada
- **THEN** el alumno sigue viendo esa rutina y conserva el acceso normal a la app

### Requirement: Selección del tipo musculación libre en los flujos de alta

El sistema SHALL permitir elegir `studentType = MUSCULACION_LIBRE` (solo en gyms `kind = GYM`) en los tres flujos de alta de alumnos: el alta desde el panel admin (`UserForm`), el formulario público del link de invitación, y el modal de aprobación de solicitudes. El tipo elegido por el alumno en el formulario público SHALL persistirse en la solicitud (`JoinRequest.studentType`) y propagarse al usuario al aprobar (salvo override del admin). En gyms `kind != GYM`, la opción NO SHALL ofrecerse y el server SHALL caer a `PERSONALIZED`/rechazar.

#### Scenario: Alta desde el panel admin con tipo musculación libre

- **WHEN** un `ADMIN` de un gym `kind = GYM` crea un alumno eligiendo "Musculación libre"
- **THEN** el sistema crea el usuario con `studentType = MUSCULACION_LIBRE`

#### Scenario: El tipo elegido en el formulario público se propaga al aprobar

- **WHEN** un alumno se registra por el link público de un gym `kind = GYM` eligiendo "Musculación libre"
- **THEN** la solicitud guarda `studentType = MUSCULACION_LIBRE` y, al aprobarla sin override, el usuario creado queda con ese tipo

### Requirement: Vínculo con profe y visibilidad para asignar rutinas

El sistema SHALL permitir vincular un profe (`TeacherStudent`) a un alumno `MUSCULACION_LIBRE` en los flujos de alta y de edición. En el dashboard del profe, un usuario con `role = ADMIN` SHALL ver a **todos** los alumnos `MUSCULACION_LIBRE` del gym; un usuario con `role = TEACHER` SHALL ver solo los vinculados a él. La rutina fija de un alumno se crea/asigna desde el dashboard del profe y desde el formulario "Nueva Rutina".

#### Scenario: Admin ve a todos los musculación libre del gym

- **WHEN** un `ADMIN` abre el dashboard del profe en un gym `kind = GYM`
- **THEN** el sistema lista a todos los alumnos `MUSCULACION_LIBRE` del gym para asignarles rutina

#### Scenario: Profe ve solo sus alumnos vinculados

- **WHEN** un `TEACHER` abre el dashboard del profe
- **THEN** el sistema lista solo los alumnos `MUSCULACION_LIBRE` vinculados a él por `TeacherStudent`

### Requirement: Edición de la fecha de renovación desde la ficha del alumno

El sistema SHALL mostrar, en la edición de un alumno `MUSCULACION_LIBRE` (gym `kind = GYM`), la fecha de renovación de su rutina activa y SHALL permitir editarla sin alterar título ni contenido. Si el alumno no tiene rutina activa, el sistema SHALL indicar que la rutina se asigna desde el panel del profe.

#### Scenario: Editar la fecha de renovación de la rutina activa

- **WHEN** un `ADMIN`/`TEACHER` cambia la fecha de vencimiento en la ficha de un alumno con rutina activa
- **THEN** el sistema actualiza `renewAt` de esa rutina sin tocar su contenido

#### Scenario: Alumno sin rutina en la ficha

- **WHEN** se edita un alumno `MUSCULACION_LIBRE` sin rutina activa
- **THEN** el sistema indica que la rutina se asigna desde el panel del profe, sin campo de fecha

### Requirement: Indicador de vencimiento para el propio alumno

El sistema SHALL mostrar al alumno `MUSCULACION_LIBRE`, en la vista de su rutina activa, la fecha de renovación, y SHALL mostrar un aviso cuando la renovación esté dentro de los próximos 7 días o ya haya pasado (sugiriéndole hablar con su profe). El indicador SHALL ser solo visual (sin push al alumno).

#### Scenario: El alumno ve la fecha de renovación

- **WHEN** un alumno `MUSCULACION_LIBRE` con rutina activa abre su dashboard
- **THEN** el sistema muestra la fecha de renovación de su rutina

#### Scenario: Aviso de rutina por vencer o vencida

- **WHEN** la `renewAt` de su rutina está dentro de 7 días o ya pasó
- **THEN** el sistema muestra un aviso indicando que está por vencer/vencida y que hable con su profe

### Requirement: Pertenencia a grupos de los alumnos musculación libre

El sistema SHALL permitir que los alumnos `MUSCULACION_LIBRE` pertenezcan a grupos (`Group`/`GroupMember`), además de los `PERSONALIZED`. Para un alumno `MUSCULACION_LIBRE`, la membresía a un grupo SHALL ser suficiente (no SHALL requerirse vínculo `TeacherStudent`). Al cambiar el tipo de un alumno a `MUSCULACION_LIBRE`, el sistema NO SHALL borrar sus membresías de grupo (a diferencia de `GENERAL`). Toda asignación a grupo SHALL validar que el alumno pertenezca al gym de la sesión.

#### Scenario: Agregar un alumno musculación libre a un grupo

- **WHEN** un `TEACHER`/`ADMIN` agrega a un grupo a un alumno `MUSCULACION_LIBRE` del gym
- **THEN** el sistema crea la membresía sin requerir vínculo `TeacherStudent`

#### Scenario: Rechazo de alumno de otro gym

- **WHEN** se intenta agregar a un grupo a un alumno que no pertenece al gym de la sesión
- **THEN** la operación es rechazada

### Requirement: Asignación de rutina fija por grupo

El sistema SHALL permitir, desde el formulario "Nueva Rutina" con destinatario "Musculación libre", elegir un **grupo** y crear una `FixedRoutine` para **cada** miembro `MUSCULACION_LIBRE` de ese grupo (cada uno con su propio `renewAt` y su recordatorio). La operación SHALL validar `role` (TEACHER/ADMIN), `kind = GYM`, que el grupo pertenezca al gym (y al profe si es TEACHER), y SHALL crear rutinas solo para los miembros `MUSCULACION_LIBRE` del gym.

#### Scenario: Crear rutina para un grupo

- **WHEN** un `TEACHER`/`ADMIN` elige destinatario "Musculación libre" → un grupo, con título, contenido y fecha de renovación
- **THEN** el sistema crea una `FixedRoutine` para cada miembro `MUSCULACION_LIBRE` del grupo

#### Scenario: Grupo sin miembros musculación libre

- **WHEN** el grupo elegido no tiene miembros `MUSCULACION_LIBRE`
- **THEN** el sistema devuelve un error indicando que el grupo no tiene alumnos de musculación libre

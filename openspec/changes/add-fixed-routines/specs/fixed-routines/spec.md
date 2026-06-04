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

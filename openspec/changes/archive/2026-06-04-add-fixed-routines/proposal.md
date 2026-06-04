> **Alcance**: esta capability aplica **solo a gyms con `kind = GYM`** (gimnasios tradicionales). No aplica a `kind = BOX` (CrossFit) ni `kind = PERSONAL`.

## Why

En gimnasios de musculación libre hay alumnos que no siguen la "WOD del día": reciben una **rutina fija** que el profe renueva cada ~30 días. Hoy el modelo `Wod` es un workout fechado (el alumno ve la "WOD de hoy" por fecha) y no hay forma de tener una rutina persistente ni de avisarle al profe que la renueve. Esto obliga al profe a acordarse a mano del vencimiento de cada alumno.

## What Changes

- **Nuevo modelo `FixedRoutine`**: rutina persistente asignada a un alumno por un profe, con título (el nivel se escribe acá como texto), contenido markdown y fecha de renovación (`renewAt`). Cada renovación crea un registro nuevo (historial); el alumno ve la rutina activa más reciente.
- **Nuevo tipo de alumno "musculación libre"** (valor nuevo en `StudentType`): se registra como alumno (por el link/QR de alta existente) y el profe/admin lo marca. Estos alumnos NO reciben las WOD diarias; su dashboard muestra su rutina fija activa.
- **Asignar / renovar rutina fija**: el profe carga título + contenido (editor markdown existente) + `renewAt` (DatePicker del sistema, default `+30 días`). Renovar = cargar una nueva, lo que reinicia el ciclo.
- **Recordatorio de renovación al profe**: el cron diario detecta rutinas activas con `renewAt` en hitos **7/3/1/0 días** y manda push al profe asignado (`sendPushToUser(teacherId, …)`), con dedup por día. En el dashboard del profe aparece una lista/indicador de "rutinas por renovar" (por vencer o vencidas).
- **Sin bloqueo**: si el profe no renueva, la rutina queda marcada como "por renovar/vencida" en su panel y el alumno la sigue viendo hasta que se cambie. No afecta acceso ni billing.

## Capabilities

### New Capabilities
- `fixed-routines`: rutinas fijas persistentes para alumnos de musculación libre, su asignación/renovación por el profe, la vista persistente del alumno, y el recordatorio de renovación al profe por hitos.

### Modified Capabilities
<!-- ninguna: no existe spec de WODs/rutinas. La lógica de visibilidad de WODs en el dashboard del alumno se ajusta a nivel de implementación (excluir a los alumnos de musculación libre), pero no hay un requisito de spec previo que cambie. -->

## Impact

- **Schema/DB**: nuevo modelo `FixedRoutine`; nuevo valor en el enum `StudentType`. Migración aplicada con `prisma migrate deploy` (shadow DB no configurada).
- **Actions**: `src/actions/` — crear/renovar/editar/borrar (soft-delete) `FixedRoutine`, restringido a TEACHER/ADMIN del gym con vínculo `TeacherStudent` al alumno.
- **Cron**: fase nueva en el cron diario (`notify-due-today` o `check-gym-trials`) para los hitos de recordatorio.
- **Push**: helper nuevo en `src/lib/push.ts` (`sendRoutineRenewalPush`).
- **UI profe**: formulario de asignación/renovación + indicador "rutinas por renovar" en el dashboard del profe.
- **UI alumno**: el dashboard del alumno musculación libre muestra su rutina fija activa en vez de la WOD del día; revisar la lógica de visibilidad de WODs para excluir a estos alumnos.
- **Multi-tenancy**: todo filtrado por `gymId`. Sin impacto en `kind = PERSONAL` ni en el flujo de billing.

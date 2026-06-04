## Context

El modelo `Wod` (`prisma/schema.prisma`) es un workout **fechado** (`date @db.Date`) con targeting (`targetType ALL | PERSONALIZED | GROUP | STUDENT`, `targetStudentId`, `targetGroupId`). El alumno ve la "WOD de hoy" comparando fechas en `src/app/[gymSlug]/dashboard/athlete/`. No hay vigencia ni renovación.

`StudentType` (hoy `GENERAL` / `PERSONALIZED`) define qué WODs ve cada alumno; `canCreateOwnRoutines` permite autogestión; `AccountKind FULL | LITE` es ortogonal (LITE = sin login). La relación profe–alumno es `TeacherStudent` (N:N).

Infra reutilizable: `sendPushToUser(userId, title, body)` (`src/lib/push.ts`); el cron diario `notify-due-today` (12:00 ART) y `check-gym-trials` (03:00 ART); el patrón de dedup por día con un campo `lastXNotifiedOn` (`sendDueReminderIfNeeded`); el editor markdown y `MarkdownRenderer` ya usados por WODs; el DatePicker del sistema.

Restricciones: multi-tenancy por `gymId`; migraciones con `migrate deploy` (shadow DB no configurada); APIs de Next 16 verificadas contra `node_modules/next/dist/docs/`.

## Goals / Non-Goals

**Goals:**
- Rutina fija persistente por alumno, renovable, con historial.
- Tipo de alumno "musculación libre" cuyo dashboard muestra esa rutina (no la WOD diaria).
- Recordatorio de renovación al profe asignado por hitos (push + indicador en su panel).

**Non-Goals:**
- No hay niveles formales (el nivel va en el título como texto).
- No hay plantillas reutilizables de rutina.
- No hay bloqueo ni efecto en billing/acceso si no se renueva.
- No se toca el flujo de WOD diaria para el resto de los alumnos.
- **Solo aplica a gyms con `kind = GYM`** (gimnasios tradicionales). No aplica a `kind = BOX` (CrossFit) ni `kind = PERSONAL`. Las actions rechazan si el gym no es `GYM` y la UI solo ofrece la opción en gyms `GYM`.

## Decisions

### Decisión 1: Modelo dedicado `FixedRoutine` en vez de reusar `Wod`

```prisma
model FixedRoutine {
  id                    String    @id @default(cuid())
  gymId                 String
  studentId             String
  teacherId             String
  title                 String
  content               String        // markdown
  assignedAt            DateTime  @default(now())
  renewAt               DateTime  @db.Date
  lastRenewalNotifiedOn DateTime? @db.Date   // dedup del push por día
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  gym     Gym  @relation(fields: [gymId], references: [id], onDelete: Cascade)
  student User @relation("FixedRoutineStudent", fields: [studentId], references: [id], onDelete: Cascade)
  teacher User @relation("FixedRoutineTeacher", fields: [teacherId], references: [id], onDelete: Cascade)

  @@index([gymId])
  @@index([studentId, deletedAt])
  @@index([teacherId, renewAt])
}
```

- **Por qué**: `Wod` está acoplado a la mecánica diaria (date + targeting + vista "WOD de hoy"). Overloadearlo con vigencia + vista persistente bifurcaría la lógica de visibilidad existente (riesgo). Un modelo aparte mantiene los dos conceptos limpios y aislados.
- **Activa = la más reciente**: la rutina activa de un alumno es la `FixedRoutine` con `deletedAt = null` más reciente por `assignedAt` (o `createdAt`). Las anteriores quedan como historial. **Renovar = crear una nueva** (no editar en su lugar), así se preserva el historial.
- **`renewAt` como `@db.Date`**: solo fecha (sin hora), consistente con `Wod.date` y con el manejo de "hoy" en zona Argentina del proyecto.
- **Alternativa descartada**: reusar `Wod` + `renewAt`. Menos modelo nuevo pero ensucia la vista del alumno y el targeting.

### Decisión 2: Nuevo valor en `StudentType` (`MUSCULACION_LIBRE`)

- **Por qué**: necesitamos una señal explícita para (a) que el dashboard del alumno muestre la rutina fija en vez de la WOD diaria, y (b) que la UI del profe ofrezca "asignar/renovar rutina fija" para esos alumnos. El enum ya gobierna la visibilidad de WODs, así que es el lugar natural.
- **Impacto en visibilidad de WODs**: en la lógica del dashboard athlete, los alumnos `MUSCULACION_LIBRE` quedan excluidos de recibir WODs (`ALL`/`PERSONALIZED`/`GROUP`), y en su lugar ven su `FixedRoutine` activa. Hay que auditar cada branch que hoy mira `studentType`.
- **Alternativa descartada**: un booleano separado. Sumaría una dimensión más a cruzar con `studentType`; un valor de enum es más claro y excluyente.

### Decisión 3: Recordatorio en el cron diario, push al `teacherId`

- Fase nueva en el cron diario que ya corre (preferentemente `notify-due-today`, 12:00 ART, horario más razonable para avisar a un profe que el de bloqueos a las 03:00). Busca rutinas activas (la más reciente por alumno, `deletedAt = null`) con `renewAt` a {7,3,1,0} días del "hoy" ART, y manda push al `teacherId` con `sendRoutineRenewalPush(teacherId, studentName, daysLeft)`.
- **Dedup**: `lastRenewalNotifiedOn` por día (mismo patrón que `lastDueNotifiedOn`), para no spamear si el cron corre dos veces.
- **Indicador del profe**: el dashboard del profe consulta sus rutinas activas con `renewAt <= hoy + 7` (por vencer) o `renewAt < hoy` (vencida) y las lista.

### Decisión 4: `renewAt` con default +30 días, editable

- Al crear/renovar, `renewAt` se precarga en `assignedAt + 30 días` pero es editable con el DatePicker del sistema. Cubre el caso típico (30 días) sin cerrar la puerta a ciclos distintos, y evita un campo de configuración aparte.

## Risks / Trade-offs

- **[Auditar toda la lógica de visibilidad de WODs]** → un branch de `studentType` que no contemple `MUSCULACION_LIBRE` podría mostrarle WODs diarias o esconderle su rutina. Mitigación: enumerar y cubrir cada uso de `studentType` (dashboard athlete, validaciones de target en `wod.ts`, selectores). Cubierto por tareas y scenarios.
- **[Profe asignado ambiguo]** → un alumno puede tener varios profes (`TeacherStudent`). La `FixedRoutine` fija el `teacherId` que la creó, así el recordatorio va a ese profe (no a todos). Documentado en spec.
- **[Rutina vencida sin renovar]** → sin bloqueo; el alumno sigue viendo la rutina vieja. Mitigación: marcarla "vencida" en el panel del profe y seguir mostrándola en "por renovar". Aceptado por decisión de producto.
- **[Doble push si el cron corre dos veces]** → mitigado por `lastRenewalNotifiedOn`.
- **[Alumno LITE]** → un alumno LITE (sin login) no puede ver su rutina en la app. Si se permite asignarle rutina fija, el valor es solo para el profe. Decisión: permitir o no asignar a LITE — se resuelve en tareas; por defecto seguir la regla existente de WODs (no asignar a LITE) salvo que el usuario indique lo contrario.

## Migration Plan

1. Agregar el modelo `FixedRoutine` y el valor `MUSCULACION_LIBRE` a `StudentType` en `schema.prisma`.
2. Generar la migración y aplicarla con `prisma migrate deploy` (no `migrate dev`).
3. `prisma generate` + deploy del código.
4. **Rollback**: el valor de enum y la tabla nuevos son aditivos; revertir el código los deja inertes (ningún alumno marcado como musculación libre salvo los que se marquen). Para revertir datos, cambiar el `studentType` de esos alumnos.

## Open Questions

- ¿Se permite asignar rutina fija a alumnos `LITE` (sin login)? Por defecto: no, igual que las WODs. Confirmar en revisión.
- ¿El horario del recordatorio (12:00 ART vía `notify-due-today`) es el adecuado para los profes? Asumido que sí.

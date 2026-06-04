## 1. Schema y migración

- [x] 1.1 Agregar el modelo `FixedRoutine` a `prisma/schema.prisma` (campos, relaciones a Gym/student/teacher, índices `gymId`, `[studentId, deletedAt]`, `[teacherId, renewAt]`) y las relaciones inversas en `Gym` y `User`
- [x] 1.2 Agregar el valor `MUSCULACION_LIBRE` al enum `StudentType`
- [x] 1.3 Generar la migración y aplicarla con `prisma migrate deploy` (NO `migrate dev` — shadow DB no configurada); correr `prisma generate`
  - Archivo de migración creado en `prisma/migrations/20260604100000_add_fixed_routines/migration.sql`. `prisma generate` corrió OK. La migración NO fue aplicada a la DB (confirmar que DATABASE_URL apunta a DB local antes de correr `prisma migrate deploy`).

## 2. Tipo de alumno y visibilidad de WODs

- [x] 2.1 Auditar todos los usos de `studentType` (dashboard athlete, `src/actions/wod.ts` `validateTarget`, selectores/filtros) y excluir a `MUSCULACION_LIBRE` de recibir WODs diarias
  - `athlete/page.tsx`: rama temprana que muestra rutina fija en vez de WODs.
  - `athlete/wod/page.tsx`: redirect a athlete si el alumno es MUSCULACION_LIBRE.
  - `wod.ts` validateTarget: no toca este flujo (solo valida targets de profes, no visibilidad de alumnos).
- [x] 2.2 En el editor de alumno (`StudentEditor`), permitir setear `studentType = MUSCULACION_LIBRE` (TEACHER/ADMIN del gym), **solo cuando el gym es `kind = GYM`**
  - Selector 3-way en StudentEditor, solo visible cuando `gymKind === "GYM"`.
  - Nueva action `setStudentType` en `user.ts`.
- [x] 2.3 Restringir toda la feature a `kind = GYM`: las actions (set de tipo y CRUD de FixedRoutine) rechazan si el gym no es `GYM`; la UI (opción de tipo, form de rutina fija) solo se ofrece en gyms `GYM`. Defensivamente, el cron filtra por gyms `GYM`.

## 3. Acciones (FixedRoutine)

- [x] 3.1 `createFixedRoutine({ studentId, title, content, renewAt? })`: valida rol TEACHER/ADMIN + vínculo con el alumno + mismo gym; setea `teacherId`, `gymId`, `assignedAt = now()`, `renewAt` (default +30 días); multi-tenancy por `gymId`
- [x] 3.2 `updateFixedRoutine` (editar título/contenido/renewAt de la activa) y `deleteFixedRoutine` (soft-delete) con las mismas validaciones
- [x] 3.3 Helper para obtener la rutina activa de un alumno (`getActiveFixedRoutine`) y el listado de rutinas "por renovar/vencidas" de un profe (`getTeacherRenewalRoutines`)

## 4. UI profe

- [x] 4.1 Formulario para asignar/renovar la rutina fija de un alumno musculación libre: título + editor markdown existente + DatePicker del sistema para `renewAt` (no `<input type="date">` nativo)
  - Componente `FixedRoutineManager` en `src/components/fixed-routine/FixedRoutineManager.tsx`.
- [x] 4.2 Indicador/lista "rutinas por renovar" en el dashboard del profe (alumnos con rutina activa por vencer ≤7 días o vencida), marcando las vencidas

## 5. UI alumno

- [x] 5.1 En el dashboard del alumno `MUSCULACION_LIBRE`, mostrar su rutina fija activa persistente (con `MarkdownRenderer`), en vez de la "WOD de hoy"
- [x] 5.2 Estado vacío cuando no tiene rutina activa ("todavía no tenés una rutina cargada")

## 6. Recordatorio (cron + push)

- [x] 6.1 En `src/lib/push.ts`, agregar `sendRoutineRenewalPush(teacherId, studentName, daysLeft)` (copy según `daysLeft`: vence en N días / vence hoy)
- [x] 6.2 Fase nueva en el cron diario (`notify-due-today`, 12:00 ART): busca rutinas activas con `renewAt` en hitos {7,3,1,0} días (zona Argentina), envía push al `teacherId`, dedupea por día con `lastRenewalNotifiedOn`. Filtra defensivamente por gyms `kind = GYM`.
- [x] 6.3 Respuesta del cron incluye `renewalRemindersSent` en el JSON de respuesta.

## 7. Verificación

- [x] 7.1 `npm run lint` y `npm run build` pasan (sin nuevos errores; 2 errores pre-existentes en layout.tsx no son de este cambio)
- [x] 7.2 Multi-tenancy revisado: todas las queries nuevas filtran por `gymId`. `kind = PERSONAL` no se ve afectado (GYM-only guard en todas las actions).
- [ ] 7.3 Verificar manualmente con datos locales: marcar alumno musculación libre, asignar rutina, ver vista persistente del alumno, simular hitos de recordatorio (sin tocar producción; respetar reglas de seeds)

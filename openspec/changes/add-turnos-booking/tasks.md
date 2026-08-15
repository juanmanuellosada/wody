## 1. Schema y migración

- [x] 1.1 Agregar a `Gym` en `prisma/schema.prisma`: `bookingEnabled Boolean @default(false)`, `trainingEnabled Boolean @default(true)`, `timezone String @default("America/Argentina/Buenos_Aires")`, `reminderLeadHours Int @default(2)`
- [x] 1.2 Crear modelo `Activity` (gymId, name, description, teacherId opcional, allowsRecurring, cancelWindowHours default 2, active, timestamps) con índice `[gymId, active]`
- [x] 1.3 Crear modelo `ActivitySlot` (activityId, dayOfWeek 0-6, startMinute, endMinute, capacity nullable, active) con índice `[activityId, active]`
- [x] 1.4 Crear modelo `ActivitySession` (gymId desnormalizado, slotId, date, startsAt, endsAt, capacity snapshot, bookedCount default 0, cancelled) con `@@unique([slotId, date])` e índice `[gymId, startsAt]`
- [x] 1.5 Crear modelo `ActivityEnrollment` (gymId, slotId, userId, createdAt, cancelledAt) con `@@unique([slotId, userId])` e índice `[gymId, userId]`
- [x] 1.6 Crear modelo `ActivityBooking` (gymId, sessionId, userId, source ENROLLMENT|SINGLE, status CONFIRMED|CANCELLED, createdById, reminderSentAt, timestamps) con `@@unique([sessionId, userId])` e índices `[gymId, userId]` y `[sessionId, status]`
- [x] 1.7 Generar la migración y aplicarla con `prisma migrate deploy` (Neon no tiene shadow DB; verificar `DATABASE_URL` antes de correr nada — `.env` apunta a producción)

## 2. Gating por módulo

- [x] 2.1 Agregar helpers de módulo en `src/lib/gym.ts` (`hasBookingModule`, `hasTrainingModule`) siguiendo el estilo de `hasAccessControl`
- [x] 2.2 Sumar `bookingEnabled`, `trainingEnabled`, `timezone` al `select` de Prisma en `src/app/[gymSlug]/layout.tsx:73-85` y propagarlos
- [x] 2.3 Agregar la entrada "Turnos" a `getNavLinks` en `src/components/layout/Navbar.tsx:39-113`, condicionada a `bookingEnabled`, para ADMIN, TEACHER y STUDENT
- [x] 2.4 Ocultar WODs / RMs / rutinas del menú cuando `trainingEnabled` es `false`, sin alterar la rama `isPersonalGym`
- [x] 2.5 Agregar el toggle de `bookingEnabled` y `trainingEnabled` al panel de super-admin en `/admin/gyms/[id]`, con su server action en `src/actions/super-admin/gym.ts`
- [x] 2.6 Retrofitear el guard de `trainingEnabled` en las rutas de entrenamiento ya existentes (`dashboard/athlete`, `dashboard/teacher`, `dashboard/mis-rutinas`, `dashboard/rms`): con el módulo apagado, el acceso por URL directa debe rechazarse, no solo desaparecer del menú

## 3. Gestión de actividades (ADMIN / TEACHER)

- [x] 3.1 Server actions de Actividad en `src/actions/activity.ts`: crear, editar, desactivar — con guard de rol y filtro por `gymId`
- [x] 3.2 Server actions de horarios (`ActivitySlot`): agregar, editar, desactivar
- [x] 3.3 Permisos: ADMIN gestiona todas las actividades del gym; TEACHER solo aquellas donde figura a cargo, y como mínimo puede ver los inscriptos
- [x] 3.4 Página de listado y alta/edición de actividades en `src/app/[gymSlug]/turnos/gestion/`, con guard releyendo `bookingEnabled` de DB (patrón de `productos/page.tsx:31-38`)
- [x] 3.5 Vista de una sesión con la lista de inscriptos
- [x] 3.6 Anotar y desanotar alumnos manualmente desde la vista de sesión (necesario para cuentas `LITE`, que no tienen login), registrando `createdById`
- [x] 3.7 Cancelar una sesión puntual sin borrar el horario recurrente
- [x] 3.8 Notificar por push a los alumnos con reserva confirmada cuando el gym cancela una sesión (el spec lo exige y quedó sin implementar en 3.7)
- [x] 3.9 Alta de Actividad con horarios en un solo paso: `Activity.capacity` (cupo por defecto, `prisma/schema.prisma`) y `ActivityDialog` permite agregar/quitar filas de horario (día, inicio, fin, cupo opcional) antes de guardar; `createActivity` crea `Activity` + `ActivitySlot[]` en una transacción, valida al menos un horario, fin > inicio y sin solapamientos del mismo día, y deja claro en la UI que cada horario se repite todas las semanas
- [x] 3.10 Cupo por defecto a nivel Actividad: resolución `slot.capacity ?? activity.capacity ?? null` en `ensureSessionsForSlot` (`src/lib/activity-schedule.ts`) al materializar cada `ActivitySession`
- [x] 3.11 Eliminación de Actividad: botón único "Eliminar" en `ActivityList`; `deleteActivity` borra en cascada si la actividad nunca tuvo `ActivityBooking`, o archiva (`active=false`, desaparece de listas de gestión y calendario del alumno) si tuvo alguna vez, preservando el historial; `previewActivityDeletion` informa alumnos con reserva futura para la confirmación previa; notificación push a los afectados reusando el patrón de `cancelActivitySession`; permisos ADMIN/TEACHER validados en el server action

## 4. Materialización de sesiones

- [x] 4.1 Helper de conversión hora local ↔ instante absoluto usando `Gym.timezone` (tz nombrada, no offset fijo)
- [x] 4.2 Función de materialización: generar `ActivitySession` para los slots activos hasta el horizonte de 4 semanas, idempotente vía `@@unique([slotId, date])`, con snapshot de `capacity`
- [x] 4.3 Derivar `ActivityBooking` de los `ActivityEnrollment` activos al materializar cada sesión nueva, respetando el cupo
- [x] 4.4 Endpoint de cron en `src/app/api/cron/materialize-sessions/` siguiendo el patrón de los crons existentes (auth del cron incluida)
- [x] 4.5 Registrar el cron en `vercel.json` — hoy hay 3, verificar el límite del plan antes de sumar
- [x] 4.6 Materialización on-demand si se consulta una fecha dentro del horizonte que aún no fue generada, para que un cron caído no deje al alumno sin ver sus turnos (`ensureSessionsForSlot` es idempotente y llamable directamente por los server actions de reserva)

## 5. Inscripción y reserva (STUDENT)

- [x] 5.1 Calendario de actividades del gym en `src/app/[gymSlug]/turnos/`, con guard de `bookingEnabled`
- [x] 5.2 Server action de reserva puntual en `src/actions/booking.ts`, con validación atómica de cupo (leer `capacity`, luego `updateMany` condicional sobre `bookedCount`; Prisma no compara columnas entre sí)
- [x] 5.3 Server action de inscripción recurrente: crea el `ActivityEnrollment` y materializa los `ActivityBooking` hasta el horizonte
- [x] 5.4 UI de la pregunta "¿a todas o solo a esta?", ofrecida solo si `Activity.allowsRecurring` es `true`
- [x] 5.5 Cancelar una fecha concreta: marca el `ActivityBooking` como `CANCELLED`, decrementa `bookedCount` y deja intacto el `ActivityEnrollment`
- [x] 5.6 Cancelar la inscripción recurrente: baja las reservas futuras y deja las pasadas
- [x] 5.7 Validar la ventana de cancelación en el server action, no solo en la UI
- [x] 5.8 Bloquear la auto-reserva de cuentas `AccountKind.LITE`
- [x] 5.9 Vista "Mis turnos" del alumno con sus próximas sesiones

## 6. Recordatorios

- [x] 6.1 Función de selección de candidatas: `status=CONFIRMED`, `reminderSentAt=null`, sesión no cancelada, `startsAt` dentro de `Gym.reminderLeadHours`, agrupando por gym
- [x] 6.2 Envío por push reusando `web-push` (ver `docs/notificaciones-push.md`). Sin fallback a email
- [x] 6.3 Estampar `reminderSentAt` solo si el envío salió bien, y continuar con el resto de los candidatos ante un fallo individual
- [x] 6.4 Endpoint de cron en `src/app/api/cron/activity-reminders/` y registro en `vercel.json`
- [x] 6.5 Campo de configuración de `reminderLeadHours` en la pantalla de ajustes del gym

## 7. Verificación

- [x] 7.1 Verificar aislamiento multi-tenant: toda query de actividades, sesiones, inscripciones y reservas filtrada por `gymId` (revisión estática de `src/actions/activity.ts`, `src/actions/booking.ts`, `src/lib/activity-schedule.ts`, `src/lib/activity-reminders.ts` y `src/app/[gymSlug]/turnos/**`; `ActivitySlot` se valida vía `activity.gymId` tras el `findFirst`, sin excepciones)
- [ ] 7.2 Verificar la carrera por el último lugar: dos reservas simultáneas sobre una sesión con cupo 1 dejan exactamente una confirmada (pendiente: requiere DB local o staging, no disponible en este entorno — .env apunta a producción)
- [ ] 7.3 Verificar que cancelar una fecha no rompe la inscripción recurrente, y que el cron la vuelve a materializar en la siguiente fecha (pendiente: requiere DB local o staging, no disponible en este entorno — .env apunta a producción)
- [x] 7.4 Verificar el gating: con `bookingEnabled=false` la sección no aparece en el menú y el acceso por URL directa se rechaza (lectura de código: `Navbar.tsx` solo agrega "Turnos" si `bookingEnabled`, y las 5 páginas bajo `turnos/**` llaman a `isBookingModuleEnabled` y redirigen si es `false`)
- [x] 7.5 Verificar que con `trainingEnabled=false` no se puede acceder a WODs, RMs ni rutinas, y que `PERSONAL` sigue funcionando igual (lectura de código: `dashboard/athlete`, `dashboard/teacher`, `dashboard/mis-rutinas`, `dashboard/rms` llaman a `isTrainingModuleEnabled` y redirigen a `/beneficios`; la rama `isPersonalGym` se excluye del chequeo en los 4 casos)
- [x] 7.6 Verificar que ningún gym existente cambió de comportamiento tras la migración (`bookingEnabled=false` por default) (verificado previamente contra la DB por otro agente: los 9 gyms existentes quedaron con `bookingEnabled=false`; no re-verificado en esta pasada)
- [x] 7.7 Correr `npm run lint` y `npm run build` (`lint` falla con los 2 errores preexistentes de `react-hooks/purity` en `[gymSlug]/layout.tsx:151,197` — sin hallazgos nuevos; `build` termina OK, exit code 0)

## 8. Ajustes post-implementación

- [x] 8.1 Eliminar el campo `Activity.color` (sin uso real en producción): schema, server actions, selects de las 3 páginas de `turnos/`, `ActivityDialog`, `ActivityList`, `TurnosCalendar` y `MyTurnos`
- [x] 8.2 Crear `src/components/ui/TimePicker.tsx` (consistente con `DatePicker`/`ColorPicker`) y reemplazar los 4 `<input type="time">` nativos en `ActivityDialog` y `ActivitySlotManager`

## 9. Actividades de fecha única (ONE_OFF)

- [x] 9.1 Schema: `enum ActivityScheduleKind { WEEKLY ONE_OFF }`, `Activity.scheduleKind` (`@default(WEEKLY)`), `ActivitySlot.dayOfWeek` nullable, `ActivitySlot.date DateTime? @db.Date` (`prisma format` + `validate` + `generate`; migración la aplica el usuario tras auditar el SQL)
- [x] 9.2 `src/actions/activity.ts`: `ActivityInput.scheduleKind` (fijo desde el alta, `updateActivity` lo ignora), `SlotInput`/`SlotRow` con `dayOfWeek: number | null` y `date: string | null`, validación de coherencia (`WEEKLY` exige `dayOfWeek` y prohíbe `date`; `ONE_OFF` exige `date` y prohíbe `dayOfWeek`) en `createActivity`, `createActivitySlot` y `updateActivitySlot`
- [x] 9.3 `src/lib/activity-schedule.ts`: `ensureSessionsForSlot` genera exactamente una `ActivitySession` para un slot `ONE_OFF` en `slot.date`, ignorando el horizonte de 4 semanas; sigue siendo idempotente vía `@@unique([slotId, date])`. `WEEKLY` sin cambios
- [x] 9.4 `src/actions/booking.ts`: `enrollInSlot` rechaza actividades `scheduleKind = ONE_OFF` en el server, independientemente de `allowsRecurring` y de lo que muestre la UI
- [x] 9.5 UI de alta (`ActivityDialog.tsx`): selector de modo de agenda (solo en creación, no editable después); si es `WEEKLY` pide día de la semana (como antes); si es `ONE_OFF` pide fecha con `DatePicker`; oculta el checkbox de inscripción recurrente cuando el modo es `ONE_OFF`
- [x] 9.6 UI de edición de horarios (`ActivitySlotManager.tsx`): recibe `scheduleKind` de la actividad y alterna entre selector de día y `DatePicker` según corresponda
- [x] 9.7 Formato compartido (`format.ts`): `formatSlotSchedule()` muestra la fecha concreta (dd/mm/yyyy) para slots `ONE_OFF` y el nombre del día para `WEEKLY`, usado en `ActivitySlotManager`; el calendario del alumno y "Mis turnos" ya mostraban la fecha concreta de la sesión (no el día suelto) y no requirieron cambios en ese punto
- [x] 9.8 `turnos/page.tsx`: la pregunta "¿a todas o solo a esta?" no se ofrece para actividades `ONE_OFF` (se computa `allowsRecurring = activity.allowsRecurring && scheduleKind !== "ONE_OFF"` al construir las filas del calendario)
- [x] 9.9 Actualizar specs `turnos-activities/spec.md` y `turnos-booking/spec.md` con los requerimientos de modo de agenda, coherencia del slot, materialización `ONE_OFF` y rechazo de inscripción recurrente
- [x] 9.10 Correr `npm run lint` y `npm run build` (mismos 2 errores preexistentes de `react-hooks/purity` en `layout.tsx:151,197`, sin hallazgos nuevos; build OK)

## 10. Vigencia de una actividad WEEKLY (startsOn / endsOn)

- [x] 10.1 Schema: `Activity.startsOn DateTime? @db.Date` y `Activity.endsOn DateTime? @db.Date`, ambas aditivas y nullable (`prisma format` + `validate` + `generate`; migración la aplica el usuario tras auditar el SQL)
- [x] 10.2 `src/lib/activity-schedule.ts`: `ensureSessionsForSlot` acota la rama `WEEKLY` a `[max(hoy, startsOn), min(through, endsOn)]`, ramificando explícitamente cada bound en vez de un `where` genérico con `not` sobre las columnas nullable; `ONE_OFF` sin cambios
- [x] 10.3 `src/actions/activity.ts`: `ActivityInput.startsOn`/`endsOn`, `validateVigencia` (WEEKLY exige `startsOn` y `endsOn >= startsOn` si viene; ONE_OFF prohíbe ambos), aplicada en `createActivity` y `updateActivity`
- [x] 10.4 `updateActivity`: si la actividad es `WEEKLY` y la nueva vigencia deja `ActivitySession` futuras y no canceladas fuera de rango, cancelarlas y notificar por push a los alumnos con reserva confirmada, reusando `cancelSessionsAndNotify` (extraído de `cancelActivitySession` para compartir la lógica); un fallo de envío individual no aborta el resto
- [x] 10.5 UI (`ActivityDialog.tsx`): campos "Se repite a partir de" (obligatorio, default hoy) y "Hasta" (opcional, con toggle "Sin fecha de fin") usando `DatePicker`, visibles solo en `scheduleKind = WEEKLY`; editable también en modo edición
- [x] 10.6 `format.ts`: `formatVigencia`, `formatWeeklyDaysAndTime` y `formatActivitySchedule` para mostrar la vigencia de forma legible ("Lunes y miércoles de 14:00 a 15:00, desde el dd/mm/aaaa" o "..., del dd/mm/aaaa al dd/mm/aaaa")
- [x] 10.7 Mostrar la vigencia en `ActivityList.tsx` (listado de gestión) y en el detalle de la actividad (`turnos/gestion/[activityId]/page.tsx`)
- [x] 10.8 Actualizar `specs/turnos-activities/spec.md` con el requerimiento "Vigencia de una actividad recurrente"
- [x] 10.9 Correr `npm run lint` y `npm run build` (mismos 2 errores preexistentes de `react-hooks/purity` en `layout.tsx:151,197`, sin hallazgos nuevos; build OK)

## 11. startsOn debe coincidir con un día con horario (WEEKLY)

- [x] 11.1 `src/actions/activity.ts`: `startsOnDayMismatch` (helper) valida que el día de la semana de `startsOn` coincida con el `dayOfWeek` de al menos un `ActivitySlot` activo; sin efecto si no hay ningún slot activo con el que comparar. Aplicada en `createActivity` (contra los slots enviados en el alta) y `updateActivity` (contra los slots activos existentes), con mensaje de error que indica los días válidos
- [x] 11.2 `createActivitySlot`, `updateActivitySlot` y `deactivateActivitySlot`: revalidar tras la operación que `startsOn` siga coincidiendo con al menos un slot activo resultante; rechazar (no corregir en silencio) con mensaje indicando que hay que ajustar primero la fecha de inicio
- [x] 11.3 `src/lib/activity-schedule.ts`: verificado (sin cambios de código) que `ensureSessionsForSlot` no tiene off-by-one — la primera sesión cae exactamente en `startsOn` cuando su día de la semana coincide con `slot.dayOfWeek`, reproducido con un script de arithmetic de fechas standalone (4 casos: inicio futuro coincidente, inicio futuro en otro día de la semana, inicio pasado, `endsOn` como último día válido)
- [x] 11.4 UI (`ActivityDialog.tsx`): el default de "Se repite a partir de" es la próxima fecha (desde hoy) que cae en alguno de los días elegidos (`slotDrafts` en alta, `activitySlotDays` — prop nueva con los días de los slots activos actuales — en edición); deshabilitado si todavía no hay ningún día elegido; se recalcula al cambiar los días si el usuario no tocó el campo a mano (`startsOnTouched`); hint bajo el campo con los días válidos y aviso si el valor actual ya no coincide; validación en cliente que espeja (no reemplaza) la del servidor
- [x] 11.5 `src/components/activity/ActivityList.tsx`: pasa `activitySlotDays` (derivado de `editing.slots`) a `ActivityDialog` en modo edición; tipo de `editing` ampliado a `ActivityListRow | "new" | null` para tener los slots disponibles
- [x] 11.6 Actualizar `specs/turnos-activities/spec.md`, requirement "Vigencia de una actividad recurrente": regla de coincidencia de día + 3 escenarios (coincide, no coincide, editar horarios deja `startsOn` inválido)
- [x] 11.7 Correr `npm run lint` y `npm run build`

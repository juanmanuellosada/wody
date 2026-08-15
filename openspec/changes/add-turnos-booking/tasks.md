## 1. Schema y migración

- [x] 1.1 Agregar a `Gym` en `prisma/schema.prisma`: `bookingEnabled Boolean @default(false)`, `trainingEnabled Boolean @default(true)`, `timezone String @default("America/Argentina/Buenos_Aires")`, `reminderLeadHours Int @default(2)`
- [x] 1.2 Crear modelo `Activity` (gymId, name, description, color, teacherId opcional, allowsRecurring, cancelWindowHours default 2, active, timestamps) con índice `[gymId, active]`
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

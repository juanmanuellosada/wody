## Context

Wody no tiene hoy **nada** de agenda: buscar `Class|Schedule|Booking|Slot|Calendar` en `prisma/schema.prisma` da 0 resultados. Lo único con noción de asistencia es `AccessLog` (check-in por QR, `schema.prisma:299-315`), que no está ligado a horarios, y `Group`, que es una lista estática de alumnos sin horario.

El gating por gym tampoco existe como concepto: los feature flags viven en `User` (`canViewRevenue`, `canCreateOwnRoutines`) y lo único que gatea features por gym son dos `Set` hardcodeados por slug en `src/lib/gym.ts:17-30`. No hay modelo de planes ni tiers — `Gym.subscriptionMonthlyAmount` es informativo y el monto real está hardcodeado en `src/lib/mercadopago.ts:172`.

Restricciones que enmarcan el diseño:
- Multi-tenancy estricta: toda query filtrada por `gymId` / `gymSlug`, unicidades compuestas.
- El billing no se toca. Mercado Pago no permite cambiar el monto de un preapproval sin recrearlo, así que cualquier cosa que roce el precio es cara y está fuera de alcance.
- Cuentas `LITE` (`AccountKind.LITE`) no tienen login: existen como alumnos pero no pueden operar por sí mismas.
- `.env` apunta a la base de producción. Las migraciones se aplican con `prisma migrate deploy` (Neon no tiene shadow DB).

## Goals / Non-Goals

**Goals:**
- Modelar actividades con horarios recurrentes semanales y cupo opcional.
- Distinguir **inscripción recurrente** de **reserva puntual**, de modo que cancelar una fecha no desanote al alumno de las demás.
- Validar cupo de forma correcta bajo concurrencia.
- Prender/apagar el módulo por gym sin introducir planes ni tocar el billing.
- Recordar al alumno su sesión antes de que empiece.

**Non-Goals:**
- Lista de espera.
- Límite de clases por socio ("8 clases al mes").
- Vincular el check-in de puerta (`AccessLog`) con la sesión.
- Cobro, seña o pago del turno.
- Reserva pública o anónima. El que reserva **siempre** es un `User` del gym.
- Planes, tiers o cualquier cambio de precio.

## Decisions

### D1 — Cinco entidades, no tres

`docs/analisis-competitivo-y-plan-2026.md` sugiere `ClassSchedule` / `ClassSession` / `Booking`. Ese esquema no cubre la inscripción recurrente, que es el requisito central: *"me anoto a todas y voy cancelando las que no puedo"*.

| Modelo | Rol |
|---|---|
| `Activity` | La actividad en sí: nombre, profe, política de cancelación, si acepta recurrencia |
| `ActivitySlot` | Horario recurrente semanal (día + hora inicio/fin + cupo) |
| `ActivitySession` | Ocurrencia materializada de un slot en una fecha concreta |
| `ActivityEnrollment` | Intención permanente del alumno sobre un slot ("todos los lunes") |
| `ActivityBooking` | Estado del alumno en una sesión concreta |

**Alternativa considerada:** solo `Enrollment` + tabla de excepciones, sin `Booking` materializado. Ocupación = inscriptos − excepciones + reservas sueltas. Menos filas, pero el conteo de cupo se vuelve un query con tres términos, no hay dónde colgar `reminderSentAt`, y no queda rastro auditable de quién canceló qué y cuándo. **Rechazada**: la materialización compra simplicidad en cupo, recordatorios y auditoría a cambio de filas baratas.

**Por qué `Enrollment` apunta a `ActivitySlot` y no a `Activity`:** una actividad puede tener lunes y miércoles, y el alumno puede querer solo los lunes.

### D2 — Materialización eager con horizonte, vía cron

`ActivitySession` se genera por adelantado con un horizonte fijo (propuesta: **4 semanas**), mediante un cron diario que además crea los `ActivityBooking` derivados de las inscripciones activas.

**Alternativa considerada:** sesiones virtuales calculadas al vuelo, materializadas solo cuando alguien reserva. Menos filas, pero contar cupo y disparar recordatorios obliga a materializar igual, y el merge entre ocurrencias virtuales y reales es código sutil y fácil de romper.

**Elegida la eager** porque el volumen es trivial (una actividad con 3 horarios genera 12 sesiones por mes) y porque ya existe infraestructura de cron en `src/app/api/cron/` con tres jobs andando.

Consecuencia: inscribirse "a todas" crea bookings solo hasta el horizonte; el cron los extiende. Por eso `Enrollment` es la fuente de verdad y `Booking` es derivado.

### D3 — Cupo: snapshot en la sesión + contador atómico

`ActivitySlot.capacity` es nullable — `null` significa **sin límite**. Al materializar, la sesión toma un *snapshot* de ese cupo, para que cambiar el cupo del horario no invalide reservas ya confirmadas.

Para la concurrencia (dos alumnos tomando el último lugar a la vez), la sesión lleva un contador `bookedCount` y la reserva se hace así:

1. Leer la sesión (obtener `capacity`).
2. Si `capacity` es `null` → insertar directo.
3. Si no → `updateMany({ where: { id, bookedCount: { lt: <capacity leída> } }, data: { bookedCount: { increment: 1 } } })`.
4. Si devuelve `count: 0`, el cupo se llenó → error de negocio, no se crea el booking.

Se usa un literal en el `where` porque Prisma no permite comparar dos columnas entre sí. El `updateMany` condicional es atómico en Postgres, así que no hace falta transacción serializable ni SQL crudo.

Doble reserva del mismo alumno se previene con `@@unique([sessionId, userId])`.

**Ojo con `not` sobre columnas nullable en Prisma**: descarta las filas `NULL` silenciosamente. Cualquier filtro sobre `capacity` debe ramificar explícitamente entre "sin límite" y "con límite", nunca usar `not`.

### D4 — Recurrencia y cupo conviven como "lugares fijos"

Si una actividad con cupo 12 recibe 12 inscripciones recurrentes, queda ocupada por las mismas personas indefinidamente. Para un taller con lugares fijos eso es el comportamiento deseado; para una clase de demanda rotativa, no.

Se resuelve con `Activity.allowsRecurring`: el admin decide por actividad si acepta inscripción recurrente o solo reserva fecha por fecha. Si es `false`, la UI no ofrece la pregunta "¿a todas o solo a esta?".

### D5 — Zona horaria explícita en `Gym`

Los horarios se guardan como minutos desde medianoche **en hora local del gym** (`startMinute` / `endMinute`), y la sesión materializada guarda además el instante absoluto (`startsAt` / `endsAt`) para ordenar, filtrar y disparar recordatorios sin recalcular.

Convertir uno en otro requiere saber la zona horaria, y `Gym` hoy no la tiene. Se agrega `Gym.timezone` con default `America/Argentina/Buenos_Aires`. Es un campo con default seguro, y evita una migración dolorosa cuando aparezca el primer cliente fuera de Argentina — la expansión LatAm ya figura en Fase 3 del plan 2026. Argentina no tiene DST, pero varios países de la región sí, y la conversión debe hacerse con la tz nombrada (no con un offset fijo) para que siga siendo correcta.

### D6 — Alta manual por parte del profe, para cuentas LITE

Los alumnos `AccountKind.LITE` no tienen login y no pueden auto-anotarse. Un `ADMIN` o `TEACHER` puede anotar y desanotar alumnos en una sesión desde la vista de gestión. `ActivityBooking.createdById` registra quién originó la reserva, para distinguir la auto-reserva de la carga manual.

### D7 — Gating por módulo en `src/lib/gym.ts`

`Gym.bookingEnabled` (default `false`) y `Gym.trainingEnabled` (default `true`) se leen en `src/app/[gymSlug]/layout.tsx:73-85`, se propagan a `getNavLinks` (`src/components/layout/Navbar.tsx:39-113`) y cada página nueva revalida el flag contra la DB, siguiendo el patrón de `src/app/[gymSlug]/productos/page.tsx:31-38` (no confiar en el token).

Las funciones de módulo viven en `src/lib/gym.ts`, junto a `hasAccessControl` y compañía. Los `Set` hardcodeados por slug existentes **no se migran en este cambio** — es refactor separado y mezclarlo agranda el diff sin necesidad.

`trainingEnabled=false` oculta WODs, RMs y rutinas. No afecta la rama `isPersonalGym` de la navbar, que ya arma su propio menú.

### D8 — Recordatorios por push, con antelación configurable por gym

Un cron busca `ActivityBooking` con `status=CONFIRMED`, `reminderSentAt=null` y sesión que arranca dentro de la ventana de aviso, envía y estampa `reminderSentAt`. Es el mismo patrón que `src/app/api/cron/notify-due-today`, e idempotente por el sello: el sello se estampa solo si el envío salió bien.

**Push es el único canal.** No hay fallback a email. Un alumno sin `PushSubscription` activa simplemente no recibe recordatorio de turno. Esto evita arrastrar la cuota de Resend y el copy de otro canal a la v1; si más adelante hace falta, el fallback se agrega sin tocar el modelo.

La antelación es **configurable por gym**: `Gym.reminderLeadHours`, default `2`. El cron agrupa por gym y aplica la ventana de cada uno.


**Restricción del plan de Vercel (confirmado: la cuenta es Hobby).** En Hobby los cron jobs solo pueden correr **una vez por día** — una expresión sub-diaria falla el deploy — y la precisión es ±59 min. El cron de materialización es diario, así que no le afecta. El de recordatorios sí: para avisar 2 h antes hay que dispararlo al menos cada hora.

El endpoint de recordatorios se implementa igual en todos los casos; solo cambia quién lo dispara:

| Disparador | Viable en Hobby | Nota |
|---|---|---|
| Cron de Vercel diario | Sí | Degrada el aviso a un resumen "tus turnos de hoy" |
| Scheduler externo (GitHub Actions) cada 30 min | Sí | Mantiene el aviso 2 h antes sin cambiar de plan |
| Cron de Vercel horario | Solo en Pro | El deploy falla en Hobby |

El endpoint debe ser idempotente y seguro de invocar con cualquier frecuencia — cosa que ya garantiza el sello `reminderSentAt` — de modo que cambiar de disparador no requiera tocar código.

### D9 — Ventana de cancelación por actividad

`Activity.cancelWindowHours` (default propuesto: `2`). Se valida **en el server action**, no solo en la UI. Cancelar fuera de ventana devuelve error de negocio. Cancelar una sesión puntual marca ese `ActivityBooking` como `CANCELLED` y deja intacto el `ActivityEnrollment`.

## Risks / Trade-offs

- **Inscripción recurrente + cupo bloquea la actividad para alumnos nuevos** → mitigado con `allowsRecurring` por actividad (D4). Es una decisión de negocio explícita del admin, no un efecto colateral.
- **Crecimiento de filas por materialización** → horizonte corto (4 semanas) y volumen bajo por gym. Si molesta, se agrega purga de sesiones pasadas; no hace falta en v1.
- **Cantidad de cron jobs de Vercel** → ya hay 3 (`check-gym-trials`, `email-quota`, `notify-due-today`). Verificar el límite del plan antes de agregar dos más; si aprieta, materialización y recordatorios pueden convivir en un solo endpoint.
- **Migración contra producción** → `.env` apunta a la base real. El cambio es puramente aditivo y con defaults seguros, pero debe aplicarse con `prisma migrate deploy` y revisando `DATABASE_URL` antes de correr nada.
- **`bookingEnabled=false` por default** significa que el módulo nace apagado para todos los gyms actuales: cero impacto en producción hasta prenderlo a mano. Es también la estrategia de rollback.
- **Desfasaje entre `Enrollment` y `Booking`** si el cron falla varios días: los alumnos inscriptos no verían sus reservas futuras. Mitigado porque la materialización es idempotente y al correr se pone al día sola; conviene además materializar on-demand si alguien abre una fecha aún no generada.

## Migration Plan

1. Migración aditiva: 5 modelos nuevos + `Gym.bookingEnabled`, `Gym.trainingEnabled`, `Gym.timezone`. Todos con default; ninguna columna existente cambia.
2. Aplicar con `prisma migrate deploy`.
3. Deploy del código con el módulo apagado en todos los gyms (`bookingEnabled=false`) → producción no cambia.
4. Prender el flag en un gym piloto y validar el ciclo completo: crear actividad → inscribirse → cancelar una fecha → recibir recordatorio.
5. **Rollback**: apagar `bookingEnabled`. Los datos quedan pero dejan de ser accesibles. No hace falta revertir la migración.

## Decisiones cerradas con el usuario

Estas eran preguntas abiertas y ya están resueltas:

1. **`bookingEnabled` lo prende el super-admin** desde `/admin/gyms/[id]`, no el admin del gym. Permite controlar el rollout gym por gym.
2. **La antelación del recordatorio es configurable por gym** (`Gym.reminderLeadHours`, default 2 h) — ver D8.
3. **Solo push.** Sin fallback a email — ver D8.
4. **El profe a cargo gestiona su actividad**, como mínimo puede ver quiénes van. `ADMIN` gestiona todas las actividades del gym; `TEACHER` gestiona aquellas donde figura a cargo.
5. **`Gym.timezone`** se agrega en este cambio, con default `America/Argentina/Buenos_Aires` — ver D5.

## Open Questions

1. **Ventana de cancelación por defecto: 2 horas** (`Activity.cancelWindowHours`). Asumido, pendiente de confirmación explícita. Es configurable por actividad, así que el default solo afecta a las actividades recién creadas.

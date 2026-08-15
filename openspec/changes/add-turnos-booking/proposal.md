## Why

Wody no tiene agenda ni reserva de clases, que es el table stake #1 de la categoría (`docs/analisis-competitivo-y-plan-2026.md` lo marca como P0 / Fase 1): CrossHero, BoxMagic, Wodify y Zen Planner lo tienen y Wody no. Además, hay centros que ofrecen actividades con horario fijo y cupo (talleres, clases especiales, pilates, funcional) que hoy no pueden gestionarse en la plataforma.

Este cambio agrega el módulo **Turnos**: un centro define actividades con horarios recurrentes y cupo opcional, y sus alumnos se anotan. Se entrega dentro del mismo plan y al mismo precio — no es un upsell, es la feature que cierra la brecha competitiva.

## What Changes

**Gestión de actividades (ADMIN / TEACHER)**
- Alta de Actividad: nombre, descripción, profe a cargo (opcional).
- Uno o más horarios recurrentes semanales por actividad (ej. lunes 14:00–15:00, miércoles 14:00–15:00).
- Cupo **opcional** por horario: con límite de personas o sin límite.
- Flag por actividad: si acepta inscripción recurrente o solo reserva fecha por fecha.
- Ventana de cancelación configurable (horas antes del inicio).
- Vista de quiénes están anotados en cada fecha; posibilidad de anotar/desanotar a un alumno manualmente (necesario para cuentas LITE, que no tienen login).

**Inscripción y reserva (STUDENT)**
- Calendario de actividades disponibles del gym.
- Al anotarse a una actividad recurrente, se pregunta **"¿a todas o solo a esta?"**.
- **Inscripción** (recurrente) y **Reserva** (fecha concreta) son dos conceptos distintos: cancelar una fecha no rompe la inscripción.
- Cancelación permitida solo dentro de la ventana configurada.
- El cupo se valida contra las reservas confirmadas de esa sesión.

**Módulos por gym**
- Dos booleanos nuevos en `Gym`: `bookingEnabled` (default `false`) y `trainingEnabled` (default `true`).
- `bookingEnabled` prende la sección Turnos. `trainingEnabled=false` oculta WODs / RMs / rutinas, para un centro que solo usa turnos.
- **El billing no cambia**: mismo monto para todos, sin planes ni tiers. No se tocan los preapprovals de Mercado Pago.

**Recordatorios**
- Aviso al alumno antes de su sesión, vía web-push y/o email, reusando la infraestructura existente.

Sin breaking changes: los dos campos nuevos de `Gym` tienen default y `bookingEnabled=false` deja a todos los gyms actuales exactamente como están.

## Capabilities

### New Capabilities
- `turnos-activities`: definición de actividades, horarios recurrentes, materialización de sesiones y configuración de cupo y ventana de cancelación. Vista de gestión para ADMIN/TEACHER.
- `turnos-booking`: inscripción recurrente y reserva por sesión de un alumno, cancelación con ventana, validación de cupo y vista de calendario del alumno.
- `turnos-reminders`: recordatorio al alumno antes de la sesión vía push y/o email.
- `gym-modules`: activación por gym de los módulos Turnos y Entrenamiento (`bookingEnabled` / `trainingEnabled`), y su efecto en navegación y guards de página.

### Modified Capabilities
<!-- Ninguna. Ningún spec existente cambia sus requerimientos: el módulo es aditivo y el billing, los roles y las cuentas LITE se respetan tal como están hoy. -->

## Impact

**Schema (`prisma/schema.prisma`)** — 5 modelos nuevos y 2 campos en `Gym`:
- `Activity`, `ActivitySlot` (horario recurrente), `ActivitySession` (ocurrencia materializada), `ActivityEnrollment` (inscripción recurrente), `ActivityBooking` (reserva de una fecha).
- `Gym.bookingEnabled`, `Gym.trainingEnabled`.
- Migración: usar `prisma migrate deploy` (Neon no tiene shadow DB configurada). Cuidado: `.env` apunta a producción.

**Código**
- `src/lib/gym.ts` — capa de gating por módulo. Hoy tiene Sets hardcodeados por slug (`:17-30`); evaluar alinear el patrón.
- `src/app/[gymSlug]/layout.tsx:73-85` — sumar los flags al `select` de Prisma y propagarlos.
- `src/components/layout/Navbar.tsx:39-113` — entradas de menú de Turnos y ocultamiento de entrenamiento.
- `src/app/[gymSlug]/turnos/**` — rutas nuevas (alumno y gestión), con guard por página releyendo de DB (patrón de `productos/page.tsx:31-38`).
- `src/actions/activity.ts`, `src/actions/booking.ts` — server actions nuevas.
- `src/app/api/cron/**` — cron nuevo para materializar sesiones con horizonte y para disparar recordatorios.

**Sin impacto**
- `src/lib/mercadopago.ts`, montos, preapprovals y todo el flujo de billing quedan intactos.
- `GymKind` se mantiene `GYM | BOX | PERSONAL`.

**Multi-tenancy**: toda query nueva se filtra por `gymId` / `gymSlug`. Unicidad compuesta para evitar doble reserva del mismo alumno en la misma sesión.

**Fuera de alcance (v1)**: lista de espera, límite de clases por socio, vínculo con el check-in de puerta (`AccessLog`), cobro o seña del turno, reserva pública sin cuenta.

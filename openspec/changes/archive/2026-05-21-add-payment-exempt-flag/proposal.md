## Why

Algunos alumnos no tienen que pagar cuota (familiares del dueño del gym, staff, becados, comodatos). Hoy el sistema no los distingue: aparecen como "atrasados" en `/[gymSlug]/pagos`, disparan recordatorios push de vencimiento y caen en `PENDING` al hacer check-in en la puerta. Eso obliga a los admins a moverles `nextPaymentDate` a mano de forma indefinida y ensucia la sección de cobranza.

## What Changes

- **Modelo `User`**: agregar `paymentExempt Boolean @default(false)` y `paymentExemptReason String?` (texto libre opcional para dejar constancia del motivo).
- **Migración Prisma**: nueva migration aplicable con `prisma migrate deploy` (Neon no tiene shadow DB), backfill = `false` para todos los usuarios existentes.
- **Server action `setStudentPaymentExempt`** en `src/actions/user.ts`: solo `ADMIN`, toggle del flag + edición del motivo, scoped por `gymId`. Un `TEACHER` NO puede cambiarlo.
- **Acceso (`isUserAlDia` en `src/lib/checkin.ts`)**: un alumno exento se considera al día siempre (salvo `blockedAt`), por lo que su check-in resuelve `OK` y no `PENDING`.
- **Push de vencimiento (`sendDueReminderIfNeeded` en `src/lib/push.ts` + cron `notify-due-today`)**: excluir exentos del barrido; nunca recibe el recordatorio "tu cuota vence".
- **Sección `/[gymSlug]/pagos`**: los exentos NO cuentan en los contadores "Atrasados" / "Por vencer", aparecen en una pestaña/filtro separado "Exentos" y muestran un badge "Exento" en lugar de la fecha de próximo pago. La estadística de recaudación NO se afecta (sigue mirando `Payment`, no estado de cuota).
- **Editor de alumno (`EditStudentButton`)**: un `ADMIN` ve un toggle "Exento de pago" + campo opcional "Motivo".
- **Banner del alumno (`PaymentStatusBanner`)**: si el alumno es exento, muestra "Exento de pago" en vez del estado al día / atrasado / por vencer.
- **Registro de pago**: si un `ADMIN` intenta registrar un pago a un alumno exento, el popup advierte ("Este alumno está marcado como exento") pero PERMITE confirmar — útil para casos puntuales donde el exento decide aportar.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `payment-tracking`: agrega el concepto de **alumno exento**, su efecto sobre contadores de cobranza / recordatorios push / check-in / registro de pago, los permisos para togglearla (solo `ADMIN`) y su visibilidad en la UI.

## Impact

- **Schema / DB**: nueva columna en `User`, nueva migration. Compatible con datos existentes (default `false`).
- **Server actions afectadas**: `src/actions/user.ts` (nueva action), `src/actions/payment.ts` (warning opcional al registrar pago de exento).
- **Lógica de dominio**: `src/lib/checkin.ts` (`isUserAlDia`), `src/lib/push.ts` (`sendDueReminderIfNeeded`), `src/app/api/cron/notify-due-today/route.ts`.
- **UI**: `src/app/[gymSlug]/pagos/page.tsx`, `src/components/EditStudentButton.tsx`, `src/components/RegisterPaymentDialog.tsx`, `src/components/PaymentStatusBanner.tsx`.
- **Fuera de alcance**: estadísticas de recaudación (no se tocan), exenciones temporales con fechas (queda como posible follow-up si aparece la necesidad), exenciones a nivel de profe/admin (esos roles ya no tienen mora hoy).

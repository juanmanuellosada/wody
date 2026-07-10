# Caja y Control de Pagos

`/[gymSlug]/pagos` y `/[gymSlug]/caja` cubren dos responsabilidades separadas sobre los pagos de cuota de los alumnos.

## `/pagos` — Control de Pagos

Accesible por `ADMIN` y `TEACHER`. Muestra la lista de alumnos con su estado de cuota (al día / atrasado / por vencer / exento), permite editar al alumno y bloquearlo. Filtrable por estado de cuota y por tipo de alumno (`StudentType`), de forma combinable. **No** expone recaudación, gráficos, historial de pagos ni la acción de registrar un pago.

## `/caja` — Caja

Accesible por `ADMIN` y `TEACHER` (no `STUDENT`/`ACCESS`, no gym `kind = PERSONAL`). Concentra:

- **Registrar pago** — botón disponible para todo `ADMIN`/`TEACHER`. Un `TEACHER` solo puede registrar pagos de sus alumnos asignados. Es la **única** vía para registrar pagos en la app; `/pagos` no tiene ningún acceso a este flujo.
- **Recaudación** (montos, gráficos de evolución mensual) y el **historial de pagos** — visibles únicamente para `ADMIN` con el permiso `User.canViewRevenue = true`. Para el resto del staff (otros `ADMIN` y todo `TEACHER`) esta información ni se calcula ni se envía al cliente. El gate lee `canViewRevenue` fresco desde la base (no confía en el token de NextAuth, que puede quedar desactualizado tras una designación/revocación reciente).
- Filtro por tipo de alumno (`StudentType`) sobre la recaudación, con opciones según el `kind` del gym (`MUSCULACION_LIBRE` solo en `GYM`).

## Permiso `canViewRevenue`

Campo `User.canViewRevenue Boolean @default(false)`, semánticamente válido solo en usuarios `role = ADMIN`. Un `ADMIN` designado (con `canViewRevenue = true`) puede habilitar/deshabilitar el permiso sobre otros `ADMIN` del mismo gym desde el Panel Admin (`ToggleCanViewRevenueButton`, action `setCanViewRevenue` en `src/actions/user.ts`). Guardrail: nunca se puede quitar el permiso al último `ADMIN` designado de un gym — siempre queda al menos uno.

En cada gym (excepto `kind = PERSONAL`) existe en todo momento al menos un `ADMIN` con `canViewRevenue = true`, sembrado en la migración `prisma/migrations/20260710000000_add_can_view_revenue/migration.sql`.

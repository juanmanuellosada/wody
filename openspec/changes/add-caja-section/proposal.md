## Why

Hoy `/pagos` mezcla dos cosas con sensibilidades distintas: el **control operativo de cuotas** (quién está al día / atrasado, registrar un pago) y la **información económica del gym** (recaudación total, evolución mensual, historial completo de pagos). Cualquier `ADMIN` o `TEACHER` que entra a `/pagos` ve la recaudación, cuando en muchos gimnasios ese dato debe estar restringido a dueños/socios. Separar ambas responsabilidades permite que los profes sigan operando (registrar pagos, ver estado de cuotas) sin exponer la facturación del gym, y que solo personas designadas vean la plata.

## What Changes

- **Nueva sección "Caja" en `/caja`** — accesible por `ADMIN` y `TEACHER` (no `STUDENT`/`ACCESS`, no gym `PERSONAL`). Concentra la información económica y el alta de pagos.
- **Nuevo permiso por usuario `canViewRevenue`** (`User.canViewRevenue Boolean @default(false)`). Solo los `ADMIN` con este permiso ven la **Recaudación** (montos + gráficos de evolución) y el **Historial de pagos** dentro de `/caja`. Los demás `ADMIN` y todos los `TEACHER` entran a `/caja` pero solo ven **Registrar pago**.
- **El Historial de pagos pasa a estar gateado por `canViewRevenue`** — se mueve a `/caja` junto con la recaudación, porque sumar el historial permite deducir la recaudación.
- **`/pagos` queda solo con "Control de Pagos"** — la tabla de alumnos con su estado de cuota (al día / atrasado / por vencer / exento), edición y bloqueo. **BREAKING** para la UI: se quitan de `/pagos` la Recaudación, los gráficos, el Historial de pagos y el botón standalone de Registrar pago (se mueven a `/caja`).
- **Designación de quién ve la recaudación desde la edición de usuarios** — un `ADMIN` con `canViewRevenue` puede habilitar/deshabilitar el permiso a **otros `ADMIN`** del mismo gym. Guardrail: nunca se puede quitar el permiso al último `ADMIN` que lo tiene en un gym (siempre queda ≥1).
- **Semilla por defecto en base de datos** — al aplicar la migración, en cada gym el `ADMIN` designado arranca con `canViewRevenue=true` (lista concreta por gym; fallback general: el `ADMIN` más antiguo).
- **Filtro por tipo de alumno (`StudentType`)** — nuevo en dos lugares: la Recaudación en `/caja` (montos/gráficos por tipo) y el Control de Pagos en `/pagos` (tabla por tipo), adaptándose al `kind` del gym (`MUSCULACION_LIBRE` solo en `GYM`).
- **Link "Caja" en el Navbar** para `ADMIN` y `TEACHER`.

## Capabilities

### New Capabilities
- `caja`: La sección `/caja`: su control de acceso por rol, la visibilidad de la Recaudación y el Historial de pagos condicionada a `canViewRevenue`, el flujo Registrar pago para todos los profes, y el filtro por tipo de alumno sobre la recaudación.

### Modified Capabilities
- `payment-tracking`: La Recaudación, los gráficos de evolución, el Historial de pagos y el botón standalone Registrar pago dejan de vivir en `/pagos`; `/pagos` queda como "Control de Pagos" (estado de cuotas por alumno) e incorpora filtro por tipo de alumno además del filtro por estado.
- `user-roles`: Nuevo permiso por usuario `canViewRevenue`, su operación de asignación/revocación restringida a `ADMIN` designantes sobre `ADMIN` del mismo gym, el guardrail de "último designado" y el valor por defecto sembrado en base.

## Impact

- **Schema/DB**: nuevo campo `User.canViewRevenue` (migración additive `migrate deploy`) + data-migration de backfill por gym.
- **Rutas**: nueva `src/app/[gymSlug]/caja/`; modificación de `src/app/[gymSlug]/pagos/page.tsx`.
- **Componentes**: reubicación/adaptación de `PaymentStatsPanel`, `PaymentEvolutionChart`, `PaymentHistorySection`, `RegisterPaymentButton`/`RegisterPaymentSection`; `PaymentFilters` extendido con tipo de alumno; `Navbar` (link Caja); `StudentEditor` o UI de edición de admin para el toggle de `canViewRevenue`.
- **Server actions / lib**: nueva action de designación en `src/actions/user.ts`; `src/lib/payment-stats.ts` extendido con filtro por `studentType`; gating de recaudación/historial por `canViewRevenue` en los Server Components.
- **Auth/permeabilidad**: nueva condición de autorización basada en `session.user.canViewRevenue` (verificar que el campo se propague en el token/sesión de NextAuth).
- **Docs**: nota del permiso en `docs/`.

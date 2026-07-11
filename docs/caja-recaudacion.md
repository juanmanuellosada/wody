# Caja y Control de Pagos

`/[gymSlug]/pagos` y `/[gymSlug]/caja` cubren dos responsabilidades separadas sobre los pagos de cuota de los alumnos.

## `/pagos` — Control de Pagos

Accesible por `ADMIN` y `TEACHER`. Muestra la lista de alumnos con su estado de cuota (al día / atrasado / por vencer / exento), permite editar al alumno y bloquearlo. Filtrable por estado de cuota y por tipo de alumno (`StudentType`), de forma combinable. **No** expone recaudación, gráficos, historial de pagos ni la acción de registrar un pago.

## `/caja` — Caja

Accesible por `ADMIN` y `TEACHER` (no `STUDENT`/`ACCESS`, no gym `kind = PERSONAL`). Concentra:

- **Registrar pago** — botón disponible para todo `ADMIN`/`TEACHER`. Un `TEACHER` solo puede registrar pagos de sus alumnos asignados. Es la **única** vía para registrar pagos en la app; `/pagos` no tiene ningún acceso a este flujo.
- **Nueva venta** — botón disponible para todo `ADMIN`/`TEACHER`, independientemente de `canViewRevenue`. Ver [Ventas de productos](#ventas-de-productos).
- **Registrar gasto** — botón visible únicamente para `ADMIN` con `canViewRevenue = true`. Ver [Gastos](#gastos).
- **Recaudación** (montos, gráficos de evolución mensual) y el **historial de pagos** — visibles únicamente para `ADMIN` con el permiso `User.canViewRevenue = true`. Para el resto del staff (otros `ADMIN` y todo `TEACHER`) esta información ni se calcula ni se envía al cliente. El gate lee `canViewRevenue` fresco desde la base (no confía en el token de NextAuth, que puede quedar desactualizado tras una designación/revocación reciente).
- Filtro por tipo de alumno (`StudentType`) sobre la recaudación, con opciones según el `kind` del gym (`MUSCULACION_LIBRE` solo en `GYM`).
- Selector de **3 vistas de recaudación**: Alumnos / Productos / Mixta. Ver [Vistas de recaudación](#vistas-de-recaudación).

## Permiso `canViewRevenue`

Campo `User.canViewRevenue Boolean @default(false)`, semánticamente válido solo en usuarios `role = ADMIN`. Un `ADMIN` designado (con `canViewRevenue = true`) puede habilitar/deshabilitar el permiso sobre otros `ADMIN` del mismo gym desde el Panel Admin (`ToggleCanViewRevenueButton`, action `setCanViewRevenue` en `src/actions/user.ts`). Guardrail: nunca se puede quitar el permiso al último `ADMIN` designado de un gym — siempre queda al menos uno.

En cada gym (excepto `kind = PERSONAL`) existe en todo momento al menos un `ADMIN` con `canViewRevenue = true`, sembrado en la migración `prisma/migrations/20260710000000_add_can_view_revenue/migration.sql`.

Desde `add-productos-ventas-gastos`, el flag también gobierna la gestión de productos/categorías (`/productos`) y el registro de gastos — un solo permiso habilita las tres capacidades (ver recaudación, administrar productos, registrar gastos).

## `/productos` — Catálogo

Accesible únicamente por `ADMIN` con `canViewRevenue = true` (mismo gate que la recaudación, leído fresco de DB); no disponible en gyms `kind = PERSONAL`. Permite dar de alta **categorías** (`ProductCategory`, único `(gymId, name)`, no se puede borrar una categoría con productos activos) y **productos** (`Product`: descripción, categoría, precio de venta, stock, y un **código** entero único por gym entre productos activos).

El código de producto se autogenera con un contador por gym (`Gym.nextProductCode`), mismo patrón transacción-con-fallback-`P2002` que `memberNumber` (`src/actions/user.ts`); el usuario puede sobreescribirlo manualmente al crear o editar. Los productos se dan de baja con soft-delete (`Product.deletedAt`) para no romper ventas históricas que los referencian.

Acciones en `src/actions/product.ts`.

## Ventas de productos

"Nueva venta" (en Caja) crea un `Sale`: producto, cantidad (≥ 1, default 1), importe unitario (pre-llenado con `Product.salePrice`, editable), método de pago (`PaymentMethod`, obligatorio) y fecha (default hoy, sin futuras). El importe total se persiste como snapshot (`Sale.totalAmount`) para que editar el producto no altere ventas pasadas.

La venta **descuenta stock** del producto en la misma transacción, **sin bloquear** si el stock queda en cero o negativo — la UI avisa (no bloqueante) cuando la venta deja el stock en ≤ 0. Registrar una venta está disponible para `ADMIN` y `TEACHER`; editar/eliminar es exclusivo de `ADMIN` (`src/actions/sale.ts`).

## Gastos

"Registrar gasto" (en Caja, solo designados) crea un `Expense`: importe (> 0), descripción y fecha (default hoy, sin futuras). Editar/eliminar también exclusivo de `ADMIN` con `canViewRevenue = true` (`src/actions/expense.ts`).

## Vistas de recaudación

El panel de recaudación (`RevenuePanel`) ofrece 3 vistas, seleccionables por querystring `revenueView` (`alumnos` | `productos` | `mixta`, default `alumnos`), todas detrás del gate `canViewRevenue`:

- **Alumnos** — comportamiento histórico: recaudación de cuotas (`Payment`), filtros por período, profesor, método y tipo de alumno.
- **Productos** — recaudación por ventas (`Sale`): monto y cantidad de ventas del período, filtros por período, método y categoría opcional.
- **Mixta** — resultado neto del período: `Ingresos (cuotas + ventas) − Gastos = Resultado`, con el desglose de cada componente, evolución mensual (ingresos vs. gastos) y el historial por pestañas (Cuotas / Ventas / Gastos).

Cálculos en `src/lib/payment-stats.ts` (cuotas, ya existente) y `src/lib/finance-stats.ts` (ventas, gastos y el resultado neto combinado — archivo hermano de `payment-stats.ts`, reusa sus funciones exportadas `getPaymentStats`/`getMonthlyEvolution`/`getPaymentHistory` para la parte de cuotas).

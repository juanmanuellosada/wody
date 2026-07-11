## Why

Hoy Caja solo registra un tipo de ingreso: las cuotas de los alumnos. Para tener control completo de la economía del gym hace falta sumar las otras dos patas del flujo de caja: **ventas de productos** (otro ingreso) y **gastos** (egresos). Con las tres, Caja pasa de "cuánto entró por cuotas" a un mini estado de resultados: `(cuotas + ventas) − gastos = resultado del período`.

## What Changes

- **Nueva sección "Productos" en `/productos`** — ABM de productos y sus categorías. Solo la ven y gestionan los **admins designados** (mismo permiso `canViewRevenue` que la recaudación).
- **Modelo de producto**: pertenece a una **categoría**, tiene un **código** autogenerable (autoincremental por gym, editable), **descripción**, **precio de venta** y **stock**.
- **Ventas en Caja ("Nueva venta")** — la registra **cualquiera** con acceso a Caja (`ADMIN` + `TEACHER`). Una venta elige un producto, **cantidad** (default 1), precio autocompletado del producto pero **editable**, y **método de pago** (reusa el enum `PaymentMethod`). La venta **descuenta stock**: si queda en 0 o negativo **avisa pero no bloquea**.
- **Gastos en Caja ("Registrar gasto")** — solo los **admins designados**. Un gasto pide **importe** y **descripción** (+ fecha, editable, default hoy).
- **Recaudación con 3 vistas** — los designados ven la recaudación con un selector de vista: **Alumnos** (la actual, cuotas), **Productos** (ventas), y **Mixta** (resultado neto: ingresos cuotas + ventas menos gastos, con el desglose).
- **Link "Productos" en el Navbar** — visible solo a admins designados.
- **BREAKING** (menor): el permiso `canViewRevenue` amplía su alcance — ya no es solo "ver recaudación", ahora habilita también gestionar productos y registrar gastos. Un solo flag gobierna las tres capacidades (decisión del usuario).

## Capabilities

### New Capabilities
- `product-catalog`: Productos y categorías (ABM), generación de código autoincremental por gym, y el permiso de gestión (solo admins designados). Incluye la lectura del catálogo para quienes registran ventas.
- `sales`: Registro de ventas de productos en Caja (producto + cantidad + precio + método de pago), descuento de stock con aviso-sin-bloqueo, quién puede registrarlas, y su corrección/eliminación.
- `expenses`: Registro de gastos del gym (importe + descripción + fecha), restringido a admins designados, y su corrección/eliminación.

### Modified Capabilities
- `caja`: La sección `/caja` incorpora "Nueva venta" (para todos los profes) y "Registrar gasto" (solo designados), y el panel de recaudación pasa a tener tres vistas seleccionables (Alumnos / Productos / Mixta-neta), todas detrás del gate `canViewRevenue`.

## Impact

- **Schema/DB**: nuevos modelos `Product`, `ProductCategory`, `Sale`, `Expense`; nuevo `Gym.nextProductCode Int @default(1)`. Migración additive (`migrate deploy`). Reusa el enum `PaymentMethod`. Sin backfill (feature nueva). Multi-tenant: `gymId` en todos, código único por gym.
- **Rutas**: nueva `src/app/[gymSlug]/productos/`; modificación de `src/app/[gymSlug]/caja/page.tsx` y `src/app/[gymSlug]/layout.tsx` (pasar `canViewRevenue` fresco al Navbar).
- **Componentes**: nuevos `NewSaleDialog`/`NewSaleButton`, `RegisterExpenseDialog`/`RegisterExpenseButton`, `ProductForm`/lista de productos, selector de vista de recaudación; `RevenuePanel` parametrizado por vista; `Navbar` (prop + link Productos).
- **Server actions / lib**: nuevas actions `product.ts` (crear/editar/eliminar producto y categoría), `sale.ts` (registrar/editar/eliminar venta), `expense.ts` (registrar/editar/eliminar gasto); nuevo `finance-stats.ts` (o extensión de `payment-stats.ts`) para las vistas Productos y Mixta.
- **Docs**: extender `docs/caja-recaudacion.md` con productos, ventas y gastos.

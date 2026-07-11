## Context

La sección Caja (`src/app/[gymSlug]/caja/page.tsx`) hoy muestra el botón "Registrar pago" (para `ADMIN`+`TEACHER`) y, detrás del gate `canViewRevenue` (leído fresco de DB, `caja/page.tsx:97-103`), el `RevenuePanel` con la recaudación de cuotas. La recaudación se calcula en `src/lib/payment-stats.ts` (funciones server-side sobre `Payment`, no server actions). El permiso `canViewRevenue` (flag en `User`, `schema.prisma:155`) se asigna con `setCanViewRevenue` (`user.ts:999`) y se lee fresco por el JWT stale.

Piezas que se reusan como molde:
- **Autoincremento por gym**: `Gym.nextMemberNumber` + patrón transacción-con-fallback-P2002 en `user.ts:97-159`, y `formatMemberNumber` (`src/lib/memberNumber.ts`). Molde para el código de producto.
- **Diálogo de alta**: `RegisterPaymentDialog.tsx` (typeahead `StudentSearch`, máscara de importe, `DatePicker`, `<select>` de método, `useTransition`, sub-diálogo de confirmación). Molde para "Nueva venta" y "Registrar gasto".
- **Server action**: `payment.ts` (`assertCanEditStudent` guard, `registerPayment` con transacción, `updatePayment`/`deletePayment` admin-only). Molde para `sale.ts`/`expense.ts`.
- **Enum** `PaymentMethod { EFECTIVO, TRANSFERENCIA, TARJETA, MERCADO_PAGO }` (`schema.prisma:100-105`).

## Goals / Non-Goals

**Goals:**
- Registrar ventas de productos y gastos, y reflejarlos en la recaudación como resultado neto.
- Mantener el modelo de permisos simple: `canViewRevenue` gobierna ver recaudación + gestionar productos + registrar gastos; registrar ventas queda abierto a todo el staff.
- Reusar patrones existentes (autoincremento, diálogos, actions, gating fresco) para bajar riesgo.

**Non-Goals:**
- No es un POS completo: v1 es un producto por venta (con cantidad), no un carrito multi-línea.
- No hay categorías de gasto ni adjuntos/comprobantes en gastos (solo importe + descripción + fecha).
- No hay historial de movimientos de stock ni órdenes de compra/reposición: el stock se ajusta editando el producto.
- No se toca el modelo `Payment` ni la vista Alumnos existente (solo se la reencuadra como una de las 3 vistas).
- No se renombra la columna `canViewRevenue` (aunque su alcance crece).

## Decisions

### 1. Modelos nuevos (no unificar en una tabla de movimientos)
`Product`, `ProductCategory`, `Sale`, `Expense` como modelos separados, no una tabla genérica de "movimientos". Rationale: cada uno tiene campos y semántica distintos (stock, categoría, alumno-vs-nada); una tabla polimórfica complicaría queries y validaciones. La unificación ocurre en la **capa de reporte** (vista Mixta), no en el schema. Todos con `gymId` + índices por `gymId, fecha`. Importes en `Decimal(12,2)` como `Payment`.

- `ProductCategory`: `id, gymId, name, createdAt`. Único `(gymId, name)`.
- `Product`: `id, gymId, code (Int), description, categoryId, salePrice (Decimal 12,2), stock (Int), createdAt, updatedAt, deletedAt?`. Único parcial `(gymId, code)` sobre no-borrados (mismo patrón que `memberNumber`). Soft-delete para no romper ventas históricas que lo referencian.
- `Sale`: `id, gymId, productId, quantity (Int), unitAmount (Decimal 12,2), totalAmount (Decimal 12,2), paymentMethod (PaymentMethod, requerido), soldAt (DateTime), recordedById, createdAt`. `totalAmount` se persiste (snapshot) para que editar el producto no altere ventas pasadas. `product` con `onDelete: Restrict`.
- `Expense`: `id, gymId, amount (Decimal 12,2), description, spentAt (DateTime), recordedById, createdAt`.

### 2. Código de producto autoincremental por gym
Nuevo `Gym.nextProductCode Int @default(1)`. Al crear un producto sin código explícito, se replica el patrón de `memberNumber` (`user.ts:97-159`): `tx.gym.update({ nextProductCode: { increment: 1 } })`, asignar el previo, `product.create`, con fallback `P2002` que resincroniza `nextProductCode = MAX(code)+1` y reintenta. El usuario puede **override** el código a mano (editable); si el manual choca el único parcial, se rechaza con error claro. Formateo visual con padStart (reusar/espejar `formatMemberNumber`).

### 3. Permisos
- **Gestionar productos/categorías** (crear/editar/eliminar) y **registrar/editar/eliminar gastos**: `ADMIN` con `canViewRevenue` (leído **fresco** de DB, no del token — mismo patrón que `caja`/`admin`). Actions rechazan si no.
- **Leer el catálogo de productos**: cualquiera con acceso a Caja (`ADMIN`+`TEACHER`), porque el diálogo "Nueva venta" necesita la lista. La página `/productos` (gestión) sí es solo designados.
- **Registrar venta**: `ADMIN`+`TEACHER` (acceso a Caja). Editar/eliminar venta: solo `ADMIN` (como `updatePayment`/`deletePayment`).
- La página `/productos` gatea igual que el bloque de recaudación: `isAdmin && dbUser.canViewRevenue`.

### 4. Stock: descuenta y avisa, no bloquea
`registerSale` decrementa `product.stock` por `quantity` dentro de la misma transacción que crea la `Sale` (sin validar disponibilidad → permite negativo). El **aviso** es de UI: el diálogo muestra el stock actual y, si `stock - quantity <= 0`, un warning no bloqueante ("Vas a dejar el stock en N"). No hay guard server-side que rechace por falta de stock.

### 5. Reporte: 3 vistas con selector
`RevenuePanel` se parametriza con una vista (`revenueView` por querystring: `alumnos` | `productos` | `mixta`, default `alumnos`). Se agrega `src/lib/finance-stats.ts` que reusa la mecánica de `payment-stats.ts` (exportar/compartir `computePeriodStats`-like) para agregar `Sale` y `Expense`:
- **Alumnos**: sin cambios — `payment-stats` sobre `Payment`. Filtros: período, profesor, método, tipo de alumno.
- **Productos**: agrega `Sale` (`_sum totalAmount`, `_count`). Filtros: período, método, y opcional categoría de producto. No aplica profesor/tipo de alumno.
- **Mixta (neta)**: tres números — Ingresos = cuotas(`Payment`) + ventas(`Sale`); Egresos = gastos(`Expense`); **Resultado = Ingresos − Egresos**, con el desglose de cada componente y su evolución mensual. Filtros: período, método.
El selector de vista se renderiza arriba del panel; cada vista ajusta qué filtros muestra `PaymentFilters` (o un componente de filtros por vista). El historial de la vista Productos lista ventas; el de Mixta puede combinar o mostrar por pestaña (detalle de layout).

### 6. Navbar y layout
`NavbarProps` + `getNavLinks` reciben `canViewRevenue?: boolean`; se agrega `...(canViewRevenue ? [{ href: gymPath(gymSlug, "/productos"), label: "Productos" }] : [])` en la rama `ADMIN`. El valor **fresco** se toma del `prisma.user.findUnique` que el layout ya hace (`layout.tsx:72-85`) agregando `canViewRevenue: true` al `select` (sin query extra) y pasándolo como prop.

### 7. Diálogos
- **Nueva venta**: espejo de `RegisterPaymentDialog` — typeahead de producto (filtra por nombre/código), muestra precio y stock del producto elegido, campo cantidad (default 1), importe unitario editable (pre-lleno con `salePrice`), total calculado, `<select>` método (requerido), fecha de la venta (`DatePicker`, default hoy, sin futuras). Al confirmar llama `registerSale`.
- **Registrar gasto**: importe (máscara), descripción (textarea), fecha (`DatePicker`, default hoy). Llama `registerExpense`.
Ambos con `useTransition` y manejo de error como el de pagos.

## Risks / Trade-offs

- **Stock negativo** → permitido a propósito (decisión: no bloquear la venta real). Mitigación: aviso visible en el diálogo y stock visible en `/productos` para reponer.
- **Editar producto vs ventas históricas** → se mitiga persistiendo `unitAmount`/`totalAmount` en la `Sale` (snapshot) y usando soft-delete + `onDelete: Restrict` en `Product`.
- **Consistencia de la recaudación** → editar/eliminar ventas y gastos altera el resultado; por eso esas operaciones son admin-only (igual que pagos). La vista Mixta debe recalcular en vivo.
- **Alcance del cambio** → es grande (4 modelos + sección + 3 vistas). Se ordena en tandas en `tasks.md`; el schema/migración y las capacidades base van primero. Riesgo de PR grande: se puede partir el merge en 2 si hace falta, pero la propuesta es única.
- **Aplicar migración en prod** → additive, sin backfill; el drift de migraciones ya fue reconciliado en el cambio anterior. Igual: `migrate deploy`, nunca `migrate dev`.

## Migration Plan

1. Agregar los modelos y `Gym.nextProductCode` a `schema.prisma`; generar migración additive (nuevas tablas + columna + enums/índices únicos parciales por gym).
2. `prisma generate`; aplicar con `npx prisma migrate deploy` contra prod (confirmar target). Sin backfill.
3. Deploy de código (actions, páginas, componentes, navbar/layout).
4. **Rollback**: todo additive; revertir el código deja las tablas nuevas sin uso (drop opcional posterior). No afecta cuotas ni Caja existente.

## Open Questions

- **Layout del historial en vista Mixta**: ¿lista combinada de movimientos (cuotas/ventas/gastos con signo) o pestañas por fuente? Detalle de UI, no de contrato.
- **Filtro por categoría en vista Productos**: incluido como opcional; confirmar si se quiere en v1 o se difiere.
- **Baja de categoría con productos asociados**: ¿bloquear o reasignar? Propuesta: bloquear la baja si tiene productos no borrados.

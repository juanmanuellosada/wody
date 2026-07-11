## 1. Schema y migración

- [x] 1.1 Agregar a `prisma/schema.prisma`: `ProductCategory` (`id, gymId, name, createdAt`, único `(gymId, name)`), `Product` (`id, gymId, code Int, description, categoryId, salePrice Decimal(12,2), stock Int, createdAt, updatedAt, deletedAt?`), `Sale` (`id, gymId, productId, quantity Int, unitAmount Decimal(12,2), totalAmount Decimal(12,2), paymentMethod PaymentMethod, soldAt, recordedById, createdAt`), `Expense` (`id, gymId, amount Decimal(12,2), description, spentAt, recordedById, createdAt`)
- [x] 1.2 Agregar `Gym.nextProductCode Int @default(1)` y las relaciones inversas en `Gym`/`User` (recordedBy)
- [x] 1.3 Índices: `@@index([gymId, soldAt])` (Sale), `@@index([gymId, spentAt])` (Expense), `@@index([gymId])` (Product/Category); único parcial `(gymId, code)` sobre `deletedAt IS NULL` para `Product` (mismo patrón SQL que `memberNumber`); `onDelete: Restrict` en `Sale.product`
- [x] 1.4 Generar la migración additive (no `migrate dev`); aplicar en prod con `migrate deploy` (confirmar target). Sin backfill

## 2. Server actions — productos y categorías (`src/actions/product.ts`)

- [x] 2.1 Guard `assertCanManageProducts()` (molde `setCanViewRevenue`): `ADMIN` + `canViewRevenue` fresco de DB + `gymId`; devuelve `{ ok, session, gymId, gymSlug }`
- [x] 2.2 `createProduct(data)`: valida, asigna código autoincremental por gym (patrón `user.ts:97-159` con transacción + fallback `P2002` resync-y-retry) o usa el código manual validando unicidad; `revalidatePath` de `/productos` y `/caja`
- [x] 2.3 `updateProduct(id, data)` y `deleteProduct(id)` (soft-delete): solo designados, mismo gym
- [x] 2.4 `createCategory(name)` / `deleteCategory(id)`: designados, único por gym, impedir baja si tiene productos activos
- [x] 2.5 Helper de lectura de catálogo para el diálogo de venta (accesible a `ADMIN`+`TEACHER`, solo lectura)

## 3. Sección Productos (`/[gymSlug]/productos`)

- [x] 3.1 `src/app/[gymSlug]/productos/page.tsx` (Server Component): gate `isAdmin && canViewRevenue` fresco (redirige si no); redirige `PERSONAL`
- [x] 3.2 Lista de productos (código, descripción, categoría, precio, stock) con editar/eliminar; alta con `ProductForm`
- [x] 3.3 Gestión de categorías (crear/eliminar) inline
- [x] 3.4 `ProductForm.tsx` (cliente): descripción, categoría (select + crear), precio (máscara), stock, código (autogenerado con opción de override)

## 4. Ventas (`src/actions/sale.ts` + diálogo)

- [x] 4.1 `registerSale(productId, quantity, unitAmount, { soldAtStr, paymentMethod })`: valida rol `ADMIN`/`TEACHER` + gym, producto del mismo gym, cantidad ≥ 1, importe ≥ 0, método requerido, sin fechas futuras; transacción `sale.create` + `product.update stock decrement` (sin bloquear por stock)
- [x] 4.2 `updateSale` / `deleteSale`: solo `ADMIN`, mismo gym (molde `updatePayment`/`deletePayment`)
- [x] 4.3 `NewSaleDialog.tsx` + `NewSaleButton.tsx` (molde `RegisterPaymentDialog`/`RegisterPaymentSection`): typeahead de producto (nombre/código), muestra precio y stock, cantidad (default 1), importe unitario editable, total calculado, `<select>` método, `DatePicker` fecha (default hoy, sin futuras); aviso no bloqueante si `stock - quantity <= 0`

## 5. Gastos (`src/actions/expense.ts` + diálogo)

- [x] 5.1 `registerExpense(amount, description, { spentAtStr })`: valida `ADMIN` + `canViewRevenue` fresco + gym, importe > 0, sin fechas futuras
- [x] 5.2 `updateExpense` / `deleteExpense`: solo designados, mismo gym
- [x] 5.3 `RegisterExpenseDialog.tsx` + `RegisterExpenseButton.tsx`: importe (máscara), descripción (textarea), `DatePicker` fecha (default hoy)

## 6. Reporte — vistas Alumnos / Productos / Mixta (`src/lib/finance-stats.ts`)

- [x] 6.1 Exportar/compartir desde `payment-stats.ts` las piezas reusables (`computePeriodStats`-like) o crear `finance-stats.ts` hermano
- [x] 6.2 Vista Productos: agregación de `Sale` (`_sum totalAmount`, `_count`) por período, con comparación vs período anterior, evolución mensual y filtro por método (y opcional categoría)
- [x] 6.3 Vista Mixta: calcular ingresos (cuotas + ventas), gastos y resultado neto por período, con desglose y evolución mensual
- [x] 6.4 Parametrizar `RevenuePanel` por `revenueView` (querystring `alumnos|productos|mixta`, default `alumnos`) y adaptar los filtros visibles según la vista

## 7. Cablear Caja

- [x] 7.1 En `caja/page.tsx`: agregar `NewSaleButton` en el header (para `ADMIN`+`TEACHER`), cargando el catálogo de productos del gym
- [x] 7.2 Agregar `RegisterExpenseButton` detrás de `showRevenue` (solo designados)
- [x] 7.3 Agregar el selector de vista de recaudación dentro del bloque `{showRevenue && ...}` y pasar la vista al `RevenuePanel`

## 8. Navbar y layout

- [x] 8.1 Agregar `canViewRevenue?: boolean` a `NavbarProps` y a `getNavLinks`; agregar el link "Productos" → `/productos` en la rama `ADMIN` solo si `canViewRevenue`
- [x] 8.2 En `src/app/[gymSlug]/layout.tsx`: agregar `canViewRevenue: true` al `select` del `findUnique` existente y pasarlo fresco al `<Navbar>`

## 9. Docs y specs

- [x] 9.1 Extender `docs/caja-recaudacion.md` con productos, ventas, gastos y las 3 vistas de recaudación
- [x] 9.2 `openspec validate add-productos-ventas-gastos` sin errores

## 10. Verificación

- [x] 10.1 `npm run lint` y `npm run build` en verde (build 100% verde; lint sin errores/warnings en el código de este cambio — los 2 errores `react-hooks/purity` restantes en `layout.tsx:151,197` son preexistentes y no tocan líneas de este cambio, confirmado aislando con `git stash`)
- [ ] 10.2 Runtime: un designado crea categoría + producto (código autogenerado); un teacher registra una venta (descuenta stock, avisa si queda ≤ 0); un designado registra un gasto; un no designado no ve Productos/Registrar gasto
- [ ] 10.3 Runtime: las 3 vistas de recaudación (Alumnos/Productos/Mixta) muestran los números correctos y el resultado neto = ingresos − gastos
- [ ] 10.4 Multi-tenant: no se puede vender un producto de otro gym ni ver catálogo/gastos ajenos

## 1. Schema y capa de datos

- [x] 1.1 Agregar el modelo `Payment` a `prisma/schema.prisma`: `id`, `gymId`, `studentId`, `amount` (`Decimal @db.Decimal(12, 2)`), `paidAt` (`DateTime`), `recordedById`, `createdAt`, `updatedAt`
- [x] 1.2 Definir relaciones de `Payment` a `Gym` y a `User` (alumno y `recordedBy`), y agregar las relaciones inversas en `Gym` y `User`
- [x] 1.3 Agregar índices `@@index([gymId, paidAt])` y `@@index([studentId])` al modelo `Payment`
- [x] 1.4 Generar la migración Prisma (aditiva) y correr `prisma generate`

## 2. Server actions

- [x] 2.1 Agregar `recharts` a las dependencias del `package.json` raíz
- [x] 2.2 Eliminar la action `markStudentAsPaid` de `src/actions/payment.ts`
- [x] 2.3 Implementar `registerPayment`: validar rol (`ADMIN`/`TEACHER`) y pertenencia al gym, crear el `Payment` y actualizar `User.nextPaymentDate` dentro de `prisma.$transaction`
- [x] 2.4 Implementar `updatePayment` (solo `ADMIN`): editar el importe de un `Payment` existente, validando `gymId`
- [x] 2.5 Implementar `deletePayment` (solo `ADMIN`): eliminar un `Payment` sin tocar `nextPaymentDate`, validando `gymId`
- [x] 2.6 Implementar helper que devuelve el importe del último pago de un alumno (para pre-llenar el popup)
- [x] 2.7 Implementar las consultas de estadísticas (recaudación total, cantidad de pagos, ticket promedio y evolución mensual) con filtros por período, profesor y alumno, comparación contra el período anterior, y alcance por rol (`ADMIN` = gym completo, `TEACHER` = alumnos asignados)

## 3. UI — Registrar pago

- [x] 3.1 Eliminar `src/components/PayButton.tsx` y sus usos
- [x] 3.2 Crear el componente popup "Registrar pago" con selector de alumno, importe y próxima fecha de pago; pre-llenar importe con el último pago y la fecha con el vencimiento + 1 mes
- [x] 3.3 Agregar el botón "Registrar pago" arriba de la sección de pagos
- [x] 3.4 Agregar el acceso "Registrar pago" en cada fila de la lista, abriendo el mismo popup con el alumno pre-seleccionado

## 4. UI — Estadísticas

- [x] 4.1 Crear el panel de estadísticas (Server Component): recaudación total, cantidad de pagos, ticket promedio y variación contra el período anterior
- [x] 4.2 Crear el gráfico de evolución mensual con Recharts como Client Component (`"use client"`)
- [x] 4.3 Crear los controles de filtro: período (vista mensual por defecto + rango personalizado), profesor y alumno
- [x] 4.4 Integrar el panel de estadísticas arriba de la lista de alumnos en `src/app/[gymSlug]/pagos/page.tsx`

## 5. UI — Corrección de pagos

- [x] 5.1 Agregar la UI para que un `ADMIN` edite el importe o elimine un pago registrado

## 6. Verificación

- [x] 6.1 Confirmar que no quedan referencias a `PayButton` ni a `markStudentAsPaid` en el código
- [x] 6.2 Verificar la conversión de `Prisma.Decimal` a `number` en todo borde server→Client Component
- [x] 6.3 Correr `npm run lint` y `npm run build` sin errores
- [ ] 6.4 Probar el flujo completo: registrar pago (botón y fila), editar, eliminar, filtros de estadísticas y aislamiento multi-tenant por `gymId`

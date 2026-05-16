## Context

La sección de pagos de Wody no tiene modelo de transacciones. El estado de cuota vive en un único campo `User.nextPaymentDate`; "Marcar pagado" (`PayButton` → `markStudentAsPaid`) le suma un mes y nada más. No hay importes, ni fecha de cobro, ni autor del registro. Esto hace imposible cualquier reporte de recaudación.

El proyecto es multi-tenant: cada gym aísla sus datos por `gymId`. Stack: Next.js 16.2.2 (App Router), React 19, Prisma 6.19.3 sobre PostgreSQL (Neon). Los profes ven solo sus alumnos vía la relación `TeacherStudent`.

## Goals / Non-Goals

**Goals:**
- Persistir cada cobro como una transacción con importe, fecha y autor.
- Reemplazar el flujo por fila por un único flujo "Registrar pago" que cree el registro y corra el vencimiento atómicamente.
- Dar al `ADMIN`/`TEACHER` estadísticas de recaudación por período, profesor y alumno.
- Permitir corregir o eliminar pagos mal cargados.

**Non-Goals:**
- Integración con pasarelas de pago (Mercado Pago u otras) — fuera de alcance.
- Pagos parciales o planes con múltiples cuotas — un pago corre el vencimiento un período.
- Migración de datos históricos — no existen importes previos que importar.
- Cambiar el auto-bloqueo por mora (`getBlockStatus`) ni la lógica de `JoinRequest`.

## Decisions

### 1. Modelo `Payment` como tabla nueva
Una tabla nueva en vez de campos sueltos en `User`: una cuota es una transacción con identidad propia y se necesita historial (varios pagos por alumno). Campos: `id`, `gymId`, `studentId`, `amount`, `paidAt`, `recordedById`, `createdAt`, `updatedAt`. Relaciones a `Gym` y dos a `User` (`student`, `recordedBy`). Índices `(gymId, paidAt)` para las consultas de estadísticas por período y `studentId` para el historial por alumno. Es aditiva: no toca filas existentes, el rollback es un `DROP TABLE`.

*Alternativa descartada:* guardar un JSON de pagos en `User` — imposible de agregar/filtrar en SQL.

### 2. `amount` como `Decimal`
Dinero con `@db.Decimal(12, 2)`, no `Float` (errores de redondeo) ni `Int` de centavos (innecesario para pesos). **Importante:** `Prisma.Decimal` no es serializable a un Client Component; convertir a `number` en el borde server→client.

### 3. Registrar pago = transacción atómica
`registerPayment` corre dentro de `prisma.$transaction`: crea el `Payment` y actualiza `User.nextPaymentDate`. Si una falla, no queda un cobro sin correr la fecha ni una fecha corrida sin cobro.

### 4. `paidAt` = editable por el usuario, default hoy
El popup expone un campo "Fecha del pago" inicializado con la fecha de hoy (UTC). El usuario puede retroceder la fecha para registrar pagos atrasados o del pasado. Se rechazan fechas futuras, tanto en la UI (el `DatePicker` deshabilita los días posteriores a hoy) como en la server action (validación server-side). Esto resuelve la alternativa diferida de la versión anterior.

*Open Question resuelta:* el campo de fecha editable para pagos atrasados fue implementado en esta extensión.

### 5. Edición manual de fecha ≠ pago
`setStudentPaymentDate` (en `StudentEditor`) se conserva como corrección administrativa: mueve `nextPaymentDate` sin crear un `Payment`. No cuenta como ingreso. La distinción es deliberada: "Registrar pago" es plata real, mover la fecha es corregir un error.

### 6. Atribución por profesor = relación actual
El filtro "por profesor" usa la relación `TeacherStudent` vigente al momento de consultar, no un snapshot guardado en el `Payment`. Más simple y consistente con cómo `/pagos` ya filtra hoy.

*Trade-off:* si se reasigna un alumno, sus pagos pasados se re-atribuyen al nuevo profe. Aceptable: los alumnos rara vez cambian de profe y no se guarda dinero por profe, solo se agrupa una vista.

### 7. Eliminar un pago NO revierte la fecha
`deletePayment` borra el registro de ingreso pero no toca `User.nextPaymentDate`: revertir la fecha podría re-bloquear a un alumno al día por un error de tipeo. Si hace falta corregir el vencimiento, se hace aparte con `setStudentPaymentDate`. `updatePayment` solo edita `amount` (cambiar de alumno = eliminar y recrear).

### 8. Estadísticas calculadas en el server
Se computan en server actions / Server Components con `prisma.payment.aggregate` y `groupBy`, filtrando por `gymId` y por el alcance del rol (`ADMIN` = todo el gym; `TEACHER` = `studentId IN` sus alumnos). El cliente solo recibe números ya agregados.

### 9. Gráfico con Recharts
Se adopta `recharts` para el gráfico de evolución mensual: misma librería que el proyecto hermano `cashe-frontend`, estable y compatible con React 19 / Next 16. El gráfico es un Client Component (`"use client"`); el resto del panel de estadísticas es Server Component. No se copia el wrapper estilo shadcn de `cashe-frontend` — alcanza con un `<BarChart>` enfocado.

## Risks / Trade-offs

- **Desincronización pago ↔ fecha de vencimiento** → la transacción atómica (decisión 3) lo evita en el alta; en el borrado se asume a propósito (decisión 7).
- **`Prisma.Decimal` filtrado a un Client Component** → convertir a `number`/`string` en server actions y Server Components antes de pasar props.
- **Estadísticas vacías al inicio** → no hay datos históricos; el panel arranca en cero y se va poblando. Es esperado, no un bug.
- **Re-atribución por reasignación de profe** → aceptado (decisión 6); documentar en la UI si genera confusión.
- **Borrar `PayButton` y `markStudentAsPaid`** → cambio breaking; verificar que no haya otros usos de la action además de `/pagos`.

## Migration Plan

1. Agregar el modelo `Payment` a `prisma/schema.prisma` y correr la migración (aditiva).
2. `prisma generate` (ya forma parte de `npm run build`).
3. Desplegar acciones y UI nuevas; eliminar `PayButton` / `markStudentAsPaid`.
4. **Rollback:** revertir el código y `DROP TABLE "Payment"` — no hay datos en riesgo porque la tabla es nueva.

### 10. `PaymentMethod` como enum Prisma nullable

Se agrega el enum `PaymentMethod` con valores `EFECTIVO`, `TRANSFERENCIA`, `TARJETA`, `MERCADO_PAGO`. La columna `paymentMethod` en `Payment` es nullable (`PaymentMethod?`) para no romper filas existentes sin método cargado: las filas con `null` quedan como "sin especificar" y no matchean ningún filtro de método concreto.

El campo es obligatorio para pagos nuevos desde el popup (UI requiere selección; default `EFECTIVO`), pero la server action admite `null` para mantener compatibilidad con usos programáticos futuros.

### 11. Guardia de pago duplicado

`registerPayment` verifica si ya existe un `Payment` del mismo alumno con `paidAt` en el mismo día calendario (UTC) antes de crear. Si existe, retorna `{ success: false, requiresConfirmation: true, duplicateInfo }` en lugar del estado normal. El popup muestra una pantalla de confirmación y re-llama con `confirmedDuplicate: true`. Si el usuario confirma, el pago se crea sin más chequeo.

Alternativa descartada: validación solo en UI — descartada porque no protege contra doble submit en condiciones de red o llamadas directas a la action.

## Open Questions

- ¿El panel de estadísticas necesita exportar a CSV? No en esta iteración; evaluar según uso.

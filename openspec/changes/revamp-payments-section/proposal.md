## Why

Hoy Wody no guarda los pagos: solo persiste `User.nextPaymentDate`, y "Marcar pagado" se limita a correr esa fecha un mes. Se pierde el importe, la fecha real y quién registró el cobro — es imposible saber cuánto recaudó el gym, ni analizar la recaudación por período, profesor o alumno. Para que el dueño de un gym pueda gestionar sus ingresos, los pagos tienen que dejar rastro.

## What Changes

- **BREAKING** — Se elimina el botón "Marcar pagado" por fila (`PayButton`) y la server action `markStudentAsPaid`.
- Nuevo modelo Prisma `Payment`: registra cada cobro con importe, fecha, alumno, gym y quién lo cargó. Tabla nueva y aditiva — no migra ni altera datos existentes.
- Nuevo flujo "Registrar pago": un botón arriba de la sección de pagos abre un popup con alumno, importe y próxima fecha de pago. Al confirmar, crea un `Payment` y corre `User.nextPaymentDate` en una sola transacción. El importe se pre-llena con el último pago de ese alumno; la próxima fecha sugiere el vencimiento actual + 1 mes (editable). Cada fila de la lista también ofrece un acceso que abre el mismo popup con el alumno pre-seleccionado.
- La sección `/[gymSlug]/pagos` suma un panel de estadísticas arriba de la lista de alumnos existente: recaudación total, cantidad de pagos, ticket promedio y un gráfico de evolución mensual. Filtros por período (mensual por defecto + rango personalizado, con comparación contra el período anterior), por profesor y por alumno.
- Corrección de pagos: un `ADMIN` puede editar o eliminar un `Payment` ya registrado.
- Se mantiene la edición manual de la fecha de pago en `StudentEditor` (`setStudentPaymentDate`) como corrección administrativa: no genera un `Payment` ni cuenta como ingreso.
- Alcance por rol: `ADMIN` ve la recaudación de todo el gym; `TEACHER` solo la de sus alumnos asignados (vía `TeacherStudent`).

## Capabilities

### New Capabilities
- `payment-tracking`: registro de pagos con importe e historial (`Payment`), flujo de "Registrar pago" que actualiza el vencimiento del alumno, corrección/eliminación de pagos, y estadísticas de recaudación por período, profesor y alumno.

### Modified Capabilities
<!-- Ninguna: las specs existentes (join-requests, personal-mode, user-roles, user-soft-delete) no cambian sus requisitos. -->

## Impact

- **Schema** — `prisma/schema.prisma`: nuevo modelo `Payment` con relaciones a `Gym` y `User` (student y recordedBy), índices `(gymId, paidAt)` y `studentId`. Requiere `prisma generate` + migración.
- **Server actions** — `src/actions/payment.ts`: se elimina `markStudentAsPaid`; se agregan `registerPayment`, `updatePayment`, `deletePayment` y consultas de estadísticas. `setStudentPaymentDate` se conserva.
- **UI** — se elimina `src/components/PayButton.tsx`; se agrega un componente de popup "Registrar pago" y un panel de estadísticas. Se rediseña `src/app/[gymSlug]/pagos/page.tsx`.
- **Dependencias** — se suma `recharts` (gráfico de evolución), usado como Client Component.
- **Multi-tenancy** — toda query sobre `Payment` se filtra por `gymId`; el filtro por profesor se apoya en la relación `TeacherStudent` actual.
- **Sin migración de datos históricos**: las estadísticas arrancan desde la fecha de lanzamiento, porque hasta ahora no se guardaban importes.

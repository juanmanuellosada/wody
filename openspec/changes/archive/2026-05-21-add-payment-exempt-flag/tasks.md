## 1. Schema y migración

- [x] 1.1 Agregar a `model User` en `prisma/schema.prisma` los campos `paymentExempt Boolean @default(false)` y `paymentExemptReason String?`
- [x] 1.2 Generar migration manual en `prisma/migrations/<timestamp>_add_user_payment_exempt/migration.sql` con el `ALTER TABLE "User" ADD COLUMN ...` (default `false` para `paymentExempt`)
- [x] 1.3 Correr `prisma generate` para refrescar el cliente Prisma; no correr `migrate dev` (Neon sin shadow DB) — aplicar en producción con `migrate deploy` cuando se despliegue

## 2. Server action

- [x] 2.1 En `src/actions/user.ts`, agregar `setStudentPaymentExempt(studentId, exempt: boolean, reason: string | null): Promise<UserResult>`
- [x] 2.2 La action valida sesión, exige `role === "ADMIN"` (rechaza `TEACHER`), confirma que `student.gymId === session.user.gymId`, que el target es `role === "STUDENT"` y que no está soft-deleted
- [x] 2.3 Normalizar `reason`: trim, si queda vacío se persiste como `null`
- [x] 2.4 `revalidatePath` de `/admin` y `/pagos` del gym tras el update
- [x] 2.5 Manejo de errores siguiendo el patrón de `updateStudent` / `setUserBlocked`

## 3. Lógica de dominio (check-in y push)

- [x] 3.1 En `src/lib/checkin.ts`, ampliar el tipo `AlDiaInput` con `paymentExempt: boolean` y agregar en `isUserAlDia`: `if (user.paymentExempt) return !user.blockedAt;` ANTES del check de fecha
- [x] 3.2 Actualizar todos los call sites de `isUserAlDia` para que su `select` traiga `paymentExempt: true` (buscar con `grep` referencias a `isUserAlDia` en `src/`)
- [x] 3.3 En `src/lib/push.ts` `sendDueReminderIfNeeded`, agregar `paymentExempt: true` al `select`, y early return `{ sent: false, reason: "exempt" }` si está marcado
- [x] 3.4 En `src/app/api/cron/notify-due-today/route.ts`, agregar `paymentExempt: false` al `where` del `findMany`

## 4. Sección de pagos `/[gymSlug]/pagos`

- [x] 4.1 En `src/app/[gymSlug]/pagos/page.tsx`, agregar `paymentExempt: true` y `paymentExemptReason: true` al `select` de los queries de alumnos
- [x] 4.2 Excluir a los exentos de los contadores y filtros "Atrasados" y "Por vencer" (filtrar antes de aplicar `computeStatus`)
- [x] 4.3 Agregar una pill de filtro "Exentos" que liste a los alumnos con `paymentExempt = true`
- [x] 4.4 En la fila del listado, cuando `paymentExempt === true`, mostrar un badge "Exento" en vez del estado de mora / fecha de próximo pago; tooltip con el motivo si está disponible

## 5. UI del alumno

- [x] 5.1 En `src/components/PaymentStatusBanner.tsx`, agregar prop `paymentExempt: boolean` y `paymentExemptReason?: string | null`; si `paymentExempt` es true, renderizar "Exento de pago" con el motivo opcional en vez del banner de estado por fecha
- [x] 5.2 Actualizar todos los call sites de `PaymentStatusBanner` para pasar los nuevos props (revisar `src/app/[gymSlug]/pagos/page.tsx`, dashboards del alumno y cualquier otra ubicación)
- [x] 5.3 En `src/components/EditStudentButton.tsx`, agregar un toggle "Exento de pago" + textarea opcional "Motivo" — visible y editable solo para `ADMIN`; al guardar, llama a `setStudentPaymentExempt`

## 6. Registrar pago

- [x] 6.1 En `src/components/RegisterPaymentDialog.tsx`, cuando el alumno seleccionado tiene `paymentExempt = true`, mostrar un aviso visible ("Este alumno está marcado como exento de pago") sin deshabilitar el botón de confirmar
- [x] 6.2 Pasar `paymentExempt` (y `paymentExemptReason`) de cada alumno desde el server data del listado de pagos hacia el popup
- [x] 6.3 Confirmar que `registerPayment` en `src/actions/payment.ts` NO modifica el flag `paymentExempt` (no requiere cambios, pero verificar el comportamiento)

## 7. Verificación manual

- [ ] 7.1 Marcar a un alumno como exento desde el editor (como `ADMIN`) y confirmar que el flag persiste y aparece el badge en `/pagos`
- [ ] 7.2 Confirmar que el alumno exento NO aparece en los contadores "Atrasados" / "Por vencer" aunque su `nextPaymentDate` ya haya pasado
- [ ] 7.3 Hacer check-in con un alumno exento → el resultado debe ser `OK`, NO `PENDING`
- [ ] 7.4 Forzar el cron `notify-due-today` y confirmar que un alumno exento con `nextPaymentDate` en hoy NO recibe el push (revisar logs / `pushesSent`)
- [ ] 7.5 Intentar registrar un pago a un alumno exento → debe aparecer el warning pero permitir confirmar; verificar que tras confirmar, el `Payment` se crea y `paymentExempt` permanece `true`
- [ ] 7.6 Loguearse como `TEACHER` y verificar que NO puede togglear la exención (UI sin el toggle o deshabilitado; la server action rechaza si se llama directo)
- [ ] 7.7 Desmarcar la exención de un alumno → confirmar que vuelve a ser tratado según su `nextPaymentDate` actual y que aparece en "Atrasados" si corresponde

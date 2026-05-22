## Why

Hoy, al dar de alta un alumno LITE, el `User.nextPaymentDate` se setea automáticamente con el default `now()` del schema, lo que obliga al admin a entrar después a la sección de pagos para corregir la fecha del próximo vencimiento. Es un paso fácil de olvidar y genera alumnos con vencimientos incorrectos desde el día uno. Pedir esa fecha en el mismo formulario de alta elimina el paso posterior y deja al alumno con su ciclo de pago bien definido desde el momento de creación.

## What Changes

- Agregar al `UserForm` (modo lite) un campo obligatorio "Próximo pago" con DatePicker, precargado con la fecha de hoy.
- Validar en cliente y servidor que la fecha sea formato `YYYY-MM-DD` y `>= hoy` (mismo patrón que `parseJoinRequestPaymentDate` en `src/lib/dates.ts`).
- En la Server Action `createUser` (`src/actions/user.ts`, flujo lite), leer `nextPaymentDate` del `FormData`, validarlo y pasarlo al `prisma.user.create` dentro de la transacción atómica que ya crea el `User` y opcionalmente el `TeacherStudent`.
- Si la fecha falta o es inválida, la Server Action devuelve `{ success: false, error }` sin crear nada — la atomicidad existente se preserva.
- No se altera el comportamiento de creación de usuarios FULL (con email/contraseña) — el campo es exclusivo del modo lite.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `lite-student-accounts`: la creación de alumno lite ahora exige `nextPaymentDate` como input del formulario y lo persiste en el alta, en lugar de depender del default `now()`.

## Impact

- **UI**: `src/components/UserForm.tsx` (campo nuevo en modo lite, estado controlado, validación cliente).
- **Server Action**: `src/actions/user.ts` (`createUser`, rama lite — parseo + validación + uso del valor en `prisma.user.create`).
- **Helpers**: reutiliza `parseJoinRequestPaymentDate` / `getTodayArgentina` / `toInputDate` de `src/lib/dates.ts` (sin cambios).
- **Schema Prisma**: sin cambios. `User.nextPaymentDate` ya existe con tipo `DateTime @db.Date`.
- **Migraciones**: ninguna.
- **Specs**: delta en `openspec/changes/add-lite-payment-date-on-create/specs/lite-student-accounts/spec.md`.
- **Documentación**: no requiere updates en `docs/` (el flujo está documentado por la spec).

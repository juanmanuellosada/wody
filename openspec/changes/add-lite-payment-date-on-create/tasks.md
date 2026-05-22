## 1. Server Action

- [x] 1.1 En `src/actions/user.ts`, dentro del flujo `mode === "lite"` de `createUser`, leer `nextPaymentDate` del `FormData` como string antes del bloque de transacción.
- [x] 1.2 Validar la fecha con `parseJoinRequestPaymentDate` (importar de `@/lib/dates`). Si devuelve `{ ok: false, error }`, retornar `{ success: false, error }` con mensaje en español ("La fecha de próximo pago es obligatoria y debe tener formato AAAA-MM-DD" para vacío/formato; usar el error del helper si rechaza por fecha pasada).
- [x] 1.3 Pasar el `Date` parseado al `prisma.user.create` (campo `nextPaymentDate`) dentro de la transacción existente. No mover ni alterar el resto del bloque transaccional (incremento de `nextMemberNumber`, creación de `TeacherStudent`).
- [x] 1.4 Verificar que el reintento por colisión de `memberNumber` (catch P2002, líneas ~112-141) también incluya el `nextPaymentDate` parseado al reintentar el `create`.

## 2. UI — UserForm

- [x] 2.1 En `src/components/UserForm.tsx`, agregar estado controlado `nextPaymentDate: string` precargado con `toInputDate(getTodayArgentina())` (importar de `@/lib/dates`).
- [x] 2.2 Renderizar el campo solo cuando `mode === "lite"`, debajo del selector de profe. Usar `<input type="date">` consistente con el patrón actual del form (no usar `DatePicker` de RegisterPaymentDialog si el form no lo usa en otros campos — coherencia visual interna del componente prima).
- [x] 2.3 Setear `min={toInputDate(getTodayArgentina())}` y `required` en el input.
- [x] 2.4 Incluir `nextPaymentDate` como campo del `FormData` que se envía a `createUser` (asegurar `name="nextPaymentDate"`).
- [x] 2.5 Si `createUser` devuelve `{ success: false, error }` con error de fecha, mostrar el mensaje en el mismo lugar donde el form muestra otros errores de creación.

## 3. Verificación manual

- [x] 3.1 Levantar `npm run dev`, autenticarse como ADMIN en un gym de prueba, abrir el alta de alumno, elegir modo lite y verificar que el campo "Próximo pago" aparece precargado con hoy.
- [x] 3.2 Crear un alumno lite dejando la fecha en hoy → verificar en DB (o sección de pagos) que `nextPaymentDate` es hoy.
- [x] 3.3 Crear otro alumno lite con fecha futura (ej: hoy + 30 días) → verificar que se persiste correctamente.
- [x] 3.4 Intentar enviar con fecha pasada (ej: hoy - 1) → verificar que el form muestra error y no se crea nada (ni `User`, ni incremento de `nextMemberNumber`).
- [x] 3.5 Borrar el valor del input y enviar → verificar que se muestra error de validación.
- [x] 3.6 Confirmar que crear usuarios FULL (modos `invite` y `password`) sigue funcionando sin cambios y sin pedir fecha de pago.

## 4. Cierre

- [x] 4.1 Ejecutar `npm run lint` y resolver warnings/errors introducidos por este cambio.
- [ ] 4.2 Commit en español con scope adecuado (ej: `feat(alumnos-lite): pedir fecha de próximo pago al alta`).

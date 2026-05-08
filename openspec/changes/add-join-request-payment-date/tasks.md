## 1. Schema y migración

- [x] 1.1 Agregar `nextPaymentDate DateTime @db.Date` (NOT NULL) al modelo `JoinRequest` en `prisma/schema.prisma`.
- [x] 1.2 Generar migración Prisma con `npx prisma migrate dev --name add_join_request_payment_date`. Editar el SQL para que sea: `ADD COLUMN ... DEFAULT CURRENT_DATE` → `UPDATE ... SET nextPaymentDate = createdAt::date` → `ALTER COLUMN ... DROP DEFAULT`. Verificar que la migración corra sin error en local contra una DB con rows existentes en `JoinRequest`.
- [x] 1.3 Confirmar que `npm run build` (que incluye `prisma generate`) regenera tipos sin errores.

## 2. Helper de validación de fecha

- [x] 2.1 En `src/lib/dates.ts` (o crear helper local en `src/actions/join-request.ts` si es trivial), agregar función `parseJoinRequestPaymentDate(input: string): { ok: true; date: Date } | { ok: false; error: string }` que: valide formato `YYYY-MM-DD`, parsee a `Date` UTC midnight, compare con `getTodayArgentina()`, devuelva error específico ("Fecha de pago inválida" / "La fecha de pago no puede ser anterior a hoy"). Reutilizar en submit y approve.

## 3. Server action `submitJoinRequest`

- [x] 3.1 Agregar `nextPaymentDate: string` al type del input de `submitJoinRequest` en `src/actions/join-request.ts`.
- [x] 3.2 Llamar al helper de 2.1 después de las validaciones existentes; si falla, retornar `{ ok: false, error }` (mismo patrón que las demás validaciones; NO se aplica anti-enumeration en errores de fecha).
- [x] 3.3 Pasar la `Date` parseada al `prisma.joinRequest.create({ data: { ..., nextPaymentDate } })`.

## 4. Form público `/{gymSlug}/invitarme`

- [x] 4.1 En `src/app/[gymSlug]/invitarme/JoinRequestForm.tsx`, agregar un `<input type="date" name="nextPaymentDate" required />` con label "Próxima fecha de pago".
- [x] 4.2 Computar `min` y default `value` como `getTodayArgentina()` formateado `YYYY-MM-DD`. Si el form es client component, calcularlo al render con un helper inline (`new Date()` ajustado a UTC-3); si es server component que pasa props, recibirlo como prop desde el server.
- [x] 4.3 Incluir `nextPaymentDate` en el state del form y en el payload pasado a `submitJoinRequest`.
- [x] 4.4 Renderizar el `error` retornado por el server (si vino) cerca del input (mismo patrón que los demás campos).

## 5. Server action `approveJoinRequest` — overrides

- [x] 5.1 Agregar `nextPaymentDate?: string` al type `ApproveOverrides` en `src/actions/join-request.ts`.
- [x] 5.2 En la whitelist defensiva (`safeOverrides`), agregar la lectura explícita del campo nuevo.
- [x] 5.3 Resolver `finalNextPaymentDate`: si `safeOverrides?.nextPaymentDate` está provisto, parsearlo con el helper 2.1 (rechazar si error). Si no, usar `request.nextPaymentDate`.
- [x] 5.4 Validar que la `Date` resuelta sea ≥ `getTodayArgentina()`. Si no, retornar `{ ok: false, error: "La fecha de pago no puede ser anterior a hoy. Editala antes de aprobar." }` (sin overrides) o `"La fecha de pago no puede ser anterior a hoy"` (con override). Texto exacto según el scenario en el spec.
- [x] 5.5 Pasar `nextPaymentDate: finalNextPaymentDate` al `tx.user.create({ data: { ... } })` (esto deja de depender del default `now()` del schema).
- [x] 5.6 Persistir `nextPaymentDate: finalNextPaymentDate` en el `tx.joinRequest.update` final (junto con `name`).

## 6. Modal admin "Aprobar"

- [x] 6.1 En el listado de `JoinRequest` (`src/app/[gymSlug]/admin/invitaciones/page.tsx` o el componente de fila), pasar `nextPaymentDate` como prop al `ApproveJoinRequestButton`.
- [x] 6.2 En `src/app/[gymSlug]/admin/invitaciones/ApproveJoinRequestButton.tsx`, agregar la fila "Próxima fecha de pago: {formatear es-AR}" al resumen del modal (siempre visible, no dentro del sub-form).
- [x] 6.3 Agregar al state del sub-form: `const [nextPaymentDate, setNextPaymentDate] = useState(formatYMD(requestNextPaymentDate))`.
- [x] 6.4 Renderizar `<input type="date" name="nextPaymentDate" min={...} value={nextPaymentDate} onChange={...} required />` en el sub-form de edición. Computar `min` con el helper de 2.1 al render (cliente).
- [x] 6.5 Si el admin cambia el valor, incluirlo en el payload de overrides cuando clickea "Aprobar". Si no abrió la edición, NO incluirlo (deja que el server use `request.nextPaymentDate`).
- [x] 6.6 Mostrar el error retornado por el server cerca del input (cuando la fecha resuelta sea pasada o mal formada).

## 7. Verificación end-to-end

- [x] 7.1 `npm run lint` pasa.
- [x] 7.2 `npm run build` pasa.
- [ ] 7.3 Smoke manual: crear una `JoinRequest` desde `/{gymSlug}/invitarme` con fecha futura. Aprobarla sin overrides desde la sección admin. Verificar que `User.nextPaymentDate` quedó con el valor elegido y que el dashboard de pagos NO la muestra como atrasada.
- [ ] 7.4 Smoke manual: aprobar editando la fecha. Verificar el override se aplica.
- [ ] 7.5 Smoke manual: intentar enviar el form con una fecha pasada (manipulando con devtools, ya que el cliente la bloquea con `min`); verificar que el server rechaza con el error específico.
- [ ] 7.6 Smoke manual: tomar una `JoinRequest` con fecha que quedó en pasado (simular cambiándola en DB) e intentar aprobar sin override; verificar el error "Editala antes de aprobar".

## 8. Spec deltas y archivado

- [x] 8.1 Ejecutar `openspec validate add-join-request-payment-date --strict` para confirmar que los deltas hacen match con los Requirements del spec actual.
- [ ] 8.2 Una vez mergeado y verificado en main, correr `/opsx:archive add-join-request-payment-date` para promover los deltas a `openspec/specs/join-requests/spec.md` y mover el change a `openspec/changes/archive/`.

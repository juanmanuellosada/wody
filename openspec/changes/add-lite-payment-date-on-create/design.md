## Context

La feature de alumnos lite (spec `lite-student-accounts`) permite crear alumnos sin email/contraseña con un solo click. El campo `User.nextPaymentDate` (tipo `DateTime @db.Date`, default `now()`) ya existe en el schema y se usa en toda la lógica de pagos, control de accesos y kiosko.

El problema: hoy el alumno lite arranca con `nextPaymentDate = now()` (la fecha del alta), lo que típicamente no refleja el ciclo real del alumno (la mayoría paga el primer mes adelantado y vence en 30 días). El admin tiene que entrar a la sección de pagos y editar la fecha — paso fácil de olvidar y que deja alumnos con vencimientos incorrectos hasta que alguien lo nota.

Patrones a reutilizar:
- `parseJoinRequestPaymentDate` en `src/lib/dates.ts:52-81` ya hace exactamente la validación que necesitamos (regex `YYYY-MM-DD` + parseo + chequeo `>= hoy`).
- `getTodayArgentina()` en `src/lib/dates.ts:5-21` y `toInputDate()` en `src/lib/dates.ts:39-45` para precargar el input.
- `RegisterPaymentDialog` (`src/components/RegisterPaymentDialog.tsx`) y `JoinRequestApprovalDialog` (cambio `add-join-request-payment-date` ya archivado) muestran el patrón UI de DatePicker con sugerencia.

## Goals / Non-Goals

**Goals:**

- El admin define la fecha del próximo pago en el mismo formulario de alta del alumno lite.
- La validación es consistente con la del flujo de aprobación de join requests (mismo helper).
- Si la validación falla, ningún side-effect ocurre (no se incrementa `memberNumber`, no se crea `User`, no se crea `TeacherStudent`).
- Cero cambios al schema y cero migraciones.

**Non-Goals:**

- No se cambia el comportamiento de creación de usuarios FULL (modos `invite` y `password`) — esos modos ya gestionan pagos diferente (vía join request o post-activación).
- No se agrega un campo "fecha del primer pago" o "registrar primer pago al alta": eso ya está cubierto por `registerPayment` post-creación. Solo se setea la fecha del PRÓXIMO vencimiento.
- No se toca la sección de pagos (`RegisterPaymentDialog`, `/pagos/page.tsx`) — sigue siendo el lugar para editar la fecha más adelante.
- No se cambia el default `@default(now())` del schema (no rompe el flujo de creación de FULL ni de seeds).

## Decisions

### Reutilizar `parseJoinRequestPaymentDate` en vez de duplicar lógica

`createUser` recibirá `nextPaymentDate` como string `YYYY-MM-DD` del `FormData` y lo pasará por `parseJoinRequestPaymentDate(input)`. Si devuelve `{ ok: false, error }`, la Server Action retorna `{ success: false, error }` antes de cualquier mutación.

**Alternativa considerada**: escribir un helper genérico `parseFuturePaymentDate` con el mismo cuerpo. Rechazado: el helper actual ya tiene el nombre lo suficientemente general en su semántica (es solo "fecha de pago no-pasada") y duplicar un wrapper agrega indirección sin valor. Si en el futuro otro flujo lo necesita, se renombra el helper en un commit aparte.

### Validar antes de la transacción, no dentro

`createUser` tiene una transacción atómica para incrementar `nextMemberNumber` + crear `User` + crear `TeacherStudent`. La validación de fecha se hace **antes** de abrir la transacción.

**Razón**: si la fecha es inválida, ni siquiera queremos quemar un memberNumber ni hacer un round-trip a la DB. Es validación pura de input, encaja antes del side-effect.

### El input HTML tiene `min={today}` pero la validación canónica está en el server

El `<input type="date">` recibe `min={toInputDate(getTodayArgentina())}`. Eso da UX inmediata en el navegador, pero la validación **canónica** vive en la Server Action — un cliente malicioso podría omitir el `min`, pero `parseJoinRequestPaymentDate` lo rechaza.

**Razón**: defensa en profundidad sin duplicar lógica. El cliente solo necesita el `min` para guiar; el servidor es la autoridad.

### Default del input: hoy, no hoy+1mes

El DatePicker se precarga con la fecha de hoy (`toInputDate(getTodayArgentina())`).

**Razón**: el usuario lo eligió explícitamente en la fase de propuesta — la mayoría de las altas son alumnos que ya pagaron al momento de inscribirse, así que el ciclo arranca justo ahí. El admin lo extiende manualmente si necesita un mes de gracia. (Si en el futuro la operatoria cambia, mover a `addOneMonth(today)` es un one-liner.)

### Mensajes de error en español

`createUser` ya devuelve errores en español al UI. Los mensajes nuevos siguen ese tono:
- Fecha vacía o formato inválido: `"La fecha de próximo pago es obligatoria y debe tener formato AAAA-MM-DD"`.
- Fecha en el pasado: `"La fecha de próximo pago no puede ser anterior a hoy"`.

`UserForm` muestra estos errores con el mismo patrón visual que usa para otros errores de creación (toast + opcional badge inline).

### Campo en el `FormData` se llama `nextPaymentDate`

Coincide con el nombre del campo en el modelo `User`. Facilita la lectura mental y se alinea con el patrón ya usado en `add-join-request-payment-date`.

## Risks / Trade-offs

- **[Riesgo]** Un admin podría querer marcar `paymentExempt` al alta y entonces la fecha del próximo pago es irrelevante. → **Mitigación**: el campo `paymentExempt` se setea por defecto en `false` (no se expone al alta). La fecha igual se guarda pero queda ignorada por la lógica de cobro si el admin activa `paymentExempt` después. Documentado en el spec como comportamiento esperado.

- **[Riesgo]** Si el usuario abre el formulario hoy a las 23:55 hora Argentina y lo envía a las 00:01, la fecha que el cliente precargó (ayer) ya no es válida. → **Mitigación**: `parseJoinRequestPaymentDate` permite la igualdad (`>= hoy`); el caso extremo se cubre porque la diferencia es 1 día y el cliente puede reintentar. No vale la pena agregar lógica de refresh automático.

- **[Trade-off]** Hacer la fecha obligatoria fuerza al admin a tomar una decisión consciente, pero es un clic más en el camino feliz comparado con el comportamiento actual (cero clics, default `now()`). El usuario aceptó este trade-off explícitamente en la fase de propuesta.

- **[Riesgo]** Tests automatizados no existen en el proyecto (no hay suite). → **Mitigación**: verificación manual descrita en `tasks.md` cubre los 4 escenarios del spec (alta exitosa con hoy, alta con fecha futura, rechazo de fecha pasada, rechazo de formato inválido).

## Migration Plan

- No hay migración de datos. Los lites existentes mantienen el `nextPaymentDate` que ya tienen (el que sea — `now()` del alta o lo que se haya editado después).
- Rollback: revertir el commit. Sin side-effects irreversibles.

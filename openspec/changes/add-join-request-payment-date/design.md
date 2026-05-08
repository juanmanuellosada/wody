## Context

El flujo actual de invitaciones (capability `join-requests`) crea `User` con `nextPaymentDate` resuelto al default del schema (`now()`), causando que el alumno aparezca como "atrasado" en cuanto el admin lo aprueba (la lógica del dashboard usa `< hoy` como umbral de "Atrasado", ver `src/app/[gymSlug]/pagos/page.tsx`). El campo `nextPaymentDate` es `DateTime @db.Date`, comparado contra `getTodayArgentina()` (UTC-3, midnight). El payload del form público hoy contiene solo identidad + auth + profes; el modal admin permite editar `name`, `studentType`, `teacherIds`, `canCreateOwnRoutines` pero no toca pagos. La feature mueve la decisión al momento natural (cuando el alumno se registra) y cierra el bypass al permitir corrección admin.

Restricciones relevantes:
- Multi-tenancy estricta por `gymId`. El campo `nextPaymentDate` es por-row de `JoinRequest`, naturalmente aislado.
- Zona horaria: el "hoy" autoritativo es Argentina (UTC-3) vía `getTodayArgentina()`. El cliente puede vivir en otra TZ.
- El campo `User.nextPaymentDate` es `@db.Date` (sin hora) — la equivalencia es a nivel calendar day.
- Next.js 16.2.2 (App Router) con server actions. No hay tests automáticos.

## Goals / Non-Goals

**Goals:**
- El alumno declara `nextPaymentDate` al registrarse, eliminando el falso positivo de "cuota vencida" inmediato.
- El admin tiene visibilidad y veto (puede corregir antes de aprobar).
- Validación consistente cliente + servidor: rango `≥ hoy` (Argentina) en ambos puntos.
- Persistencia y audit trail: `JoinRequest.nextPaymentDate` queda como histórico de lo que se acordó, igual que `name` y `teacherIds` post-aprobación.

**Non-Goals:**
- NO se introduce un modelo `Payment` separado (eso es alcance distinto, fuera de este change).
- NO se cambia el comportamiento del dashboard de pagos (`computeStatus`).
- NO se aplica el mismo cambio al flujo de creación manual de alumnos por admin (`createUser` en `src/actions/user.ts`) — esa ruta sigue como está. Si más adelante se quiere armonizar, va en otro change.
- NO se permite fechas en el pasado bajo ninguna circunstancia (ni en el form público ni en el modal admin), aunque el admin podría querer "registrar a alguien que ya pagó retroactivamente". Decisión deliberada (ver Decision 4).

## Decisions

### Decision 1: Campo `nextPaymentDate` no nullable en `JoinRequest`

**Decisión:** Agregar `nextPaymentDate DateTime @db.Date` (NOT NULL) al modelo `JoinRequest`.

**Razón:** El form público lo exige, así que toda nueva request tendrá valor. Hacerlo nullable introduce ambigüedad en `approveJoinRequest` (¿qué hago si es null?) y obliga a UI defensiva en el modal admin. La obligatoriedad refleja el invariante real.

**Alternativa descartada:** `DateTime? @db.Date` (nullable) con fallback `coalesce(nextPaymentDate, now())` en el approve. Más permisivo pero esconde bugs (un null inesperado pasa desapercibido y reintroduce el problema original).

### Decision 2: Estrategia de migración Prisma — dos pasos lógicos en una sola migración

**Decisión:** Migración SQL que (a) agrega la columna con default `CURRENT_DATE`, (b) backfillea filas existentes a `created_at::date`, (c) retira el default y deja la columna `NOT NULL` sin default. Una sola migración generada via `prisma migrate dev --name add_join_request_payment_date`, editada a mano para incluir el backfill antes del `ALTER COLUMN ... DROP DEFAULT`.

**Razón:** Hay rows históricas en `JoinRequest` (status `PENDING`, `APPROVED`, `REJECTED`). `created_at::date` es el mejor proxy razonable para legacy: para `APPROVED` el dato es ya irrelevante (el `User` ya tiene su propia fecha), y para `PENDING` rechazadas/aprobadas a futuro por humanos, ven la fecha original como punto de partida y la editan si hace falta. La migración es idempotente y no requiere downtime.

**Alternativa descartada:** Borrar todas las `JoinRequest` `PENDING` previas a la migración. Demasiado destructivo y los `APPROVED`/`REJECTED` también necesitan valor (NOT NULL).

**Alternativa descartada:** Dos migraciones (nullable → backfill → NOT NULL). Más prolijo en proyectos grandes pero overkill aquí; este esquema cabe en una sola transacción Postgres y el dataset de `JoinRequest` es chico.

### Decision 3: Validación de fecha — string `YYYY-MM-DD`, comparación con `getTodayArgentina()`

**Decisión:** Tanto el form público como el modal admin envían `nextPaymentDate` como `string` en formato ISO date `YYYY-MM-DD` (lo que produce `<input type="date">`). El servidor parsea con `new Date(\`${str}T00:00:00.000Z\`)` y compara con `getTodayArgentina()`. Si `parsed < today` → error "La fecha de pago no puede ser anterior a hoy".

**Razón:** Evita el lío de timezones de pasar `Date` por cliente/servidor. `<input type="date">` ya garantiza el formato y soporta `min` declarativo. La comparación contra `getTodayArgentina()` (que devuelve un `Date` UTC representando midnight Argentina) es estable: ambas son UTC-midnight de un calendar day.

**Alternativa descartada:** Pasar epoch ms o `Date.toISOString()`. Trae horas y arrastra TZ del cliente — riesgo de off-by-one entre cliente y servidor a la medianoche.

**Sutileza:** El `min` del `<input type="date">` se computa con `getTodayArgentina()` en el server component (pasado como prop) o, si el form es client component, calculado al render como `new Date().toISOString().slice(0,10)`. El cliente puede ser engañado (es solo UX); la verdad es la validación server-side.

### Decision 4: No permitir fechas en el pasado, ni en form ni en modal

**Decisión:** Rango uniforme `≥ hoy` en ambos puntos. Sin excepción para el admin.

**Razón:** Mantener el mismo invariante simplifica spec, código y tests. Si el admin necesita registrar "alguien que ya está al día desde antes" puede aprobar con fecha = hoy y luego editar el `User.nextPaymentDate` por la ruta normal del dashboard de pagos (que sí permite cualquier fecha). Esto evita duplicar la responsabilidad de "registro retroactivo" en este flujo.

**Trade-off conocido:** El admin paga el costo de un click extra en el escenario raro de "alumno ya estaba al día con otro registro previo". Aceptable.

### Decision 5: `ApproveOverrides.nextPaymentDate` es `string | undefined`, no `Date`

**Decisión:** El override es opcional. Si no viene, se usa `request.nextPaymentDate` (lo que el alumno declaró). Si viene, debe ser `≥ hoy` igual que el del form.

**Razón:** Simetría con el resto de overrides (`name`, `studentType`, `teacherIds`, `canCreateOwnRoutines`) — la ausencia significa "usá lo de la request".

**Resolución final:**
```
nextPaymentDate final = parseDate(overrides.nextPaymentDate ?? formatDate(request.nextPaymentDate))
si nextPaymentDate final < hoy → error
```

Esto cubre incluso el caso "la JoinRequest fue creada hace 30 días con fecha de hoy-de-entonces, hoy esa fecha es pasado" — al aprobar, el admin se ve forzado a corregir (lo cual es correcto).

### Decision 6: Audit trail simétrico

**Decisión:** Al aprobar, persistir el `nextPaymentDate` finalmente usado de vuelta en `JoinRequest.nextPaymentDate` (igual que se hace con `name` y `teacherIds`).

**Razón:** Coherencia con el patrón existente: la `JoinRequest` queda como snapshot de "qué quedó realmente acordado", no de "qué pidió el alumno originalmente". Un comment en código documenta la pérdida.

**Alternativa rechazada:** Dejar la fecha original intacta y solo guardar la final en `User`. Lo descartamos por consistencia interna — cambiar el patrón solo para este campo introduciría inconsistencia.

## Risks / Trade-offs

- **Riesgo: Migración de rows históricas mal-backfilleadas** → Mitigación: usar `created_at::date` como aproximación; las filas `APPROVED`/`REJECTED` no se vuelven a usar en el flujo de aprobación, así que el valor solo es histórico. Filas `PENDING` antiguas que sigan vivas se editan si hace falta al aprobar.
- **Riesgo: TZ off-by-one** (un usuario en GMT+10 ve "hoy" diferente al servidor) → Mitigación: la validación canónica es server-side con `getTodayArgentina()`. El `min` del input es UX, no seguridad.
- **Riesgo: la JoinRequest queda demasiado "vieja" entre submit y approve** (alumno declaró fecha hoy, admin aprueba 5 días después → la fecha ya es pasada) → Mitigación: la validación al approve fuerza al admin a corregir. Edge case esperado, no edge case patológico.
- **Riesgo: el form público se vuelve menos amigable** (un campo más) → Mitigación: default UI = hoy, label clara ("Próxima fecha de pago"). Es un campo, no es bloqueante.
- **Trade-off: el admin no puede registrar fechas pasadas** → Aceptado (Decision 4). Si emerge dolor real, abrimos otro change.

## Migration Plan

1. **Schema**: agregar campo a `prisma/schema.prisma` (sin generar migración aún).
2. **Migración SQL** (`prisma migrate dev --name add_join_request_payment_date`):
   ```sql
   ALTER TABLE "JoinRequest"
     ADD COLUMN "nextPaymentDate" DATE NOT NULL DEFAULT CURRENT_DATE;
   UPDATE "JoinRequest"
     SET "nextPaymentDate" = "createdAt"::date
     WHERE "nextPaymentDate" = CURRENT_DATE;
   ALTER TABLE "JoinRequest"
     ALTER COLUMN "nextPaymentDate" DROP DEFAULT;
   ```
   (El `WHERE nextPaymentDate = CURRENT_DATE` es defensivo; en práctica todas las filas existentes acaban de recibir `CURRENT_DATE`.)
3. **Tipos**: regenerar Prisma Client (`prisma generate` corre como parte de `npm run build`).
4. **Server actions**: actualizar `submitJoinRequest` y `approveJoinRequest` (ver tasks.md).
5. **UI pública**: agregar input al form, validación cliente (`min`).
6. **UI admin**: agregar lectura + input en sub-form, validación cliente.
7. **Spec deltas**: actualizar 4 Requirements en `openspec/specs/join-requests/spec.md`.

**Rollback:** revertir la migración (`ALTER TABLE ... DROP COLUMN`). Las server actions y UI son aditivas a nivel HTTP — un payload viejo sin `nextPaymentDate` rompería la nueva versión, pero no hay clientes externos. En caso de rollback aplicar también la versión previa del código.

## Open Questions

- ¿La fecha mostrada en la lista de invitaciones (no solo en el modal) ayuda? Prop sería trivial pero spec actual no lo pide. Decisión: NO incluir en este change para mantener el alcance acotado; ver si el admin lo pide después.

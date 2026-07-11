## Context

`/pagos` (`src/app/[gymSlug]/pagos/page.tsx`) hoy sirve dos propósitos con sensibilidad distinta: control operativo de cuotas (estado por alumno, registrar pago) e información económica (recaudación, evolución mensual, historial). El gate actual (`:143-158`) sólo distingue `ADMIN`/`TEACHER` vs resto; no hay granularidad para ocultar la recaudación a parte del staff.

Estado relevante:
- Recaudación y gráficos viven en `PaymentStatsPanel.tsx` (cards + `PaymentEvolutionChart` + `PaymentHistorySection`), alimentados por `src/lib/payment-stats.ts` (funciones server-side, **no** server actions; su seguridad depende del gate de la página).
- El staff (ADMIN/TEACHER) y los alumnos se listan juntos en el **Panel Admin** (`src/app/[gymSlug]/admin/page.tsx`). No existe editor dedicado de staff; las acciones sobre ADMIN/TEACHER son botones sueltos (`PromoteTeacherButton`, `BlockUserButton`, `DeleteUserButton`).
- Patrón existente de flag booleano por usuario: `canCreateOwnRoutines` + `setCanCreateOwnRoutines` (`src/actions/user.ts:935`). Patrón de acción sobre staff: `promoteTeacherToAdmin` (`user.ts:886`) + `PromoteTeacherButton.tsx`.
- Multi-tenant: toda query filtra por `gymId`/`gymSlug`. Migraciones via `migrate deploy` (shadow DB no configurada).

## Goals / Non-Goals

**Goals:**
- Separar la información económica del gym en `/caja`, restringida por un permiso por-usuario `canViewRevenue`.
- Mantener a los profes operando (registrar pago, ver estado de cuotas) sin ver la facturación.
- Permitir que un admin designado habilite a otros admins, con la garantía de que siempre queda ≥1 por gym.
- Filtrar recaudación (`/caja`) y control de pagos (`/pagos`) por tipo de alumno.

**Non-Goals:**
- No se crea un editor de staff completo (tipo `StudentEditor`) para admins; solo un toggle puntual en la tabla del Panel Admin.
- No se toca el cálculo económico de fondo (`Payment`, agregaciones) más allá de sumar el filtro por `studentType`.
- No se modifica `/ingresos` (control de accesos), aunque también muestra recaudación de otro tipo — fuera de alcance.
- No se cambia el modelo de cobro por alumno ni MercadoPago.

## Decisions

### 1. Permiso: `User.canViewRevenue Boolean @default(false)`
Se replica el molde de `canCreateOwnRoutines`: campo booleano en `User`, migración additive. Alternativa descartada: un enum de "roles de caja" o una tabla de permisos — sobredimensionado para un único flag binario. El permiso solo es semánticamente válido en `ADMIN` (la operación de asignación lo exige); en otros roles queda `false` e inerte.

**Propagación en sesión:** `canViewRevenue` debe estar disponible en `session.user` para gatear Server Components sin un query extra. Se agrega al callback `jwt`/`session` de NextAuth junto a `role`/`gymId`. Riesgo de staleness del token (ver Risks).

### 2. `/caja`: nuevo Server Component con gating por capas
`src/app/[gymSlug]/caja/page.tsx`, mismo patrón de gate que `/pagos` (redirige `STUDENT`/`ACCESS` a `/login`; `PERSONAL` redirige a su dashboard). Dentro:
- **Registrar pago** (botón standalone) → visible para `ADMIN` y `TEACHER`. Para `TEACHER` queda acotado a sus alumnos (ya lo valida `payment.ts:16-52`).
- **Recaudación + gráficos + Historial de pagos** → se renderizan **solo si** `session.user.role === "ADMIN" && session.user.canViewRevenue`. Se reutilizan `PaymentStatsPanel` (o una descomposición: extraer el bloque de recaudación/gráficos/historial a un `RevenuePanel`, dejando el botón de registrar como pieza independiente). Alternativa descartada: gatear con CSS/hidden — la recaudación no debe llegar siquiera al cliente de quien no la puede ver, así que el gate es server-side (no se calcula ni se envía).

Defensa en profundidad: además del gate de la página, `payment-stats.ts` seguirá invocándose solo desde Server Components ya protegidos; el historial y stats no se exponen como server actions.

### 3. `/pagos`: queda "Control de Pagos"
Se elimina de `pagos/page.tsx` el `PaymentStatsPanel` completo (recaudación, gráficos, historial, botón standalone de registrar). Permanece la tabla de alumnos con tiles de estado (Todos/Atrasados/Por vencer/Al día/Exentos), edición y bloqueo.

**Decisión sobre "Registrar pago" por fila (confirmada):** el registro de pagos ocurre **exclusivamente en `/caja`**. Se **quita** el `RegisterPaymentRowButton` de cada fila del Control de Pagos y no queda ningún botón standalone de registrar en `/pagos`. En `/caja`, el registro se hace desde el botón prominente usando el buscador typeahead para elegir al alumno. En `/pagos` las filas conservan solo editar y bloquear.

### 4. Designación desde el Panel Admin
Nuevo componente cliente `ToggleCanViewRevenueButton.tsx` (molde `PromoteTeacherButton.tsx`) + server action `setCanViewRevenue(targetUserId, next)` en `src/actions/user.ts`. Se renderiza en `admin/page.tsx` en la columna de acciones bajo `{user.role === "ADMIN" && ...}` (bloques desktop y mobile). Alternativa descartada: crear una ruta/editor de staff nuevo — mucho más costoso para un toggle.

**Validaciones de la action:**
- Caller autenticado con `role === "ADMIN"` **y** `canViewRevenue === true` (solo un designado puede designar).
- Target existe, mismo `gymId` que el caller, `role === "ADMIN"`, `deletedAt === null`.
- **Guardrail último designado:** al pasar a `false`, contar admins del gym con `canViewRevenue === true`; si el target es el único (count ≤ 1), rechazar con error explícito.
- `prisma.user.update` + `revalidatePath(.../admin)` + `revalidatePath(.../caja)`.

### 5. Filtro por tipo de alumno
Se extiende `PaymentFilters` con un selector de `StudentType`, cuyas opciones dependen del `kind` del gym (`MUSCULACION_LIBRE` solo si `GYM`; en `BOX` se ofrecen solo `GENERAL`/`PERSONALIZED`). El valor viaja por querystring (como el filtro de período/estado actual).
- **Recaudación (`/caja`)**: `payment-stats.ts` (`computePeriodStats`/`resolveStudentScope`) recibe un `studentType?` opcional que se agrega al `where` sobre los alumnos incluidos en la agregación.
- **Control de Pagos (`/pagos`)**: la query de la tabla de alumnos suma el filtro `studentType` al `where` existente por estado.

### 6. Backfill por gym (data-migration)
En la misma migración SQL (o script `migrate deploy`-safe) que agrega la columna:
1. `UPDATE "User" SET "canViewRevenue" = true` para el admin designado de cada gym, matcheando por `email` + `gym.slug`:
   `unidos-garage→pablo.poch@hotmail.com`, `rompiendo-limites→lescanojess111@gmail.com`, `atlas-gym→marianellareinki@hotmail.com`, `mila-fit→marianellareinki+mila@hotmail.com`, `crowned-program→diazema217@gmail.com`, `unidos-gap→lescanojess111@gmail.com`.
2. **Fallback**: para todo gym (excepto `PERSONAL`) que quede con 0 admins con `canViewRevenue`, setear `true` al `ADMIN` más antiguo (`ORDER BY createdAt ASC`, `deletedAt IS NULL`). Cubre gyms futuros y desalineaciones de email. Idempotente (se puede correr sin duplicar efecto).

### 7. Navbar
Link "Caja" → `/caja` en el bloque `ADMIN` y en el bloque `TEACHER` de `Navbar.tsx`. "Pagos" se mantiene para ambos.

## Risks / Trade-offs

- **Token stale de NextAuth** → si `canViewRevenue` se guarda en el JWT, un admin recién designado/revocado no verá el cambio hasta refrescar el token. Mitigación: leer `canViewRevenue` fresco desde la DB en el Server Component de `/caja` (no confiar solo en el token para el gate de la recaudación), o forzar refresh de sesión tras la action. Decisión: gate de `/caja` lee de DB por `session.user.id` para el bloque de recaudación; el token solo se usa para el link del navbar (cosmético).
- **Fuga de recaudación vía Control de Pagos** → la tabla de `/pagos` muestra estados/importes por alumno; en teoría alguien podría sumar. Mitigación aceptada: el control de pagos no expone el agregado ni el historial completo; el importe por alumno es operativo. El usuario ya validó que el vector real a cerrar es el Historial (por eso se gatea).
- **Backfill contra prod por email** → si algún email cambió, el gym cae al fallback (oldest admin), que siempre garantiza ≥1. Riesgo bajo. Se verifica post-deploy que cada gym tenga exactamente el admin esperado.
- **Reutilización vs duplicación de `PaymentStatsPanel`** → moverlo tal cual a `/caja` mezcla el botón de registrar (para todos) con la recaudación (solo designados). Se prefiere descomponer en `RevenuePanel` + botón de registrar independiente para poder gatearlos por separado.

## Migration Plan

1. Agregar `canViewRevenue` a `prisma/schema.prisma` (User) y generar migración SQL (additive, default `false`).
2. En la migración, ejecutar el backfill (paso 6): UPDATE por email + fallback oldest-admin.
3. Propagar `canViewRevenue` en callbacks de NextAuth.
4. Aplicar con `npx prisma migrate deploy` (no `migrate dev`).
5. Deploy de código (rutas, componentes, actions, navbar).
6. **Rollback:** la columna es additive con default `false`; revertir código restaura `/pagos` al estado previo. La columna puede quedar sin uso sin romper nada (drop opcional en una migración posterior).

## Open Questions

- **Historial en `/caja`**: ¿ubicación exacta dentro de `/caja` (dentro del `RevenuePanel` o como sección aparte, ambas bajo el mismo gate)? Detalle de layout, no de contrato.

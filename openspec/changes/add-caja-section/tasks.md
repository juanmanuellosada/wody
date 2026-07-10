## 1. Schema y migración

- [x] 1.1 Agregar `canViewRevenue Boolean @default(false)` al modelo `User` en `prisma/schema.prisma`
- [x] 1.2 Generar la migración SQL additive (no `migrate dev`; preparar para `migrate deploy`)
- [x] 1.3 En la migración, agregar el backfill: `UPDATE "User" SET "canViewRevenue" = true` para el admin designado de cada gym por `email` + `gym.slug` (unidos-garage→pablo.poch@hotmail.com, rompiendo-limites→lescanojess111@gmail.com, atlas-gym→marianellareinki@hotmail.com, mila-fit→marianellareinki+mila@hotmail.com, crowned-program→diazema217@gmail.com, unidos-gap→lescanojess111@gmail.com)
- [x] 1.4 En la migración, agregar el fallback: para todo gym `kind != PERSONAL` que quede con 0 admins con `canViewRevenue`, setear `true` al `ADMIN` más antiguo (`createdAt` ASC, `deletedAt IS NULL`)
- [ ] 1.5 `prisma generate` y aplicar la migración en local (`migrate deploy`) para verificar que corre limpia — **BLOQUEADO**: `prisma generate` corrió OK, pero no hay `DATABASE_URL` local confirmada como no-prod en este entorno (no existe `.env.local`; `.env` apunta a un host Neon sin marcar explícitamente como dev) y además el host no es alcanzable desde este sandbox. Ver reporte de la ejecución.

## 2. Sesión / auth

- [x] 2.1 Propagar `canViewRevenue` en los callbacks `jwt`/`session` de NextAuth (junto a `role`/`gymId`) y en el tipo de sesión (`src/types` / augmentación de `next-auth`)

## 3. Permiso de recaudación: server action y UI de designación

- [x] 3.1 Crear la server action `setCanViewRevenue(targetUserId, next)` en `src/actions/user.ts` (molde `setCanCreateOwnRoutines`/`promoteTeacherToAdmin`): valida caller `ADMIN` con `canViewRevenue`, target `ADMIN` mismo `gymId` y `deletedAt null`, guardrail del último designado al revocar, `prisma.user.update`, `revalidatePath` de `/admin` y `/caja`
- [x] 3.2 Crear el componente cliente `ToggleCanViewRevenueButton.tsx` (molde `PromoteTeacherButton.tsx`) con confirmación
- [x] 3.3 Renderizar el toggle en `src/app/[gymSlug]/admin/page.tsx` en la columna de acciones bajo `{user.role === "ADMIN" && ...}` (bloques desktop y mobile); incluir `canViewRevenue` en el `select` de usuarios de esa página
- [x] 3.4 Reflejar en la UI el estado actual del permiso (habilitado/deshabilitado) y deshabilitar/avisar cuando el guardrail impide revocar

## 4. Sección Caja (`/[gymSlug]/caja`)

- [x] 4.1 Crear `src/app/[gymSlug]/caja/page.tsx` (Server Component) con el gate de acceso: `ADMIN`/`TEACHER` permitidos, `STUDENT`/`ACCESS` redirigidos, `PERSONAL` redirigido (mismo patrón que `/pagos`)
- [x] 4.2 Leer `canViewRevenue` fresco desde la DB por `session.user.id` para el gate de la recaudación (no confiar solo en el token)
- [x] 4.3 Descomponer `PaymentStatsPanel` en un `RevenuePanel` (recaudación + cards + `PaymentEvolutionChart` + `PaymentHistorySection`) y el botón standalone de registrar como pieza independiente
- [x] 4.4 En Caja: renderizar el botón "Registrar pago" para todo `ADMIN`/`TEACHER`; renderizar `RevenuePanel` solo si `role === "ADMIN" && canViewRevenue` (no calcular ni enviar datos de recaudación/historial si no aplica)
- [x] 4.5 Mantener el alcance por rol del registro (TEACHER solo sus alumnos) reutilizando las validaciones de `payment.ts`

## 5. Filtro por tipo de alumno

- [x] 5.1 Extender `src/lib/payment-stats.ts` (`computePeriodStats`/`resolveStudentScope`) con un parámetro opcional `studentType` que se agrega al `where` de los alumnos incluidos en la agregación
- [x] 5.2 Extender `PaymentFilters` con un selector de `StudentType`, con opciones dependientes del `kind` del gym (`MUSCULACION_LIBRE` solo `GYM`), viajando por querystring
- [x] 5.3 Cablear el filtro de tipo de alumno en el `RevenuePanel` de Caja (recaudación + gráficos)
- [x] 5.4 Cablear el filtro de tipo de alumno en la query de la tabla de Control de Pagos en `/pagos` (combinable con el filtro de estado existente)

## 6. Reducir `/pagos` a Control de Pagos

- [x] 6.1 Quitar de `src/app/[gymSlug]/pagos/page.tsx` el `PaymentStatsPanel` completo (recaudación, gráficos, historial, botón standalone de registrar)
- [x] 6.2 Conservar la tabla de alumnos con tiles de estado, edición y bloqueo; QUITAR el `RegisterPaymentRowButton` por fila (el registro de pagos queda exclusivamente en `/caja`)
- [x] 6.3 Verificar que el gate de `/pagos` sigue permitiendo `ADMIN`/`TEACHER` y que no queda ningún import/prop huérfano

## 7. Navegación

- [x] 7.1 Agregar el link "Caja" → `/caja` en `src/components/layout/Navbar.tsx` para los bloques `ADMIN` y `TEACHER`

## 8. Docs y specs

- [x] 8.1 Documentar el permiso `canViewRevenue` y la separación Pagos/Caja en `docs/` (linkear, no duplicar)
- [x] 8.2 `openspec validate add-caja-section` sin errores

## 9. Verificación

- [ ] 9.1 Verificar en runtime: admin designado ve recaudación+historial en `/caja`; admin no designado y teacher ven solo Registrar pago; ambos siguen viendo Control de Pagos en `/pagos` — **PENDIENTE**: no se pudo levantar `next dev` contra una DB con datos porque el host Neon configurado no es alcanzable desde este sandbox.
- [ ] 9.2 Verificar el guardrail: no se puede revocar el permiso al último admin designado de un gym — **PENDIENTE** (misma razón que 9.1).
- [ ] 9.3 Verificar los filtros por tipo de alumno en recaudación (`/caja`) y en Control de Pagos (`/pagos`), con opciones adaptadas al `kind` del gym — **PENDIENTE** (misma razón que 9.1).
- [ ] 9.4 `npm run lint` y `npm run build` sin errores — **PARCIAL**: `npm run lint` no reporta errores/warnings nuevos en ningún archivo tocado por este cambio (los 2 errores preexistentes de `layout.tsx` — regla `react-hooks/purity` sobre `Date.now()` — son anteriores a este cambio y no lo tocamos). `npm run build` compila TypeScript sin errores, pero falla en la fase de generación estática de `/demo/student/beneficios` (página preexistente, no tocada) porque esa página consulta Cupones vía Prisma en build time y el host Neon configurado no es alcanzable desde este sandbox — falla de infraestructura/red preexistente, no del código de este cambio.

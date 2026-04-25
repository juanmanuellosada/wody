## Context

Wody es multi-tenant: un mismo email puede existir en varios gyms y cada usuario está atado a un `gymId` (`prisma/schema.prisma`, unicidad compuesta `(email, gymId)`). El rol está modelado como enum singular `Role { ADMIN | TEACHER | STUDENT | ACCESS }` y se asigna en `createUser` (`src/actions/user.ts:18-123`). No existe ningún flujo que lo modifique después.

La autorización en runtime se basa en `session.user.role`, serializado en el JWT por NextAuth v5 (`src/lib/auth.ts:88-126`). La lista de "profes válidos" se construye con `users.filter(u => u.role === "TEACHER" || u.role === "ADMIN")` (`src/app/[gymSlug]/admin/page.tsx:70`), y `assignStudent` valida lo mismo (`src/actions/user.ts:166`). **Un ADMIN ya tiene todos los permisos de TEACHER**: puede crear WODs, recibir alumnos vía `TeacherStudent`, aparecer en filtros de profes. Adicionalmente el ADMIN puede usar el control de accesos (cuando el gym lo tiene habilitado — algunos gyms como Unidos no usan ese servicio, pero el rol lo incluye igualmente). Por eso la transición TEACHER → ADMIN es una **expansión pura de permisos**: no hay capacidades que el target pierda, no hay relaciones que dejen de tener sentido.

El flag `User.blockedAt` (`src/actions/user.ts:316-351`) controla acceso a login y rutas protegidas. La función `setUserBlocked` ya impone una invariante implícita: no se puede bloquear a un usuario con `role = ADMIN` (`src/actions/user.ts:338-340`). Esa invariante condiciona este cambio: no se debe promover a ADMIN un usuario que está bloqueado, porque dejaría al sistema en un estado que el resto del código no permite alcanzar de otro modo.

## Goals / Non-Goals

**Goals:**

- Habilitar la promoción TEACHER → ADMIN desde el panel de admin sin tocar la base.
- Validar que la operación respete tenancy y la invariante "no hay ADMIN bloqueado".
- Mantener el código simple: una action sin parámetros de rol (la transición está hardcoded).

**Non-Goals:**

- **No** habilitar ninguna otra transición: ni ADMIN → TEACHER (downgrade), ni cambios desde/hacia STUDENT o ACCESS. Si el dueño del gym necesita degradar a un admin o cambiar otro rol, va por otro cambio futuro y bajo otra discusión de producto.
- **No** introducir multi-rol.
- **No** invalidar sesiones activas. El promovido verá sus permisos de ADMIN tras re-loguearse.
- **No** notificar al usuario afectado (decisión del producto).
- **No** tests automáticos (el proyecto no tiene suite).
- **No** registrar audit log de la promoción (no hay infraestructura de audit hoy).

## Decisions

### D1: Action específica `promoteTeacherToAdmin(userId)`, no genérica `changeUserRole`

**Decisión**: la action no recibe `newRole` ni `currentRole`. Solo `userId`. La transición está fija en TEACHER → ADMIN.

**Por qué**: el alcance del cambio es esa única transición. Una action genérica con un `newRole` parametrizado abriría la puerta a otras transiciones por accidente (ej. un campo oculto en un form modificado desde devtools), obligaría a defender contra todas ellas, y diluiría el código con ramas que nadie pidió. Mejor que el código declare en su firma exactamente qué permite.

**Alternativa considerada**: action genérica con switch interno. Descartada — más superficie, menos legible, y la única transición real ya es la concreta.

### D2: Validar en orden: caller ADMIN → tenant → rol del target → no bloqueado → no auto

La action ejecuta:

1. `auth()` → `session.user.role === "ADMIN"`. Rechazar si no.
2. Cargar el target con `prisma.user.findUnique({ where: { id: userId } })`. Rechazar si no existe.
3. `target.gymId === session.user.gymId`. Rechazar si difieren.
4. `target.role === "TEACHER"`. Rechazar si no (cubre el caso "el target ya es ADMIN" como rechazo, no como no-op — ver D5).
5. `target.blockedAt === null`. Rechazar con error claro tipo "desbloqueá primero al usuario".
6. `target.id !== session.user.id`. Defensivo — implícitamente cubierto porque el caller es ADMIN y el target debe ser TEACHER, así que no pueden coincidir; queda como cinturón.
7. `prisma.user.update({ where: { id: target.id }, data: { role: "ADMIN" } })`.

**Por qué este orden**: rechazo temprano y barato para los casos comunes (caller no autorizado, target inexistente). La validación de `blockedAt` después de la de tenant evita revelar información cruzada entre gyms.

### D3: Sin transacción, sin side effects

**Decisión**: la action es un único `update`. No usa `prisma.$transaction`.

**Por qué**: no hay side effects sobre `TeacherStudent` (las filas donde el target figura como `teacherId` siguen siendo válidas: ADMIN puede actuar como teacher), ni sobre `Wod`, ni sobre flags. La operación es atómica por construcción.

### D4: Sin reset de flags

**Decisión**: no tocar `canCreateOwnRoutines`, `studentType`, `groupId`, `memberNumber`, ni ningún otro campo del User. Solo `role`.

**Por qué**: para un TEACHER, los defaults que asigna `createUser` ya son los mismos que para un ADMIN (`canCreateOwnRoutines: true`, `studentType: "PERSONALIZED"`, `groupId: null`). Cualquier cambio sería ruido.

### D5: Si `target.role !== "TEACHER"`, error explícito (no no-op)

**Decisión**: cuando el target ya es ADMIN, STUDENT o ACCESS, la action devuelve error en vez de silenciosamente no hacer nada.

**Por qué**: la única vía para llegar a la action es el botón en filas TEACHER de la UI; si llega un `userId` cuyo rol no es TEACHER, es un escenario inesperado (UI desactualizada vs datos, o request manual). Un error explícito ayuda a diagnosticar; un no-op enmascara bugs.

### D6: UI — botón "Promover a admin" solo en filas de TEACHER

**Decisión**: en `src/app/[gymSlug]/admin/page.tsx` (tabla desktop ~205-350 y cards mobile ~354-447), agregar un botón "Promover a admin" únicamente en las filas cuyo `user.role === "TEACHER"`. El botón abre un diálogo de confirmación corto: "Vas a promover a {nombre} a ADMIN. El cambio se reflejará en su sesión cuando vuelva a iniciar sesión."

- No hay `<select>` de roles. Es un botón explícito.
- Si el TEACHER tiene `blockedAt != null`, el botón se renderiza pero deshabilitado, con tooltip "El usuario está bloqueado".
- Componente cliente chico nuevo (`PromoteTeacherButton.tsx`) — no se reusa `StudentEditor` (que tiene su propia lógica para STUDENT).

**Por qué**: la operación es una sola y específica; un botón directo es más claro que un selector. La confirmación es suficiente — no hay nada que el admin pierda al confirmar (no hay relaciones que se borren, no hay permisos que el target pierda).

### D7: Sesión activa NO se invalida

**Decisión**: el cambio persiste en la base, pero el JWT del promovido sigue conteniendo `role = TEACHER` hasta el próximo login (sesión dura 90 días). La UI lo dice explícito en la confirmación.

**Por qué**: invalidar JWTs en NextAuth v5 requiere mecanismos adicionales (denylist, refresh forzado) que no existen en el proyecto. El usuario afectado no pierde permisos al promoverse — solo gana — así que la "ventana" de sesión desactualizada no es problemática (sigue pudiendo hacer todo lo que ya hacía como TEACHER, y obtiene los permisos extra al re-loguear).

## Risks / Trade-offs

- **Sesión desactualizada tras la promoción** → el promovido conserva `role = TEACHER` en su sesión actual hasta re-login. **Mitigación**: documentado en la confirmación de la UI. No se invalida JWT en este cambio. Riesgo bajo: la transición es upgrade, no downgrade — el usuario no pierde nada, solo no ve el bonus hasta volver a entrar.
- **Promoción de un TEACHER bloqueado** → rompería la invariante "no hay ADMIN bloqueado" (`setUserBlocked` la sostiene del otro lado). **Mitigación**: D2.5 rechaza la operación, y la UI deshabilita el botón con tooltip explicativo (D6).
- **Race entre `setUserBlocked(teacher)` y `promoteTeacherToAdmin(teacher)`** → en teoría dos admins simultáneos podrían bloquear y promover al mismo TEACHER, dejándolo como ADMIN bloqueado. **Mitigación**: aceptable. La ventana es minúscula y, si ocurre, el ADMIN bloqueado simplemente no puede loguearse (el chequeo de bloqueo en login y layout sigue funcionando) — el siguiente admin puede revertirlo manualmente o en un cambio futuro se podría meter el chequeo en `$transaction`. Para el alcance actual no vale la complejidad.
- **Alcance limitado a TEACHER → ADMIN** → si en el futuro se quiere degradar admins o promover STUDENT, hay que diseñar reglas (último admin, side effects sobre `TeacherStudent`, reset de flags). Eso queda explícitamente fuera de este cambio.

## Migration Plan

Sin migración de datos. El campo `role` ya existe. Deploy estándar de Next.js a Vercel:

1. Merge a `main`.
2. Vercel buildea y promueve.
3. Verificación manual en un gym piloto: promover un TEACHER, confirmar que aparece como ADMIN en la lista, que el promovido al re-loguear ve el panel de admin.

**Rollback**: revertir el commit. Sin migración, instantáneo. Las promociones aplicadas hasta el revert quedan persistidas en la base — si se quiere volver atrás un caso puntual, se hace a mano.

## Open Questions

(ninguna pendiente — todas resueltas con el cliente)

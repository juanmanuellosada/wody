## 1. Server action `promoteTeacherToAdmin`

- [x] 1.1 Agregar `promoteTeacherToAdmin(formData)` en `src/actions/user.ts` siguiendo el estilo de `createUser` / `updateStudent` (server action `"use server"`, recibe `FormData` con `userId`).
- [x] 1.2 Validar caller: `auth()` → `session.user.role === "ADMIN"`; rechazar si no.
- [x] 1.3 Parsear `userId` del FormData; rechazar si está vacío o no es string.
- [x] 1.4 Cargar el target con `prisma.user.findUnique({ where: { id: userId } })`; rechazar si no existe.
- [x] 1.5 Validar tenant: `target.gymId === session.user.gymId`; rechazar si difieren.
- [x] 1.6 Validar rol origen: `target.role === "TEACHER"`; rechazar con error explícito si no (cubre target ya ADMIN, STUDENT, ACCESS).
- [x] 1.7 Validar bloqueo: `target.blockedAt === null`; rechazar con mensaje "El usuario está bloqueado, desbloquealo primero".
- [x] 1.8 Validación defensiva: `target.id !== session.user.id` (cinturón — implícitamente cubierto por D2).
- [x] 1.9 Aplicar `prisma.user.update({ where: { id: target.id }, data: { role: "ADMIN" } })`.
- [x] 1.10 Llamar `revalidatePath` para el panel de admin del gym (`/[gymSlug]/admin`).
- [x] 1.11 Devolver el formato consistente con el resto de actions en `src/actions/user.ts` (revisar el patrón antes de elegir entre redirect o valor de retorno).

## 2. Componente UI `PromoteTeacherButton`

- [x] 2.1 Crear `src/components/PromoteTeacherButton.tsx` como componente cliente (`"use client"`) con props `{ user: { id, name, blockedAt: Date | null } }`.
- [x] 2.2 Renderizar un botón "Promover a admin". Si `user.blockedAt != null`, renderizarlo deshabilitado con tooltip o texto auxiliar "El usuario está bloqueado".
- [x] 2.3 Al hacer clic (cuando habilitado), abrir un diálogo de confirmación que incluya el nombre del target y el texto: "El cambio se reflejará en su sesión cuando vuelva a iniciar sesión."
- [x] 2.4 Al confirmar, postear a la action `promoteTeacherToAdmin` con `userId`.
- [x] 2.5 Manejar estado pending y errores devueltos por la action (mostrar el mensaje de error tal cual).

## 3. Integración en el panel de admin

- [x] 3.1 En `src/app/[gymSlug]/admin/page.tsx`, en la tabla desktop (líneas ~205-350), agregar `<PromoteTeacherButton user={...} />` en la columna de acciones de cada fila cuyo `user.role === "TEACHER"`.
- [x] 3.2 Mismo cambio en las cards mobile (líneas ~354-447).
- [x] 3.3 Verificar que el botón **no** aparece en filas con rol ADMIN, STUDENT ni ACCESS.
- [x] 3.4 Conservar el botón existente "Editar" (`StudentEditor`) sin cambios — sigue aplicando solo a STUDENT.

## 4. Verificación manual

- [ ] 4.1 Logueado como ADMIN: promover a un TEACHER no bloqueado. Confirmar que el diálogo aparece, que la lista refresca con el usuario como ADMIN, y que las filas de `TeacherStudent` donde figura como `teacherId` se conservan (`select count(*) from "TeacherStudent" where "teacherId" = ?`).
- [ ] 4.2 Logueado como el TEACHER recién promovido: cerrar sesión, volver a entrar, comprobar que la sesión refleja `role = ADMIN` y que el panel de admin es accesible.
- [ ] 4.3 Bloquear a un TEACHER (con `setUserBlocked` desde la UI). Verificar que el botón "Promover a admin" aparece deshabilitado con el indicador de bloqueo. Intentar postear el form a mano (curl/devtools): la action devuelve error.
- [ ] 4.4 Logueado como ADMIN del gym A: postear el form a mano apuntando a un TEACHER del gym B. Confirmar rechazo.
- [ ] 4.5 Logueado como ADMIN: postear el form a mano apuntando a un usuario ADMIN, STUDENT o ACCESS. Confirmar rechazo con mensaje explícito (no no-op silencioso).
- [ ] 4.6 Logueado como TEACHER, STUDENT o ACCESS: confirmar que el botón no aparece y que postear el form directo es rechazado por la action.
- [ ] 4.7 Verificar que el panel de admin **no** muestra el botón "Promover a admin" en filas que ya son ADMIN ni en filas STUDENT/ACCESS.

## 5. Cierre

- [x] 5.1 `npm run lint` limpio.
- [x] 5.2 `npm run build` limpio.
- [x] 5.3 Commit en Conventional Commits en español, scope por feature: `feat(admin): permitir promover un profe a admin desde el panel`.
- [ ] 5.4 Marcar todas las tasks como completadas en este archivo.
- [ ] 5.5 Ejecutar `/opsx:archive enable-admin-change-user-role` para promover los specs a `openspec/specs/` y mover el cambio a `openspec/changes/archive/`.

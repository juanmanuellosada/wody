## 1. Schema y migraciones

- [x] 1.1 Editar `prisma/schema.prisma`: agregar enum `JoinRequestStatus { PENDING APPROVED REJECTED }` y modelo `JoinRequest` (id, gymId, name, email, passwordHash, teacherId opcional, status, reviewedById opcional, reviewedAt opcional, createdAt). Relaciones a `Gym` (Cascade) y a `User` para `teacher` y `reviewedBy` (SetNull). Índice `@@index([gymId, status, createdAt])`.
- [x] 1.2 Agregar valor `JOIN_APPROVED` al enum `EmailLogType` existente.
- [x] 1.3 Generar SQL de migración con `prisma migrate diff` (sin aplicar): `prisma/migrations/{timestamp}_add_join_requests/migration.sql`. Verificar que es backwards-compatible (solo CREATE TABLE, CREATE TYPE, ALTER TYPE para sumar valor al enum).
- [x] 1.4 SQL aplicado manualmente en Neon. Migración registrada con `npx prisma migrate resolve --applied 20260501150435_add_join_requests`.

## 2. Capa interna de email

- [x] 2.1 Crear `src/lib/email/templates/JoinApprovedEmail.tsx`: usa `EmailLayout` (mismo header con logo del gym + footer con logo de Wody negro), saluda al alumno por nombre, anuncia aprobación, link "Ingresá ahora" hacia `${APP_URL}/{gymSlug}/login`.

## 3. Server actions

- [x] 3.1 Crear `src/actions/join-request.ts` con `submitJoinRequest({ gymSlug, name, email, password, passwordConfirmation, teacherId, honeypot })`. Validar inputs, chequear honeypot (si no vacío → return ok silencioso), chequear conflictos de email (User existente o JoinRequest pendiente → return ok silencioso), validar `teacherId` pertenece al gym y tiene role TEACHER/ADMIN, hashear password con bcrypt 10 rounds, crear `JoinRequest`. Siempre retornar `{ ok: true }` en cualquiera de los casos "silenciosos".
- [x] 3.2 En `src/actions/join-request.ts`, agregar `approveJoinRequest({ requestId })`. Verificar caller ADMIN del mismo gym (vía `auth()` y match `gymId`). Verificar status `PENDING`. Transaction: crear `User` con role STUDENT y password=passwordHash de la request, marcar request APPROVED con reviewedAt/reviewedById. Si la creación del User falla por unique constraint, NO actualizar la request y retornar error explícito. Después del commit, invocar `sendEmail` con `JoinApprovedEmail`.
- [x] 3.3 En `src/actions/join-request.ts`, agregar `rejectJoinRequest({ requestId })`. Verificar caller ADMIN del mismo gym, status PENDING, marcar REJECTED con reviewedAt/reviewedById. No mandar mail.

## 4. Proxy y página pública

- [x] 4.1 En `src/proxy.ts`, sumar `/invitarme` a la lista de rutas públicas (junto a `/activar`, `/recuperar`, `/login`, `/`).
- [x] 4.2 Crear `src/app/[gymSlug]/invitarme/page.tsx`: server component que carga el gym por slug (404 si no existe), carga la lista de teachers del gym (TEACHER+ADMIN del gym, ordenados por nombre), renderiza el form pasando esos teachers al client component.
- [x] 4.3 Crear `src/app/[gymSlug]/invitarme/JoinRequestForm.tsx` (client component): form con campos `name`, `email`, `password`, `passwordConfirmation`, `teacherId` (select, primer opción "Sin profe asignado"), y campo honeypot oculto vía CSS (`position: absolute; left: -9999px;` o similar, con `tabindex={-1}` y `autocomplete="off"`). Submit invoca `submitJoinRequest`. Después del submit, mostrar mensaje fijo "Solicitud recibida, te avisamos por mail cuando el admin la apruebe" sin importar el resultado.
- [x] 4.4 La página pública usa el mismo styling que `/login` (fondo black, panel, etc.) para consistencia visual. Mostrar el logo del gym arriba si `gym.logo` está, sino el nombre del gym como heading.

## 5. Sección admin

- [x] 5.1 Crear `src/app/[gymSlug]/admin/invitaciones/page.tsx`: server component que verifica role ADMIN (redirect si no), carga `JoinRequest` del gym agrupadas por status, lista en tabs Pendientes/Aprobadas/Rechazadas. Tab Pendientes default. Para cada request mostrar name, email, teacher.name si está, createdAt formateado, y en pendientes los botones Aprobar/Rechazar.
- [x] 5.2 Crear los componentes client de los botones Aprobar/Rechazar (`ApproveJoinRequestButton.tsx`, `RejectJoinRequestButton.tsx`) con `ConfirmDialog` antes de la acción. Usar revalidatePath o router.refresh después del éxito.
- [x] 5.3 Arriba de la lista, un componente `<JoinLinkBox gymSlug={...} />` (client) con input read-only mostrando `https://www.wody.com.ar/{gymSlug}/invitarme` y botón "Copiar" que usa `navigator.clipboard.writeText` y muestra "Copiado" temporal.

## 6. Navbar con badge

- [x] 6.1 Modificar `src/components/layout/Navbar.tsx` o el componente que renderiza el menú admin. Si role === ADMIN, agregar item "Invitaciones" linkeando a `/{slug}/admin/invitaciones`. Pasar count de pendientes como prop desde el layout (que ya hace queries server-side).
- [x] 6.2 En `src/app/[gymSlug]/layout.tsx`, si role === ADMIN, hacer `prisma.joinRequest.count({ where: { gymId, status: 'PENDING' } })` y pasarlo a la Navbar.
- [x] 6.3 Renderizar badge si count > 0 al lado del item, con el styling existente del proyecto (ej. círculo rojo con número).

## 7. Documentación

- [x] 7.1 Agregar a `docs/alta-nuevo-gym.md` y `docs/alta-nuevo-box.md` una nota sobre el link público `/{slug}/invitarme` que el admin puede compartir, y la sección de admin/invitaciones donde aprueba/rechaza.

## 8. Verificación manual y rollout

- [ ] 8.1 Smoke test en prod: abrir `/{slug}/invitarme` con un slug propio, llenar el form, comprobar que aparece en el panel admin como pendiente. Aprobar, verificar mail recibido, loguear con la password elegida en el form. Probar rechazar. Probar reintento después de rechazo (debería poder).
- [ ] 8.2 Verificar el badge en navbar (entrar como admin con requests pendientes).
- [ ] 8.3 Verificar el botón "Copiar" del link público.
- [ ] 8.4 Probar honeypot: enviar form con honeypot completado vía dev tools, verificar que no se crea request pero el caller recibe "ok".
- [ ] 8.5 Probar anti-enumeration: enviar form con email que ya existe como User en el gym → comprobar que no se crea request pero el caller recibe "ok".

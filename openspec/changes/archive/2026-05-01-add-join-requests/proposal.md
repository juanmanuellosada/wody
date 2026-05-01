## Why

Hoy todas las altas de alumnos pasan por el admin manualmente. Eso significa que para cada alumno nuevo, el admin tiene que pedirle los datos por privado, tipear el form, y crear el usuario. En gimnasios con flujo alto de alumnos nuevos (cuando se promociona una clase abierta o un descuento) eso se vuelve un cuello de botella, y el admin termina creando alumnos con datos incompletos o con errores de tipeo. Necesitamos un mecanismo donde el alumno se auto-registre desde un link público del gym, suba sus datos, y el admin solo apruebe o rechace.

## What Changes

- Nueva página pública `/{gymSlug}/invitarme` con un form de auto-registro. Campos: nombre, email, contraseña (con confirmación), profe (opcional, selector de la lista de profes del gym). Un campo honeypot oculto para filtrar bots básicos.
- La server action de submit del form crea un row en una nueva tabla `JoinRequest` con `status = PENDING` y la contraseña ya hasheada (bcryptjs, mismos rounds que `User.password`).
- Anti-enumeration: el endpoint siempre responde "solicitud recibida" exista o no el email en el gym, y exista o no una request pendiente con ese email.
- Nueva sección admin `/{gymSlug}/admin/invitaciones` con tres tabs: Pendientes, Aprobadas, Rechazadas. Lista cada `JoinRequest` con `name`, `email`, `teacherId` opcional resuelto a nombre, fecha. Botones "Aprobar" y "Rechazar" en filas pendientes.
- "Aprobar" crea el `User` copiando el hash de password de la request al campo `User.password`, marca la request `APPROVED` con `reviewedById` y `reviewedAt`, y manda un mail de "cuenta aprobada" al alumno con link al login del gym (vía Resend, usando el servicio de mails existente).
- "Rechazar" marca la request `REJECTED` con `reviewedById` y `reviewedAt`. No manda mail al alumno (silencioso).
- Badge en la navbar del admin: count de requests `PENDING` para que el admin sepa cuándo entrar a la sección.
- Arriba de la sección de invitaciones, un input read-only con la URL pública (`https://www.wody.com.ar/{slug}/invitarme`) y un botón "Copiar".
- Solo crea usuarios con `role = STUDENT`. El form no expone selector de rol.
- El proxy de Next.js suma `/invitarme` a la lista de rutas públicas (junto a `/activar`, `/recuperar`, `/login`).

## Capabilities

### New Capabilities

- `join-requests`: solicitudes de auto-registro de alumnos, con flujo de aprobación/rechazo desde el panel de admin y notificación por mail al aprobar.

### Modified Capabilities

<!-- Ninguna. user-roles cubre promoción/bloqueo, no creación; account-activation cubre el flujo de invitación con token (que sigue intacto). El nuevo flujo es independiente. -->

## Impact

- **Schema Prisma**: nuevo modelo `JoinRequest` con `id`, `gymId`, `name`, `email`, `passwordHash`, `teacherId?`, `status` (`PENDING` | `APPROVED` | `REJECTED`), `createdAt`, `reviewedAt?`, `reviewedById?`. Constraint compuesta `@@index([gymId, status, createdAt])` para listar/badge eficientemente. Sin unique compuesto en `(email, gymId)` porque el flujo permite reintentos después de rechazo (anti-enumeration: la duplicación se filtra a nivel server action). Migración aditiva, no destructiva.
- **Páginas nuevas**: `/{gymSlug}/invitarme` (pública), `/{gymSlug}/admin/invitaciones` (ADMIN).
- **Server actions nuevas**: `submitJoinRequest`, `approveJoinRequest`, `rejectJoinRequest` en `src/actions/join-request.ts`. La de submit no requiere auth; las de aprobar/rechazar requieren ADMIN del mismo gym.
- **Template de mail nuevo**: `src/lib/email/templates/JoinApprovedEmail.tsx` con branding del gym + logo de Wody en footer (mismo `EmailLayout`). Suma un valor más al enum `EmailLogType` (`JOIN_APPROVED`) y se contabiliza para la cuota mensual.
- **Proxy**: agregar `/invitarme` a las rutas públicas en `src/proxy.ts`.
- **Navbar**: badge con count de pendientes en el item "Invitaciones" (solo visible para ADMIN).
- **Tests**: no hay suite — verificación manual con escenarios del spec.
- **Documentación**: agregar mención breve a la URL pública en `docs/alta-nuevo-gym.md` y `docs/alta-nuevo-box.md`.

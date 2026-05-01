## Why

Hoy el flujo de aprobación de auto-registro siempre crea al alumno con `studentType = PERSONALIZED`, `canCreateOwnRoutines = false` y el profe que eligió el alumno. El admin no tiene forma de ajustar ninguno de esos campos al aprobar — si quiere cambiarlos, debe aprobar y después editar el usuario. Esto es fricción innecesaria: el momento natural para clasificar al alumno (general vs personalizado, con o sin profe, con o sin permiso para crear sus propias rutinas) es el momento de la aprobación, no después. También permite corregir el nombre si el alumno se equivocó al registrarse.

## What Changes

- El modal de aprobación en `/{gymSlug}/admin/invitaciones` SHALL ofrecer un botón "Editar antes de aprobar" que despliega un mini-form con: `name`, `studentType`, `teacherId` y `canCreateOwnRoutines`. El flujo rápido (sólo aprobar con los defaults del alumno) SHALL seguir funcionando sin abrir el form.
- La server action `approveJoinRequest` SHALL aceptar overrides opcionales de esos cuatro campos. Si no se mandan, mantiene el comportamiento actual (defaults del `JoinRequest`).
- La regla de negocio sobre `canCreateOwnRoutines` y profe SHALL replicar la del alta manual (`createUser`): `GENERAL` no tiene profe ni `canCreateOwnRoutines`; `PERSONALIZED` puede tener profe opcional, y si no tiene profe, `canCreateOwnRoutines` se fuerza a `true`.
- Al aprobar con cambios, el sistema SHALL persistir el `name` y `teacherId` editados en el `JoinRequest` (para que la pestaña "Aprobadas" refleje los datos finales) **además** de crear el `User` con esos valores. El `email` y `passwordHash` de la request NO SHALL ser editables.

## Capabilities

### New Capabilities

(ninguna nueva)

### Modified Capabilities

- `join-requests`: el requirement de `approveJoinRequest` y el de `Sección admin de invitaciones` cambian para soportar la edición previa a la aprobación.

## Impact

- **Código UI**: `src/app/[gymSlug]/admin/invitaciones/page.tsx` (o su componente cliente de modal) — agregar el form on-demand y el wiring de overrides.
- **Server action**: `src/actions/join-request.ts` — extender la firma de `approveJoinRequest` con overrides opcionales y aplicar la regla heredada de `createUser`.
- **Regla compartida**: la lógica `canCreateOwnRoutines = teacherIdToLink ? requestedCanCreate : true` para `PERSONALIZED` (hoy en `src/actions/user.ts:60-74`) SHALL replicarse en `approveJoinRequest`. No se introduce un helper compartido en este cambio para mantener el diff acotado, salvo que la duplicación supere ~10 líneas.
- **Modelo de datos**: sin cambios en `prisma/schema.prisma`. Todos los campos involucrados (`User.studentType`, `User.canCreateOwnRoutines`, `JoinRequest.name`, `JoinRequest.teacherId`) ya existen.
- **Email**: el `JoinApprovedEmail` se envía igual al email de la request, sin cambios.

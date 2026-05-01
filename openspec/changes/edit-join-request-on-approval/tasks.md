## 1. Server action — `approveJoinRequest` con overrides

- [x] 1.1 En `src/actions/join-request.ts`, extender la firma de `approveJoinRequest` para aceptar `overrides?: { name?: string; studentType?: "GENERAL" | "PERSONALIZED"; teacherId?: string | null; canCreateOwnRoutines?: boolean }`. Definir el tipo en el mismo archivo (no exportarlo aún) y aceptar el parámetro como opcional para preservar compatibilidad con call-sites que no manden overrides.
- [x] 1.2 Implementar la regla de resolución de campos exactamente como se describe en `design.md` decisión 3 y en el spec delta (sección "MODIFIED Requirements: Aprobación crea User"): `studentType` default PERSONALIZED; GENERAL fuerza `teacherId=null` y `canCreateOwnRoutines=false`; PERSONALIZED sin profe fuerza `canCreateOwnRoutines=true`; PERSONALIZED con profe respeta el override. La distinción `overrides.teacherId !== undefined` debe permitir explícitamente setear `teacherId = null` desde el admin.
- [x] 1.3 Validar `overrides.teacherId` cuando viene no-null: el user existe, está activo (`deletedAt IS NULL`), pertenece al mismo `gymId` de la request, y tiene `role` en `("TEACHER", "ADMIN")`. Replicar el shape del check ya existente en `src/actions/user.ts:76-88`. Si la validación falla, devolver `{ ok: false, error: "Profe inválido" }` y NO modificar la request.
- [x] 1.4 En la transacción Prisma existente del approve, además de `user.create` y `joinRequest.update({ status: APPROVED, ... })`, hacer `joinRequest.update` con los valores finales de `name` y `teacherId` resueltos por la regla. Si los overrides no cambiaron esos dos campos respecto al request original, el update sigue siendo idempotente.
- [x] 1.5 Whitelist defensiva en el server: aunque el cliente sólo mande los 4 campos permitidos, en el handler tomar **explícitamente** `overrides.name`, `overrides.studentType`, `overrides.teacherId`, `overrides.canCreateOwnRoutines` y descartar cualquier otra propiedad. NO leer dinámicamente `Object.keys(overrides)`. Esto cubre el escenario "Tampering del email vía overrides" del spec.
- [x] 1.6 Agregar un comentario corto sobre `approveJoinRequest` que apunte a `src/actions/user.ts:60-74` como call-site canónico de la regla de `canCreateOwnRoutines`, para que cualquier futura modificación se propague (justificado en design decisión 3).

## 2. UI — Modal de aprobación con edición on-demand

- [x] 2.1 En el componente cliente del modal de aprobación dentro de `src/app/[gymSlug]/admin/invitaciones/page.tsx` (o su componente cliente extraído — si la página actual hace inline el modal, extraer a un componente cliente nuevo en la misma carpeta para mantener la página como server component). Identificar el componente y dejarlo localizado en una primera lectura antes de tocar nada.
- [x] 2.2 Agregar dentro del modal un botón secundario "Editar antes de aprobar" que toggle un panel desplegable con el mini-form. Por defecto el panel está colapsado y el botón "Aprobar" funciona como hoy (sin overrides).
- [x] 2.3 Implementar el mini-form con estado local (no server state):
    - `name`: text input, default `request.name`.
    - `studentType`: select con opciones GENERAL y PERSONALIZED, default PERSONALIZED.
    - `teacherId`: select con la lista de profes activos del gym + opción "Sin profe", default `request.teacherId`. La lista de profes ya se está fetcheando en otros forms del admin (ej. `UserForm`); reutilizar la misma fuente (server prop o action) en lugar de fetchear de cero.
    - `canCreateOwnRoutines`: checkbox.
- [x] 2.4 Replicar la lógica de visibilidad/forzado de `UserForm.tsx:32-36`:
    - Si `studentType !== "PERSONALIZED"`: ocultar `teacherId` y `canCreateOwnRoutines`.
    - Si `studentType === "PERSONALIZED"` y `teacherId === null`: forzar `canCreateOwnRoutines = true` y renderizarlo `disabled` con label "Obligatorio".
    - Si `studentType === "PERSONALIZED"` y hay profe: checkbox editable.
- [x] 2.5 El campo `email` SHALL mostrarse en el modal como read-only (texto plano o input deshabilitado), sin formar parte del payload.
- [x] 2.6 Al confirmar, mandar `approveJoinRequest({ requestId, overrides })` donde `overrides` se construye **sólo si el panel de edición fue abierto** y el admin tocó al menos un campo. Si nunca abrió el panel, mandar la llamada sin `overrides` para conservar el flujo rápido. Para construir el payload, incluir únicamente los campos que difieren del default del request, así no inflamos el log de la action con redundancia.
- [x] 2.7 Manejar el error `"Profe inválido"` que puede devolver el server (caso de teacher de otro gym), mostrándolo en el modal sin cerrarlo.

## 3. Verificación manual

- [x] 3.1 Levantar `npm run dev`, loguearse como ADMIN de un gym de seed con join-requests pendientes (`prisma/seed-*.ts`), y verificar que el flujo "Aprobar sin editar" funciona idéntico al actual (alumno creado con PERSONALIZED, profe del request, sin canCreateOwnRoutines).
- [x] 3.2 Probar las cuatro combinaciones del spec: aprobar editando sólo nombre; aprobar cambiando a GENERAL; aprobar dejando PERSONALIZED sin profe (verificar que el checkbox queda forzado en true); aprobar PERSONALIZED con profe distinto al elegido por el alumno.
- [x] 3.3 Verificar que la pestaña "Aprobadas" muestra el `name` y `teacher.name` finales (los editados por el admin), no los originales del request.
- [x] 3.4 Probar el caso de error: modificar el `teacherId` del payload vía dev tools para apuntar a un profe de otro gym y confirmar que el server rechaza con "Profe inválido" sin tocar la request.
- [x] 3.5 Confirmar que el email enviado por `JoinApprovedEmail` se sigue mandando al email original (no editable) y con el nombre final del usuario.

## 4. Validación final

- [x] 4.1 Correr `npm run lint`. Resolver cualquier issue introducido.
- [x] 4.2 Correr `npm run build` (incluye `prisma generate && next build`) para verificar que no hay errores de tipos en la firma extendida de `approveJoinRequest` ni en el componente del modal.
- [x] 4.3 Confirmar que `prisma/schema.prisma` no fue tocado (este cambio no requiere migration).

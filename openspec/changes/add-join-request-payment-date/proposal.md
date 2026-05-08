## Why

Hoy todo alumno aprobado por el flujo de invitaciones queda con `User.nextPaymentDate = now()` (default del schema), por lo que aparece automáticamente como "cuota vencida" en el dashboard de pagos apenas el admin lo aprueba (la comparación es estricta: `nextPaymentDate < hoy` → "Atrasado"). Esto obliga al admin a editar la fecha de cada alumno recién aprobado para limpiar falsos positivos. La feature traslada la decisión al flujo natural: el alumno declara cuándo paga al solicitar acceso, y el admin la valida o ajusta al aprobar.

## What Changes

- El form público `/{gymSlug}/invitarme` SHALL incluir un nuevo campo **obligatorio** "Próxima fecha de pago" (date input), con `min = hoy` y default UI = hoy.
- La server action `submitJoinRequest` SHALL aceptar y validar `nextPaymentDate` (formato `YYYY-MM-DD`, debe ser ≥ hoy en zona horaria Argentina). Falla → `{ ok: false, error }` específico.
- El modelo `JoinRequest` SHALL ganar un campo `nextPaymentDate DateTime @db.Date` **no nullable** (poblado por el form público).
- El modal admin "Aprobar" SHALL mostrar la fecha elegida por el alumno como dato visible en el resumen, y el sub-form "Editar antes de aprobar" SHALL incluir un date input editable con la misma validación de rango (`min = hoy`).
- `ApproveOverrides` SHALL aceptar `nextPaymentDate?: string` (formato `YYYY-MM-DD`); `approveJoinRequest` SHALL validar que la fecha resuelta sea ≥ hoy y SHALL pasar `nextPaymentDate` explícitamente al `tx.user.create` (en lugar de caer al default `now()` del schema).
- Audit trail: el `JoinRequest` SHALL persistir el `nextPaymentDate` final usado en la aprobación (igual que ya hace con `name` y `teacherIds`).
- **BREAKING (interno)**: `JoinRequestSubmit` y `ApproveJoinRequestButton` cambian su contrato de props (nuevo campo en el payload de submit, nuevo campo opcional en el de overrides). No hay clientes externos.
- Migración Prisma: el campo nuevo es no nullable. Como hoy no hay rows en `JoinRequest` con status `PENDING` que vayan a sobrevivir (las pendientes se aprueban o rechazan rápido en cada gym), la migración SHALL aplicar el campo con un default temporal (`CURRENT_DATE`) y luego retirar el default — alternativa: dos pasos (agregar nullable, backfill de rows existentes a `createdAt`, pasar a NOT NULL). El paso exacto se decide en `design.md`.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities

- `join-requests`: cambian los Requirements "Validación del form", "Persistencia con password hasheada", "Sección admin de invitaciones" y "Aprobación crea User" para incorporar `nextPaymentDate` (input del form, persistencia, edición admin, override en la aprobación).

## Impact

- **Schema (Prisma)**: nuevo campo `JoinRequest.nextPaymentDate DateTime @db.Date`. Requiere migración.
- **Server actions**: `src/actions/join-request.ts` (`submitJoinRequest`, `approveJoinRequest`, tipos `ApproveOverrides` / `JoinResult`).
- **UI pública**: `src/app/[gymSlug]/invitarme/JoinRequestForm.tsx` (nuevo campo + validación cliente).
- **UI admin**: `src/app/[gymSlug]/admin/invitaciones/ApproveJoinRequestButton.tsx` (mostrar fecha + agregar al sub-form de edición).
- **Listado admin**: `src/app/[gymSlug]/admin/invitaciones/page.tsx` y/o componente de fila — pasar `nextPaymentDate` como prop al botón.
- **Spec**: `openspec/specs/join-requests/spec.md` recibe deltas en 4 Requirements y nuevos scenarios.
- **Datos existentes**: `JoinRequest` filas históricas (en archivo o pendientes) necesitan estrategia de backfill (ver design).
- **Consumidores externos**: ninguno; las dos server actions son privadas al app.

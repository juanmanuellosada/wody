## Context

El flujo de auto-registro (cambio `add-join-requests`) deja al admin con un único botón "Aprobar" que crea al alumno con defaults rígidos: `role = STUDENT`, `studentType = PERSONALIZED`, `canCreateOwnRoutines = false`, y el profe que el alumno haya elegido (puede ser ninguno).

El alta manual (`createUser` en `src/actions/user.ts:60-74` y `UserForm` en `src/components/UserForm.tsx:32-36`) ya tiene una regla establecida y testeada para resolver `studentType`, `teacherId` y `canCreateOwnRoutines` de forma coherente. Esa regla NO se aplica hoy en el flujo de aprobación de auto-registro.

Stakeholders:
- Admins del gym: necesitan clasificar al alumno al momento de aprobar (en lugar de aprobar y editar después).
- Alumnos: el form público de auto-registro no cambia, no requiere campos nuevos.

## Goals / Non-Goals

**Goals:**
- Permitir editar `name`, `studentType`, `teacherId` y `canCreateOwnRoutines` antes de aprobar.
- Mantener el flujo rápido (un click sobre "Aprobar") para el caso 90% en que el admin sólo confirma.
- Replicar exactamente la regla de `createUser` para `studentType` + `teacherId` + `canCreateOwnRoutines`.
- Persistir los cambios tanto en el `User` creado como en el `JoinRequest` (para que la pestaña "Aprobadas" refleje los datos finales).

**Non-Goals:**
- No editar `email` ni `password` de la request.
- No cambiar el rol al crear el `User` — sigue siendo `STUDENT` por el requirement "Solo crea STUDENTs".
- No introducir un selector de rol en el form público.
- No extraer un helper compartido entre `createUser` y `approveJoinRequest` en este cambio (se evalúa después si la duplicación se vuelve molesta).
- No tocar el flujo de rechazo (`rejectJoinRequest`).

## Decisions

### Decisión 1: UX on-demand vía botón "Editar antes de aprobar"

El modal de confirmación actual SHALL agregar un botón secundario "Editar antes de aprobar" que despliega un mini-form con los cuatro campos. El botón "Aprobar" sin abrir el form usa los defaults del `JoinRequest`.

**Por qué no un form siempre visible**: el caso típico es aprobar tal cual. Forzar al admin a confirmar 4 campos cada vez aumenta fricción para el flujo más común.

**Por qué no una página dedicada**: una página separada agrega un click extra al flujo simple y obliga a manejar navegación y estado de URL para algo efímero. El modal in-place es más liviano.

### Decisión 2: La server action acepta overrides opcionales

`approveJoinRequest` SHALL extender su firma a:

```ts
approveJoinRequest({
  requestId: string,
  overrides?: {
    name?: string,
    studentType?: "GENERAL" | "PERSONALIZED",
    teacherId?: string | null,
    canCreateOwnRoutines?: boolean,
  }
}): Promise<JoinResult>
```

Si `overrides` no viene, el comportamiento es exactamente el actual. Si viene, los campos presentes pisan los defaults del `JoinRequest` antes de crear el `User`.

**Por qué overrides opcionales en lugar de un campo separado por cada uno**: agrupar en un sub-objeto deja claro a quien lee el call-site que son "valores que el admin sobrescribió", y mantiene la firma compacta.

### Decisión 3: Aplicar la regla de `createUser` con la misma lógica

La resolución final de los campos SHALL seguir el patrón existente:

```ts
const role = "STUDENT" // siempre, por requirement existente
const studentType = overrides?.studentType ?? "PERSONALIZED"
const isPersonalizedStudent = studentType === "PERSONALIZED"
const teacherIdToLink = isPersonalizedStudent
  ? (overrides?.teacherId !== undefined ? overrides.teacherId : request.teacherId) ?? null
  : null
const requestedCanCreate = overrides?.canCreateOwnRoutines ?? false
const canCreateOwnRoutines = isPersonalizedStudent
  ? (teacherIdToLink ? requestedCanCreate : true)
  : false
```

**Por qué duplicar la lógica en lugar de extraer un helper**: el diff de duplicar son ~10 líneas en una sola función. Un helper requeriría definir un tipo compartido y migrar `createUser` para llamarlo, lo cual expande el blast radius de este cambio sin beneficio inmediato. Si en el futuro aparece un tercer call-site, ahí vale extraer.

### Decisión 4: Persistir cambios en `JoinRequest` además del `User`

Al aprobar con overrides, el sistema SHALL hacer `update` sobre `JoinRequest` para:
- `name` ← `overrides.name ?? request.name`
- `teacherId` ← teacherIdToLink resuelto

**Por qué actualizar también la request**: si el admin corrigió un nombre o cambió el profe, queremos que la pestaña "Aprobadas" refleje lo que efectivamente quedó persistido, no el dato erróneo original. Esto convierte la pestaña en un audit trail útil.

**Trade-off**: perdemos el dato original que mandó el alumno (no se guarda historial). Aceptable: el dato original ya no es relevante una vez aprobado. Si más adelante se quiere histórico, se agrega un campo `originalName` o una tabla de eventos — fuera de scope.

NOTA: `studentType` y `canCreateOwnRoutines` NO existen en el modelo `JoinRequest` y NO se persisten en él — viven sólo en el `User` creado. La pestaña "Aprobadas" muestra los campos del `JoinRequest`, no del `User`, así que esos dos campos no se muestran ahí (no es regresión, hoy tampoco se muestran).

### Decisión 5: La UI replica el comportamiento del `UserForm` existente

El mini-form usa el mismo patrón que `UserForm`:
- `studentType` como select.
- `teacherId` como select de profes activos del gym (incluyendo "sin profe").
- `canCreateOwnRoutines` como checkbox; si `studentType !== "PERSONALIZED"` SHALL ocultarse; si está sin profe SHALL forzarse a `true` y `disabled` con label "Obligatorio".

**Por qué no extraer un componente compartido entre `UserForm` y este modal**: ídem decisión 3. Diff de duplicación pequeño, blast radius del helper grande. Re-evaluar si aparece un tercer caso.

## Risks / Trade-offs

- **Riesgo: Inconsistencia futura entre `createUser` y `approveJoinRequest`** si la regla de `canCreateOwnRoutines` cambia. → **Mitigación**: dejar un comentario corto en `approveJoinRequest` apuntando al call-site canónico (`src/actions/user.ts:60-74`) para que cualquier futura modificación se propague.
- **Riesgo: Race condition entre dos admins aprobando la misma request** con overrides distintos. → **Mitigación**: ya cubierto por el requirement existente "Aprobar request ya procesada" — el segundo admin recibe error porque el status ya no es `PENDING`.
- **Trade-off: Pestaña "Aprobadas" pierde el nombre original** que mandó el alumno si el admin lo edita. → Aceptado: el valor final es lo que importa post-aprobación.

## Migration Plan

No requiere migración de schema ni backfill. Los `JoinRequest` ya aprobados antes de este cambio quedan con los datos originales (no editaron nada porque la feature no existía). Las nuevas aprobaciones empiezan a usar el flujo extendido.

Rollback: revertir los archivos tocados deja el sistema en el estado pre-cambio sin pérdida de datos.

## Open Questions

(ninguna pendiente — el usuario validó UX, persistencia, y la regla heredada antes de iniciar la propuesta)

## Context

Estado actual: la pertenencia alumno↔grupo está implementada como FK simple `User.groupId` (`prisma/schema.prisma:79`), con relación `User.group` ↔ `Group.students` (líneas 88, 119). Eso obliga a que cada alumno PERSONALIZED pertenezca como máximo a un grupo. La validación está en `assignStudentToGroup` (`src/actions/group.ts:153-155`), que rechaza GENERAL pero asume FK 1-N. El UI del profe en `src/app/[gymSlug]/dashboard/teacher/page.tsx:121-123` filtra los alumnos disponibles excluyendo cualquiera con `groupId` no nulo, lo que produce el bug observado: el profe Pablo Poch en `unidos-garage` ve solo 2 alumnos cuando crea un grupo nuevo, porque 5 de sus 7 PERSONALIZED ya están en otro grupo suyo.

Constraints relevantes:
- Multi-tenancy por `gymId` ya garantizada por las queries existentes; este cambio no la altera.
- Soft-delete activo en `User`, `Group`, `Wod` (migration `20260425000000_add_user_soft_delete`). Memberships viven en una tabla nueva sin soft-delete (ver Decision D2).
- Producción tiene volumen bajo: `unidos-garage` con 5 memberships activas; otros gyms a verificar antes del deploy.
- Neon con Point-In-Time Recovery activo: rollback de schema posible si la migración falla.
- WODs de tipo `GROUP` apuntan hoy a un solo `targetGroupId`. La spec mantiene esa cardinalidad — un WOD sigue siendo para un solo grupo. Lo que cambia es que el alumno puede estar en varios grupos a la vez.

## Goals / Non-Goals

**Goals:**
- Permitir que un alumno PERSONALIZED pertenezca a 0..N grupos.
- Resolver el bottleneck del selector "agregar alumno" en `GroupManager`.
- Mantener invariantes existentes: GENERAL no agrupable, grupo y alumno deben compartir profe (vía `TeacherStudent`), admin puede saltar `TeacherStudent`.
- Migración atómica (mismo PR/deploy): schema + backfill + drop column + código nuevo.
- Cero impacto visual al alumno (no hay UI de "tu grupo" hoy).

**Non-Goals:**
- No cambiar la relación profe↔alumno (`TeacherStudent` ya es M2M, queda intacta).
- No cambiar la cardinalidad de WODs: un `Wod.targetGroupId` sigue apuntando a un único grupo.
- No habilitar grupos para GENERAL.
- No agregar metadata a `GroupMember` (joinedAt, role-in-group): se descarta para mantener la tabla mínima; si más adelante se requiere, agregar columna es trivial.
- No introducir soft-delete sobre `GroupMember`: las memberships son ephemeral (ver D2).
- No tocar UI del alumno: hoy no muestra "tu grupo", el cambio es interno al filtro de WODs.

## Decisions

### D1 — Tabla join explícita `GroupMember`, no M2M implícita de Prisma

Prisma soporta M2M implícita declarando `User.groups Group[]` ↔ `Group.students User[]`, lo que genera una tabla oculta `_GroupStudents(A, B)`. Se rechaza esa opción.

**Razones:**
- Control explícito de índices (PK compuesta `(userId, groupId)` + índice secundario `(groupId)` para "alumnos de este grupo").
- Posibilidad de añadir columnas (`joinedAt`, etc.) sin migración traumática (la M2M implícita exige convertirla).
- Las queries de `Prisma.GroupMember.deleteMany({ where: { groupId } })` son legibles; las equivalentes implícitas dependen de `disconnect` que es más opaco.
- Coherencia con el modelo existente: `TeacherStudent` ya es una tabla join explícita (`prisma/schema.prisma:161-169`).

**Definición:**
```prisma
model GroupMember {
  userId   String
  groupId  String
  user     User  @relation(fields: [userId],  references: [id], onDelete: Cascade)
  group    Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([userId, groupId])
  @@index([groupId])
}
```

`onDelete: Cascade` cubre el caso "hard-delete del User" (no usado hoy, pero correcto). Para soft-delete usamos `deleteMany` explícito en las server actions (D3).

### D2 — `GroupMember` sin `deletedAt`

Las memberships son ephemeral: hoy `User.groupId` cambia/se nullea sin historial. Replicar exactamente esa semántica con hard-delete es lo más simple. No hay requisito de auditoría sobre membresías históricas.

**Trade-off aceptado:** si en el futuro se necesita "ver de qué grupos fue parte un alumno antes", habrá que reintroducir auditoría (probablemente con tabla de eventos, no resucitando soft-delete acá).

### D3 — Server actions hacen `deleteMany` explícito (no dependen del `onDelete` del FK)

`Group.deletedAt` es soft-delete, así que el `onDelete: Cascade` del FK NO se dispara. Las acciones que hoy nullean `User.groupId` deben pasar a `deleteMany` sobre `GroupMember`:

| Acción actual | Reemplazo |
|---|---|
| `prisma.user.updateMany({ where: { groupId }, data: { groupId: null } })` (en `deleteGroup`) | `prisma.groupMember.deleteMany({ where: { groupId } })` |
| `prisma.user.updateMany({ where: { groupId: { in: deletedGroupIds } }, data: { groupId: null } })` (en soft-delete de profe) | `prisma.groupMember.deleteMany({ where: { groupId: { in: deletedGroupIds } } })` |
| `data: { groupId: null, canCreateOwnRoutines: false }` (en `toggleStudentType` a GENERAL) | Operación separada: `prisma.groupMember.deleteMany({ where: { userId } })` y `prisma.user.update(...)` en transacción |

### D4 — Selector "agregar alumno" filtra por grupo, no global

`GroupManager` hoy recibe una sola `ungroupedStudents: Student[]` que se reusa en todos los selectores. Para soportar la regla "alumno aparece como opción para cada grupo donde aún no es miembro", la prop pasa a ser por-grupo:

```ts
// antes
groups: { id, name, students: Student[] }
ungroupedStudents: Student[]

// después
groups: { id, name, students: Student[], availableToAdd: Student[] }
```

`availableToAdd` se computa server-side en `teacher/page.tsx` y `admin/page.tsx`: para cada grupo `g`, lista todos los PERSONALIZED del profe que no están en `g.students`. La prop `ungroupedStudents` se elimina.

Alternativa descartada: pasar al cliente la lista global de PERSONALIZED + el set de memberships, y filtrar en cliente. Más cómodo pero filtra menos predecible si el componente se reusa fuera del flow del profe (caso `admin/page.tsx`).

### D5 — Filtro de WOD del alumno: `groupId IN (...)` en vez de `=`

Hoy:
```ts
...(student?.groupId
  ? [{ targetType: "GROUP", targetGroupId: student.groupId }]
  : [])
```

Después:
```ts
const groupIds = await prisma.groupMember.findMany({
  where: { userId: studentId },
  select: { groupId: true },
}).then(rows => rows.map(r => r.groupId));

...(groupIds.length > 0
  ? [{ targetType: "GROUP", targetGroupId: { in: groupIds } }]
  : [])
```

Se hace en `athlete/page.tsx` y `athlete/wod/page.tsx`. Una query extra por render del dashboard del alumno. En la práctica los memberships son pocos (rara vez más de 3) y la query usa el PK compuesto. Se acepta el costo.

### D6 — Migración en una sola fase: backfill + drop column en la misma SQL

Los pasos:
1. `CREATE TABLE "GroupMember" (...)` con PK e índice.
2. `INSERT INTO "GroupMember" (userId, groupId) SELECT id, "groupId" FROM "User" WHERE "groupId" IS NOT NULL;`
3. **Validación dentro del mismo bloque**: `DO $$ BEGIN IF (SELECT COUNT(*) FROM "User" WHERE "groupId" IS NOT NULL) <> (SELECT COUNT(*) FROM "GroupMember") THEN RAISE EXCEPTION 'GroupMember backfill mismatch'; END IF; END $$;` para abortar la migración si los counts no coinciden.
4. `ALTER TABLE "User" DROP COLUMN "groupId";`

Alternativa descartada: dos fases (primero crear y backfillear, deployar, luego drop). Más segura pero introduce una ventana donde el código tiene que tolerar ambos modelos. Para el volumen actual y con PITR de Neon, la fase única es justificable.

**Atomic deploy contract:** la PR contiene schema + código simultáneo. Vercel aplica el deploy de Next.js cuando termina el `prisma migrate deploy` en build, así que la app nunca corre con schema viejo + código nuevo (o viceversa).

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Backfill incorrecto (alguna fila se pierde) | Bloque `DO $$` en la migration aborta si counts pre/post no coinciden. Adicional: `tasks.md` incluye snapshot manual de `SELECT * FROM "User" WHERE "groupId" IS NOT NULL` antes del deploy. |
| Deploy no atómico → ventana con app rota | La PR junta schema + código. Vercel ejecuta `prisma migrate deploy` en `build` antes de promote; ante fallo en migrate, Vercel aborta el deploy y queda la versión anterior. |
| Algún callsite de `User.groupId` que no se detectó | Grep cubrió 13 ocurrencias en `src/` y `prisma/`. Todas listadas en `tasks.md`. ESLint+typecheck en CI captura cualquiera que sobre. |
| Alumno en muchos grupos hace que el feed del WOD se infle | Si un día se vuelve normal tener N>10 memberships, podría duplicarse contenido si dos profes apuntan al mismo material en grupos distintos. Es responsabilidad del profe (no del modelo). Se acepta. |
| Performance: query extra de memberships en cada render del athlete dashboard | PK + índice cubren. <100µs típico. Aceptable. |
| `GroupMember` sin soft-delete pierde historia de "estuvo en X grupo" | No hay requisito de negocio. Si surge, se introduce tabla de eventos aparte. |
| Datos en otros gyms con `groupId` no nulo | El backfill los cubre indistinto del gym. La validación de count incluye todos los gyms. |

## Migration Plan

### Pre-deploy
1. Snapshot manual: `SELECT id, name, "groupId", "gymId" FROM "User" WHERE "groupId" IS NOT NULL ORDER BY "gymId", id;` → guardar para auditoría.
2. Verificar PITR de Neon activo y retención > 1h.

### Deploy (atómico vía Vercel + Prisma)
1. `prisma migrate deploy` ejecuta la migration nueva:
   - `CREATE TABLE "GroupMember" (...)`.
   - `INSERT INTO "GroupMember" SELECT id, "groupId" FROM "User" WHERE "groupId" IS NOT NULL;`.
   - Bloque `DO $$` valida `count("User".groupId NOT NULL) = count("GroupMember")`. Aborta si no.
   - `ALTER TABLE "User" DROP COLUMN "groupId";`.
2. Vercel promueve la build con el código nuevo (que ya no referencia `User.groupId`).

### Post-deploy
1. Verificación funcional: en `unidos-garage`, login como Pablo Poch → crear grupo nuevo → el selector debe mostrar todos los PERSONALIZED del profe (los 5 de "PERSONALIZADOS" deben aparecer ahora) excepto los que ya están en *ese* nuevo grupo (vacío al inicio, así que aparecen los 7).
2. Verificación de WODs: alumna que hoy está en "PERSONALIZADOS" sigue viendo los WODs `targetType=GROUP` que apuntan a ese grupo.
3. Spot-check de otros gyms con grupos activos.

### Rollback
- Si el deploy falla en `migrate deploy` por la validación de count: la migración aborta sola, queda el schema viejo intacto. Investigar qué row quedó fuera y corregir.
- Si el código nuevo presenta bug detectado post-deploy: revert del PR y `prisma migrate resolve --rolled-back` no es trivial (la columna ya fue dropeada). Plan B: forward-fix con migración nueva que recrea `User.groupId` y backfilllea desde `GroupMember`. Plan C extremo: PITR de Neon a un timestamp pre-deploy.

## Open Questions

Ninguna pendiente al momento de escribir este design. Preguntas Q1-Q4 fueron resueltas con el usuario antes de proponer:
- Q1 → Solo PERSONALIZED puede pertenecer a grupos (no se abre a GENERAL).
- Q2 → Selector excluye solo el grupo actual.
- Q3 → `User.groupId` se dropea en la misma migración.
- Q4 → Tabla se llama `GroupMember`.

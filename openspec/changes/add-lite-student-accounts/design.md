## Context

Wody es multi-tenant: cada `Gym` agrupa sus propios `User`s. Hoy el modelo `User` exige `email` (no nullable) y la unicidad relevante es `(email, gymId) WHERE deletedAt IS NULL`. Un mismo email puede existir en gyms distintos, pero dentro de un gym es único. El `memberNumber` es entero único por gym y se asigna atómicamente vía `Gym.nextMemberNumber` con recuperación P2002 ante colisiones.

Los flujos de alta de alumno existentes (`mode: "invite"` con `VerificationToken` + `mode: "password"` con hash directo) viven en `src/actions/user.ts:createUser` y se invocan desde `src/components/UserForm.tsx`. Los flujos de pagos (`src/actions/payment.ts:registerPayment`), accesos (`src/actions/access.ts:lookupForKiosk` + `decideCheckin`), y Wods/RMs (`src/actions/wod.ts`, `src/actions/rm.ts`) están razonablemente desacoplados del email del alumno: salvo el login (NextAuth Credentials provider) y el botón de invitación, el resto opera por `userId`.

Stakeholders:
- **Admins de gym**: principales usuarios del cambio — quieren registrar alumnos que no van a usar la app, sin emails inventados.
- **Profes**: no se ven afectados directamente; los lites son visibles en sus listados pero no se les pueden asignar rutinas.
- **Devs**: el cambio toca schema y varios flujos, hay que ser cuidadoso con tipos y guards.

## Goals / Non-Goals

**Goals:**
- Permitir crear alumnos sin email ni password, identificados por `memberNumber` único por gym.
- Mantener invariantes existentes: unicidad de `(email, gymId)`, unicidad de `(memberNumber, gymId)`, soft-delete, multi-tenancy.
- Hacer reversible la decisión: un lite puede convertirse en cuenta completa más adelante sin perder historial.
- Que el `UserForm` muestre el `memberNumber` estimado en los 3 modos antes de crear.
- Que el rollback no requiera migración destructiva en caliente.

**Non-Goals:**
- Auto-creación masiva de lites (importación CSV) — fuera de scope, se evalúa después.
- Permitir login alternativo para lites (por PIN, QR, etc.) — explícitamente no. Si necesitan loguearse, se upgradean.
- Cambiar la mecánica de generación de `memberNumber` (sigue siendo atómica con `Gym.nextMemberNumber` + fallback P2002).
- Modificar payment-tracking, user-roles, ni personal-mode al nivel de spec.

## Decisions

### D1: `accountKind` enum separado, NO valor `LITE` en `StudentType`

**Decisión:** crear un enum nuevo `AccountKind { FULL, LITE }` y agregar `User.accountKind` con default `FULL`. **No** extender `StudentType` (que es `GENERAL | PERSONALIZED`).

**Razón:** `studentType` describe **qué entrenamiento recibe** el alumno; `accountKind` describe **cómo se identifica/loguea**. Son ejes ortogonales. Fusionarlos pierde información en el upgrade (¿qué `studentType` tenía "originalmente" un `LITE`?) y rompe queries que asumen `GENERAL | PERSONALIZED` exhaustivo. Además, agregar valor a enum existente en PG tiene la limitación de que `ALTER TYPE ... ADD VALUE` no puede usarse en el mismo `migration.sql` transaccional que el código que lo consume.

**Alternativa descartada:** boolean `isLite`. Funciona pero un enum deja la puerta abierta a futuros tipos (`READ_ONLY`, `GUEST`, etc.) sin migrar de tipo de dato.

### D2: Migración en pasos separados, con `migrate deploy`

**Decisión:** una sola migración que (a) crea `AccountKind`, (b) agrega columna `accountKind` con default `FULL`, (c) hace `DROP NOT NULL` en `email`. Todo en un mismo `migration.sql` porque no se usa el nuevo enum en código aún (no hay riesgo del problema "unsafe use of new value").

**Razón:** Neon no soporta shadow DB para `migrate dev`. El equipo ya usa `migrate deploy` en producción (documentado en memoria del agente). `DROP NOT NULL` es metadata-only en PG, instantáneo, no reescribe tabla, y no rompe el índice parcial existente.

**Alternativa descartada:** crear migraciones separadas. Innecesario porque no estamos extendiendo un enum existente — `AccountKind` es nuevo desde cero.

### D3: `memberNumber` preview vía `MAX(memberNumber) + 1`, no reserva

**Decisión:** nueva server action `previewNextMemberNumber(gymId)` que ejecuta `SELECT COALESCE(MAX("memberNumber"), 0) + 1 FROM "User" WHERE "gymId" = ? AND "deletedAt" IS NULL`. La transacción real de creación sigue usando `Gym.nextMemberNumber` con fallback P2002.

**Razón:** consistente con el fallback ya existente para casos de colisión. Reservar números deja huecos garantizados ante formularios abandonados, y los gyms suelen contar socios secuencialmente. El preview es "estimado" — la transacción real puede asignar otro (concurrencia entre admins). El admin solo lee el número final del toast de éxito.

**Alternativa descartada:** leer `Gym.nextMemberNumber` directamente. Funciona pero puede divergir del `MAX + 1` real si hubo huecos por soft-deletes o cancelaciones (el contador solo incrementa).

### D4: Upgrade vía nueva server action, no vía `updateStudent`

**Decisión:** nueva server action `upgradeLiteUser(userId, { mode, email, password?, studentType, canCreateOwnRoutines? })` con sus propias validaciones. `updateStudent` rechaza explícitamente updates de `email`/`password` cuando el target es lite.

**Razón:**
- Separa intención (upgrade es un evento de negocio, no un edit cualquiera).
- Permite reusar la lógica de pre-check de colisiones de email (mensajes diferenciados: "ya activado" / "pendiente de activación" / "bloqueado") sin contaminar `updateStudent`.
- Soporta el sub-modo `invite` (envío de token de activación) reusando `VerificationToken`, lo cual `updateStudent` no hace.
- Impide upgrades accidentales por parte de teachers que editan datos del alumno.

**Alternativa descartada:** colapsar todo en `updateStudent` con guards. Más simple en líneas de código pero peor en claridad y testabilidad.

### D5: Restricciones del lite enforced en server, NO solo en UI

**Decisión:** cada guard de lite vive en su server action correspondiente, no solo en el componente:
- `validateTarget` en `src/actions/wod.ts` rechaza `targetStudentId` cuyo `accountKind === "LITE"`.
- `toggleStudentType` y `setCanCreateOwnRoutines` rechazan lites.
- `updateStudent` rechaza updates de email/password en lites.
- NextAuth Credentials provider agrega `email: { not: null }` defensivo (aunque el form ya bloquea email vacío).

**Razón:** los server actions son la frontera de confianza. La UI puede tener bugs o estar bypasseada por requests directos.

### D6: Sin feature flag obligatorio (opcional)

**Decisión:** **no** agregar `Gym.featureLiteEnabled` en este change. La opción "Alumno lite" está disponible para todos los gyms desde el deploy.

**Razón:** agregar un flag suma una columna más en `Gym`, otro switch en el form, y otra dimensión de testing. El cambio es lo suficientemente acotado (crear un lite no rompe nada de lo que ya funciona) como para no necesitarlo. Si después de deploy hay alguna sorpresa, se agrega el flag en un cambio posterior.

**Alternativa parcial:** mantener una env var `NEXT_PUBLIC_ENABLE_LITE_USERS` (no en schema) por si hay que apagar la UI rápido sin redeploy de schema. Decisión: agregarla como guarda en el `UserForm` (lee `process.env.NEXT_PUBLIC_ENABLE_LITE_USERS !== "false"`). Es cero costo en schema y permite kill-switch.

### D7: Lite siempre nace con `studentType="GENERAL"` y `canCreateOwnRoutines=false`

**Decisión:** al crear un lite no se ofrecen los campos `studentType` ni `canCreateOwnRoutines` en el form — quedan fijos en `GENERAL` / `false`. Al upgradearse, el admin elige los valores reales.

**Razón:** un lite por definición no entrena trackeado. Pedir esos campos al crear es ruido. El upgrade es el momento natural para decidirlos.

## Risks / Trade-offs

- **[Riesgo]** El preview de `memberNumber` puede diverger del valor real asignado en concurrencia → **Mitigación:** mostrar siempre el número real en el toast de éxito; nunca tratarlo como "reservado" en el form. Documentar en el componente que es estimado.
- **[Riesgo]** `email = null` en `User` puede romper código que asume `email: string` no-nullable → **Mitigación:** auditar todos los lugares que renderean o consumen `user.email` (relevamiento ya hecho: `src/app/[gymSlug]/admin/page.tsx`, `src/components/StudentEditor.tsx`, `src/components/ResendInvitationButton.tsx`, `src/components/EditStudentButton.tsx`). TypeScript va a marcar los call-sites al regenerar tipos de Prisma — los pasos del implementador siguen al error del compilador.
- **[Riesgo]** Un teacher podría asignar un Wod a un lite por mistake (la UI dropdown del target listará lites) → **Mitigación:** filtrar lites del dropdown de target en el editor de Wod, **y** validar en `validateTarget` en server. Doble defensa.
- **[Riesgo]** El feature flag por env var no aplica retroactivamente — si se apaga, los lites ya creados siguen existiendo → **Mitigación:** explícito en la doc. Apagar el flag solo previene crear nuevos, no inactiva existentes.
- **[Riesgo]** Rollback de schema (revertir `email` a `NOT NULL`) falla si hay lites con email null → **Mitigación:** script de rollback documentado: `UPDATE "User" SET email='lite-'||id||'@no-email.local' WHERE "accountKind"='LITE' AND email IS NULL` antes de reaplicar `NOT NULL`. Snapshot de Neon previo al deploy.
- **[Trade-off]** Sin feature flag por gym → activamos para todos a la vez. Asumimos riesgo bajo por la cobertura defensiva en server actions.
- **[Trade-off]** Sin auditoría persistida del upgrade (quién lo hizo, cuándo). Aceptamos para no agregar tabla nueva; se puede sumar en un change posterior si emerge necesidad.

## Migration Plan

1. **Pre-deploy**: snapshot de Neon.
2. **Migración Prisma** (un solo archivo SQL):
   ```sql
   CREATE TYPE "AccountKind" AS ENUM ('FULL', 'LITE');
   ALTER TABLE "User" ADD COLUMN "accountKind" "AccountKind" NOT NULL DEFAULT 'FULL';
   ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
   ```
3. **Deploy de código** con `migrate deploy` (no `migrate dev`).
4. **Smoke test post-deploy**:
   - Login de un admin existente sigue funcionando.
   - Crear alumno con `mode: "password"` sigue funcionando.
   - Crear alumno con `mode: "invite"` sigue funcionando.
   - Crear alumno con `mode: "lite"` funciona: no pide email, asigna memberNumber, aparece en tabla con etiqueta "Lite".
   - Registrar un pago a un lite funciona.
   - Buscar lite por memberNumber en kiosko funciona; conceder acceso funciona.
   - Asignar un Wod con target a un lite falla con error claro.
   - Upgrade de lite a full funciona; el alumno upgradeado puede loguearse.
5. **Rollback de código** (si hace falta): redeploy del commit anterior. Lites quedan en DB con email null — código viejo los lista raros pero no crashea.
6. **Rollback de schema completo** (último recurso): script de relleno de emails sintéticos + `ALTER COLUMN email SET NOT NULL` + `DROP COLUMN accountKind` + `DROP TYPE AccountKind`. Solo si se confirma que no se quiere mantener nada del cambio.

## Open Questions

- Ninguna bloqueante. Las decisiones sobre RMs en lites (bloqueados), feature flag (env var simple), y `studentType` default (`GENERAL`) ya están confirmadas con el usuario.
- A revisar en revisión del change: ¿el botón "Convertir a cuenta completa" debería estar también en la fila de la tabla (acción rápida) o solo en la vista de detalle del alumno?

## Why

Hoy todo alumno requiere `email` único y opcionalmente `password` para existir en el sistema. En gimnasios y boxes reales hay alumnos que solo necesitan figurar para que el admin les registre pagos y accesos en la puerta, pero no usan la app ni la web. Forzarlos a tener email genera fricción (emails falsos, colisiones por nombres repetidos) y abre la puerta a confusión cuando hay homónimos. La unicidad útil para estos casos es el `memberNumber`, no el email.

## What Changes

- **BREAKING (schema)**: `User.email` pasa de `String` a `String?` (nullable). La unicidad parcial `(email, gymId) WHERE deletedAt IS NULL` se mantiene; `NULL` no colisiona consigo mismo en PostgreSQL.
- Nuevo enum `AccountKind` con valores `FULL` y `LITE`. Nuevo campo `User.accountKind AccountKind @default(FULL)`. Es ortogonal a `StudentType` — `studentType` describe qué entrenamiento recibe el alumno (GENERAL/PERSONALIZED), `accountKind` describe si tiene cuenta utilizable o si es solo un registro administrativo.
- `UserForm` pasa de 2 modos (`invite` / `password`) a 3 (`invite` / `password` / `lite`). Los tres modos muestran el `memberNumber` estimado antes de crear, calculado como `MAX(memberNumber WHERE deletedAt IS NULL) + 1` por gym (consistente con el fallback P2002 existente).
- Server action `createUser` acepta `mode: "lite"`: crea `User` con `email=null`, `password=null`, `role="STUDENT"`, `studentType="GENERAL"`, `accountKind="LITE"`, `canCreateOwnRoutines=false`. Reusa la transacción atómica de `memberNumber`.
- Nueva server action `upgradeLiteUser(userId, { mode, email, password?, studentType, ... })`: convierte un lite en cuenta completa preservando `memberNumber`, `paymentExempt`, `nextPaymentDate`, `blockedAt` e historial de pagos/accesos. Soporta los mismos sub-modos que `createUser` (`invite` o `password`). Replica el pre-check de colisiones de email del flujo existente.
- Restricciones de los lites (todas enforced en server actions):
  - **Sin login**: NextAuth Credentials provider agrega `email: { not: null }` defensivo.
  - **Sin QR**: la PWA no se les muestra (no se loguean).
  - **Sin Wods asignados**: `validateTarget` rechaza `targetStudentId` cuyo `accountKind === "LITE"`.
  - **Sin RMs**: garantizado por construcción (un lite no tiene sesión, no puede crear RM propio); además se documenta en el spec.
  - **Sí pueden tener profe**: `TeacherStudent` los acepta sin cambios.
  - **Sí pueden tener pagos**: `registerPayment` los acepta sin cambios (siguen siendo `role="STUDENT"`).
  - **Sí aparecen en búsqueda manual del kiosko**: `lookupForKiosk` ya busca por `memberNumber`, sin cambios.
- `updateStudent` rechaza cambios de `email`/`password` sobre un lite — el upgrade es la única vía para que un lite gane esos campos.
- `toggleStudentType` y `setCanCreateOwnRoutines` rechazan operar sobre lites.
- UI admin actualiza tipos de prop a `email: string | null`. Oculta `ResendInvitationButton` para lites. Agrega botón "Convertir a cuenta completa" en la vista del alumno lite. Agrega filtro Lite/Full en la tabla.
- Feature flag opcional (`Gym.featureLiteEnabled Boolean @default(false)` o env var `NEXT_PUBLIC_ENABLE_LITE_USERS`) para activar la opción "Alumno lite" en el formulario por gym o globalmente.

## Capabilities

### New Capabilities
- `lite-student-accounts`: alumnos sin email ni password, identificados solo por `memberNumber`, restringidos a operaciones administrativas (accesos, pagos, asignación de profe), con un camino de upgrade a cuenta completa que preserva su historial.

### Modified Capabilities
<!-- Ninguna. Las capacidades existentes (user-roles, payment-tracking, user-soft-delete, personal-mode, join-requests) no cambian sus requirements al nivel de spec.
     El nuevo capability convive con ellas; las server actions de pagos y accesos siguen comportándose igual desde la perspectiva del usuario. -->

## Impact

**Schema (Prisma + PostgreSQL/Neon):**
- `prisma/schema.prisma`: `User.email` nullable, nuevo enum `AccountKind`, nuevo campo `User.accountKind`.
- Dos migraciones separadas (el `ALTER TYPE ... ADD VALUE` no se puede usar en el mismo tx que el código que lo consume — patrón canónico de PG):
  1. `CREATE TYPE "AccountKind"` + `ALTER TABLE "User" ADD COLUMN "accountKind"` con default `FULL` + `ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL`.
  2. (Solo si se decide ir por flag a nivel gym) `ALTER TABLE "Gym" ADD COLUMN "featureLiteEnabled" BOOLEAN DEFAULT false`.
- Usar `migrate deploy` (no `migrate dev`; no hay shadow DB en Neon).

**Server actions afectados:**
- `src/actions/user.ts`: `createUser` (+ mode lite), `upgradeLiteUser` (nuevo), `updateStudent` (guard), `toggleStudentType` (guard), `setCanCreateOwnRoutines` (guard), helper `previewNextMemberNumber` (nuevo).
- `src/actions/wod.ts`: `validateTarget` rechaza lites como `targetStudentId`.
- `src/actions/payment.ts`: sin cambios funcionales; auditoría manual del guard de rol.
- `src/actions/access.ts`: sin cambios; documentar que lites aparecen vía búsqueda manual.

**Auth:**
- `src/lib/auth.ts`: Credentials provider agrega filtro `email: { not: null }`.

**UI:**
- `src/components/UserForm.tsx`: 3 modos + preview de `memberNumber`.
- `src/components/StudentEditor.tsx`: tipa `currentEmail: string | null`, deshabilita inputs de email/password si es lite.
- `src/components/ResendInvitationButton.tsx` y `EditStudentButton.tsx`: prop `email: string | null`.
- `src/app/[gymSlug]/admin/page.tsx`: renderiza email null-safe, oculta resend en lites, agrega botón "Convertir a cuenta completa", agrega filtro Lite/Full.
- Nuevo componente `src/components/UpgradeLiteDialog.tsx`.

**Seeds y docs:**
- `prisma/seed-*.ts`: incluir 1-2 lites de ejemplo en el seed más usado (`seed-personal.ts` o equivalente).
- `docs/`: nuevo doc `docs/alumnos-lite.md` explicando el flujo para staff de gyms.

**Sin impacto en:**
- `src/actions/rm.ts` (lite no tiene sesión, no puede crear RMs).
- `src/components/NotificationPermissionButton.tsx` (lite nunca abre la PWA).
- Modelos `Wod`, `RM`, `Payment`, `AccessLog`, `TeacherStudent`, `PushSubscription`.

**Rollback plan:**
- El feature flag permite apagar la creación de lites sin tocar schema.
- Rollback de código sin rollback de schema es seguro (código viejo ignora `accountKind`; lites aparecen como usuarios sin email).
- Rollback de schema completo requiere primero rellenar emails sintéticos en lites existentes (`UPDATE "User" SET email='lite-'||id||'@no-email.local' WHERE accountKind='LITE'`) antes de restaurar `NOT NULL`.
- Snapshot de Neon antes del deploy.

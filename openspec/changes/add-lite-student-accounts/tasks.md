## 1. Schema y migración

- [x] 1.1 Editar `prisma/schema.prisma`: agregar enum `AccountKind { FULL, LITE }`, agregar `accountKind AccountKind @default(FULL)` en `model User`, cambiar `email String` a `email String?`.
- [x] 1.2 Generar migración SQL con `npx prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script` y revisar manualmente. El archivo final SHALL contener: `CREATE TYPE "AccountKind"`, `ALTER TABLE "User" ADD COLUMN "accountKind"` con default `'FULL'`, `ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL`.
- [ ] 1.3 Aplicar con `npx prisma migrate deploy` (no `migrate dev`; Neon sin shadow DB). **PENDIENTE — acción del humano**.
- [x] 1.4 Regenerar cliente Prisma (`npx prisma generate`) y dejar que TypeScript marque los call-sites a corregir.

## 2. Helper de preview de memberNumber

- [x] 2.1 Nuevo helper `previewNextMemberNumber(gymId: string): Promise<number>` en `src/actions/user.ts` (o `src/lib/memberNumber.ts` si conviene aislarlo). Implementa `SELECT COALESCE(MAX("memberNumber"), 0) + 1 FROM "User" WHERE "gymId" = ? AND "deletedAt" IS NULL`. Documentar inline que es estimado, no reservado.
- [x] 2.2 Exponerlo como server action `"use server"` para que `UserForm` lo pueda llamar al montar.

## 3. `createUser` — modo `lite`

- [x] 3.1 En `src/actions/user.ts:createUser`, agregar `mode: "lite"` a la validación de input.
- [x] 3.2 En la branch `mode === "lite"`: setear `email=null`, `password=null`, `role="STUDENT"`, `studentType="GENERAL"`, `accountKind="LITE"`, `canCreateOwnRoutines=false`, `emailVerifiedAt=null`. Reusar la transacción atómica de `gym.nextMemberNumber` + recuperación P2002.
- [x] 3.3 Permitir asignación opcional de `teacherId` (crear `TeacherStudent` dentro de la misma tx) — mismo flujo que `mode: "invite"`.
- [x] 3.4 Devolver `{ success: true, memberNumber: <real> }` para que el toast lo muestre.

## 4. `upgradeLiteUser` — nueva server action

- [x] 4.1 Crear `upgradeLiteUser(userId, payload)` en `src/actions/user.ts`. Payload: `{ mode: "invite" | "password", email: string, password?: string, studentType: "GENERAL" | "PERSONALIZED", canCreateOwnRoutines?: boolean }`.
- [x] 4.2 Verificar autorización: caller SHALL ser ADMIN del mismo gym del target.
- [x] 4.3 Replicar pre-check de email del `createUser` actual (líneas 93-120 del archivo en su estado actual): si el email ya existe en el gym, devolver error diferenciado según estado del titular (activo / pendiente / bloqueado / soft-deleted).
- [x] 4.4 Validar dentro de la transacción que `target.accountKind === "LITE"` (no antes — defensa contra race conditions).
- [x] 4.5 Resolver `canCreateOwnRoutines` final aplicando las mismas reglas que `createUser` (TEACHER/ADMIN → true; PERSONALIZED sin profe → true; PERSONALIZED con profe → según parámetro; GENERAL → false).
- [x] 4.6 Branch `mode === "password"`: setear `email`, hashear `password` con bcrypt (cost 10, igual al actual), `emailVerifiedAt=now()`, `accountKind="FULL"`, `studentType`, `canCreateOwnRoutines`. NO modificar `memberNumber`, `paymentExempt`, `paymentExemptReason`, `nextPaymentDate`, `blockedAt`.
- [x] 4.7 Branch `mode === "invite"`: setear `email`, `password=null`, `emailVerifiedAt=null`, `accountKind="FULL"`, `studentType`, `canCreateOwnRoutines`. Dentro de la misma tx, crear `VerificationToken` de tipo INVITE con expiración a 7 días, reusando el helper `generateToken` existente.
- [x] 4.8 Devolver `{ success: true }` o `{ success: false, error }` con el mismo shape que `createUser`.

## 5. Guards en server actions existentes

- [x] 5.1 `src/actions/wod.ts:validateTarget`: cuando `target.type === "STUDENT"`, leer `accountKind` del student y rechazar con error en español si es `"LITE"`. Asegurar que el lookup no agregue queries innecesarios (idealmente, usar el resultado ya leído de la validación de gymId).
- [x] 5.2 `src/actions/user.ts:updateStudent`: si `target.accountKind === "LITE"` y el payload trae `email` o `password` no vacíos, rechazar con error indicando que el upgrade es el camino correcto.
- [x] 5.3 `src/actions/user.ts:toggleStudentType`: rechazar si `target.accountKind === "LITE"`.
- [x] 5.4 `src/actions/user.ts:setCanCreateOwnRoutines` (o nombre equivalente; confirmar al implementar): rechazar si `target.accountKind === "LITE"`.
- [x] 5.5 `src/lib/auth.ts`: en `authorize()` del Credentials provider, agregar `email: { not: null }` al `where` del `findMany` que busca candidatos.

## 6. UI — `UserForm` con 3 modos y preview

- [x] 6.1 En `src/components/UserForm.tsx`, agregar tercer toggle/botón "Alumno lite (sin app)".
- [x] 6.2 Al montar, invocar `previewNextMemberNumber(gymId)` y mostrar el resultado como "Próximo nº de socio (estimado): #NNNN" arriba del formulario en los 3 modos.
- [x] 6.3 En modo `lite`, ocultar inputs de `email` y `password`. Mantener `name` (required) y `teacherId` (opcional). Ocultar también selectores de `studentType` y `canCreateOwnRoutines` si estaban visibles.
- [x] 6.4 Honor el kill-switch: leer `process.env.NEXT_PUBLIC_ENABLE_LITE_USERS` y, si es `"false"`, no renderizar el botón de modo `lite`.
- [x] 6.5 Al crear con éxito, mostrar toast con el `memberNumber` real devuelto por el server.

## 7. UI — upgrade dialog

- [x] 7.1 Crear `src/components/UpgradeLiteDialog.tsx`: modal con toggle entre modos `invite` y `password`, inputs de `email` (required), `password` (required solo si modo password, min 6), selector de `studentType`, checkbox `canCreateOwnRoutines` (visible solo si `studentType === "PERSONALIZED"` y hay profe asignado).
- [x] 7.2 El dialog invoca `upgradeLiteUser` y maneja errores con los mensajes diferenciados (email en uso por activo / pendiente / bloqueado / soft-deleted).
- [x] 7.3 Al éxito, mostrar toast confirmando la conversión y revalidar la tabla de alumnos.

## 8. UI — admin page

- [x] 8.1 En `src/app/[gymSlug]/admin/page.tsx`, cambiar la renderización de `user.email` por algo null-safe: si `email === null`, mostrar `#${formatMemberNumber(user.memberNumber)}` o el texto "Sin email" (decidir al implementar; preferir el memberNumber para no perder identificación visual).
- [x] 8.2 Renderizar badge "Lite" en filas con `accountKind === "LITE"` (estilo distinto al de "Pendiente", "Bloqueado", etc.).
- [x] 8.3 Ocultar `ResendInvitationButton` cuando `user.accountKind === "LITE"` o `user.email === null`.
- [x] 8.4 Renderizar nuevo botón "Convertir a cuenta completa" en filas de lites; al click, abrir `UpgradeLiteDialog` con el `userId` del lite.
- [x] 8.5 Agregar filtro segmentado Lite / Full / Todos en la cabecera de la tabla (similar al filtro de estado si existe).
- [ ] 8.6 Filtrar lites del dropdown de "Alumno target" en el editor de Wod (si existe esa UI de creación con `targetType="STUDENT"`). **No implementado — el guard en server action es suficiente; la UI del WOD editor no usa ese dropdown en este change.**

## 9. Tipos de props en componentes

- [x] 9.1 `src/components/ResendInvitationButton.tsx`: cambiar prop `email: string` → `email: string | null`. Si null, el componente no renderiza nada (o un placeholder deshabilitado).
- [x] 9.2 `src/components/EditStudentButton.tsx`: misma señal para la prop `email`.
- [x] 9.3 `src/components/StudentEditor.tsx`: cambiar `currentEmail` a `string | null`. Si `accountKind === "LITE"` (agregar prop), los inputs de email/password se deshabilitan o se ocultan, y el editor redirige al admin a usar `UpgradeLiteDialog`.
- [x] 9.4 Recorrer el output de `tsc --noEmit` y corregir cualquier otro lugar donde un `string` consume `email` ahora-nullable. Fix aplicado en `src/app/[gymSlug]/pagos/page.tsx` (tipo `PaymentRow.email`).

## 10. Seeds y docs

- [x] 10.1 Agregar 1-2 alumnos lite en un seed de gym existente (preferentemente el más usado en dev, p. ej. `prisma/seed-personal.ts` o equivalente) para tener fixtures de prueba visual. **Elegido: `prisma/seed-atlas-gym.ts`** (gym de desarrollo local del proyecto).
- [x] 10.2 Crear `docs/alumnos-lite.md` explicando para staff de gyms: qué es un lite, cómo se crea, qué pueden y no pueden hacer, cómo se convierte a cuenta completa.

## 11. Verificación manual end-to-end

- [ ] 11.1 Login como ADMIN existente sigue funcionando (regresión de NextAuth filter). **PENDIENTE — acción del humano post-deploy**.
- [ ] 11.2 Crear alumno con `mode: "password"` (regresión).
- [ ] 11.3 Crear alumno con `mode: "invite"` (regresión).
- [ ] 11.4 Crear alumno con `mode: "lite"`: form muestra preview, no pide email/password, asigna memberNumber correcto, toast lo muestra.
- [ ] 11.5 Crear dos lites con el mismo nombre en el mismo gym: la creación de ambos tiene éxito.
- [ ] 11.6 Registrar un pago a un lite: éxito; aparece en historial.
- [ ] 11.7 Buscar el lite en el kiosko por `memberNumber`: aparece su ficha; conceder acceso crea `AccessLog`.
- [ ] 11.8 Intentar asignar un Wod a un lite (`targetStudentId=lite.id`): falla con error claro.
- [ ] 11.9 Intentar editar el email del lite vía `StudentEditor`: el flujo redirige a upgrade o el campo está deshabilitado.
- [ ] 11.10 Upgrade del lite a cuenta completa con `mode: "password"`: el alumno upgradeado puede loguearse; su `memberNumber` se preserva; sus pagos previos siguen ahí.
- [ ] 11.11 Upgrade del lite con `mode: "invite"`: se crea `VerificationToken`; el alumno todavía no puede loguearse hasta activar.
- [ ] 11.12 Filtro Lite/Full/Todos en tabla admin: cuenta correcta en cada vista.
- [ ] 11.13 Apagar `NEXT_PUBLIC_ENABLE_LITE_USERS="false"` y reiniciar dev server: el botón de modo lite desaparece; los lites ya creados siguen visibles y operables.

## 12. Limpieza y validaciones finales

- [x] 12.1 `npm run lint` sin errores nuevos. (0 errores nuevos; 5 warnings pre-existentes en remotion/ y email/tokens.ts)
- [x] 12.2 `npm run build` exitoso (incluye `prisma generate` + `next build`).
- [x] 12.3 Revisar que `prisma/schema.prisma` esté formateado (`npx prisma format`). Formateado.
- [ ] 12.4 Confirmar que el snapshot de Neon previo al deploy se haya tomado antes de mergear a `main`. **PENDIENTE — acción del humano**.

## 13. Follow-ups

- [x] 13.1 Guard en `unassignStudent` para que lites mantengan `canCreateOwnRoutines=false`: dentro de la transacción, antes de hacer `update { canCreateOwnRoutines: true }`, leer el `accountKind` del alumno y saltar el update si es `"LITE"`. Las demás funciones que tocan `canCreateOwnRoutines` (`toggleStudentType`, `setCanCreateOwnRoutines`, `upgradeLiteUser`) ya tenían guards previos o son correctas por diseño.

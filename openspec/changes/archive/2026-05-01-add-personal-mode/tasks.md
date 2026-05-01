## 1. Schema y migraciones

- [x] 1.1 Agregar `PERSONAL` al enum `GymKind` en `prisma/schema.prisma`
- [x] 1.2 Agregar campo `User.isPlatformAdmin Boolean @default(false)` en `prisma/schema.prisma`
- [x] 1.3 Agregar modelo `PersonalAccessWhitelist` en `prisma/schema.prisma` con campos `id`, `email @unique`, `note`, `createdAt`, `createdById?`, `consumedAt?` y relación `createdBy: User?` con `onDelete: SetNull`
- [x] 1.4 Agregar relación inversa `whitelistEntriesCreated: PersonalAccessWhitelist[]` en el modelo `User` (relation "WhitelistCreatedBy")
- [x] 1.5 Migración generada manualmente (Neon no soporta shadow DB), aplicada por el usuario, registrada con `prisma migrate resolve --applied 20260502000000_add_personal_mode`. FK de `CouponRedemption` quedó separado como deuda (rol no era owner)
- [x] 1.6 `prisma generate` corrió limpio

## 2. Slugs reservados

- [x] 2.1 Crear `src/lib/reserved-slugs.ts` con un `Set<string>` exportado: `personal`, `admin`, `api`, `app`, `validar`, `demo`, `instalar`, `registro-personal`
- [x] 2.2 Exportar helper `isReservedSlug(slug: string): boolean`
- [x] 2.3 Documentar en el archivo (comentario corto) que cada nueva ruta pública debe agregarse al set

## 3. Helper de gym kind

- [x] 3.1 Agregar `isPersonalGym(kind: GymKind): boolean` en `src/lib/gym.ts`
- [x] 3.2 Verificar que `src/lib/gym.ts` siga exportando `GYMS_WITHOUT_ACCESS_CONTROL` y `GYMS_WITHOUT_TEACHER_WHATSAPP` sin cambios

## 4. Seed del gym personal

- [x] 4.1 Crear `prisma/seed-personal.ts` que inserta el único gym personal: `slug = "personal"`, `kind = PERSONAL`, `name = "Wody Personal"`, `nextMemberNumber = 1`. Idempotente (skip si ya existe una fila con `kind = PERSONAL`)
- [x] 4.2 El seed debe rechazar si encuentra un gym con `slug = "personal"` y `kind != PERSONAL` (caso de colisión por seed previo accidental)
- [x] 4.3 Crear `docs/alta-gym-personal.md` describiendo cuándo y cómo correr el seed (paralelo en estilo a `docs/alta-nuevo-gym.md` y `docs/alta-nuevo-box.md`)
- [x] 4.4 Correr el seed en local y verificar que la fila exista; correrlo de nuevo y verificar que no falla <!-- verificar manualmente: `set -a && . ./.env.local && set +a && npx tsx prisma/seed-personal.ts` -->

## 5. Server action de registro personal

- [x] 5.1 Crear `src/actions/personal-registration.ts` con la action `submitPersonalRegistration({ name, email, password, passwordConfirm, honeypot })`
- [x] 5.2 Implementar validaciones de formato: email válido, password >= 6 chars, passwords coinciden, honeypot vacío. Honeypot populado retorna `{ ok: true }` silenciosamente
- [x] 5.3 Normalizar email a lowercase antes de cualquier consulta
- [x] 5.4 Consultar `PersonalAccessWhitelist` por email y `consumedAt: null`. Si no hay match, retornar `{ ok: true }` sin side effects
- [x] 5.5 Si hay match, ejecutar transacción: incrementar `Gym.nextMemberNumber`, crear `User` con todos los defaults del Requirement "Forma del User personal", marcar whitelist `consumedAt = now()`, generar `VerificationToken` tipo `INVITE`
- [x] 5.6 Encolar el envío del email de bienvenida fuera del path de respuesta (no `await` sobre el envío del mail). Usar `void sendEmail(...)` o equivalente para que el response al cliente no espere
- [x] 5.7 Retornar siempre `{ ok: true }` con el mismo timing perceptible (no devolver código de éxito distinto en ramas autorizadas vs no autorizadas)
- [x] 5.8 Crear la action `confirmPersonalAccount({ token })`: consume el `VerificationToken`, valida tipo `INVITE`, valida no expirado ni consumido, setea `User.emailVerifiedAt = now()`, revoca el token, retorna `{ ok: true }`. En caso de token inválido devuelve `{ ok: false, reason: "..." }`

## 6. Página pública de registro

- [x] 6.1 Crear `src/app/registro-personal/page.tsx` con el formulario (campos: nombre, email, password, password confirmación, honeypot oculto). Sin Navbar (root layout)
- [x] 6.2 Después del submit exitoso, mostrar el mensaje uniforme de éxito (texto exacto del `design.md` sección Copy)
- [x] 6.3 Errores de formato visibles inline (no bloqueados por anti-enumeración)
- [x] 6.4 Crear `src/app/registro-personal/confirmar/[token]/page.tsx` que invoca `confirmPersonalAccount`. Si `ok` redirige a `/login`. Si no, muestra error con link para reintentar `/registro-personal`

## 7. Email de bienvenida

- [x] 7.1 Identificar el motor de envío de email actual (mismo que usa `account.ts → activateAccount` y `join-request.ts`). Motor: **Resend** vía `src/lib/email/client.ts` + `src/lib/email/send.ts`. Renderizado con `@react-email/render`. Templates React en `src/lib/email/templates/`
- [x] 7.2 Crear plantilla "bienvenida personal" con el asunto y cuerpo del `design.md` sección Copy. Soportar texto plano + HTML si el motor existente lo hace
- [x] 7.3 La plantilla debe interpolar `{nombre}`, `{URL_CONFIRMACION}`, `{URL_REGISTRO}` (la última es para el caso de link expirado)
- [x] 7.4 Wirear la plantilla en `submitPersonalRegistration` paso 5.6

## 8. Routing y layout para `/personal/*`

- [x] 8.1 En `src/app/[gymSlug]/layout.tsx`, leer `gym.kind` y guardarlo en una variable accesible en el render
- [x] 8.2 Cuando `gym.kind === "PERSONAL"`, NO renderizar `<PaymentStatusBanner>` ni `<WhatsAppFab>` (independiente del rol)
- [x] 8.3 Verificar que las páginas existentes bajo `[gymSlug]/dashboard/mis-rutinas`, `[gymSlug]/dashboard/rms`, `[gymSlug]/dashboard/timers` funcionan accediendo vía `/personal/dashboard/...` (no debería requerir cambios; solo verificación) <!-- (no requiere edits, funciona por reuso del segmento dinámico) -->
- [x] 8.4 Verificar que rutas que no aplican (`/personal/admin`, `/personal/ingresos`, `/personal/pagos`, `/personal/beneficios`, `/personal/checkin`, `/personal/dashboard/teacher`, `/personal/dashboard/athlete`) no son accesibles para el usuario personal (la combinación de rol STUDENT + filtrado de Navbar las oculta; confirmar que tampoco respondan 200 si se navega manualmente, devolviendo redirect o 404) <!-- (guards agregados a 10 páginas: admin/, admin/invitaciones/, dashboard/teacher/, dashboard/athlete/, dashboard/athlete/wod/, pagos/, ingresos/, ingresos/historial/, checkin/, beneficios/) -->

## 9. Navbar reducido para modo personal

- [x] 9.1 En `src/components/layout/Navbar.tsx`, leer `gym.kind` (vía session o prop, según cómo esté hoy) en `getNavLinks()`
- [x] 9.2 Si `gym.kind === "PERSONAL"`, devolver únicamente: "Mis WODs" → `/personal/dashboard/mis-rutinas`, "Mis RMs" → `/personal/dashboard/rms`, "Cronómetros" → `/personal/dashboard/timers`
- [x] 9.3 Verificar que los menús existentes para `GYM` y `BOX` no se afectan (regresión cero)
- [x] 9.4 Verificar que el botón "Mi WOD" del student normal NO aparece para personal (la rutina del día asignada por un profe no aplica)

## 10. Validación de actions de WOD/RM para usuarios personales

- [x] 10.1 Revisar `src/actions/wod.ts → createWod`. Verificar que un STUDENT con `canCreateOwnRoutines = true` puede crear un Wod con `teacherId = session.user.id`, `targetType = "STUDENT"`, `targetStudentId = session.user.id` (ya OK, sin cambio — `canWriteWithTarget` cubre este caso)
- [x] 10.2 Si el branch no existe o es restrictivo, agregarlo (sin romper el caso existente de TEACHER/ADMIN) (ya OK, sin cambio — branch existe en `canWriteWithTarget`)
- [x] 10.3 Lo mismo para `updateWod`, `deleteWod`: confirmar que un STUDENT solo puede operar sobre WODs cuyo `teacherId === session.user.id` (ya OK, sin cambio — `canWriteExisting` maneja esto)
- [x] 10.4 Revisar `src/actions/rm.ts`: confirmar que `createRm`, `updateRm`, `deleteRm` ya operan sobre `studentId === session.user.id` sin requerir cambios (ya OK, sin cambio — sin check de rol, solo verifica studentId)

## 11. Admin de plataforma — gestión de whitelist

- [x] 11.1 Crear `src/actions/personal-whitelist.ts` con `addToWhitelist({ email, note })`, `removeFromWhitelist({ email })`, `listWhitelist({ search? })`. Cada action valida `session.user.isPlatformAdmin === true` antes de ejecutar
- [x] 11.2 `addToWhitelist` normaliza email a lowercase, rechaza duplicados con error explícito `{ ok: false, error: "duplicate" }`, setea `createdById = session.user.id`
- [x] 11.3 `removeFromWhitelist` borra la fila físicamente (P2025 → `{ ok: false, error: "not_found" }`); no afecta al User asociado si lo hubiera
- [x] 11.4 `listWhitelist` devuelve filas con `email`, `note`, `createdAt`, `consumedAt`, y nombre/email del operador que la creó (vía `include: { createdBy: { select: { id, name, email } } }`)
- [x] 11.5 Crear `src/app/admin/personal-whitelist/page.tsx` con UI para listar, agregar y quitar emails. Server component que valida `isPlatformAdmin` y redirige a `/` si no. Incluye `AddWhitelistForm.tsx` y `RemoveWhitelistButton.tsx` como client components
- [x] 11.6 Crear `src/app/admin/layout.tsx` (no existía) que redirige a `/` si `!session.user.isPlatformAdmin`

## 12. Sesión y NextAuth

- [x] 12.1 Agregado `gymKind: GymKind` a `session.user` en `src/lib/auth.ts` — callbacks `jwt` y `session` actualizados. También agregado `isPlatformAdmin: boolean` a la sesión
- [x] 12.2 Actualizado `src/types/index.ts` (es el declaration file real del proyecto, importado como `@/types/index`) con `gymKind: GymKind` e `isPlatformAdmin: boolean` en los tres módulos augmentados (`next-auth Session`, `next-auth User`, `@auth/core/types User`). No existe `next-auth.d.ts` separado
- [x] 12.3 Agregado en `authorize` de `auth.ts`: `if (user.gym.kind === "PERSONAL" && user.emailVerifiedAt === null) throw new PersonalUnverifiedError()`. Error key: `"personal_unverified"`. Solo aplica a gym PERSONAL; usuarios de gym tradicional con `emailVerifiedAt = null` no se ven afectados
- [x] 12.4 El check de `password === null → throw PendingActivationError()` está antes del check de `emailVerifiedAt` y no fue modificado — el flujo PENDING_ACTIVATION sigue igual para invitaciones tradicionales

## 13. Verificación manual end-to-end

- [x] 13.1 Levantar `npm run dev` y registrar un email NO whitelisted en `/registro-personal`. Verificar: respuesta uniforme de éxito, no se crea User en DB, no llega mail, no se crea fila en whitelist
- [x] 13.2 Loguear como `isPlatformAdmin` (setear flag manualmente en DB), agregar un email a la whitelist desde `/admin/personal-whitelist`. Verificar fila creada con todos los campos
- [x] 13.3 Registrar ese email en `/registro-personal`. Verificar: User creado en gym personal, whitelist `consumedAt` seteado, mail recibido con link de confirmación
- [x] 13.4 Click en el link → cuenta confirmada → login exitoso → llega a `/personal/...`
- [x] 13.5 Crear un Wod desde `/personal/dashboard/mis-rutinas`, crear un RM desde `/personal/dashboard/rms`. Verificar persistencia
- [x] 13.6 Verificar Navbar: solo "Mis WODs", "Mis RMs", "Cronómetros". Sin Pagos, Ingresos, Beneficios, Admin, "Mi WOD"
- [x] 13.7 Loguear como ADMIN/TEACHER/STUDENT de un gym tradicional (`GYM` o `BOX`). Verificar que el Navbar y la UI no cambiaron en absoluto (regresión cero)
- [x] 13.8 Intentar acceder a `/personal/admin`, `/personal/pagos`, `/personal/ingresos` como usuario personal. Verificar que se rechaza o redirige (no 200 con UI rota)
- [x] 13.9 Quitar el email de la whitelist desde `/admin/personal-whitelist`. Verificar que el User personal sigue existiendo y operativo
- [x] 13.10 Probar el caso de token expirado / inválido en `/registro-personal/confirmar/[token]` → mensaje de error + link a reintentar
- [x] 13.11 Probar registro con honeypot populado → respuesta uniforme, no se hace nada
- [x] 13.12 Probar registro con email autorizado pero ya consumido → respuesta uniforme, no se crea segundo User

## 14. Cleanup y docs finales

- [x] 14.1 Verificar que no quedaron `console.log` ni TODOs en código nuevo
- [x] 14.2 Correr `npm run lint` y limpiar warnings introducidos
- [x] 14.3 Correr `npm run build` y verificar build limpio
- [x] 14.4 Actualizar `AGENTS.md` con una línea breve mencionando el nuevo `GymKind.PERSONAL` y el slug reservado `personal` en la sección de jerga del dominio o en una nota
- [ ] 14.5 Confirmar con el operador del producto el copy final del email y del mensaje de éxito (los textos del `design.md` son borrador propuesto) <!-- (borrador en design.md sección Copy, queda para revisión del producto) -->

## 1. Pre-implementación: verificación de dependencias

- [x] 1.1 Confirmar estado de `add-email-service` — revisar `openspec/changes/add-email-service/tasks.md` y entender qué API queda disponible. Específicamente: ¿hay un helper para mandar emails con (`to`, `template`, `vars`)? Si no, definir cómo arrancar (stubs + ampliar en línea o esperar a que se archive).

## 2. Schema y migración Prisma

- [x] 2.1 Editar `prisma/schema.prisma`: agregar `enum SignupRequestStatus { PENDING, APPROVED, REJECTED, COMPLETED, EXPIRED }`
- [x] 2.2 Editar `prisma/schema.prisma`: agregar el modelo `GymSignupRequest` con todos los campos del spec (email, contactName, gymName, gymKindSuggested, phone, expectedStudents, message, status, createdAt, approvedAt, rejectedAt, completedAt, onboardingToken @unique, tokenExpiresAt, rejectionReason, gymId, createdByAdminId)
- [x] 2.3 Agregar las relaciones inversas en `Gym` (`signupRequest GymSignupRequest?`) y `User` (`createdSignupRequests GymSignupRequest[]` para el `createdByAdminId`)
- [x] 2.4 Editar `prisma/schema.prisma`: agregar el modelo `SignupRequestRateLimit` con `id @id @default(cuid())`, `ip String`, `createdAt DateTime @default(now())`. Sin FKs. Indice en `(ip, createdAt)`
- [x] 2.5 Crear la migración SQL manualmente en `prisma/migrations/<timestamp>_add_gym_signup_onboarding/migration.sql` siguiendo el patrón del proyecto (NO usar `migrate dev`, ver memoria de proyecto)
- [x] 2.6 Revisar el SQL: confirmar que crea solo las tablas y enum nuevos, sin tocar tablas existentes
- [x] 2.7 Correr `npx prisma generate` localmente y compilar TypeScript. Resolver errores si hay
- [ ] 2.8 Aplicar la migración a la DB local/prod en su momento (queda pendiente para Fase de Deploy)

## 3. Helpers compartidos

- [x] 3.1 Crear `src/lib/signup-request.ts` con helpers de uso transversal:
  - `generateOnboardingToken(): string` — wrap de cuid
  - `computeTokenExpiresAt(): Date` — `now + 7 días`
  - `isTokenExpired(req: GymSignupRequest): boolean`
  - `canTransition(from: SignupRequestStatus, to: SignupRequestStatus): boolean` — implementa la matriz de transiciones válidas del spec
- [x] 3.2 Crear `src/lib/rate-limit.ts` con `checkSignupRateLimit(ip: string, prisma: PrismaClient): Promise<boolean>` que cuenta entries en `SignupRequestRateLimit` con `createdAt > now - 1h` para esa IP, retorna `false` si excede 5
- [x] 3.3 Agregar `recordRateLimit(ip: string, prisma)` que crea un registro en `SignupRequestRateLimit`
- [x] 3.4 (Opcional pero recomendado) En `src/lib/rate-limit.ts` exponer `cleanupOldRateLimits(prisma)` que borra entries con `createdAt < now - 24h`. Se llamará desde el cron diario

## 4. Emails transaccionales

- [x] 4.1 Definir los 3 templates de email basándose en la API que provee `add-email-service`. Templates:
  - `lead-received`: asunto "Recibimos tu consulta", cuerpo con nombre del lead, agradecimiento, expectativa de tiempo de respuesta (ej "te contestamos en 48 hs hábiles")
  - `lead-approved`: asunto "Tu gym está aprobado en Wody", cuerpo con link a `<dominio>/onboarding/<token>`, advertencia de expiración a 7 días, breve resumen de los pasos
  - `lead-rejected`: asunto "Respuesta sobre tu solicitud en Wody", cuerpo de cortesía, opcionalmente el `rejectionReason`
- [x] 4.2 Implementar wrappers tipo `sendLeadReceivedEmail(req: GymSignupRequest)`, `sendLeadApprovedEmail(req)`, `sendLeadRejectedEmail(req)` en `src/lib/signup-emails.ts` (o donde se ubique el email service). Cada uno arma el cuerpo y delega al cliente de email genérico
- [x] 4.3 Asegurarse de que los emails sean idempotentes a nivel disparo (si el handler se invoca dos veces por un mismo evento, no spamea al destinatario más de una vez razonablemente — confiar en lock del estado en DB para evitar el doble disparo)

## 5. API pública: lead form

- [x] 5.1 Crear `src/app/api/signup-request/route.ts` con handler `POST`
- [x] 5.2 Validar shape del body (zod o validación manual): `email` (formato válido), `contactName` (no vacío), `gymName` (no vacío), `gymKindSuggested` (`GYM` o `BOX`), `phone` (opcional), `expectedStudents` (opcional, int), `message` (opcional)
- [x] 5.3 Extraer la IP del request usando los headers `x-forwarded-for` / `x-real-ip` (patrón usado en otros endpoints públicos del proyecto si lo hay; sino, fallback razonable)
- [x] 5.4 Llamar a `checkSignupRateLimit(ip)`. Si retorna `false`: responder `429 { error: "Demasiadas solicitudes, intentá más tarde" }` y NO crear nada
- [x] 5.5 Chequear si ya existe una `GymSignupRequest` con `email` igual y `status IN (PENDING, APPROVED)`. Si existe: responder `200 { success: true }` (idempotencia sigilosa) y NO crear nada
- [x] 5.6 Crear la `GymSignupRequest` con `status = PENDING`
- [x] 5.7 Llamar a `recordRateLimit(ip)`
- [x] 5.8 Disparar `sendLeadReceivedEmail(req)` en un try/catch para no romper la response si el email falla (loggear warning)
- [x] 5.9 Responder `200 { success: true }`. Cualquier error 500 con log

## 6. Server actions super-admin

- [x] 6.1 Crear `src/actions/super-admin/signup-request.ts` con `"use server"` y `assertSuperAdmin` (reutilizar el helper de `gym.ts`)
- [x] 6.2 Implementar `listSignupRequests(filter?: { status?: SignupRequestStatus })`: query con orden por `createdAt desc`, select de los campos necesarios para la tabla
- [x] 6.3 Implementar `getSignupRequestDetail(id: string)`: lee la request, lanza si no existe
- [x] 6.4 Implementar `approveSignupRequest(id: string)`: valida transición desde `PENDING` o `EXPIRED` con `canTransition`, genera token nuevo, setea expiración, persiste, dispara `sendLeadApprovedEmail`
- [x] 6.5 Implementar `rejectSignupRequest(id: string, reason?: string)`: valida transición desde `PENDING` o `APPROVED`, persiste estado y razón, dispara `sendLeadRejectedEmail`
- [x] 6.6 Implementar `createWhitelistEntry(input)`: crea la request directamente en `APPROVED` con `createdByAdminId = session.user.id`, token nuevo, expiración 7d. Dispara `sendLeadApprovedEmail`
- [x] 6.7 Implementar `resendOnboardingEmail(id: string)`: valida que la request esté en `APPROVED` y token no expirado. Si pasa, re-dispara `sendLeadApprovedEmail` con el token actual. Si el token expiró, retorna error indicando que debe re-aprobar

## 7. Server action pública: onboarding

- [x] 7.1 Crear `src/actions/onboarding.ts` con `"use server"` (no requiere session, valida por token)
- [x] 7.2 Implementar `validateOnboardingToken(token: string)`: lee la request, retorna `{ valid: true, request } | { valid: false, reason: 'not_found' | 'expired' | 'used' }`. Se usa server-side desde la page para decidir qué renderizar
- [x] 7.3 Implementar `submitOnboarding(token: string, input: { slug, password, kind, primaryColor?, logoFile?: File })`:
  - Re-validar token (TOCTOU defense)
  - Validar `slug`: no vacío, lowercase, hyphens, no en `isReservedSlug`, unicidad contra `Gym.slug`
  - Validar `password`: >= 8 chars
  - Si `logoFile` viene: subir con `uploadPublicImage(file, 'gyms')`
  - Hashear password con `bcryptjs`
  - `prisma.$transaction([
      gym.create(...),
      user.create(...),
      signupRequest.update({ status: COMPLETED, completedAt, gymId })
    ])`
  - Después del commit: `signIn("credentials", { email: req.email, password, redirect: false, gymSlug: slug })`
  - Retornar `{ success: true, slug }` para que el cliente haga `router.push`
- [x] 7.4 Manejar errores: si falla el `signIn`, retornar `{ success: true, slug, signInFailed: true }` para que el cliente muestre fallback "tu gym está listo, andá a /<slug>/login"

## 8. Cron: expiración de tokens + limpieza de rate limits

- [x] 8.1 Editar `src/app/api/cron/check-gym-trials/route.ts`: agregar al final una Fase 3 que ejecute `prisma.gymSignupRequest.updateMany({ where: { status: 'APPROVED', tokenExpiresAt: { lt: now } }, data: { status: 'EXPIRED' } })`
- [x] 8.2 Loggear el conteo de expiradas en esa misma corrida
- [x] 8.3 Agregar al final del cron una Fase 4 de limpieza: llamar a `cleanupOldRateLimits` (si se implementó en 3.4)
- [x] 8.4 Extender el JSON de respuesta del cron a `{ ..., expiredSignupRequestsCount }`

## 9. UI super-admin

- [x] 9.1 Crear `src/app/admin/signup-requests/page.tsx` (Server Component): valida `SUPERADMIN`, invoca `listSignupRequests` con filtros tomados de search params. Renderiza tabla con todas las requests, agrupadas por estado o con filtros tipo tabs (PENDING destacado al inicio)
- [x] 9.2 Crear `src/app/admin/signup-requests/[id]/page.tsx`: detalle de una request con todos sus campos, badges por estado, y un componente cliente `SignupRequestActions` con los botones Aprobar / Rechazar / Re-emitir / Re-aprobar (según estado)
- [x] 9.3 Crear `src/components/admin/SignupRequestActions.tsx` (Client Component) con la lógica de los botones, modales de confirmación, y llamadas a las server actions
- [x] 9.4 Crear `src/app/admin/signup-requests/new/page.tsx`: form de creación whitelist con los campos (email, contactName, gymName, gymKindSuggested, message?), invoca `createWhitelistEntry`
- [x] 9.5 Agregar entrada "Signup requests" o "Leads" al nav lateral del super-admin (o donde corresponda en `src/app/admin/layout.tsx`)
- [ ] 9.6 Mostrar badge con conteo de PENDING en la entrada del nav, similar a como existe en otras secciones

## 10. UI pública: pricing section en la landing

- [x] 10.1 Editar `src/app/page.tsx`: agregar una sección de pricing debajo del listado de gyms. Headline tipo "¿Querés que tu gimnasio esté acá?". Card con plan único: nombre, precio "$60.000 ARS/mes", "Trial 30 días", bullets de features (rutinas, RMs, ingresos, push, etc.), botón "Contactanos"
- [x] 10.2 Crear `src/components/landing/ContactForm.tsx` (Client Component): form con campos requeridos + opcionales según spec. Modal o sección expandible. `useTransition` para el submit. Maneja success state ("recibimos tu consulta") y error state
- [x] 10.3 Integrar el form con `POST /api/signup-request`. En éxito, mostrar mensaje y limpiar form. En 429, mensaje "demasiadas solicitudes, esperá un rato"

## 11. UI pública: onboarding

- [x] 11.1 Crear `src/app/onboarding/[token]/page.tsx` (Server Component): valida el token con `validateOnboardingToken` y renderiza:
  - Si `not_found`: página de error "este link no es válido o ya fue utilizado" con CTA a contacto
  - Si `expired`: página de error "este link expiró" con CTA a contacto
  - Si `used` (status COMPLETED): página de error "este link ya fue usado, ingresá con tu cuenta"
  - Si `valid`: renderiza `OnboardingForm` (client component) con los datos pre-cargados de la request
- [x] 11.2 Crear `src/components/onboarding/OnboardingForm.tsx` (Client Component) con form completo: input de slug (con validación en vivo de formato, no de unicidad), inputs de password y confirmación, selector de kind (radio o select GYM/BOX con label "tradicional" / "CrossFit"), input de logo (file picker opcional), input de color (hex con preview opcional). Submit invoca `submitOnboarding` con `useTransition`
- [x] 11.3 En éxito: `router.push("/<slug>/admin")`. En `signInFailed`: mostrar mensaje fallback con link a `/<slug>/login`
- [x] 11.4 Estilos consistentes con el resto del proyecto (font-heading, panel, line, brand-red, etc.)

## 12. Documentación

- [ ] 12.1 Crear `docs/onboarding-gyms.md` con guía operativa: flujo de lead, qué ve el super-admin, cómo aprobar/rechazar, cómo agregar whitelist, qué pasa con tokens expirados, troubleshooting típico (email no llegó, slug duplicado, etc.)
- [ ] 12.2 Actualizar `AGENTS.md` si hace falta (probablemente no — el WHAT/WHY/HOW no cambia, solo se agrega una sección al funnel)
- [ ] 12.3 Mencionar en el doc que el flujo manual de `/admin/gyms/new` sigue disponible para casos excepcionales

## 13. Deploy y verificación

- [ ] 13.1 Crear PR a `main` con todos los cambios
- [ ] 13.2 Verificar build de Vercel exitoso
- [ ] 13.3 Aplicar migración a prod con `npx prisma migrate deploy`
- [ ] 13.4 Smoke test del form público: enviar un lead de prueba desde la landing real, verificar que se crea la entry en DB y se manda el email "lead-received"
- [ ] 13.5 Smoke test super-admin: aprobar la request de prueba, verificar email "lead-approved", click en el link
- [ ] 13.6 Smoke test onboarding: completar el form con slug + password + kind, verificar que crea Gym + User + redirige al panel
- [ ] 13.7 Smoke test whitelist: crear una entry whitelist desde el super-admin, verificar email + onboarding
- [ ] 13.8 Smoke test rechazo: rechazar una request, verificar email "lead-rejected"
- [ ] 13.9 Smoke test expiración: setear `tokenExpiresAt` en el pasado en una request `APPROVED`, correr el cron manualmente, verificar que pasa a `EXPIRED`
- [ ] 13.10 Limpieza: borrar los gyms creados durante smoke tests (o dejarlos si querés data de muestra)

## Why

Hoy Wody no tiene una vía pública para que un gimnasio interesado en la plataforma se registre por su cuenta: la única forma de dar de alta un gym es que el super-admin lo cree manualmente desde `/admin/gyms/new`, lo cual requiere coordinación 1-a-1 por canales externos (WhatsApp, email) y termina con vos haciendo trabajo administrativo de "subir el logo, configurar el color, crear el primer usuario, mandar credenciales". Esto no escala — cualquier crecimiento más allá de 5–10 gyms se vuelve insostenible.

Falta un funnel B2B que combine **revisión humana** (vos validás cada lead antes de aprobarlo, para mantener calidad de quiénes entran) con **onboarding self-service** (el dueño aprobado completa su propio gym sin intervención tuya). Ese funnel arranca desde la landing pública con una sección de pricing visible y un form de contacto, y termina con un gym operativo en trial automáticamente.

## What Changes

- **Modelo nuevo `GymSignupRequest`** con máquina de estados `PENDING → APPROVED → REJECTED → COMPLETED → EXPIRED`. Cubre tanto leads del form público como entries de whitelist creadas directamente por el super-admin.
- **Form de contacto público en la landing** dentro de una nueva sección de pricing visible (Plan estándar $60.000/mes, trial de 30 días).
- **Panel super-admin `/admin/signup-requests`**: lista filtrable por estado, vista de detalle con acciones Aprobar / Rechazar / Re-emitir email, y creación de whitelist entries.
- **Página de onboarding pública `/onboarding/[token]`** con form para que el dueño elija slug, defina password del primer admin, confirme kind, suba logo opcional, elija color primario opcional. Al submit: transacción Prisma que crea `Gym` + primer `User` ADMIN + marca request como `COMPLETED`. Auto-login y redirect al panel del gym.
- **3 templates de email nuevos**: lead recibido (al visitante), aprobado (al dueño con link de onboarding), rechazado (al lead, opcional cuando el super-admin lo marca explícitamente).
- **Token de onboarding** con expiración a 7 días, único por request. Re-emisión manual posible desde super-admin si todavía no expiró.
- **Cron de expiración de tokens** que marca como `EXPIRED` las requests con `tokenExpiresAt < now` y status `APPROVED`. Reutiliza el cron diario existente.
- **API pública `POST /api/signup-request`** con rate limiting básico por IP.

## Capabilities

### New Capabilities

- `gym-signup-onboarding`: funnel B2B de adquisición de gyms — form público de contacto, revisión humana del super-admin, generación de token con expiración, onboarding self-service del dueño que crea el gym y su primer admin user, y emails transaccionales asociados.

### Modified Capabilities

(Ninguna. `gym-billing` provee los campos `trialEndsAt`, `paymentExempt` que este cambio consume sin modificar.)

## Impact

- **Schema (`prisma/schema.prisma`)**: nuevo modelo `GymSignupRequest`, nuevo enum `SignupRequestStatus`. Sin cambios a modelos existentes — la relación al `Gym` y al `User` super-admin son via foreign keys opcionales.
- **Migración**: solo agrega tabla y enum. Sin data-migration ni cambios destructivos.
- **API pública nueva**: `POST /api/signup-request` (sin auth) con rate limiting por IP para mitigar spam.
- **Rutas nuevas**:
  - `/onboarding/[token]` (público con validación de token)
  - `/admin/signup-requests` (super-admin: lista)
  - `/admin/signup-requests/[id]` (super-admin: detalle + acciones)
  - `/admin/signup-requests/new` (super-admin: form whitelist)
- **Server actions nuevas**:
  - `src/actions/onboarding.ts`: `submitOnboarding(token, formData)` (público).
  - `src/actions/super-admin/signup-request.ts`: `listSignupRequests`, `getSignupRequestDetail`, `approveSignupRequest`, `rejectSignupRequest`, `createWhitelistEntry`, `resendOnboardingEmail`.
- **Componentes UI nuevos**: pricing section + contact form en landing, página de onboarding (server + client), tabla de signup requests en super-admin, form de creación whitelist.
- **Emails**: 3 templates nuevos sobre la infra de `add-email-service`.
- **Cron**: extender `/api/cron/check-gym-trials` (o crear uno nuevo) para expirar tokens.
- **Dependencia explícita**: `add-email-service` debe estar operativa al momento del deploy. Si descubrimos un gap en su API, se aborda en línea durante la implementación.
- **Sin impacto en**: billing (campos consumidos pero no modificados), super-admin panel existente (se agrega sección nueva, no se modifican las existentes), modelo `Gym` o `User` (se consume `createGym`-style en la transacción, pero no se modifica `src/actions/super-admin/gym.ts`).

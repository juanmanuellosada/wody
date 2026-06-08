# Onboarding de gyms — funnel B2B

## 1. Resumen

El funnel de alta de gyms permite que cualquier visitante de la landing solicite unirse a Wody sin intervención tuya, pero con revisión humana antes de que el dueño pueda configurar su gym. El flujo cubre todo: form público de contacto → bandeja de leads en el panel super-admin → aprobación → link de onboarding con expiración de 7 días → creación de gym y primer admin en una transacción. Al terminar, el gym arranca con un trial de 15 días; el dueño configura su tarjeta cuando quiera desde `/<slug>/admin/billing` (ver [billing-mercadopago.md](./billing-mercadopago.md)). El flujo manual de `/admin/gyms/new` sigue disponible para casos excepcionales donde el super-admin quiera crear el gym completo sin pasar por este funnel.

---

## 2. Flujo end-to-end

```
Visitante llena form en la landing
    ↓
POST /api/signup-request
    ├── Rate limit por IP (5/hora) → 429 si excede
    ├── Email ya en PENDING/APPROVED → 200 silencioso (sin crear)
    └── Crea GymSignupRequest (status = PENDING)
        └── Email automático "lead-received" → visitante

Super-admin abre /admin/signup-requests → ve leads PENDING
    ├── Aprueba → genera token, seta APPROVED, email "lead-approved" con link /onboarding/<token>
    └── Rechaza (con motivo opcional) → REJECTED, email "lead-rejected" → lead

Dueño aprobado abre /onboarding/<token>
    └── Form: slug + password + kind + logo? + color?
        └── Submit → transacción Prisma:
                ├── Gym.create (trialEndsAt = now + 15d)
                ├── User.create (role ADMIN, memberNumber 1)
                └── GymSignupRequest.update (COMPLETED)
            → auto-login → redirect /<slug>/admin

Cron diario (06:00 UTC):
    ├── Fase 3: APPROVED + tokenExpiresAt < now → EXPIRED
    └── Fase 4: limpia SignupRequestRateLimit > 24h
```

Si el token expiró antes de que el dueño lo use, el cron lo marca `EXPIRED`. El super-admin puede re-aprobarlo desde el detalle, lo que genera un token nuevo y manda el email de aprobación de nuevo.

---

## 3. Flujo alternativo: whitelist

Cuando ya hablaste con el dueño por otro canal y querés mandarle el link directamente:

1. Ir a `/admin/signup-requests/new`.
2. Completar: email, nombre de contacto, nombre del gym, tipo (GYM/BOX), mensaje opcional.
3. Submit invoca `createWhitelistEntry` — crea la request directamente en `APPROVED` (con `createdByAdminId` seteado), genera token y manda el email de aprobación.
4. El resto del flujo es idéntico: el dueño abre `/onboarding/<token>` y completa el form.

---

## 4. Componentes en el código

| Componente | Qué hace |
|---|---|
| `prisma/schema.prisma` | Modelo `GymSignupRequest`, modelo `SignupRequestRateLimit`, enum `SignupRequestStatus` |
| [`src/lib/signup-request.ts`](../src/lib/signup-request.ts) | `generateOnboardingToken`, `computeTokenExpiresAt`, `isTokenExpired`, `canTransition` |
| [`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) | `checkSignupRateLimit`, `recordRateLimit`, `cleanupOldRateLimits` |
| [`src/lib/signup-emails.ts`](../src/lib/signup-emails.ts) | `sendLeadReceivedEmail`, `sendLeadApprovedEmail`, `sendLeadRejectedEmail` |
| [`src/lib/email/templates/LeadReceivedEmail.tsx`](../src/lib/email/templates/LeadReceivedEmail.tsx) | Template email "Recibimos tu consulta" |
| [`src/lib/email/templates/LeadApprovedEmail.tsx`](../src/lib/email/templates/LeadApprovedEmail.tsx) | Template email "Tu gym está aprobado en Wody" (incluye link de onboarding) |
| [`src/lib/email/templates/LeadRejectedEmail.tsx`](../src/lib/email/templates/LeadRejectedEmail.tsx) | Template email de cortesía al rechazar |
| [`src/app/api/signup-request/route.ts`](../src/app/api/signup-request/route.ts) | Endpoint público `POST /api/signup-request` con rate limiting e idempotencia |
| [`src/actions/super-admin/signup-request.ts`](../src/actions/super-admin/signup-request.ts) | `listSignupRequests`, `getSignupRequestDetail`, `approveSignupRequest`, `rejectSignupRequest`, `createWhitelistEntry`, `resendOnboardingEmail` |
| [`src/actions/onboarding.ts`](../src/actions/onboarding.ts) | `validateOnboardingToken`, `submitOnboarding` (público, valida por token) |
| [`src/app/admin/signup-requests/page.tsx`](../src/app/admin/signup-requests/page.tsx) | Lista filtrable de requests para el super-admin |
| [`src/app/admin/signup-requests/[id]/page.tsx`](../src/app/admin/signup-requests/) | Detalle de una request con acciones |
| [`src/app/admin/signup-requests/new/page.tsx`](../src/app/admin/signup-requests/) | Form de creación whitelist |
| [`src/components/admin/SignupRequestActions.tsx`](../src/components/admin/SignupRequestActions.tsx) | Client Component con botones Aprobar / Rechazar / Re-emitir / Re-aprobar |
| [`src/components/admin/WhitelistForm.tsx`](../src/components/admin/WhitelistForm.tsx) | Form de whitelist entry |
| [`src/components/landing/PricingSection.tsx`](../src/components/landing/PricingSection.tsx) | Sección de pricing en la landing (plan, precio, CTA) |
| [`src/components/landing/ContactForm.tsx`](../src/components/landing/ContactForm.tsx) | Form de contacto público (modal, maneja éxito, 429, errores) |
| [`src/app/onboarding/[token]/page.tsx`](../src/app/onboarding/) | Server Component: valida token, muestra error o renderiza el form |
| [`src/components/onboarding/OnboardingForm.tsx`](../src/components/onboarding/OnboardingForm.tsx) | Client Component con form de onboarding (slug, password, kind, logo, color) |
| [`src/app/api/cron/check-gym-trials/route.ts`](../src/app/api/cron/check-gym-trials/route.ts) | Cron diario; Fases 3 y 4 son de este funnel |

---

## 5. Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `APP_URL` | Base URL del sitio (ej: `https://www.wody.com.ar`). Se usa para construir el link de onboarding en el email de aprobación. Fallback en el código: `https://www.wody.com.ar`. |
| `CRON_SECRET` | Secret compartido para autenticar el cron (ya existe, no es nuevo). |

Las credenciales del servicio de email (Resend) ya están configuradas y son parte de `add-email-service`; no se agregan vars nuevas en este feature.

---

## 6. Operación del super-admin

### Ver leads pendientes

Ir a `/admin/signup-requests`. La tabla muestra todas las requests ordenadas por fecha de creación. Filtrá por "PENDING" para ver las que esperan revisión.

### Aprobar un lead

1. Clickear el lead en la tabla para ir al detalle.
2. Botón "Aprobar" — el sistema genera un token nuevo, setea `tokenExpiresAt = now + 7 días` y manda el email al dueño con el link de onboarding.

### Rechazar un lead

1. Desde el detalle del lead, botón "Rechazar".
2. Se abre un modal con un textarea para el motivo (opcional).
3. Confirmar — se manda el email de cortesía al lead con el motivo si lo pusiste.

Se puede rechazar tanto un lead `PENDING` como uno que ya estaba `APPROVED`.

### Crear una whitelist entry

Ir a `/admin/signup-requests/new`, completar el form y guardar. El sistema genera el token y manda el email de aprobación directamente.

### Re-emitir el email si el dueño no lo encontró

Desde el detalle, botón "Re-emitir email". Solo funciona si el token sigue vigente — re-manda el mismo email con el mismo link, sin generar token nuevo.

### Re-aprobar si el token expiró

Si el token ya expiró (request en `EXPIRED`), el botón "Re-emitir" se reemplaza por "Re-aprobar". Al clickearlo se genera un token nuevo y se manda el email de aprobación de nuevo.

---

## 7. Rate limiting y anti-spam

- **5 requests por IP por hora** al endpoint público `POST /api/signup-request`. Si se supera, el endpoint responde `429`.
- **Idempotencia sigilosa**: si el email ya tiene una request en `PENDING` o `APPROVED`, el endpoint responde `200` sin crear nada. El visitante ve el mensaje de éxito normal; no se le informa que su email ya fue registrado (evita que un atacante use la respuesta como oráculo).
- **Limpieza automática**: el cron diario borra entries de `SignupRequestRateLimit` con más de 24h (Fase 4).

---

## 8. Cron y expiración

El cron `GET /api/cron/check-gym-trials` (06:00 UTC = 03:00 ART) extiende las fases de billing con dos fases propias de este funnel:

- **Fase 3**: marca como `EXPIRED` todas las `GymSignupRequest` con `status = APPROVED` y `tokenExpiresAt < now`. Los campos del lead quedan intactos — el super-admin puede re-aprobar desde la bandeja.
- **Fase 4**: borra entries de `SignupRequestRateLimit` con `createdAt < now - 24h`.

La respuesta del cron incluye `expiredSignupRequestsCount` y `cleanedRateLimits`.

Para correr el cron manualmente en local:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check-gym-trials
```

---

## 9. Errores conocidos / pitfalls

- **Slug duplicado**: si el dueño elige un slug que ya existe en la DB, el submit falla con error visible en el campo. El dueño tiene que elegir otro. No se puede reservar el slug al aprobar — hay una ventana de conflicto si dos dueños aprobados eligen el mismo slug en paralelo.
- **Slug reservado**: la lista de slugs reservados vive en `src/lib/reserved-slugs.ts` e incluye `"onboarding"`, `"admin"`, `"api"`, `"personal"` y similares. Si el dueño ingresa un slug reservado, ve el error específico.
- **Token expirado al abrir el link**: el dueño ve una página de error con CTA a contacto. El super-admin re-aprueba desde el detalle de la request (botón "Re-aprobar").
- **Email no llegó**: consultá la tabla `EmailLog` con:
  ```sql
  SELECT * FROM "EmailLog"
  WHERE type IN ('LEAD_RECEIVED', 'LEAD_APPROVED', 'LEAD_REJECTED')
  ORDER BY "createdAt" DESC
  LIMIT 20;
  ```
  El campo `status` indica `SENT` o `FAILED`. Resend también tiene logs propios en su dashboard.
- **Transacción de onboarding falla con logo ya subido**: el blob queda huérfano en Vercel Blob. Es un trade-off aceptado (igual que en el flujo manual de `createGym`). Limpiarlo manualmente desde el dashboard de Vercel Blob si acumula mucho.
- **Auto-login falla pero el gym se creó**: el dueño ve un mensaje fallback con link a `/<slug>/login`. La cuenta existe y puede loguearse normalmente.

---

## 10. Punteros

- [docs/billing-mercadopago.md](./billing-mercadopago.md) — modelo de cobro post-onboarding (trial de 15 días, configuración de tarjeta, cron de bloqueo)
- [prisma/README.md](../prisma/README.md) — seguridad de seeds y procedimiento de reset local
- [AGENTS.md](../AGENTS.md) — guía general del proyecto (stack, comandos, convenciones)

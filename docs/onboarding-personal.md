# Onboarding de Wody Personal — funnel B2C

## 1. Resumen

El funnel Personal permite que cualquier visitante solicite acceso a Wody Personal desde la landing, con revisión humana antes de darle el link de registro. Comparte el modelo de datos con el funnel B2B: ambos usan `GymSignupRequest`, extendido con el campo `type` (`GYM` o `PERSONAL`). Las diferencias clave son la forma de aprobar (whitelist en vez de token de onboarding), el email que recibe el lead (link a `/registro-personal` en vez de `/onboarding/<token>`), y que no hay wizard de configuración. Para el funnel GYM análogo, ver [onboarding-gyms.md](./onboarding-gyms.md).

---

## 2. Flujo end-to-end

```
Visitante ve la sección Personal en la landing
    ↓
Click en "Contactanos" → abre ContactForm con formType="PERSONAL"
    ↓
POST /api/signup-request con { type: "PERSONAL", contactName, email, phone?, message? }
    ├── Rate limit por IP (5/hora) → 429 si excede
    ├── Email ya en PENDING/APPROVED → 200 silencioso, sin crear nada
    └── Crea GymSignupRequest (type=PERSONAL, status=PENDING, gymName=null, gymKindSuggested=null)
        └── Email automático PERSONAL_LEAD_RECEIVED → visitante

Super-admin abre /admin/signup-requests → ve la fila con badge "PERSONAL"
    ├── Aprueba → crea entry en PersonalAccessWhitelist con ese email
    │             setea status=APPROVED, approvedAt
    │             manda email PERSONAL_LEAD_APPROVED con link a /registro-personal
    └── Rechaza (motivo opcional) → REJECTED, email PERSONAL_LEAD_REJECTED → lead

Visitante aprobado abre /registro-personal
    └── Completa email + password
        └── Submit → crea User (role=STUDENT, canCreateOwnRoutines=true, trialEndsAt=+30d)
            → auto-login → redirect /personal/dashboard

Cron diario (06:00 UTC) — fases compartidas con gym:
    ├── Fase 3: APPROVED + tokenExpiresAt < now → EXPIRED (NO aplica a PERSONAL: no tienen token)
    └── Fase 4: limpia SignupRequestRateLimit > 24h
```

Para Personal, el token de onboarding NO se genera nunca: `GymSignupRequest.onboardingToken` queda `null`. El lead no expira por token — queda `APPROVED` indefinidamente hasta que el visitante use el link de registro o el super-admin lo rechace.

---

## 3. Flujo alternativo: whitelist directa desde super-admin

Cuando ya hablaste con el interesado y querés mandarle el link directamente, sin que pase por el form de la landing:

1. Ir a `/admin/signup-requests/new`.
2. En el selector de tipo, elegir **PERSONAL**.
3. Completar email, nombre de contacto, mensaje opcional. No hay campos de gym.
4. Submit → invoca `createWhitelistEntry({ type: 'PERSONAL', email, contactName, message? })`.
   - Crea la `GymSignupRequest` directamente en `APPROVED` (`createdByAdminId` seteado).
   - Crea entry en `PersonalAccessWhitelist` con ese email (si no existe).
   - Manda email `PERSONAL_LEAD_APPROVED` con link a `/registro-personal`.
5. El resto del flujo es idéntico desde el email en adelante.

---

## 4. Diferencias con el flujo GYM

| Aspecto | GYM | PERSONAL |
|---|---|---|
| Email al aprobar | Link a `/onboarding/<token>` (expira en 7d) | Link a `/registro-personal` (no expira) |
| Token de onboarding | Sí (`onboardingToken`, `tokenExpiresAt`) | No (`onboardingToken = null`) |
| Wizard de setup | Sí (slug, password, kind, logo, color) | No (`/registro-personal`: solo email + password) |
| Crea | `Gym` + `User` (role ADMIN) | Solo `User` (role STUDENT, canCreateOwnRoutines=true) |
| Trial arranca | Al crear el gym (`Gym.trialEndsAt`) | Al crear el user (`User.trialEndsAt`) |
| Campos requeridos en form | contactName, email, gymName, gymKindSuggested | contactName, email |
| Puede expirar el request | Sí (token vencido → estado EXPIRED) | No (queda APPROVED hasta que el user se registra o es rechazado) |
| Re-aprobar si expiró | Sí (botón "Re-aprobar" genera token nuevo) | No aplica |

---

## 5. Componentes en el código

| Componente | Propósito |
|---|---|
| [`src/components/landing/PersonalPricingSection.tsx`](../src/components/landing/PersonalPricingSection.tsx) | Card de pricing en la landing; botón "Contactanos" que abre ContactForm con `formType="PERSONAL"` |
| [`src/components/landing/ContactForm.tsx`](../src/components/landing/ContactForm.tsx) | Form compartido con gym; prop `formType="PERSONAL"` oculta campos gym-específicos |
| [`src/app/api/signup-request/route.ts`](../src/app/api/signup-request/route.ts) | Endpoint `POST /api/signup-request`; acepta `type` en el body (default `'GYM'`) |
| [`src/actions/super-admin/signup-request.ts`](../src/actions/super-admin/signup-request.ts) | `approveSignupRequest`, `rejectSignupRequest`, `createWhitelistEntry` — branchean por `req.type` |
| [`src/lib/signup-emails.ts`](../src/lib/signup-emails.ts) | `sendPersonalLeadReceivedEmail`, `sendPersonalLeadApprovedEmail`, `sendPersonalLeadRejectedEmail` |
| [`src/lib/email/templates/PersonalLeadReceivedEmail.tsx`](../src/lib/email/templates/PersonalLeadReceivedEmail.tsx) | Template "Recibimos tu consulta para Wody Personal" |
| [`src/lib/email/templates/PersonalLeadApprovedEmail.tsx`](../src/lib/email/templates/PersonalLeadApprovedEmail.tsx) | Template "Estás dentro de Wody Personal" (incluye link a `/registro-personal`) |
| [`src/lib/email/templates/PersonalLeadRejectedEmail.tsx`](../src/lib/email/templates/PersonalLeadRejectedEmail.tsx) | Template de cortesía al rechazar |
| [`src/app/admin/signup-requests/page.tsx`](../src/app/admin/signup-requests/page.tsx) | Lista con columna "Tipo" y filtro por tipo (GYM/PERSONAL) |
| [`src/app/admin/signup-requests/[id]/page.tsx`](../src/app/admin/signup-requests/) | Detalle del lead; muestra/oculta campos según `type` |
| [`src/components/admin/SignupRequestActions.tsx`](../src/components/admin/SignupRequestActions.tsx) | Botones Aprobar/Rechazar; textos adaptados según tipo |
| [`src/components/admin/WhitelistForm.tsx`](../src/components/admin/WhitelistForm.tsx) | Form de whitelist; selector de tipo al inicio, campos condicionales |

El registro propiamente dicho vive en `src/app/registro-personal/` — no se modificó en este cambio, se reutiliza tal cual. Valida que el email esté en `PersonalAccessWhitelist` antes de permitir crear el usuario.

---

## 6. Variables de entorno

No se agregan vars nuevas para este funnel. Las credenciales del servicio de email ya están configuradas desde el cambio `add-email-service`. La var `APP_URL` (para construir el link a `/registro-personal` en el email de aprobación) ya existe.

---

## 7. Errores conocidos / pitfalls

- **User llega a `/registro-personal` con email no whitelisteado:** el form lo rechaza. El super-admin tiene que aprobar el lead primero para que el email se agregue a `PersonalAccessWhitelist`.
- **Email duplicado en estado PENDING/APPROVED:** `POST /api/signup-request` responde `200 ok` sin crear nada y sin enviar email. El visitante ve el mensaje de éxito normal — comportamiento intencional (anti-spam, no revela si el email está registrado). Si el interesado volvió a llenar el form, no le llegará un segundo email.
- **El email de aprobación no llegó:** verificar en `EmailLog`:
  ```sql
  SELECT * FROM "EmailLog"
  WHERE type = 'PERSONAL_LEAD_APPROVED'
  ORDER BY "createdAt" DESC
  LIMIT 10;
  ```
  El super-admin puede re-disparar el email desde el detalle del lead con el botón "Re-emitir email".
- **El email rechazado es opcional:** si el super-admin ignora un lead sin rechazarlo, queda en `PENDING` indefinidamente. No hay limpieza automática de leads PERSONAL ignorados.
- **La whitelist no expira:** a diferencia del token GYM, el entry en `PersonalAccessWhitelist` no tiene fecha de expiración. Si el visitante aprobado demora semanas en registrarse, el link sigue funcionando.

---

## 8. Punteros

- [docs/billing-personal.md](./billing-personal.md) — modelo de cobro, trial y gestión post-registro
- [docs/onboarding-gyms.md](./onboarding-gyms.md) — funnel B2B análogo (token de onboarding, wizard)
- [docs/billing-mercadopago.md](./billing-mercadopago.md) — infra base de billing (webhook, planes MP, cron)

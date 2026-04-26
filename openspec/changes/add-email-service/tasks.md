## 1. Schema y migraciones

- [ ] 1.1 Editar `prisma/schema.prisma`: hacer `User.password` opcional (`String?`), agregar `User.emailVerifiedAt DateTime?`
- [ ] 1.2 Agregar enum `VerificationTokenType { INVITE RESET }` y modelo `VerificationToken` (id, userId, tokenHash, type, expiresAt, consumedAt, createdAt) con índice único en `tokenHash` y relación a `User`
- [ ] 1.3 Agregar enum `EmailLogType { INVITE RESET QUOTA_ALERT_80 QUOTA_ALERT_95 }`, enum `EmailLogStatus { SENT FAILED }` y modelo `EmailLog` (id, gymId opcional, to, type, resendId opcional, status, errorMessage opcional, sentAt) con índices en `(sentAt, status)` y `(type, sentAt)`
- [ ] 1.4 Generar migración Prisma (`npx prisma migrate dev --name add-email-service`) y verificar que es backwards-compatible (no rompe rows existentes)

## 2. Dependencias y configuración

- [ ] 2.1 Instalar deps en root: `npm install resend react-email @react-email/components @react-email/render`
- [ ] 2.2 Agregar al `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_QUOTA_ALERT_TO`, `EMAIL_QUOTA_MONTHLY_LIMIT`, `APP_URL`, `EMAIL_FLOW_ENABLED`
- [ ] 2.3 Documentar las variables en `docs/emails-resend.md` con instrucciones de setup DNS, verificación del dominio en Resend, y runbook de "qué hacer si llegamos al tope"

## 3. Cliente Resend y helper de envío

- [ ] 3.1 Crear `src/lib/email/client.ts` con singleton del cliente Resend (lee `RESEND_API_KEY`)
- [ ] 3.2 Crear `src/lib/email/send.ts` con `sendEmail({ to, gymId, type, subject, react })` que renderiza con `@react-email/render`, llama a Resend, y persiste un row en `EmailLog` con `SENT` o `FAILED`
- [ ] 3.3 Crear `src/lib/email/vocab.ts` con helper `vocab(kind: GymKind)` que devuelve `{ workoutWord, recordWord, placeWord }` adaptado a BOX o GYM
- [ ] 3.4 Crear `src/lib/email/tokens.ts` con helpers `generateToken()` (32 bytes random base64url), `hashToken(plain)` (sha256 hex) y `consumeToken({ tokenHash, type })`

## 4. Templates React Email

- [ ] 4.1 Crear `src/lib/email/templates/EmailLayout.tsx` componente compartido que recibe `gym: { name, primaryColor, logo, kind }` y renderiza header con logo + footer con `name` y disclaimer
- [ ] 4.2 Crear `src/lib/email/templates/InviteEmail.tsx` con CTA "Activar mi cuenta" hacia el link de activación, copy adaptado por `vocab(kind)`
- [ ] 4.3 Crear `src/lib/email/templates/PasswordResetEmail.tsx` con CTA "Cambiar mi contraseña" hacia el link de reset
- [ ] 4.4 Crear `src/lib/email/templates/QuotaAlertEmail.tsx` (sin branding de gym; remitente Wody) que reporta el uso actual y el threshold alcanzado

## 5. Server actions de activación y reset

- [ ] 5.1 Modificar `createUser` en `src/actions/user.ts`: remover input `password`, dejar `User.password = null`, generar token INVITE (TTL 7 días), invocar `sendEmail` con `InviteEmail`. Si `EMAIL_FLOW_ENABLED !== "true"`, mantener el comportamiento viejo (toggle de rollback)
- [ ] 5.2 Crear `src/actions/account.ts` con `activateAccount({ token, password, gymSlug })` (valida token INVITE, hashea password, marca `emailVerifiedAt`, consume token)
- [ ] 5.3 En `src/actions/account.ts`, agregar `requestPasswordReset({ gymSlug, email })` con anti-enumeration (siempre devuelve éxito), invalidación de tokens RESET previos, rate limit simple (5/hora por email)
- [ ] 5.4 En `src/actions/account.ts`, agregar `resetPassword({ token, password, gymSlug })` que valida token RESET, actualiza `User.password`, consume token (sin tocar `emailVerifiedAt`)
- [ ] 5.5 En `src/actions/user.ts`, agregar `resendInvitation({ userId })` con check de mismo gym, invalidación de tokens INVITE previos, generación nueva, envío

## 6. Páginas y UI

- [ ] 6.1 Crear página `src/app/[gymSlug]/activar/page.tsx`: server component que valida `?token=` (existencia, no consumido, no expirado, gym match) y renderiza form de password o mensaje de error específico
- [ ] 6.2 Crear página `src/app/[gymSlug]/recuperar/page.tsx`: análogo para reset
- [ ] 6.3 En `src/app/[gymSlug]/login/page.tsx`: agregar link "¿Olvidaste tu contraseña?" que abre un form (modal o página `/[gymSlug]/recuperar/solicitar`) para invocar `requestPasswordReset`
- [ ] 6.4 En `src/app/[gymSlug]/login/page.tsx`: detectar error code `PENDING_ACTIVATION` y renderizar el CTA "Tu invitación está pendiente. Pedile al admin que reenvíe el mail"
- [ ] 6.5 En el panel de admin (`src/app/[gymSlug]/admin/page.tsx` o el componente de fila de usuario): agregar botón "Reenviar invitación" condicionado a `password == null`, con confirmación
- [ ] 6.6 Remover del panel de admin el form/UI que pide password al crear alumno (o ocultar detrás del flag `EMAIL_FLOW_ENABLED`)

## 7. NextAuth integration

- [ ] 7.1 En `src/lib/auth.ts`, modificar `authorize` para que rechace usuarios con `password === null` con error code `PENDING_ACTIVATION` (sin filtrar el motivo si el email no existe — comportamiento existente)
- [ ] 7.2 Verificar que el callback de bloqueo (gym/usuario/deuda) sigue funcionando para usuarios con password seteada (regresión)

## 8. Cron de cuota

- [ ] 8.1 Crear `src/app/api/cron/email-quota/route.ts` con auth `Bearer ${CRON_SECRET}`, conteo de `EmailLog WHERE status = SENT AND sentAt >= startOfMonth()`, lógica de threshold 80%/95%, dedup mensual via `EmailLog type = QUOTA_ALERT_*`, envío del `QuotaAlertEmail`
- [ ] 8.2 Agregar entrada al `vercel.json` para schedule diario del cron
- [ ] 8.3 Verificar que el cron es idempotente (correr dos veces el mismo día no duplica alertas)

## 9. Verificación manual y rollout

- [ ] 9.1 Verificar dominio `wody.com.ar` en Resend (DNS SPF/DKIM, opcional DMARC) — acción operativa
- [ ] 9.2 Setear variables de entorno en Vercel (Production + Preview): `EMAIL_FROM="Wody <noreply@wody.com.ar>"`, `APP_URL=https://wody.com.ar`, `RESEND_API_KEY`, `EMAIL_QUOTA_ALERT_TO=juanmalosada01@gmail.com`, `EMAIL_QUOTA_MONTHLY_LIMIT=3000`, `EMAIL_FLOW_ENABLED=false` inicialmente
- [ ] 9.3 Smoke test en preview: crear alumno de prueba, recibir invitación, activar cuenta, login. Probar reset y reenvío. Probar render en Gmail, Outlook, Apple Mail
- [ ] 9.4 Smoke test del cron de cuota: invocar el endpoint con `Bearer` válido y conteo bajo threshold (no debe enviar nada); manipular temporalmente el threshold para forzar alerta y verificar dedup
- [ ] 9.5 Activar `EMAIL_FLOW_ENABLED=true` en Production
- [ ] 9.6 Verificar que la migración Prisma corrió en prod sin errores y que usuarios preexistentes pueden seguir loggeándose

## 10. Limpieza posterior (en cambio aparte)

- [ ] 10.1 Crear cambio futuro `remove-manual-password-signup` para borrar el toggle `EMAIL_FLOW_ENABLED` y el código viejo de alta con password una vez que el rollout esté estable

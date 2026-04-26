## Why

Hoy el alta de alumnos exige que un admin tipee una contraseña inicial (que después comparte por canales informales tipo WhatsApp). Eso es inseguro, friccionado y deja la responsabilidad de la primera contraseña en el admin. Además no existe ningún flujo de recuperación: si un alumno olvida su contraseña, el admin tiene que resetearla manualmente desde la base. Necesitamos un sistema de mails transaccionales que cubra alta por invitación y reset, con branding por gym y operando dentro del free tier de Resend (3000/mes) con alertas tempranas si nos acercamos al tope.

## What Changes

- **BREAKING**: La server action `createUser` deja de aceptar `password`. El alumno se crea sin contraseña y recibe un email de invitación con un link único para setearla.
- **BREAKING**: `User.password` pasa a opcional en el schema (`String?`). Usuarios existentes con password seteada no se ven afectados.
- Nueva capacidad de envío de mails transaccionales vía Resend, con templates en React Email branded por `Gym.primaryColor`, `Gym.logo`, `Gym.name`, y copy adaptado según `Gym.kind` (BOX → "WOD/RM/box", GYM → "rutina/PR/gimnasio").
- Nuevo flujo de activación: link a `/{gymSlug}/activar?token=xxx` con form para setear contraseña inicial. Token expira a los 7 días.
- Nuevo flujo de reset de password: botón en login → mail con link a `/{gymSlug}/recuperar?token=xxx`. Token expira a la hora. Anti-enumeration: el endpoint siempre devuelve éxito existe o no el email.
- Nuevo botón "Reenviar invitación" en el panel de admin para usuarios con `password == null`.
- Login bloquea a usuarios con `password == null` mostrando CTA "tu invitación está pendiente — pedí que la reenvíen".
- Monitoreo de cuota: cron diario cuenta envíos del mes en `EmailLog` y dispara alertas a `EMAIL_QUOTA_ALERT_TO` al 80% y 95% del tope. Dedup mensual para no spamear.
- Variables de entorno nuevas: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (opcional), `EMAIL_QUOTA_ALERT_TO`, `EMAIL_QUOTA_MONTHLY_LIMIT`, `APP_URL`.

## Capabilities

### New Capabilities

- `email-delivery`: Infraestructura de envío de mails transaccionales con Resend, templates en React Email con branding por tenant, y monitoreo de cuota del free tier con alertas.
- `account-activation`: Flujo de alta por invitación (sin password manual), reset de contraseña, y reenvío de invitación. Cubre creación de tokens, validación, consumo y la UX asociada en login/activar/recuperar.

### Modified Capabilities

<!-- Ninguna. user-roles cubre promoción/bloqueo, no creación de usuarios; el flujo de alta nuevo se modela como capacidad propia. -->

## Impact

- **Schema Prisma**: `User.password` pasa a opcional, nuevo `User.emailVerifiedAt`, nuevos modelos `VerificationToken` y `EmailLog`. Migración requerida.
- **Server actions afectadas**: `createUser` (cambia firma — sin password), nuevas `activateAccount`, `requestPasswordReset`, `resetPassword`, `resendInvitation`.
- **Páginas nuevas**: `/[gymSlug]/activar`, `/[gymSlug]/recuperar`, link "olvidé mi contraseña" en `/[gymSlug]/login`.
- **NextAuth `authorize`**: rechaza users con `password == null` con error específico para que el login muestre el CTA de reenvío.
- **Cron nuevo**: `src/app/api/cron/email-quota/route.ts` agendado diariamente.
- **Dependencias nuevas**: `resend`, `react-email`, `@react-email/components`, `@react-email/render`.
- **DNS del dominio**: requiere SPF + DKIM verificados en Resend (acción operativa del usuario, no código).
- **Tests**: no hay suite de tests en el repo (AGENTS.md), por lo que la verificación es manual. Los escenarios de spec sirven de checklist.
- **Documentación**: agregar `docs/emails-resend.md` con runbook (verificar dominio, rotar API key, qué hacer si se llega al tope).

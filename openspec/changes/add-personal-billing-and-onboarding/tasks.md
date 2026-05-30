## 1. Preparación manual en Mercado Pago

- [ ] 1.1 Crear el plan **Personal new** en MP: nombre "Suscripción mensual Wody Personal", $7.000 ARS/mes, frecuencia mensual, **"Prueba gratis" 30 días**, back_url `https://wody.com.ar/billing/return`. Anotar ID
- [ ] 1.2 Crear el plan **Personal returning** en MP: nombre "Suscripción mensual Wody Personal — Re-activación", $7.000 ARS/mes, mensual, **"Prueba gratis" 0 días**, mismo back_url. Anotar ID
- [ ] 1.3 En Vercel, agregar `MP_PREAPPROVAL_PLAN_ID_PERSONAL` con el ID del plan 1.1
- [ ] 1.4 En Vercel, agregar `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING` con el ID del plan 1.2. Cargar ambas en Production + Preview

## 2. Schema y migración Prisma

- [x] 2.1 Editar `prisma/schema.prisma`: agregar al modelo `User` los campos `mpPreapprovalId String?`, `mpSubscriptionStatus String?`, `mpSubscriptionStatusChangedAt DateTime?`, `trialEndsAt DateTime?`
- [x] 2.2 Editar `prisma/schema.prisma`: agregar enum nuevo `SignupRequestType { GYM, PERSONAL }`
- [x] 2.3 Editar `prisma/schema.prisma`: agregar al modelo `GymSignupRequest` el campo `type SignupRequestType @default(GYM)`
- [x] 2.4 Editar `prisma/schema.prisma`: hacer nullable los campos `gymName String?`, `gymKindSuggested String?` en `GymSignupRequest` (eran NOT NULL)
- [x] 2.5 Editar `prisma/schema.prisma`: agregar al enum `EmailLogType` los valores `PERSONAL_LEAD_RECEIVED`, `PERSONAL_LEAD_APPROVED`, `PERSONAL_LEAD_REJECTED`, `PERSONAL_PAYMENT_FAILED`
- [x] 2.6 Crear migración manual en `prisma/migrations/20260529300000_add_personal_billing/migration.sql` con:
  - `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;`
  - `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatus" TEXT;`
  - `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mpSubscriptionStatusChangedAt" TIMESTAMP(3);`
  - `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);`
  - `CREATE TYPE "SignupRequestType" AS ENUM ('GYM', 'PERSONAL');`
  - `ALTER TABLE "GymSignupRequest" ADD COLUMN IF NOT EXISTS "type" "SignupRequestType" NOT NULL DEFAULT 'GYM';`
  - `ALTER TABLE "GymSignupRequest" ALTER COLUMN "gymName" DROP NOT NULL;`
  - `ALTER TABLE "GymSignupRequest" ALTER COLUMN "gymKindSuggested" DROP NOT NULL;`
  - `ALTER TYPE "EmailLogType" ADD VALUE IF NOT EXISTS 'PERSONAL_LEAD_RECEIVED';` (x4 para los 4 valores)
  - `UPDATE "User" SET "paymentExempt" = true, "paymentExemptReason" = 'Usuario Wody Personal pre-existente al lanzamiento del modelo de cobro (2026-05)' WHERE "gymId" = (SELECT id FROM "Gym" WHERE "kind" = 'PERSONAL' LIMIT 1) AND "role" = 'STUDENT' AND "canCreateOwnRoutines" = true AND "createdAt" < CURRENT_TIMESTAMP;`
- [x] 2.7 Correr `npx prisma generate`. NO aplicar la migración

## 3. Helpers y lib de MP para Personal

- [x] 3.1 Editar `src/lib/mercadopago.ts`: agregar `getPersonalSubscriptionCheckoutUrl(userId: string): Promise<string>` análoga a la de gym pero con prefix `user_` en el `external_reference` y eligiendo entre los dos planes Personal basándose en `User.mpPreapprovalId`
- [x] 3.2 En el mismo archivo, agregar helper interno `pickPersonalPlanIdForUser(userId)` análogo al `pickPlanIdForGym` existente

## 4. Webhook: discriminación por prefix

- [x] 4.1 Editar `src/app/api/webhooks/mercadopago/route.ts`: después de extraer el `external_reference` de la respuesta de MP, agregar logic:
  ```ts
  if (externalReference.startsWith("user_")) {
    const userId = externalReference.slice("user_".length);
    // handle Personal subscription update
  } else {
    const gymId = externalReference;
    // existing gym logic
  }
  ```
- [x] 4.2 Implementar el branch Personal: leer `User`, comparar `mpSubscriptionStatus` previo, actualizar campos + `mpSubscriptionStatusChangedAt` solo en transición real, manejar caso user inexistente con warning + 200
- [x] 4.3 Disparar email `PERSONAL_PAYMENT_FAILED` cuando la transición sea desde no-paused/cancelled hacia paused/cancelled, en try/catch
- [x] 4.4 Excluir users exentos del email (igual que con gym)

## 5. Cron: fases nuevas para Personal

- [x] 5.1 Editar `src/app/api/cron/check-gym-trials/route.ts`: después de las fases de gym (1 y 1.5), agregar **Fase Personal 1** (bloqueo por trial vencido)
- [x] 5.2 Agregar **Fase Personal 1.5** (bloqueo por pago fallido + grace 7d)
- [x] 5.3 Antes de la fase de push notifications gym (existente), agregar fase de push notifications Personal en hitos {7, 3, 1, 0}
- [x] 5.4 Extender el JSON de respuesta del cron con: `personalTrialBlockedCount`, `personalTrialBlockedUserIds`, `personalPaymentFailureBlockedCount`, `personalPaymentFailureBlockedUserIds`, `personalPushSummary`
- [x] 5.5 Implementar helper `findPersonalUsersInPhase(prisma, condition)` para no duplicar el filtro `gymId = <personal>, role = STUDENT, canCreateOwnRoutines = true, deletedAt = null` en cada fase

## 6. Email templates y wrappers para Personal

- [x] 6.1 Crear `src/lib/email/templates/PersonalLeadReceivedEmail.tsx`: análogo a `LeadReceivedEmail.tsx` pero adaptado a B2C (tono más cercano, sin "tu gym", etc.)
- [x] 6.2 Crear `src/lib/email/templates/PersonalLeadApprovedEmail.tsx`: incluye link a `https://wody.com.ar/registro-personal` (NO link de onboarding token)
- [x] 6.3 Crear `src/lib/email/templates/PersonalLeadRejectedEmail.tsx`: análogo al de gym, tono ajustado
- [x] 6.4 Crear `src/lib/email/templates/PersonalPaymentFailedEmail.tsx`: link a `/personal/perfil/suscripcion`
- [x] 6.5 Editar `src/lib/signup-emails.ts`: agregar `sendPersonalLeadReceivedEmail`, `sendPersonalLeadApprovedEmail`, `sendPersonalLeadRejectedEmail`
- [x] 6.6 Editar `src/lib/billing-emails.ts`: agregar `sendPersonalPaymentFailedEmail(user)`. El user puede tener `email = null` en la práctica, validar antes

## 7. API pública: extender lead form

- [x] 7.1 Editar `src/app/api/signup-request/route.ts`: aceptar `type` en el body (`'GYM' | 'PERSONAL'`, default `'GYM'`)
- [x] 7.2 Si `type = 'GYM'`: validación shape como hoy (requiere `gymName`, `gymKindSuggested`)
- [x] 7.3 Si `type = 'PERSONAL'`: validar solo campos comunes (`contactName`, `email`, `phone?`, `message?`). Los campos gym-específicos se persisten como null
- [x] 7.4 Disparar email correspondiente según tipo (`sendLeadReceivedEmail` o `sendPersonalLeadReceivedEmail`)

## 8. Server actions super-admin (extender existentes)

- [x] 8.1 Editar `src/actions/super-admin/signup-request.ts`: en `listSignupRequests`, aceptar filtro adicional `type?: SignupRequestType`
- [x] 8.2 Editar `approveSignupRequest`: branchear por `req.type`:
  - GYM: comportamiento actual (genera token, email LEAD_APPROVED)
  - PERSONAL: NO genera token. Crea entry en `PersonalAccessWhitelist` con `email = req.email, note = "Aprobado desde lead PERSONAL #${req.id}"` (si no existe ya). Persiste `status = APPROVED`, `approvedAt`. Manda email `PERSONAL_LEAD_APPROVED`
- [x] 8.3 Editar `rejectSignupRequest`: branchear por `req.type` para mandar `sendLeadRejectedEmail` o `sendPersonalLeadRejectedEmail`
- [x] 8.4 Editar `createWhitelistEntry`: aceptar `type` en input. Para PERSONAL, validar shape distinto (sin gymName) y aplicar el mismo flujo que el approve PERSONAL (crea entry en `PersonalAccessWhitelist` + email)
- [x] 8.5 Editar `resendOnboardingEmail`: para PERSONAL re-disparar el `sendPersonalLeadApprovedEmail` (el "link" no es token sino link a registro-personal)

## 9. Server actions del Personal user

- [x] 9.1 Crear `src/actions/personal-billing.ts` con `"use server"`
- [x] 9.2 Implementar `getMyPersonalSubscriptionStatus()`: valida sesión + rol STUDENT + gym personal, retorna `{ trialEndsAt, paymentExempt, mpSubscriptionStatus, mpPreapprovalId, daysLeftInTrial }`
- [x] 9.3 Implementar `getMyPersonalCheckoutUrl()`: valida sesión, llama a `getPersonalSubscriptionCheckoutUrl(userId)`
- [x] 9.4 Implementar `cancelMySubscription()`: valida sesión, lee `mpPreapprovalId`, si es null retorna error informativo, sino llama a `cancelMpPreapproval(preapprovalId)`, persiste `mpSubscriptionStatus = 'cancelled'` y `mpSubscriptionStatusChangedAt = now()`. No setea `blockedAt`

## 10. UI super-admin: tipo en lista, form, detalle

- [x] 10.1 Editar `src/app/admin/signup-requests/page.tsx`: agregar columna "Tipo" con badge GYM/PERSONAL. Agregar filtro por tipo (tabs o segmented control). Adaptar select del query a incluir `type`
- [x] 10.2 Editar `src/app/admin/signup-requests/[id]/page.tsx`: mostrar el tipo prominentemente. Si type=GYM, mostrar campos gym-específicos. Si type=PERSONAL, ocultar esos campos
- [x] 10.3 Editar `src/components/admin/SignupRequestActions.tsx`: los botones siguen iguales pero textos adaptados según tipo (ej: para PERSONAL "Aprobar" hace explícito que se agrega a whitelist en vez de mandar al wizard)
- [x] 10.4 Editar `src/components/admin/WhitelistForm.tsx`: agregar selector de tipo al inicio (radio o segmented control GYM/PERSONAL), y mostrar/ocultar campos según tipo

## 11. UI pública: PersonalPricingSection en landing

- [x] 11.1 Crear `src/components/landing/PersonalPricingSection.tsx`: card con "Plan Personal", "$7.000 ARS / mes", "30 días gratis · sin tarjeta · sin compromiso", bullets de features ("Tus rutinas, tus PRs, todo en tu celular", "Cronómetros y timers para tus entrenamientos", "Compartí tus logros en Instagram", "Sin profe asignado: vos sos tu coach"), botón "Contactanos" que abre el ContactForm con `type=PERSONAL`
- [x] 11.2 Crear `src/components/landing/PersonalContactForm.tsx` (o modificar `ContactForm` existente con prop `type`): pide `contactName`, `email`, `phone?`, `message?`. Submit con `type='PERSONAL'`
- [x] 11.3 Editar `src/app/page.tsx`: insertar `PersonalPricingSection` después de `PricingSection` (la de gym)
- [x] 11.4 Asegurarse de que las dos cards se ven bien lado a lado en desktop y stackeadas en mobile

## 12. UI del Personal user: billing page

- [x] 12.1 Crear `src/app/[gymSlug]/perfil/suscripcion/page.tsx` (Server Component, accesible en `/personal/perfil/suscripcion`): valida sesión + STUDENT + canCreateOwnRoutines + gym personal. Invoca `getMyPersonalSubscriptionStatus` y opcionalmente `getMyPersonalCheckoutUrl`
- [x] 12.2 Crear `src/components/personal/PersonalBillingPage.tsx` (Client Component) con los 3 casos:
  - Exento: panel verde
  - En trial / no sub: card con días restantes + botón "Configurar tarjeta"
  - Sub activa: panel + botón "Reconfigurar" + botón "Cancelar suscripción" (con modal de confirmación)
- [x] 12.3 Agregar entry al nav del Personal user para llegar a `/personal/perfil/suscripcion` (mirar el Navbar o donde sea, probable `src/components/layout/Navbar.tsx`)

## 13. Banner de fin de trial Personal

- [x] 13.1 Crear `src/components/billing/PersonalTrialEndingBanner.tsx`: análogo a `TrialEndingBanner.tsx` pero apuntando a `/personal/perfil/suscripcion`
- [x] 13.2 Editar `src/app/[gymSlug]/layout.tsx`: extender la lógica de selección de banner. Si el gym es personal AND el user es STUDENT con canCreateOwnRoutines: mostrar `PersonalTrialEndingBanner` con su lógica de daysLeft
- [x] 13.3 Extraer no fue necesario — la lógica se mantiene legible con el bloque adicional inline y la guarda `trialBanner === null`

## 14. Documentación

- [x] 14.1 Crear `docs/billing-personal.md`: guía operativa del modelo Personal (precio, trial, dos planes, exención, webhook discriminator, cron, emails, self-cancel)
- [x] 14.2 Crear `docs/onboarding-personal.md`: documentar el funnel PERSONAL (form en landing, lead, aprobación, promoción a whitelist, link a registro-personal). Linkear a `docs/onboarding-gyms.md` para el flujo GYM
- [x] 14.3 Actualizar `docs/billing-mercadopago.md` con nota corta apuntando a `docs/billing-personal.md` para todo lo de cobro Personal

## 15. Deploy y verificación

- [ ] 15.1 Crear PR a `main`
- [ ] 15.2 Verificar build de Vercel exitoso (env vars Personal cargadas en Preview también)
- [ ] 15.3 Confirmar que los dos planes están creados en MP (tareas 1.1 y 1.2) **antes** de aplicar la migración a prod
- [ ] 15.4 Aplicar `npx prisma migrate deploy` contra prod
- [ ] 15.5 Verificar en `/admin/wody-personal` que los Personal users existentes aparecen con badge "Exento" y la razón correcta
- [ ] 15.6 Smoke test del form Personal en landing: enviar un lead con email de prueba, verificar email `PERSONAL_LEAD_RECEIVED`
- [ ] 15.7 Smoke test super-admin: aprobar el lead PERSONAL, verificar email `PERSONAL_LEAD_APPROVED` + que el email aparezca en `PersonalAccessWhitelist`
- [ ] 15.8 Smoke test registro-personal: el user usa el email aprobado, completa registro, queda creado con `trialEndsAt = +30d`
- [ ] 15.9 Smoke test self-cancel (cuando haya un user pagador real): el user cancela desde `/personal/perfil/suscripcion`, verifica `mpSubscriptionStatus = 'cancelled'` + email payment-failed
- [ ] 15.10 Smoke test push notifications (cuando haya un user en trial real): manipular `trialEndsAt` en DB a 7d en el futuro, correr cron manualmente, verificar push

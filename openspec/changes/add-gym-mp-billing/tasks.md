## 1. Preparación manual en Mercado Pago

- [x] 1.1 Crear el `preapproval_plan` único en el dashboard de MP. Plan creado: `02dca3f44cc44c5e8089cd00c25a7f08`, monto $60.000 ARS/mes, frecuencia mensual, descripción "Suscripción mensual Wody"
- [x] 1.1.1 **Editar el plan en MP**: cambiar "Prueba gratis" de 7 a **30 días** para alinear con el trial de Wody (ver `design.md` §0)
- [ ] 1.1.2 **Editar el plan en MP**: actualizar la URL "Pago aprobado" a `https://<dominio-prod>/billing/return` (o equivalente) una vez que el dominio esté definido — pendiente, hacer después del primer deploy
- [x] 1.2.a Generar `MP_ACCESS_TOKEN` (Production) desde el panel de credenciales de MP
- [ ] 1.2.b Generar `MP_WEBHOOK_SECRET` desde el panel de Webhooks de MP — pendiente, hacer después del primer deploy (cuando exista la URL del endpoint)
- [x] 1.3.a Cargar `MP_ACCESS_TOKEN` y `MP_PREAPPROVAL_PLAN_ID` en Vercel (Production + Preview)
- [ ] 1.3.b Cargar `MP_WEBHOOK_SECRET` en Vercel — pendiente junto con 1.2.b
- [x] 1.4 Agregar las tres env vars a `.env.example` con valores placeholder y comentario explicativo

## 2. Schema y migración Prisma

- [x] 2.1 Editar `prisma/schema.prisma`: agregar `trialEndsAt DateTime?`, `paymentExempt Boolean @default(false)`, `paymentExemptReason String?`, `mpPreapprovalId String?`, `mpSubscriptionStatus String?` al modelo `Gym`
- [x] 2.2 Editar `prisma/schema.prisma`: cambiar default de `Gym.subscriptionMonthlyAmount` a `60000`
- [x] 2.3 Crear la migración SQL manualmente en `prisma/migrations/<timestamp>_add_gym_billing/migration.sql` siguiendo el patrón de migraciones existentes (no usar `migrate dev` — la shadow DB no está configurada; ver memoria de proyecto)
- [x] 2.4 Dentro de la misma migración SQL: agregar al final un `UPDATE "Gym" SET "paymentExempt" = true, "paymentExemptReason" = 'Gym pre-existente al lanzamiento del modelo de cobro (2026-05)' WHERE "createdAt" < CURRENT_TIMESTAMP` para marcar exentos a todos los gyms pre-existentes en la misma transacción
- [x] 2.5 Revisar el SQL: confirmar que las columnas nuevas son nullable (o tienen default) para no romper rows existentes
- [x] 2.6 Correr `npx prisma generate` y compilar TypeScript del proyecto. Resolver errores donde se asuma que los nuevos campos no existen

## 3. SDK y helpers de Mercado Pago

- [x] 3.1 Instalar `mercadopago` en el `package.json` raíz (`npm i mercadopago`). NO instalar en `remotion/`
- [x] 3.2 Crear `src/lib/mercadopago.ts`: cliente MP configurado con `MP_ACCESS_TOKEN`, exportar instancia singleton
- [x] 3.3 Agregar helper `verifyMpWebhookSignature(xSignature: string, xRequestId: string | null, dataId: string | null): boolean` que use `WebhookSignatureValidator` del SDK v3 de MP contra `MP_WEBHOOK_SECRET`. **Nota**: la firma real requiere los tres valores (header `x-signature`, header `x-request-id`, query param `data.id`), no el raw body. El webhook handler debe extraerlos de la request
- [x] 3.4 Agregar helper `getSubscriptionCheckoutUrl(gymId: string): string` que arme la URL del checkout de MP usando `MP_PREAPPROVAL_PLAN_ID` y `external_reference = gymId`
- [x] 3.5 Agregar helper `cancelMpPreapproval(preapprovalId: string): Promise<void>` que llame a la API de MP para cancelar una suscripción
- [x] 3.6 Definir el type union `type MpSubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled' | 'unknown'` y un parser tolerante que mapea strings desconocidos a `'unknown'` con un log de warning

## 4. Server actions: lado super-admin

- [x] 4.1 Editar `src/actions/super-admin/gym.ts`: en `createGym`, setear `trialEndsAt = new Date(Date.now() + 30*24*60*60*1000)` al crear el gym
- [x] 4.2 Agregar `setGymPaymentExempt(gymId, exempt, reason)` en `src/actions/super-admin/gym.ts`: validar `role === 'SUPERADMIN'`, validar que `reason` esté presente si `exempt = true`, persistir cambio
- [x] 4.3 Agregar `cancelGymSubscription(gymId)` en `src/actions/super-admin/gym.ts`: validar `role === 'SUPERADMIN'`, leer `mpPreapprovalId`, llamar a `cancelMpPreapproval`, persistir `mpSubscriptionStatus = 'cancelled'`
- [x] 4.4 Editar `updateGym` para que NO acepte cambios a `paymentExempt`, `paymentExemptReason`, `mpPreapprovalId`, `mpSubscriptionStatus`, `trialEndsAt` desde el form genérico de edición (esos campos van por server actions dedicadas)

## 5. Server actions: lado dueño del gym

- [x] 5.1 Crear `src/actions/billing.ts` con `"use server"`
- [x] 5.2 Implementar `getMySubscriptionStatus()`: lee la sesión, valida `role === 'ADMIN'`, retorna `{ trialEndsAt, paymentExempt, mpSubscriptionStatus, mpPreapprovalId, daysLeftInTrial }` del gym del usuario
- [x] 5.3 Implementar `getMyCheckoutUrl()`: valida `role === 'ADMIN'`, valida que el gym NO esté exento, retorna `getSubscriptionCheckoutUrl(gym.id)`
- [x] 5.4 NO implementar cancelación lado dueño — la única vía es contactar al super-admin

## 6. Webhook de Mercado Pago

- [x] 6.1 Crear `src/app/api/webhooks/mercadopago/route.ts` con handler `POST`
- [x] 6.2 Extraer de la request: header `x-signature`, header `x-request-id`, y query param `data.id` (de la URL). El body se puede leer con `req.json()` directamente — la firma del SDK v3 no se valida sobre el body
- [x] 6.3 Validar la firma con `verifyMpWebhookSignature(xSignature, xRequestId, dataId)`. Si falla o si falta el `x-signature`, responder `401`
- [x] 6.4 Parsear el evento: extraer `type` (`subscription_preapproval`, `subscription_authorized_payment`, etc.), `data.id`, y resolver el `external_reference` (gymId) consultando la API de MP con el `preapproval_id`
- [x] 6.5 Actualizar `Gym.mpPreapprovalId` y `Gym.mpSubscriptionStatus` según el evento. Loggear solo `gymId`, `preapprovalId`, `status` — NO loggear el payload completo
- [x] 6.6 Si `type` o `status` son desconocidos, loggear warning con el payload mínimo y responder `200` (idempotencia)
- [x] 6.7 Responder `200 OK` en éxito; cualquier error interno responde `500` para que MP reintente

## 7. Cron diario de fin de trial

- [x] 7.1 Crear `src/app/api/cron/check-gym-trials/route.ts` con handler `GET` (Vercel Cron usa GET por convención)
- [x] 7.2 Validar el header `Authorization: Bearer <CRON_SECRET>` siguiendo el patrón de los otros crons del proyecto
- [x] 7.3 Query Prisma: `prisma.gym.findMany({ where: { trialEndsAt: { lt: new Date() }, mpPreapprovalId: null, paymentExempt: false, blockedAt: null, kind: { not: 'PERSONAL' } } })`
- [x] 7.4 Para cada gym del resultado, actualizar `blockedAt = new Date()`. Loggear `gymId` y `slug` de cada uno
- [x] 7.5 Registrar el cron en `vercel.json` (o equivalente) con schedule diario (sugerido `0 6 * * *` UTC = 03:00 ART)
- [x] 7.6 Responder `{ blockedCount: number, gymIds: string[] }` en JSON

## 8. UI super-admin: sección "Suscripción y exención"

- [ ] 8.1 Editar `src/app/admin/gyms/[id]/page.tsx`: agregar una nueva sección "Suscripción y exención" debajo de la sección de información general
- [ ] 8.2 Renderizar (lectura): `trialEndsAt` formateado en ART, `mpSubscriptionStatus`, `mpPreapprovalId` (con link a MP si aplica)
- [ ] 8.3 Renderizar toggle de `paymentExempt` con campo de texto para `paymentExemptReason` (requerido cuando se marca como exento). Botón "Guardar exención" que invoca `setGymPaymentExempt`
- [ ] 8.4 Renderizar botón "Cancelar suscripción" solo si `mpPreapprovalId != null`. El botón pide confirmación (modal o `confirm()`) antes de invocar `cancelGymSubscription`
- [ ] 8.5 Editar `src/app/admin/page.tsx` (dashboard): agregar columnas "Estado MP" y "Exento" a la tabla de gyms

## 9. UI dueño del gym: página `/billing`

- [ ] 9.1 Crear `src/app/[gymSlug]/admin/billing/page.tsx` (Server Component): leer sesión, validar `role === 'ADMIN'`, invocar `getMySubscriptionStatus`
- [ ] 9.2 Renderizar tres casos según el estado:
  - Gym exento: panel informativo "Tu gym está exento del cobro. Para cualquier consulta, contactanos."
  - En trial sin suscripción: mostrar días restantes + botón "Configurar tarjeta" que va al link de `getMyCheckoutUrl`
  - Con suscripción activa: mostrar estado + botón "Reconfigurar tarjeta" (mismo link de checkout, MP detecta la suscripción existente)
- [ ] 9.3 Agregar entry en el nav lateral del gym (si existe nav admin) o link en `/[gymSlug]/admin` para acceder a `/billing`

## 10. Banner de fin de trial

- [ ] 10.1 Crear `src/components/billing/TrialEndingBanner.tsx`: componente cliente que recibe `daysLeft: number` y `gymSlug: string`, renderiza banner sticky con CTA a `/[gymSlug]/admin/billing`
- [ ] 10.2 Calcular `daysLeftInTrial` en el layout del gym (`src/app/[gymSlug]/layout.tsx` o el layout admin si solo va para ADMIN) y pasar al banner cuando corresponda mostrarlo (cond: `role === 'ADMIN'`, `paymentExempt = false`, `mpSubscriptionStatus != 'authorized'`, `daysLeft <= 7 && daysLeft > 0`)
- [ ] 10.3 Si `daysLeft <= 0` y el gym no está bloqueado todavía (ventana entre fin de trial y cron), mostrar banner rojo "Tu trial terminó. Configurá tu tarjeta para evitar la suspensión"
- [ ] 10.4 Verificar que el banner NO aparece para TEACHER, STUDENT, ACCESS

## 11. Push notifications de fin de trial

- [x] 11.1 Agregar helper `sendTrialEndingPush(gymId: string, daysLeft: 7 | 3 | 1 | 0): Promise<{ totalSent: number; totalRemoved: number }>` en `src/lib/push.ts`. Internamente: `prisma.user.findMany({ where: { gymId, role: 'ADMIN', deletedAt: null } })`, e invocar `sendPushToUser` por cada admin con título y cuerpo según `daysLeft`
- [x] 11.2 Definir los mensajes (ARS, tono Wody):
  - `daysLeft = 7`: título "Tu trial termina en 7 días" / cuerpo "Configurá tu tarjeta para que tu gym no se suspenda."
  - `daysLeft = 3`: título "Tu trial termina en 3 días" / cuerpo "Faltan pocos días para configurar tu tarjeta."
  - `daysLeft = 1`: título "Tu trial termina mañana" / cuerpo "Última oportunidad para configurar tu tarjeta."
  - `daysLeft = 0`: título "Tu trial venció hoy" / cuerpo "Configurá tu tarjeta ahora para evitar la suspensión."
- [x] 11.3 Modificar el cron `src/app/api/cron/check-gym-trials/route.ts` (creado en la sección 7) para que, en la misma ejecución y después de la query de bloqueo, ejecute una segunda query: `prisma.gym.findMany({ where: { paymentExempt: false, mpSubscriptionStatus: { not: 'authorized' }, kind: { not: 'PERSONAL' }, blockedAt: null, trialEndsAt: { not: null } } })` y para cada uno calcular `daysLeft = Math.round((gym.trialEndsAt - now) / DAY_MS)`. Si `daysLeft ∈ {7, 3, 1, 0}`, invocar `sendTrialEndingPush(gym.id, daysLeft)`
- [x] 11.4 Loggear por cada push enviado: `gymId`, `slug`, `daysLeft`, `totalSent`, `totalRemoved`. Loggear con nivel `warn` cualquier error de despacho que no sea `404/410`
- [x] 11.5 Extender el JSON de respuesta del cron a `{ blockedCount, gymIds, pushSummary: { gymId, daysLeft, sent, removed }[] }` para facilitar debugging
- [ ] 11.6 Smoke test manual: con un gym de prueba, ajustar `trialEndsAt` a 7 días en el futuro, suscribir un dispositivo de prueba como ADMIN del gym, correr `curl <url>/api/cron/check-gym-trials -H "Authorization: Bearer <CRON_SECRET>"` y confirmar que llega la notificación

## 12. Documentación

- [ ] 12.1 Reescribir `docs/billing-mercadopago.md` con el modelo simplificado real: plan único, trial 30 días, exención, sin tarifa de alta, sin self-signup
- [ ] 12.2 Documentar en el doc el procedimiento manual para crear el `preapproval_plan` en el dashboard de MP (paso previo al deploy)
- [ ] 12.3 Documentar en el doc el flujo del super-admin para eximir un gym y para cancelar una suscripción
- [ ] 12.4 Documentar en el doc cómo se sincroniza el estado vía webhook y el rol del cron diario, incluyendo las push notifications de fin de trial

## 13. Deploy y verificación

- [ ] 13.1 Crear PR a `main` con todos los cambios
- [ ] 13.2 Verificar build de Vercel exitoso (incluyendo que las env vars nuevas estén configuradas en Preview)
- [ ] 13.3 Confirmar que el `preapproval_plan` está creado en el dashboard de MP (paso 1.1) antes de aplicar la migración a prod
- [ ] 13.4 Correr `npx prisma migrate deploy` contra prod desde una shell con `DATABASE_URL` de prod
- [ ] 13.5 Verificar en `/admin` que los 4 gyms existentes aparecen con badge "Exento" y `paymentExemptReason` correcta
- [ ] 13.6 Configurar la URL del webhook en el panel de MP apuntando a `https://<dominio>/api/webhooks/mercadopago`
- [ ] 13.7 Smoke test en prod: crear un gym de prueba, verificar `trialEndsAt = createdAt + 30d`. Borrar el gym de prueba
- [ ] 13.8 Smoke test con MP sandbox (si está disponible): simular cobro de suscripción y verificar que el webhook actualiza `mpSubscriptionStatus = 'authorized'`
- [ ] 13.9 Verificar que el cron `check-gym-trials` aparece en el dashboard de Vercel Cron Jobs
- [ ] 13.10 Monitorear logs de Vercel durante la primera semana: ningún error en el webhook, el cron corre diariamente, las push notifications llegan en los hitos esperados

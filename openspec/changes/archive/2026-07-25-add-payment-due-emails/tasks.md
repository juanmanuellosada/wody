## 1. Modelo de datos

- [x] 1.1 Agregar los valores `PAYMENT_DUE_STUDENT`, `PAYMENT_DUE_GYM` y `PAYMENT_DUE_PERSONAL` al enum `EmailLogType` en `prisma/schema.prisma`
- [x] 1.2 Agregar `lastDueEmailedOn DateTime? @db.Date` al modelo `User` en `prisma/schema.prisma`
- [x] 1.3 Agregar `lastBillingEmailedOn DateTime? @db.Date` al modelo `Gym` en `prisma/schema.prisma`
- [x] 1.4 Generar la migración y aplicarla con `prisma migrate deploy` (NO usar `migrate dev`: la shadow DB de Neon no está configurada en este proyecto)
- [x] 1.5 Correr `prisma generate` y verificar que los tipos nuevos estén disponibles

## 2. Templates de email

- [x] 2.1 Crear `src/lib/email/templates/PaymentDueStudentEmail.tsx` usando `EmailLayout` con branding del gym, tomando `InviteEmail.tsx` como referencia estructural. Props: `gym` (name, primaryColor, logo, kind), `recipientName`, `dueDate`, `daysRemaining`. Usar `gymTerms(gym.kind).kindWord` para decir "box" o "gym", con variantes de copy para 2 días y para hoy. Sin CTA de pago
- [x] 2.2 Crear `src/lib/email/templates/PaymentDueGymEmail.tsx` con el chrome standalone de Wody, tomando `PaymentFailedEmail.tsx` como referencia. Props: `contactName`, `gymName`, `dueDate`, `daysRemaining`, `monthlyAmount` (en centavos, dividir por 100 al renderizar), `gymBillingUrl`. Incluir el fix de host `www.` para los assets
- [x] 2.3 Crear `src/lib/email/templates/PaymentDuePersonalEmail.tsx` con el chrome standalone de Wody, tomando `PersonalPaymentFailedEmail.tsx` como referencia. Props: `contactName`, `dueDate`, `daysRemaining`, `personalBillingUrl`. El copy NO debe mencionar pasar por un gimnasio
- [x] 2.4 Verificar que los tres templates usen `Intl.DateTimeFormat("es-AR", ...)` para las fechas, `<Html lang="es">` y español rioplatense, consistente con los templates existentes

## 3. Funciones de envío

- [x] 3.1 Agregar `sendPaymentDueStudentEmail(user, gym, daysRemaining)` en `src/lib/billing-emails.ts` (o un módulo hermano si queda más claro). Debe usar `sendEmail({ to, gymId, type: "PAYMENT_DUE_STUDENT", subject, react: React.createElement(...) })` y devolver el resultado sin lanzar
- [x] 3.2 Agregar `sendPaymentDueGymEmail(gym, daysLeft)` siguiendo el patrón de `sendPaymentFailedEmail`: query de `ADMIN` del gym con `deletedAt: null` y `email: { not: null }`, loop de envíos, acumulando `{ sent, failed }`
- [x] 3.3 Agregar `sendPaymentDuePersonalEmail(user, daysLeft)` con `type: "PAYMENT_DUE_PERSONAL"` y CTA a `${APP_URL}/personal/perfil/suscripcion`
- [x] 3.4 Definir los subjects de los tres mails, en línea con los existentes (`"No pudimos cobrar tu suscripción de Wody"`). Sólo hay dos variantes por mail, "vence en 2 días" y "vence hoy": alumno `Tu cuota vence en 2 días` / `Tu cuota vence hoy`; gym `Tu cuota de Wody vence en 2 días` / `Tu cuota de Wody vence hoy`; Personal `Tu cuota de Wody Personal vence en 2 días` / `Tu cuota de Wody Personal vence hoy`

## 4. Integración en el cron de alumnos

- [x] 4.1 En `src/app/api/cron/notify-due-today/route.ts`, armar la query de candidatos del canal email: `nextPaymentDate` exactamente igual a `hoy` o a `hoy + 2 días` (los hitos del email son `{2, 0}`, NO la ventana `[hoy, hoy+2]` que usa la push — el día 1 queda afuera), más `email: { not: null }`, `gym: { kind: { not: "PERSONAL" } }`, los filtros de estado (`role STUDENT`, `deletedAt`, `blockedAt`, `paymentExempt`, `gym.blockedAt`) y el dedup `OR: [{ lastDueEmailedOn: null }, { lastDueEmailedOn: { lt: today } }]`. Seleccionar los campos que necesita el template
- [x] 4.2 Enviar el email a cada candidato y, sólo si el envío fue `ok`, actualizar `lastDueEmailedOn = today`
- [x] 4.3 Verificar que la lógica de push existente (`sendDueReminderIfNeeded` y `lastDueNotifiedOn`) quede intacta y desacoplada del canal email
- [x] 4.4 Agregar `emailsSent` y `emailsFailed` al JSON de respuesta del cron

## 5. Integración en el cron de billing

- [x] 5.1 En la fase 2.6 de `src/app/api/cron/check-gym-trials/route.ts`, agregar el envío de email. ATENCIÓN: los hitos del email son `{2, 0}` y los de la push son `{10, 7, 3, 1, 0}` — el `2` NO está en `SELF_BILLING_MILESTONES`, así que el envío de email NO puede ir dentro del `if (!SELF_BILLING_MILESTONES.has(daysLeft)) continue`. Evaluar los dos canales por separado sobre el mismo recorrido de gyms, sin alterar los hitos ni el comportamiento de la push. Aplicar el dedup sobre `lastBillingEmailedOn` y actualizarlo sólo si hubo al menos un envío `ok`
- [x] 5.2 Agregar una fase nueva para el recordatorio de cuota de usuarios Personal, con los filtros de D4: `gym.kind = PERSONAL`, `role = STUDENT`, `canCreateOwnRoutines = true`, `deletedAt: null`, `blockedAt: null`, `paymentExempt: false`, `email: { not: null }`, `nextPaymentDate` distinta del centinela `9999-12-31`, `mpSubscriptionStatus` distinto de `"authorized"`, y dedup por `lastDueEmailedOn`. Hitos `{2, 0}`
- [x] 5.3 Agregar los contadores de email de ambas fases al JSON de respuesta del cron
- [x] 5.4 Verificar que un fallo de envío no interrumpa el loop ni las fases posteriores del cron

## 6. Monitoreo de cuota

- [x] 6.1 Agregar `PAYMENT_DUE_STUDENT`, `PAYMENT_DUE_GYM` y `PAYMENT_DUE_PERSONAL` al filtro de tipos del contador en `src/app/api/cron/email-quota/route.tsx`
- [x] 6.2 Actualizar `EMAIL_QUOTA_MONTHLY_LIMIT` a `50000` (plan Resend Transactional Pro) en `.env.example` y avisar que hay que setearla también en el entorno de producción de Vercel: el default de 3000 corresponde al free tier y dispararía alertas en falso

## 7. Verificación

> **ATENCIÓN — el `DATABASE_URL` de `.env` apunta al Neon de PRODUCCIÓN.** La base tiene datos reales (8 gyms, 237 usuarios) y `RESEND_API_KEY` es la real. Correr cualquiera de los crons desde este entorno enviaría mails a personas reales y escribiría en producción. Las tareas 7.2 a 7.6 quedan **prohibidas para cualquier agente** y son responsabilidad del usuario, en una base local o en un branch de Neon de desarrollo.

- [x] 7.1 Correr `npm run lint` y `npm run build` sin errores — seguro, no toca la base
- [ ] 7.2 **(usuario, entorno de desarrollo)** Verificar manualmente los tres crons con `Bearer $CRON_SECRET`, comprobando los contadores de la respuesta y las filas creadas en `EmailLog`
- [ ] 7.3 **(usuario, entorno de desarrollo)** Verificar el dedup: correr el mismo cron dos veces seguidas y confirmar que la segunda corrida no envía nada
- [ ] 7.4 **(usuario, entorno de desarrollo)** Verificar que un usuario Personal con `nextPaymentDate` real reciba únicamente el mail de Wody Personal y NO el de alumno
- [ ] 7.5 **(usuario)** Revisar el render de los tres mails (HTML y texto plano) antes del release
- [ ] 7.6 **(usuario, entorno de desarrollo)** Verificar que los hitos del email son sólo `{2, 0}`: un alumno a 1 día del vencimiento y un gym a 7 días NO deben recibir mail, pero sí deben seguir recibiendo su push

## 8. Documentación

- [x] 8.1 Documentar los tres mails nuevos en `docs/emails-resend.md`: tipo de `EmailLogType`, disparador, destinatario, cadencia y dedup
- [x] 8.2 Agregar en `docs/notificaciones-push.md` la aclaración de que el recordatorio de vencimiento ahora es multicanal, y que el canal email sale sólo del cron
- [x] 8.3 Dejar anotada la deuda registrada en el design: la push de alumno sigue sin excluir usuarios Personal, la fase 2.6 sigue sin excluir gyms con `mpSubscriptionStatus = "authorized"`, y el chrome standalone de los templates sigue duplicado

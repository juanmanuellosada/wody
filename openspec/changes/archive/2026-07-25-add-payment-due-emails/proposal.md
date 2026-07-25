## Why

Hoy el único canal de recordatorio de vencimiento de cuota es la push notification, y ese canal falla en la práctica: los `ADMIN` no tienen forma de habilitar push (`NotificationPermissionButton` se renderiza solo si `role === "STUDENT"`), los usuarios de Wody Personal no tienen ningún recordatorio de cuota (solo de fin de trial), y el alumno que no aceptó el permiso del browser nunca se entera de que su cuota vence. El resultado es cobranza perdida y bloqueos automáticos que sorprenden al cliente.

El mail es el canal que ya está montado y funcionando (Resend + React Email + `EmailLog`), llega sin depender de un permiso del dispositivo, y para el caso de los gyms y los Personal es el único canal realista hoy.

## What Changes

- **Mail de vencimiento de cuota al alumno**: cuando la cuota de un alumno (`User.nextPaymentDate`) está por vencer, además de la push se le envía un mail con branding de su gym.
- **Mail de vencimiento de cuota del gym a Wody**: cuando `Gym.subscriptionNextPaymentDate` está por vencer, se envía un mail a todos los `ADMIN` del gym con email, en paralelo a la push existente.
- **Mail de vencimiento de cuota al usuario Personal**: capacidad nueva de punta a punta — hoy no existe ningún recordatorio de vencimiento de cuota para Personal, ni push ni mail. Se introduce el mail como canal.
- **Dedup persistido por canal**: se agrega el estado necesario para garantizar que ninguno de los tres mails se envíe más de una vez por hito. Es crítico para el caso del gym, donde el recordatorio hoy se dispara en **cada `signIn` de un ADMIN** sin ningún dedup — replicar eso por mail sería spam.
- **Contabilización de cuota de Resend**: los tipos nuevos se suman al contador del cron `email-quota`, que hoy solo cuenta `INVITE` y `RESET`. El recordatorio al alumno es el evento recurrente más frecuente del sistema y es el que puede acercar la instalación al `EMAIL_QUOTA_MONTHLY_LIMIT`.
- **Corrección de segmentación**: los usuarios Personal con `nextPaymentDate` real (los que cobra a mano el super-admin) hoy son levantados por el cron `notify-due-today` y reciben el copy de alumno *"Pasá por tu gym para renovar"*. El mail no debe repetir ese error; se segmenta explícitamente Personal vs alumno.

**No incluido** (descartado explícitamente por el usuario): mails de comprobante o de "pago registrado", tanto para el alumno como para el gym. Este cambio cubre únicamente recordatorios de que hay que pagar.

## Capabilities

### New Capabilities

- `payment-due-emails`: Recordatorios por email de vencimiento de cuota en los tres frentes del negocio (alumno → gym, gym → Wody, Personal → Wody). Cubre segmentación de destinatarios, cadencia por hitos, dedup por canal, resiliencia ante fallos de Resend, y el impacto sobre el monitoreo de cuota mensual de envío.

### Modified Capabilities

- `gym-billing`: el requirement *"Recordatorios push de vencimiento a los ADMIN"* deja de ser mono-canal — el recordatorio de vencimiento pasa a emitirse por push **y** por email. El canal email se emite únicamente desde el cron diario, en los mismos hitos, y nunca desde el login del ADMIN.
- `personal-billing`: se agrega el recordatorio de vencimiento de cuota del usuario Personal, que hoy no existe en ninguna forma (la capability solo cubre recordatorios de fin de trial y aviso de cobro fallido).

## Impact

**Código afectado**

- `prisma/schema.prisma` — nuevos valores en el enum `EmailLogType` y campos de dedup. Migración con `prisma migrate deploy` (la shadow DB de Neon no está configurada en este proyecto; `migrate dev` falla).
- `src/lib/email/templates/` — tres templates nuevos. El del alumno usa `EmailLayout` (branding del gym, `vocab(gym.kind)`); los de gym y Personal usan el chrome standalone de Wody, siguiendo `PaymentFailedEmail.tsx` y `PersonalPaymentFailedEmail.tsx`.
- `src/lib/billing-emails.ts` — nuevas funciones de envío, siguiendo el patrón de `sendPaymentFailedEmail` (query de admins con `email: { not: null }` + loop).
- `src/app/api/cron/notify-due-today/route.ts` — fase de alumnos: sumar el envío de mail junto a la push.
- `src/app/api/cron/check-gym-trials/route.ts` — fase 2.6: sumar el envío de mail; nueva fase para Personal.
- `src/lib/auth.ts` — `notifyBillingDueIfNeeded` en `events.signIn`: agregar dedup antes de sumar el canal email.
- `src/app/api/cron/email-quota/route.tsx` — sumar los tipos nuevos al filtro del contador.

**Sin impacto**

- No se toca el webhook de Mercado Pago ni la lógica de bloqueo automático.
- No se toca el canal push existente salvo por el dedup compartido.

**Riesgo principal**: volumen de mails. Es el primer tipo de mail recurrente y de alta frecuencia del sistema. El plan de Resend contratado (Transactional Pro, 50.000 mails/mes) da margen holgado para la cadencia elegida, pero `EMAIL_QUOTA_MONTHLY_LIMIT` sigue en el default de 3000 y hay que ajustarlo en el release para que las alertas de cuota no disparen en falso.

**Fuera de alcance / drift conocido**: `gym-billing` y `personal-billing` documentan trial de 15 días y dos planes de Mercado Pago, pero el código usa trial de 7 días y preapprovals sin plan. No se corrige acá.

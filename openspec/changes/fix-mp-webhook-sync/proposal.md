## Why

Un gym que paga su suscripción correctamente puede quedar marcado como moroso en Wody. Detectado en producción el 2026-08-19 con FIT CLUB (`fitclub`): la suscripción estaba `authorized` en Mercado Pago y el cobro del 15/08 aprobado, pero la DB seguía en `pending`, y el ADMIN veía el cartel rojo *"Tu trial terminó. Tu gym puede ser suspendido"*. Se corrigió a mano; la causa raíz sigue abierta y afecta a todo gym que se suscriba.

El daño no es solo cosmético. Como nada actualiza el estado desde MP, el sistema tampoco se entera cuando **deja** de cobrar: un gym con la tarjeta rechazada sigue figurando `authorized`, no dispara `sendPaymentFailedEmail` y no aparece en ningún reporte. La plataforma no puede distinguir quién está pagando.

## What Changes

- **`notification_url` explícita en la creación del preapproval.** Hoy `preApproval.create` no la manda, así que MP solo notifica si la URL está cargada a mano en el panel de la aplicación. Se pasa a declarar en el request, para gym y para Personal.
- **Validación de firma tolerante al formato de la notificación.** El handler toma `data.id` solo del query param; cuando MP no lo envía ahí, el manifest HMAC no coincide y el webhook responde `401`. Se agrega fallback al body.
- **El webhook persiste la fecha del próximo cobro.** `subscriptionNextPaymentDate` hoy solo se escribe desde el form del super-admin: a cada gym con suscripción activa se le vence la fecha cada mes y le aparece `GymBillingOverdueModal` hasta que alguien la mueve a mano. Pasa a tomar el `next_payment_date` que devuelve MP.
- **Manejo correcto de `subscription_authorized_payment`.** El handler resuelve ambos tipos de evento con `preApproval.get({ id: data.id })`, pero en este evento `data.id` identifica al *authorized payment*, no al preapproval: la llamada falla y el evento se descarta. Se resuelve primero el invoice y de ahí se obtiene el `preapproval_id`. Este es el evento de los cobros mensuales y de los reintentos.
- **Ciclo de reintentos de cobro.** Un primer intento fallido deja el invoice en `recycling` con `retry_attempt` incrementando; MP reintenta y, si sale, el preapproval vuelve a `authorized`. El sistema SHALL atravesar ese ciclo sin dejar carteles indebidos ni marcar como moroso a un gym que terminó pagando.
- **Acción "Sincronizar con MP"** en el panel de super-admin del gym: consulta el preapproval real y persiste estado y fecha. Red de seguridad para cuando el webhook falle igual, y herramienta de reparación sin SQL manual.
- **Campo propio de fecha de próximo cobro para Personal.** `User` no tiene equivalente a `Gym.subscriptionNextPaymentDate`; el `User.nextPaymentDate` que existe es la cuota del alumno a su gym y no puede reutilizarse. Se agrega `User.subscriptionNextPaymentDate` para dar paridad al flujo Personal.
- **Convivencia con el bloqueo automático.** Las fases de suspensión del cron `check-gym-trials` discriminan hoy por `subscriptionNextPaymentDate = null`, que es la señal de "este gym no se cobra por MP". Al empezar a persistir esa fecha para todos los gyms con suscripción, esa señal deja de servir y el criterio de bloqueo cambia sin que nadie lo decida. Se redefine el corte para que el estado de MP siga gobernando a los gyms de MP.

**BREAKING** en el schema: se agrega una columna nueva a `User`. Es aditiva y nullable, sin backfill.

## Capabilities

### New Capabilities
<!-- Ninguna: el cambio corrige el comportamiento de capabilities existentes. -->

### Modified Capabilities
- `gym-billing`: el requisito «Webhook recibe autorización de suscripción» describe hoy un handler que resuelve ambos tipos de evento por `preapproval_id` — incorrecto para `subscription_authorized_payment`. Se reescribe el flujo del webhook, se agrega la persistencia de `subscriptionNextPaymentDate`, el ciclo de reintentos y la sincronización manual desde el super-admin.
- `personal-billing`: mismo handler y misma corrección para las suscripciones Personal, que comparten endpoint y se discriminan por el prefijo `user_` del `external_reference`.

## Impact

**Código**
- `src/lib/mercadopago.ts` — `notification_url` en las dos funciones de creación; cliente `Invoice` del SDK; helper de sincronización.
- `src/app/api/webhooks/mercadopago/route.ts` — resolución del `data.id`, ramificación por tipo de evento, persistencia de la fecha.
- `src/actions/super-admin/gym.ts` — server action de sincronización.
- `src/components/admin/SubscriptionSection.tsx` — botón que la dispara.

**Configuración**
- `APP_URL` pasa a ser relevante para la `notification_url`; debe apuntar al host canónico `https://www.wody.com.ar`.
- `MP_WEBHOOK_SECRET` tiene que coincidir con el secret vigente en el panel de MP.

**Datos**
- Migración aditiva: `User.subscriptionNextPaymentDate` (nullable, sin backfill). Ningún dato existente cambia de significado.
- Los gyms ya desincronizados se reparan con la acción de sincronización.

**Comportamiento**
- `src/app/api/cron/check-gym-trials/route.ts` — el criterio de las fases de bloqueo cambia de "tiene fecha cargada" a "tiene suscripción de MP".

**Riesgo**
- Es billing en producción. Un webhook que escribe de más puede marcar como moroso a quien paga; uno que escribe de menos deja pasar a quien no paga. Los cambios deben ser conservadores ante datos ausentes: si MP no devuelve un campo, no se pisa el valor existente.

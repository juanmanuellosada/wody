## Context

El webhook de Mercado Pago es el **único** camino por el que Wody se entera del estado real de una suscripción. `back_url` devuelve al usuario a la home y no persiste nada; ningún cron reconcilia contra MP; `subscriptionNextPaymentDate` se escribe a mano desde el super-admin. Si el webhook no llega —o llega y rebota— el estado en la DB queda congelado en el momento de la creación del preapproval, que es siempre `pending`.

Eso es lo que pasó con FIT CLUB, y el mismo camino lo recorre todo gym nuevo que se suscribe.

Restricciones que condicionan el diseño:

- **Un solo endpoint para dos dominios.** `/api/webhooks/mercadopago` atiende gyms y usuarios Personal; se discriminan por el prefijo `user_` del `external_reference`. Toda corrección tiene que aplicar a ambas ramas.
- **Es billing en producción.** El costo de los dos errores es asimétrico pero ambos son caros: escribir de más marca como moroso a quien paga (lo que acaba de pasar), escribir de menos deja pasar a quien no paga.
- **La verdad vive en MP, no en Wody.** Wody mantiene una réplica del estado; ante conflicto, MP gana.
- **SDK `mercadopago` 3.0.0**, ya instalado. Expone `PreApproval` (en uso) e `Invoice` (sin usar), este último con `preapproval_id`, `status`, `retry_attempt` y `payment.status`.

## Goals / Non-Goals

**Goals:**

- Que una suscripción autorizada en MP quede `authorized` en Wody sin intervención manual.
- Que `subscriptionNextPaymentDate` avance sola con cada cobro mensual.
- Que el ciclo de reintentos de MP —primer intento rechazado, reintento exitoso— termine con el gym en estado normal.
- Que exista una vía de reparación sin SQL cuando el webhook falle igual.
- Que la corrección cubra gyms y Personal con la misma lógica.

**Non-Goals:**

- **No se toca `paymentExempt`.** Un gym exento no puede suscribirse a MP y queda así. Decisión del usuario, 2026-08-19.
- Un único cambio de schema, aditivo: `User.subscriptionNextPaymentDate`. Nada más se toca.
- No se construye un cron de reconciliación periódica. La sincronización es manual y bajo demanda; si más adelante hace falta automatizarla, el helper ya queda escrito.
- No se cambian los montos, los planes ni la política de bloqueo.

## Decisions

### 1. `notification_url` en el request, no en el panel

Se declara la URL en el `preApproval.create` en lugar de depender de la configuración de la aplicación en el panel de MP.

*Por qué:* la config del panel es estado invisible desde el repo — nadie se entera de que falta hasta que un gym reclama. Declararla en el request la vuelve versionada, revisable en el diff y válida por preapproval.

*Alternativa considerada:* documentar el paso manual en `docs/billing-mercadopago.md`. Descartada: ya falló una vez de forma silenciosa, y el modo de falla es exactamente el que estamos arreglando.

*Cuidado:* MP rechaza una `notification_url` que no sea HTTPS pública. En desarrollo `APP_URL` apunta a `localhost`, lo que rompería la creación del preapproval. El campo **solo se incluye si la URL resuelta es HTTPS**; en local se omite y el flujo sigue funcionando como hoy.

### 2. `data.id` del query param con fallback al body

`verifyMpWebhookSignature` recibe el `dataId` que se usa para armar el manifest HMAC. Se toma primero del query param —formato que MP usa hoy— y si falta, del `body.data.id`.

*Por qué:* MP envía notificaciones en más de un formato según cómo se registró el webhook. Un `401` no es un error visible: MP reintenta unas veces y abandona, sin que nadie en Wody se entere. El fallback es de una línea y elimina un modo de falla silencioso.

*Alternativa considerada:* aceptar el evento sin validar firma cuando falta el `data.id`. Descartada: abre el endpoint a cualquiera que conozca la URL.

### 3. Resolver el evento a un preapproval según su tipo

Hoy ambos eventos van por `preApproval.get({ id: data.id })`. Se separa:

- `subscription_preapproval` → `data.id` **es** el preapproval. Se mantiene el camino actual.
- `subscription_authorized_payment` → `data.id` es un *invoice* (authorized payment). Se hace `invoice.get({ id })`, se lee `preapproval_id`, y con eso `preApproval.get()`.

*Por qué:* es la causa de que el evento de cobro mensual —el que trae la fecha nueva y el resultado de los reintentos— se pierda entero en el `catch`.

*Alternativa considerada:* ignorar `subscription_authorized_payment` y quedarse solo con `subscription_preapproval`. Descartada: es el único evento que confirma un cobro efectivo; sin él la fecha nunca avanza sola.

### 4. El preapproval manda; el invoice informa

Un invoice rechazado **no** marca al gym como moroso por sí solo. El estado que se persiste en `mpSubscriptionStatus` sale siempre del `status` del preapproval.

*Por qué:* durante los reintentos MP deja el invoice en `recycling` con `retry_attempt` creciendo, mientras la suscripción sigue vigente. Reaccionar al primer rechazo mostraría un cartel de pago fallido a un gym al que MP le va a cobrar bien dos días después — el mismo falso positivo que estamos arreglando, en espejo. Solo cuando MP agota los reintentos y mueve el preapproval a `paused` o `cancelled` se dispara `sendPaymentFailedEmail`, que es el comportamiento que ya existe y funciona.

### 5. Nunca pisar con un valor ausente

Si la respuesta de MP no trae `next_payment_date`, se deja el valor que ya estaba. Lo mismo para cualquier campo opcional.

*Por qué:* una respuesta parcial de MP no debe degradar datos correctos. Un `null` escrito sobre una fecha válida reintroduce el modal de vencimiento.

### 6. La sincronización manual reusa el mismo código

La server action de "Sincronizar con MP" llama al mismo helper de persistencia que el webhook, con el `mpPreapprovalId` guardado en el gym.

*Por qué:* dos caminos que escriben el mismo estado con lógica distinta divergen. Además vuelve al helper testeable por la vía manual, que es la única disponible sin un webhook real.

*Alcance de permisos:* solo super-admin, igual que `cancelGymSubscription`.

### 7. Personal recibe su propio campo de fecha, no reusa `nextPaymentDate`

Se agrega `User.subscriptionNextPaymentDate` en lugar de escribir la fecha de MP en el `User.nextPaymentDate` existente.

*Por qué:* son dos deudas distintas con dos acreedores distintos. `nextPaymentDate` es **la cuota del alumno a su gym**: gobierna `autoBlockAfterDays`, los recordatorios de vencimiento y el bloqueo de alumnos morosos. La suscripción Personal es lo que ese usuario le paga a Wody. Escribir una sobre la otra bloquearía alumnos por error y corrompería un dato hoy correcto.

*Alternativa considerada:* no persistir fecha para Personal. Descartada a pedido del usuario: la meta es paridad entre gym y Personal, no un flujo degradado.

*Costo:* una migración aditiva, nullable y sin backfill.

### 8. A los gyms de Mercado Pago los gobierna su estado en MP, no su fecha

Las fases de bloqueo del cron `check-gym-trials` usan hoy `subscriptionNextPaymentDate = null` como señal de "este gym no se cobra por MP": la Fase 1.5 (bloqueo por pago fallido) solo mira gyms con la fecha vacía, y la Fase 2.7 (bloqueo por vencimiento) solo mira gyms con la fecha cargada.

Persistir la fecha para todos los gyms con suscripción rompe esa señal: los gyms de MP saldrían de la Fase 1.5 y caerían en la 2.7, cambiando su gracia de 7 días desde el fallo a `autoBlockAfterDays` desde el vencimiento —15 o 45 días según el gym— sin que nadie lo haya decidido.

Se redefine el corte por lo que realmente distingue a los dos grupos:

- **Gym con `mpPreapprovalId` cargado** → lo gobierna el estado del preapproval. Fase 1.5: se bloquea si quedó `paused`/`cancelled` más allá de la gracia de 7 días. Queda fuera de la Fase 2.7.
- **Gym sin `mpPreapprovalId`** (cobro manual o self-managed) → lo gobierna la fecha. Fase 2.7 con su `autoBlockAfterDays`. Sin cambios respecto a hoy.

*Por qué:* preserva el comportamiento actual de suspensiones para ambos grupos en lugar de heredar un cambio accidental, y expresa el criterio real —quién le cobra a este gym— en vez de inferirlo de un campo que pasó a significar otra cosa.

*Nota:* la Fase 1 (bloqueo por trial vencido) ya filtra por `mpPreapprovalId: null`, así que no se ve afectada. Las fases Personal no dependen de ninguna fecha de suscripción, así que el campo nuevo no las altera.

### 9. La renovación mensual es el caso normal, no una excepción

El ciclo que el sistema debe atravesar sin intervención: autorización inicial → cobro mensual → fecha adelantada → cobro rechazado → reintentos → cobro exitoso o suspensión → eventual reactivación. Cada paso llega como un evento de webhook y se resuelve con la misma lógica: consultar el preapproval, persistir estado y fecha.

*Por qué se explicita:* la implementación actual trata la autorización inicial como el único evento interesante. Tratar la renovación como el caso normal es lo que hace que fechas, suspensiones y reactivaciones queden consistentes solas.

*Consecuencia:* una suscripción que vuelve de `paused` a `authorized` restaura el estado normal —fecha adelantada al próximo cobro—, pero si el gym ya había sido bloqueado el desbloqueo queda a cargo del super-admin: el bloqueo puede tener otras causas y desbloquear automáticamente sería asumir cuál fue.

## Risks / Trade-offs

- **`APP_URL` mal configurada en Vercel apunta la `notification_url` al host equivocado** → se resuelve contra el host canónico `https://www.wody.com.ar` con fallback explícito, y se verifica el valor en producción antes de dar el cambio por cerrado.
- **`MP_WEBHOOK_SECRET` desactualizado deja todo en `401` igual que hoy** → la tarea de verificación incluye disparar una notificación de prueba desde el panel de MP y confirmar `200` en los logs de Vercel.
- **Los gyms ya desincronizados no se arreglan solos** → para eso está la acción de sincronización; hay que pasarla por los gyms con suscripción MP existentes una vez desplegada.
- **Un `invoice.get` de más agrega latencia y una llamada extra a la API por cada cobro** → solo ocurre en `subscription_authorized_payment`, que llega una vez por mes por suscripción. Costo despreciable.
- **MP puede cambiar la semántica de sus estados** → el handler ya persiste el string literal desconocido y emite warning en lugar de romper; se conserva ese comportamiento.
- **Riesgo de regresión en el flujo Personal**, que comparte endpoint y se toca en el mismo cambio → las dos ramas se modifican en paralelo y la verificación cubre ambas.

## Migration Plan

1. Aplicar la migración de `User.subscriptionNextPaymentDate`. Aditiva y nullable; no requiere backfill ni ventana de mantenimiento.
2. Desplegar los cambios de código.
3. Verificar en el panel de MP que el webhook está registrado con el evento de suscripciones y que el secret coincide; disparar una notificación de prueba y confirmar `200`.
4. Correr "Sincronizar con MP" sobre los gyms con `mpPreapprovalId` cargado para reparar los desincronizados.
5. Confirmar contra un gym real —FIT CLUB, próximo cobro 15/09/2026— que la fecha avanza sola.

*Rollback:* revertir el commit. La columna nueva puede quedar en la DB sin uso; no hay estado inconsistente porque ningún campo existente cambia de significado.

## Open Questions

- ¿El evento `subscription_authorized_payment` llega también en el primer cobro de una suscripción con free trial, o solo a partir del segundo ciclo? No cambia el diseño —`subscription_preapproval` cubre la autorización inicial— pero define qué esperar al verificar en producción. Se resuelve observando FIT CLUB el 15/09/2026.

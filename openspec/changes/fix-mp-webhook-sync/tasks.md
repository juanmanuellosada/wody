## 1. Creación del preapproval con notification_url

- [x] 1.1 Agregar en `src/lib/mercadopago.ts` un helper que resuelva la URL del webhook desde `APP_URL` con fallback al host canónico `https://www.wody.com.ar`, y que devuelva `null` cuando la URL resuelta no sea HTTPS
- [x] 1.2 Incluir `notification_url` en el `preApproval.create` de `createGymSubscription`, omitiendo el campo cuando el helper devuelve `null`
- [x] 1.3 Incluir `notification_url` en el `preApproval.create` de la función equivalente de Personal, con la misma condición
- [ ] 1.4 Verificar que la creación de una suscripción sigue funcionando en local (sin HTTPS) y que el campo no se envía en ese caso

## 2. Validación de firma tolerante al formato

- [x] 2.1 En `src/app/api/webhooks/mercadopago/route.ts`, parsear el body antes de validar la firma y tomar el `data.id` del query param con fallback a `body.data.id`
- [x] 2.2 Conservar el rechazo con `401` cuando la firma es inválida o falta el header `x-signature`, y verificar que el reordenamiento no altera ese comportamiento

## 3. Resolución del evento a un preapproval

- [x] 3.1 Exportar en `src/lib/mercadopago.ts` un cliente `Invoice` del SDK, junto al `preApproval` ya existente
- [x] 3.2 En el handler, ramificar por tipo de evento: `subscription_preapproval` usa el `data.id` como `preapproval_id`; `subscription_authorized_payment` consulta el invoice y extrae su `preapproval_id`
- [x] 3.3 Responder `200 ok` con un warning cuando el invoice no expone `preapproval_id`, sin modificar datos
- [x] 3.4 Confirmar que la rama Personal (`external_reference` con prefijo `user_`) atraviesa la misma resolución

## 4. Campo de fecha para Personal

- [x] 4.1 Agregar `subscriptionNextPaymentDate DateTime?` al modelo `User` en `prisma/schema.prisma`
- [x] 4.2 Generar la migración con `prisma migrate diff` y **auditar el SQL resultante** antes de aplicarlo: confirmar que solo agrega la columna y que no arrastra cambios de `onDelete` en relaciones existentes
- [ ] 4.3 Aplicar la migración con `migrate deploy` — NO usar `migrate dev`, la shadow DB no está configurada en Neon

## 5. Persistencia de la fecha de próximo cobro

- [x] 5.1 Extraer del preapproval el `next_payment_date` y persistirlo en `Gym.subscriptionNextPaymentDate`, omitiendo la escritura cuando el campo viene ausente
- [x] 5.2 Persistir la misma fecha en `User.subscriptionNextPaymentDate` para la rama Personal, con idéntica condición
- [x] 5.3 Verificar que `User.nextPaymentDate` —la cuota del alumno a su gym— NO se toca en ningún camino
- [x] 5.4 Mostrar la fecha de próximo cobro en la página de suscripción Personal, omitiéndola cuando no hay dato
- [x] 5.5 Confirmar que la semántica de `mpSubscriptionStatusChangedAt` no cambia: se actualiza solo en transición real de estado

## 6. Ciclo de reintentos, suspensión y reactivación

- [x] 6.1 Verificar que el estado persistido sale siempre del `status` del preapproval y nunca del resultado de un invoice individual
- [x] 6.2 Confirmar que `sendPaymentFailedEmail` sigue disparándose solo en la transición a `paused` o `cancelled`, y no durante los reintentos
- [x] 6.3 Confirmar que una suscripción que vuelve a `authorized` persiste estado y fecha, y que NO modifica `blockedAt` de un gym ya bloqueado

## 7. Convivencia con el bloqueo automático

- [x] 7.1 En `src/app/api/cron/check-gym-trials/route.ts`, quitar `subscriptionNextPaymentDate: null` de la Fase 1.5 y reemplazarlo por `mpPreapprovalId: { not: null }`, para que los gyms de MP sigan gobernados por el estado del preapproval
- [x] 7.2 En la Fase 2.7, reemplazar la exclusión por `mpSubscriptionStatus != 'authorized'` por `mpPreapprovalId: null`, para que ningún gym de MP quede sujeto al bloqueo por fecha
- [x] 7.3 Verificar que la Fase 1 (trial vencido) no cambia de comportamiento: ya filtra por `mpPreapprovalId: null`
- [x] 7.4 Verificar que las fases Personal no se ven afectadas por el campo nuevo

## 8. Sincronización manual desde el super-admin

- [x] 8.1 Extraer la lógica de persistencia del webhook a un helper reutilizable que reciba el preapproval y actualice el gym
- [x] 8.2 Agregar la server action `syncGymSubscription(gymId)` en `src/actions/super-admin/gym.ts`, restringida a `SUPERADMIN` vía `assertSuperAdmin()`, que consulte el preapproval con el `mpPreapprovalId` guardado y llame al helper
- [x] 8.3 Devolver un error explicativo cuando el gym no tiene `mpPreapprovalId`
- [x] 8.4 Agregar el botón "Sincronizar con Mercado Pago" en `src/components/admin/SubscriptionSection.tsx`, con feedback de resultado y refresh de la vista

## 9. Verificación

- [x] 9.1 Correr `npm run lint` y `npm run build` sin errores
- [x] 9.2 Revisar `node_modules/next/dist/docs/` antes de tocar cualquier API de Next 16 involucrada en el route handler
- [ ] 9.3 Confirmar que el valor de `APP_URL` en producción apunta al host canónico `https://www.wody.com.ar`
- [ ] 9.4 Verificar en el panel de Mercado Pago que el webhook está registrado con el evento de suscripciones y que `MP_WEBHOOK_SECRET` coincide; disparar una notificación de prueba y confirmar `200` en los logs
- [ ] 9.5 Correr "Sincronizar con Mercado Pago" sobre los gyms con `mpPreapprovalId` cargado para reparar los que quedaron desincronizados
- [ ] 9.6 Confirmar con FIT CLUB (próximo cobro 15/09/2026) que la fecha avanza sola tras el cobro

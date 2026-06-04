## 1. Schema y migración

- [x] 1.1 Agregar `selfManagedBilling Boolean @default(false)` al modelo `Gym` en `prisma/schema.prisma`
- [x] 1.2 Generar la migración y aplicarla con `prisma migrate deploy` (NO `migrate dev` — shadow DB no configurada)
- [x] 1.3 Correr `prisma generate` y verificar que el tipo `Gym` incluye el nuevo campo

## 2. Cron: recordatorios y bloqueo en modo manual

- [x] 2.1 En `src/app/api/cron/check-gym-trials/route.ts`, agregar `selfManagedBilling: false` a los `where` de la Fase 1 (Condición A: trial vencido sin MP) y Fase 1.5 (Condición B: pago fallido MP) para excluir gyms en modo manual
- [x] 2.2 Agregar fase nueva de recordatorios: buscar gyms con `selfManagedBilling: true`, `paymentExempt: false`, `subscriptionNextPaymentDate != null`, `kind != PERSONAL`; calcular días hasta vencimiento con el "hoy" en zona Argentina; si cae en hito {10,7,3,1,0}, enviar push a los ADMIN
- [x] 2.3 Agregar fase nueva de bloqueo manual: bloquear (`blockedAt = now()`) gyms con `selfManagedBilling: true`, `paymentExempt: false`, `blockedAt: null`, `kind != PERSONAL`, y `subscriptionNextPaymentDate + autoBlockAfterDays días < now()`
- [x] 2.4 Verificar que el resumen de respuesta del cron incluya los nuevos contadores (recordatorios enviados, gyms bloqueados por vencimiento manual)

## 3. Push helper

- [x] 3.1 En `src/lib/push.ts`, agregar helper `sendSelfBillingDuePush(gymId, daysLeft)` que envíe a todos los `ADMIN` del gym (mismo patrón que `sendTrialEndingPush`), con copy según `daysLeft` (vence en N días / vence hoy)

## 4. Actions

- [x] 4.1 En `src/actions/super-admin/gym.ts`, soportar set de `selfManagedBilling` (y `subscriptionNextPaymentDate`) en la creación/edición del gym; restringido a `SUPERADMIN`
- [x] 4.2 En `src/actions/billing.ts`, extender `getMySubscriptionStatus` para devolver `subscriptionNextPaymentDate` y `selfManagedBilling` (agregar al `select` y al tipo `SubscriptionStatus`)

## 5. UI: panel super-admin

- [x] 5.1 En `src/components/admin/GymForm.tsx`, agregar toggle "Cobro manual (sin Mercado Pago)" para `selfManagedBilling`
- [x] 5.2 Asegurar que el campo `subscriptionNextPaymentDate` use el DatePicker del sistema (no `<input type="date">` nativo) y quede visible/relevante cuando el modo manual está activo

## 6. UI: indicador in-app del ADMIN

- [x] 6.1 Crear componente banner para `ADMIN` (basado en el patrón visual de `PaymentStatusBanner`) con estados al día / por vencer (≤7 días) / vencido, leyendo `subscriptionNextPaymentDate`; sin link a Mercado Pago
- [x] 6.2 Montar el banner en `src/app/[gymSlug]/layout.tsx` solo cuando `selfManagedBilling = true` (consumir `getMySubscriptionStatus`)
- [x] 6.3 Ocultar `TrialEndingBanner` y el flujo de configuración de tarjeta MP cuando `selfManagedBilling = true`

## 7. Verificación

- [x] 7.1 `npm run lint` y `npm run build` pasan
- [ ] 7.2 Verificar manualmente los hitos de recordatorio y el bloqueo por gracia con datos de prueba locales (sin tocar producción; respetar reglas de seeds)
- [x] 7.3 Revisar que ningún query nuevo rompa multi-tenancy (filtrado por `gymId`) y que `kind = PERSONAL` quede excluido

## 8. Cambio de datos (operativo, post-deploy)

- [ ] 8.1 Para `atlas-gym`: en `/admin/gyms/[id]` activar modo manual, cargar `subscriptionNextPaymentDate`, y desactivar exento en la misma edición
- [ ] 8.2 Para `mila-fit`: ídem 8.1
- [ ] 8.3 Confirmar que ambos gyms NO quedan bloqueados tras la próxima corrida del cron (fecha + gracia en el futuro)

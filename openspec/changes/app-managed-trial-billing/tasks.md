## 1. Base resuelta (sin sandbox)

> Resuelto en investigación documental: **sin plan asociado** con `preApproval.create` (SDK `mercadopago@3.0.0`, ya instalado); diferimiento del primer cobro vía **`free_trial` dinámico en días** (mismo mecanismo ya validado en prod); tokenización con `@mercadopago/sdk-js` + public key. `start_date` descartado (la doc dice cobro a la ~1h). No se reusan planes.

- [x] 1.1 Implementar el helper de cálculo `díasRestantes = ceil((trialEndsAt - now)/día)` en UTC, reutilizable por gym y Personal
- [x] 1.2 Definir el flujo de tokenización con MP Bricks/CardForm y la public key (`NEXT_PUBLIC_MP_PUBLIC_KEY`) en el front
- [x] 1.3 Releer `node_modules/next/dist/docs/` para las APIs de Next.js 16 que toque la UI nueva (Server Actions / componentes cliente)

## 2. Lib Mercado Pago (`src/lib/mercadopago.ts`)

- [x] 2.1 Implementar `createGymSubscription(...)` con `preApproval.create` **sin plan asociado**: `card_token_id`, `payer_email`, `status: "authorized"`, `external_reference = gymId`, `reason`, `back_url`, `auto_recurring` (`transaction_amount`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). Guardar `id`→`mpPreapprovalId`, mapear `status` con `parseMpSubscriptionStatus`
- [x] 2.2 Implementar `createPersonalSubscription(...)` como **función espejo** (no unificada): igual pero `transaction_amount = 7000` y `external_reference = "user_<userId>"`
- [x] 2.3 Diferimiento: si `díasRestantes >= 1` incluir `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`; si `díasRestantes <= 0` omitir `free_trial` (cobro inmediato ~1h)
- [x] 2.4 Devolver un resultado tipado (ok / error con motivo) para tarjeta rechazada, token inválido/expirado y errores de la API de MP
- [x] 2.5 Eliminar `getSubscriptionCheckoutUrl` / `getPersonalSubscriptionCheckoutUrl` y los helpers `pickPlanIdForGym` / `pickPersonalPlanIdForUser`; conservar `verifyMpWebhookSignature`, `parseMpSubscriptionStatus`, `cancelMpPreapproval`

## 3. Server actions de billing

- [x] 3.1 Adaptar `src/actions/billing.ts`: la action de alta de tarjeta recibe el `card_token_id` y dispara la creación del `preapproval`; persistir `mpPreapprovalId` y `mpSubscriptionStatus` solo si la creación tiene éxito
- [x] 3.2 Adaptar la action Personal equivalente con la misma semántica y `external_reference = "user_<userId>"`
- [x] 3.3 Mantener `getMySubscriptionStatus` y su equivalente Personal leyendo `trialEndsAt`/estado MP locales (no consultar MP)
- [x] 3.4 Verificar autorización multi-tenant: el alta de tarjeta del gym filtra por `gymId`/rol `ADMIN`; la Personal por `userId` propio

## 4. UI de captura de tarjeta (MP Bricks)

- [x] 4.1 Agregar el SDK JS de MP y montar el Card Payment Brick con la public key en el flujo de billing del dueño (`/[gymSlug]/admin/billing`), reemplazando el botón de redirect
- [x] 4.2 Montar el mismo componente en la UI Personal (`/personal/perfil/suscripcion`)
- [x] 4.3 Conectar el token devuelto por Bricks a la server action; mostrar estados de carga, éxito y error con opción de reintentar
- [x] 4.4 Ajustar copy del banner/CTA: la tarjeta se puede configurar en cualquier momento del trial y el cobro recién ocurre al finalizar

## 5. Webhook y cron (verificación, sin cambios de lógica)

- [x] 5.1 Smoke test del webhook `POST /api/webhooks/mercadopago`: confirma que `external_reference` (gymId y `user_<id>`) y los eventos (`subscription_preapproval`, `subscription_authorized_payment`) siguen funcionando con `preapproval` creados por API
- [x] 5.2 Confirmar que el cron `check-gym-trials` (bloqueo por `trialEndsAt < now` + grace de 7d por `paused`/`cancelled`) no requiere cambios

## 6. Config y limpieza

- [x] 6.1 Agregar `NEXT_PUBLIC_MP_PUBLIC_KEY` (public key de MP) como env pública del front
- [x] 6.2 Eliminar del código y de la config las 4 env de plan (`MP_PREAPPROVAL_PLAN_ID`, `MP_PREAPPROVAL_PLAN_ID_RETURNING`, `MP_PREAPPROVAL_PLAN_ID_PERSONAL`, `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`); el dueño borra los 4 planes del dashboard de MP tras el deploy
- [x] 6.3 Definir el origen del monto (`subscriptionMonthlyAmount` del gym vs constante) y dejarlo documentado

## 7. QA del flujo (opcional con cuenta de test de MP)

> El diferimiento por `free_trial` ya está garantizado documentalmente (reusa el mecanismo de prod), así que este grupo es QA de extremo a extremo, no validación bloqueante del approach.

- [ ] 7.1 Alta temprana: tarjeta con trial en el futuro → `free_trial = díasRestantes`, primer cobro al fin del trial, sin cobro anticipado
- [ ] 7.2 Alta tardía: tarjeta con trial vencido → sin `free_trial` → cobro inmediato (~1h)
- [ ] 7.3 Tarjeta rechazada → no se persiste `mpPreapprovalId`, se permite reintentar
- [ ] 7.4 Verificar que un tenant con suscripción vieja (creada por plan) sigue sincronizando estado por webhook sin romperse

## 8. Documentación

- [x] 8.1 Actualizar `docs/billing-mercadopago.md`: trial 100% en app, `preapproval` por API sin plan con `free_trial` dinámico en días, captura in-app con Bricks, sin planes de MP

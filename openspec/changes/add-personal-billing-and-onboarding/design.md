## Context

Tres cambios anteriores ya implementaron la spine del modelo de cobro:

- `add-gym-mp-billing` (archivado): trial 30d, suscripción MP, exención manual, push notifications a hitos.
- `add-billing-payment-failure-handling` (archivado): dos planes new/returning, grace period 7d, email payment-failed.
- `add-gym-signup-onboarding` (archivado): funnel B2B (form en landing → super-admin → token de onboarding → wizard).

Todo eso opera **a nivel `Gym`**: campos MP en el modelo `Gym`, billing UI en `/[gymSlug]/admin/billing`, lead form que pide `gymName` y `gymKindSuggested`. Wody Personal es la otra cara de Wody — opera a nivel `User` (un user STUDENT con `canCreateOwnRoutines = true` en el gym `personal`), tiene su propia landing y flujo de registro (`registro-personal`), y hasta ahora era 100% gratis.

El requerimiento del usuario es claro: replicar el modelo de cobro de gyms para Personal, con dos ajustes de producto:
1. **Self-cancellation** (B2C standard, distinto a gyms).
2. **Promoción automática a `PersonalAccessWhitelist`** cuando aprobás un lead — Personal no necesita onboarding wizard porque el `registro-personal` ya valida vía whitelist.

Stack: ya conocido (Next.js 16, Prisma 6, NextAuth 5, Vercel Cron, web-push, React Email). Email service operativo. Lib de MP ya tiene los helpers básicos.

## Goals / Non-Goals

**Goals:**

- Cobrar $7.000 ARS/mes automáticamente a cada Personal user no exento con suscripción activa en MP.
- Dar a cada Personal user un trial de 30 días desde su creación (idéntico al de gyms).
- Permitir self-cancellation: el user cancela su sub desde su perfil.
- Notificar al user via email cuando MP no puede cobrar (mismo patrón que gym, distinto destinatario).
- Bloquear automáticamente users con trial vencido sin sub, o con sub fallida después del grace 7d.
- Funnel B2C en la landing: form de contacto con $7k/mes, lead a super-admin, aprobación → whitelist + email con link a registro.
- Mantener funcionando sin interrupción a los Personal users existentes (todos quedan exentos en el deploy).

**Non-Goals:**

- Cobro retroactivo del mes perdido al re-suscribirse después de cancelar.
- Pricing tiers, Personal Plus, Personal Pro, etc. — solo un plan a $7.000.
- Refunds programáticos.
- Migración o refactor del `registro-personal` existente — el cambio lo deja intacto y le agrega billing encima.
- Cambios al schema de `PersonalAccessWhitelist` — se reutiliza tal cual.
- Banner UI de "pago fallido" en otras pantallas — el email es suficiente, igual que con gyms.
- Onboarding wizard separado para Personal — el `registro-personal` actual cubre el flujo (entra email + password, queda registrado, trial arranca).
- Cron-driven sync con MP (consultar todas las suscripciones periódicamente) — confiamos en el webhook.
- Notification al super-admin de pagos fallidos Personal — los ve en el dashboard, igual que con gyms.

## Decisions

### 1. Extender `GymSignupRequest` con campo `type`, no crear tabla nueva

**Opciones consideradas:**
- **A)** Tabla separada `PersonalSignupRequest` con los mismos campos relevantes.
- **B)** Extender `GymSignupRequest` con `type: SignupRequestType { GYM, PERSONAL }` y hacer nullable los campos gym-específicos.

Elegimos **B**. Razones:
- El panel super-admin queda unificado — una sola tabla, un filtro de tipo.
- Toda la lógica común (token, expiración, estados, emails) se reutiliza sin if/else cruzados.
- Los campos gym-específicos (`gymName`, `gymKindSuggested`, `expectedStudents`) son los únicos no compartidos. Hacer nullable + validar shape al recibir el lead resuelve.
- El default del campo `type` es `GYM`: los rows existentes (todos GYM, creados en `add-gym-signup-onboarding`) quedan correctos sin data-migration.

**Trade-off aceptado:** dentro del modelo `GymSignupRequest` quedan algunos campos que nunca aplican para PERSONAL. El nombre del modelo queda algo gym-centric, pero renombrarlo a `SignupRequest` requeriría una migración de rename con riesgo y poco beneficio. Lo dejamos como está.

### 2. Webhook discriminator por prefix en `external_reference`

**Opciones consideradas:**
- **A)** Webhook URLs separadas en MP (`/api/webhooks/mercadopago` para gym, `/api/webhooks/mercadopago-personal` para personal).
- **B)** Único webhook, discriminar por prefix en `external_reference`.
- **C)** Único webhook, intentar match contra `Gym.id` primero, fallback a `User.id` si no encuentra.

Elegimos **B**. Razones:
- MP permite **una sola URL de webhook por app**. Tener dos apps duplica todo lo demás (access tokens, configuración de eventos, etc.).
- El prefix es explícito y no depende de búsquedas cruzadas — más rápido y sin riesgos de colisión.
- Backward compat: los gyms existentes ya están suscriptos con `external_reference = <gymId>` (cuid pelado, sin prefix). No hay que migrarlos.
- Implementación trivial: `if (externalRef.startsWith('user_')) { ... }` en el handler.

**Convención adoptada:**
- GYMs: `external_reference = <cuid del gym>` (formato actual)
- PERSONAL: `external_reference = "user_" + <cuid del user>`

### 3. Self-cancellation: server action `cancelMySubscription`, sin confirmación de super-admin

Decisión confirmada por el usuario. El user cancela desde su perfil con un botón. Razones:
- B2C standard — Strava, Netflix, Spotify, todas permiten self-cancel.
- Reducir fricción de churn impulsivo cuesta más en NPS que lo que aporta retener gente forzada.
- Después de cancelar, sigue habiendo grace period (mientras MP confirma cancellation y nuestro cron evalúa) más el trial de re-activación 0d del plan returning. Recuperar es relativamente fácil si se arrepiente.

Implementación: server action `cancelMySubscription()`:
1. Valida sesión + rol STUDENT del personal gym.
2. Lee `mpPreapprovalId` del user.
3. Llama a `cancelMpPreapproval(preapprovalId)` (helper que ya existe en `src/lib/mercadopago.ts`).
4. Persiste `mpSubscriptionStatus = 'cancelled'` y `mpSubscriptionStatusChangedAt = now()` en el user.
5. NO setea `blockedAt` inmediatamente — el cron diario lo va a evaluar como cualquier sub cancelled, con grace 7d.

Caso edge: si el user click cancelar y la API de MP falla, retornamos error pero NO modificamos el estado. Cuando se reintente o llegue el webhook orgánico de MP, se sincroniza.

### 4. Lead PERSONAL aprobado → entry en `PersonalAccessWhitelist`, NO token de onboarding

Razones:
- Existe ya `PersonalAccessWhitelist` como gate de acceso al `registro-personal`. Reutilizar.
- El flujo de `registro-personal` ya pide email + password y arma el User STUDENT con `canCreateOwnRoutines = true`. No hace falta un wizard adicional.
- El usuario no necesita configurar slug, logo, color, kind, etc. — son cosas de gym, no de Personal.

Implementación del `approveSignupRequest` cuando `type = PERSONAL`:
1. Valida transición (`PENDING → APPROVED` o `EXPIRED → APPROVED`).
2. Crea entry en `PersonalAccessWhitelist` con el email del lead (si no existe ya).
3. Persiste `status = APPROVED`, `approvedAt = now`. No genera token de onboarding (el `onboardingToken` queda null para PERSONAL).
4. Manda email `lead-approved` con link a `https://wody.com.ar/registro-personal`.

El user después va al link, completa registro, queda creado con `trialEndsAt = createdAt + 30d` (similar a cómo el gym arranca con trialEndsAt al crearse).

Cuando MP cobra al fin del trial: lo hace via el plan que tenga free_trial coordinado, igual que con gym.

**Trade-off aceptado:** el campo `onboardingToken` en `GymSignupRequest` no se usa para PERSONAL. Está bien — es nullable y para PERSONAL su nullidad es lo correcto.

### 5. Trial timing y MP free_trial: misma estrategia que gyms

Para mantener consistencia (y porque ya está validada):

- Plan PERSONAL con `free_trial = 30 días` en MP.
- Plan PERSONAL_RETURNING con `free_trial = 0 días`.
- `User.trialEndsAt = createdAt + 30d` al registrarse.
- Si el user suscribe tarjeta mid-trial, MP no cobra hasta los 30 días MP, pero el `trialEndsAt` Wody puede estar antes. El cron sigue el modelo de gym: si `mpPreapprovalId` está seteado, no bloquea por trial vencido.

Análisis es idéntico al de `add-gym-mp-billing` §0. No re-discutir.

### 6. Cron extendido — fases adicionales antes de las existentes

El cron actual ya tiene varias fases (gym trial-vencido, gym pago-fallido, gym push notifications, etc.). Vamos a agregar fases análogas para Personal en posiciones consistentes:

1. **Fase Gym 1** (existente): bloqueo gyms por trial vencido sin sub.
2. **Fase Gym 1.5** (existente): bloqueo gyms por pago fallido + grace 7d.
3. **Fase Personal 1** (nueva): bloqueo Personal users por trial vencido sin sub.
4. **Fase Personal 1.5** (nueva): bloqueo Personal users por pago fallido + grace 7d.
5. **Fase 2** (existente): push notifications gym fin de trial.
6. **Fase 2.5** (nueva): push notifications Personal fin de trial.
7. **Resto** (existente): expirar tokens, cleanup rate limits.

Pseudocódigo de la fase Personal 1:
```ts
const personalGym = await prisma.gym.findFirst({ where: { kind: 'PERSONAL' } });
if (personalGym) {
  const trialExpiredPersonalUsers = await prisma.user.findMany({
    where: {
      gymId: personalGym.id,
      role: 'STUDENT',
      canCreateOwnRoutines: true,
      trialEndsAt: { lt: now },
      mpPreapprovalId: null,
      paymentExempt: false,
      blockedAt: null,
      deletedAt: null,
    },
    select: { id: true, email: true },
  });
  for (const user of trialExpiredPersonalUsers) {
    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: now } });
    console.log("[check-gym-trials] Blocked Personal user for trial expiry", { userId: user.id });
  }
}
```

Filtros importantes: `role = STUDENT`, `canCreateOwnRoutines = true`, `deletedAt: null`. El cron NO debe bloquear admins/profes/alumnos de gyms regulares por error.

### 7. Email payment-failed para Personal — destinatario diferente

En gym, `sendPaymentFailedEmail(gym)` busca a todos los ADMIN del gym y manda. En Personal, el destinatario es el user mismo (no hay "admins del user"):

```ts
// src/lib/billing-emails.ts (extensión)
export async function sendPersonalPaymentFailedEmail(user: { id: string; name: string; email: string | null }) {
  if (!user.email) return;
  await sendEmail({
    to: user.email,
    type: 'PERSONAL_PAYMENT_FAILED',
    subject: 'No pudimos cobrar tu suscripción de Wody Personal',
    react: PersonalPaymentFailedEmail({
      contactName: user.name,
      personalBillingUrl: `${getAppUrl()}/personal/perfil/suscripcion`,
    }),
  });
}
```

Nota: el `sendEmail` también recibe `gymId` para asociar al `EmailLog`. Para Personal, le pasamos el `gymId` del personal gym (siempre es el mismo).

### 8. UI del Personal user — ruta y layout

El Personal user navega bajo `/personal/...` (el gym personal con slug `personal`). El layout existente del gym (`src/app/[gymSlug]/layout.tsx`) maneja el theming y nav.

Decisión: la billing page del Personal user vive en **`/personal/perfil/suscripcion`** (Server Component que valida la sesión y renderiza un Client Component con los 3 casos + botón self-cancel).

Banner de fin de trial: el layout del gym ya renderiza `TrialEndingBanner` para `role = ADMIN` no exentos. Vamos a extender la lógica para que también renderice un banner análogo cuando es Personal user (`role = STUDENT` + `canCreateOwnRoutines = true` + gym personal). Para mantener el archivo `[gymSlug]/layout.tsx` limpio, vamos a crear un componente `PersonalTrialEndingBanner` y un selector que decide cuál renderizar según contexto.

### 9. EmailLogType: valores separados por tipo

Aunque conceptualmente "lead recibido" es lo mismo para gym y personal, los templates son distintos y el destino mental también. Para que el `EmailLog` quede claro al debuggar, los valores van separados:

- `LEAD_RECEIVED`, `LEAD_APPROVED`, `LEAD_REJECTED`, `PAYMENT_FAILED` (existentes, son para GYM)
- `PERSONAL_LEAD_RECEIVED`, `PERSONAL_LEAD_APPROVED`, `PERSONAL_LEAD_REJECTED`, `PERSONAL_PAYMENT_FAILED` (nuevos)

La distinción además sirve para reportes futuros (volumen B2B vs B2C).

## Risks / Trade-offs

- **Re-usar `GymSignupRequest` mezcla semánticas** → el modelo tiene fields gym-only que nunca se llenan para PERSONAL. **Mitigación**: nombramiento del campo `type` deja claro qué se llena y qué no. La validación de shape al recibir el lead protege contra inputs mezclados. Una eventual normalización (renombrar a `SignupRequest`, separar tablas, etc.) se puede hacer en un cambio futuro si la mezcla se vuelve molesta.
- **Prefix `user_` puede colisionar con cuids que arrancan con "user_"** → cuid format es `c` + base36 + timestamp + más random, jamás arranca con "user_". Riesgo cero práctico. Igual loggeamos warning si el prefix está pero el resto no es un cuid válido.
- **Self-cancel facilita churn impulsivo** → aceptado por decisión de producto. Si el churn rate empieza a doler, podríamos agregar fricción tipo "¿estás seguro? ¿querés que reduzcamos el precio?" o un proceso de feedback. Por ahora UX limpia, sin trabas.
- **Webhook de cancellation puede tardar** → si el user cancela desde Wody y MP tarda en notificar el webhook, hay una ventana donde nuestro DB ya tiene `mpSubscriptionStatus = 'cancelled'` pero MP todavía considera la sub activa. Ningún problema: el siguiente webhook que llegue es idempotente y reafirma el estado.
- **PersonalAccessWhitelist puede crecer mucho** → es solo emails, cuesta nada. Si en algún momento queremos limpiar entries no usadas, podemos agregar cron de cleanup.
- **Dependencia de `registro-personal` actual** → no lo tocamos en este cambio. Confiamos en que sigue funcionando como hoy (entra email + password + valida whitelist). Si tiene bugs sin resolver, este cambio no los toca — son scope separado.
- **Banner del Personal en el layout del gym** → el layout actual `[gymSlug]/layout.tsx` tiene lógica de banner para `role = ADMIN`. Agregar la rama de Personal incrementa la complejidad de un archivo que ya hace muchas cosas. **Mitigación**: extraer la decisión "qué banner mostrar" a un componente server-side dedicado que recibe sesión + user + gym y decide.

## Migration Plan

**Pre-deploy:**

1. Crear 2 planes en MP dashboard:
   - "Suscripción mensual Wody Personal": $7.000 ARS/mes, mensual, free_trial 30d, back_url `https://wody.com.ar/billing/return`.
   - "Suscripción mensual Wody Personal — Re-activación": idem pero free_trial 0d.
2. Anotar los IDs de ambos planes.
3. Cargar en Vercel (Production + Preview):
   - `MP_PREAPPROVAL_PLAN_ID_PERSONAL` = ID del plan 1
   - `MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING` = ID del plan 2

**Deploy:**

1. Mergear PR a `main`.
2. Vercel build.
3. Aplicar migración con `npx prisma migrate deploy` contra prod (agrega columnas + enum + marca exentos a Personal users pre-existentes en una transacción).
4. Verificar en super-admin `/admin/wody-personal` que los users existentes muestran badge "Exento" y razón.
5. Smoke test rápido del form Personal en landing → debería crear lead en `GymSignupRequest` con `type = PERSONAL`.

**Rollback:**

- Si algo crítico falla: revertir commits, redeployear.
- La migración solo agrega cosas; rollback de schema es opcional (las columnas nullables no rompen nada si quedan).
- Los planes en MP quedan creados; si nadie se suscribe son inertes. Pueden archivarse manualmente.

## Open Questions

- **¿Dónde exactamente vive la billing page del Personal user?** Confirmamos `/personal/perfil/suscripcion`. Si en la implementación encontramos que `/personal/perfil` no existe como ruta, alternativa: `/personal/dashboard/suscripcion` o `/personal/billing`. Decidir durante implementación.
- **¿El form Personal tiene "expectedFrequency" o algo similar?** Decisión: solo `contactName`, `email`, `phone?`, `message?`. Mantenemos minimalista.
- **¿Renombrar `GymSignupRequest` a `SignupRequest`?** No por ahora — costo de migración alto, beneficio bajo. Si en el futuro hay 3+ tipos de lead, se reconsidera.
- **¿Refactor del `docs/onboarding-gyms.md`?** Si lo renombramos a `docs/onboarding-leads.md`, hay que actualizar referencias en otros docs. Mejor: mantener `docs/onboarding-gyms.md` para el flujo GYM y crear `docs/onboarding-personal.md` separado. Cada doc específico, fácil de navegar.

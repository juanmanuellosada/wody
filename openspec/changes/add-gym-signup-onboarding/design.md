## Context

Wody hoy onboardea gyms exclusivamente a través del panel super-admin (`/admin/gyms/new`), un flujo manual donde el operador crea el gym + el usuario admin inicial + sube el logo + configura todo. Esto funciona para 5 gyms pero no escala. Con el modelo de cobro recién lanzado (`add-gym-mp-billing`, archivado), Wody está listo para crecer, pero le falta una vía pública de adquisición.

El requerimiento del operador (vos) es claro: mantener **control de calidad** sobre quiénes entran (revisión humana de cada lead) sin perder los beneficios de un funnel automatizado (form de contacto en la landing, emails transaccionales, onboarding self-service del dueño).

Stack relevante: Next.js 16 App Router, Prisma 6, NextAuth 5 beta, postgres/Neon. Hay infra de email en curso (`add-email-service`, 32/38 tasks done) que asumimos operativa. Hay `@vercel/blob` para upload de logos. Hay rol `SUPERADMIN` con panel propio en `/admin/*`. Hay un cron diario funcionando (`/api/cron/check-gym-trials`).

## Goals / Non-Goals

**Goals:**

- Permitir que cualquier visitante de la landing solicite alta enviando un form sin autenticación.
- Notificar al visitante por email apenas envía el form.
- Dar al super-admin una bandeja de leads (`/admin/signup-requests`) con acciones Aprobar / Rechazar / Re-emitir.
- Cuando el super-admin aprueba, mandar email al dueño con un link de onboarding firmado por token con expiración de 7 días.
- Permitir al super-admin agregar entries directamente en estado `APPROVED` (flujo whitelist) saltando la fase de form.
- Permitir que el dueño aprobado complete por su cuenta: elegir slug, definir password, confirmar kind, opcional logo y color primario.
- Al completar onboarding, crear `Gym` + primer `User` ADMIN + linkear la request a `COMPLETED`, todo en una transacción.
- Auto-login del recién creado ADMIN al terminar el onboarding y redirigir a su panel.
- Marcar como `EXPIRED` las requests cuyo token venció sin uso (cron diario).

**Non-Goals:**

- Analytics/reporting de leads (conversion rate, time-to-approval, fuentes).
- Sales pipeline tools (notas internas largas, asignación, etapas custom).
- Self-cancellation del lead por parte del visitante.
- Tracking de UTMs o referrer.
- 2FA o verificación de email durante onboarding (el token ya cubre esa función).
- Onboarding multi-step (todo en un solo form).
- Cobro automático en el onboarding — el trial arranca como cualquier gym, el dueño configura la tarjeta cuando quiera desde `/[gymSlug]/admin/billing`.
- Edición de campos del lead por el super-admin (solo aprobar/rechazar).
- Migración de los gyms existentes a este modelo (los 5 actuales se crearon por el flujo super-admin manual y siguen así).

## Decisions

### 1. Una sola tabla `GymSignupRequest` cubre lead y whitelist

Opciones consideradas:

- **A)** Dos modelos separados: `GymLead` (form público) y `GymWhitelist` (entry manual del super-admin).
- **B)** Un solo modelo `GymSignupRequest` con un campo `createdByAdminId?` que distingue el origen.

Elegimos **B**. Razones:
- El handling después de la creación es idéntico: token + email + onboarding.
- Una sola tabla = una sola query para la bandeja del super-admin.
- El campo `createdByAdminId` registra el origen sin complejidad extra (null = lead público, set = whitelist).
- No duplica lógica de tokens, expiración, ni completado.

### 2. Token: cuid único + `tokenExpiresAt` en la misma tabla

Opciones consideradas:

- **A)** Tabla separada `OnboardingToken` con FK a la request.
- **B)** Columnas `onboardingToken` y `tokenExpiresAt` directamente en `GymSignupRequest`.
- **C)** JWT firmado con payload + expiración, sin persistencia.

Elegimos **B**. Razones:
- Una sola request tiene un solo token activo a la vez. No necesitamos historial.
- Permite "re-emitir email" sin generar token nuevo (mientras siga válido).
- Persistir el token en DB facilita revocación si hace falta (lo cambiamos a null o lo dejamos vencer).
- JWT requeriría manejo de secrets para esto solo, y no aporta beneficios para nuestro caso.

Formato del token: `cuid()` (ya disponible en Prisma). Es URL-safe, sin guiones raros, no adivinable.

### 3. Status como enum Prisma estricto

`SignupRequestStatus { PENDING, APPROVED, REJECTED, COMPLETED, EXPIRED }`. No es un string libre — los estados son acotados y conocidos. A diferencia de `mpSubscriptionStatus` (que dejamos como string porque MP puede agregar valores), acá nosotros somos dueños de la máquina de estados.

Transiciones válidas:
- `PENDING → APPROVED` (super-admin aprueba)
- `PENDING → REJECTED` (super-admin rechaza)
- `APPROVED → COMPLETED` (dueño completa onboarding)
- `APPROVED → EXPIRED` (cron, token venció sin uso)
- `APPROVED → REJECTED` (super-admin revierte aprobación — caso poco común pero válido)
- Cualquier otra transición se rechaza con error.

### 4. Pricing section en la landing — dónde renderiza

Hoy `src/app/page.tsx` muestra una lista de gyms (DB-driven, agregada en `add-super-admin-panel`). La pricing section debe convivir con eso.

Decisión: agregar una sección **debajo** del listado de gyms. Headline tipo "¿Querés que tu gimnasio esté acá?", card con el plan + CTA "Contactanos" que abre el form (modal o expandible en línea — preferir modal para no saturar la landing).

El form vive en un componente cliente separado para usar `useState`/`useTransition`, controlado por un trigger en la página server.

### 5. Onboarding: server validate + client form

`src/app/onboarding/[token]/page.tsx` es Server Component que:
1. Valida token + estado + expiración server-side.
2. Si inválido: renderiza una página de error correspondiente (token no existe, expirado, ya usado, rechazado).
3. Si válido: renderiza un Client Component (`OnboardingForm.tsx`) con los campos del form, pre-populado con info de la request (`gymName`, `gymKindSuggested`, `contactName`, `email`).

El submit del form llama a la server action `submitOnboarding(token, formData)`:
1. Re-valida token (defensa contra TOCTOU).
2. Valida unicidad del slug elegido y que no esté en `isReservedSlug` (reutilizar `src/lib/reserved-slugs.ts`).
3. Si hay archivo de logo: sube a Vercel Blob via `uploadPublicImage` y guarda la URL.
4. Transacción Prisma:
   - `Gym.create({ name: gymName, slug, kind, primaryColor, logo, trialEndsAt: now + 30d, paymentExempt: false, autoBlockAfterDays: 45 })`
   - `User.create({ name: contactName, email, password: bcrypt(...), role: 'ADMIN', gymId, memberNumber: 1 })`
   - `GymSignupRequest.update({ status: 'COMPLETED', completedAt: now, gymId })`
5. Llamar a `signIn("credentials", { email, password, redirect: false })` y retornar el slug para que el cliente redirija a `/<slug>/admin`.

Si la transacción falla, el blob ya subido queda huérfano (igual que en `createGym` del super-admin). Aceptamos eso por simplicidad.

### 6. Rate limiting del endpoint público

Riesgo: el endpoint `POST /api/signup-request` sin auth puede ser abusado para spam.

Opciones:

- **A)** Rate limit por IP en memoria del proceso (no funciona en serverless multi-instance — Vercel).
- **B)** Rate limit persistido en `RuntimeCache` de Vercel o en una tabla nueva.
- **C)** Implementar un check muy simple: máximo 5 requests por IP por hora, contabilizadas en una tabla `SignupRequestRateLimit` con `ip`, `timestamp`. Limpiar entries viejas con el cron.
- **D)** Captcha (reCAPTCHA, Turnstile).

Elegimos **C** como baseline. Razones:
- Es trivial de implementar (10 líneas) y funciona en Vercel sin infra extra.
- No requiere integrar un servicio externo (captcha).
- Es suficiente para un sitio que recibe pocos visitantes legítimos al día.
- Si en el futuro escala mucho, se migra a Vercel Firewall o un captcha más serio.

La tabla `SignupRequestRateLimit` tiene `id`, `ip`, `createdAt`. Sin FK. Se limpia con el cron diario (entries con `createdAt < now - 24h`).

**Excepción:** los emails también deben ser únicos en estado `PENDING` o `APPROVED` (no permitir que la misma persona spamee con 100 leads). Si llega un POST con un email que ya tiene una request `PENDING` o `APPROVED`, responder `200` simulando éxito pero no crear nueva (idempotencia sigilosa — no informa al atacante que el email ya existe).

### 7. Email "rechazado" opcional, no automático

Decisión confirmada por el usuario: el email de rechazo se envía **solo cuando el super-admin hace click en "Rechazar"** explícitamente. No hay timeout automático que rechaze leads abandonados.

Beneficios:
- Vos decidís a quién le contestás.
- Leads "en duda" pueden quedar en `PENDING` indefinidamente sin generar emails.

Trade-off: leads quedan en limbo. La lista del super-admin tiene un filtro "PENDING > N días" para identificarlos.

### 8. Auto-login al completar onboarding

Al terminar el onboarding, el dueño está esperando ver su panel. Hacer que se loguee manualmente sería fricción innecesaria.

Implementación: usar `signIn("credentials", { email, password, redirect: false })` desde la server action de onboarding, justo después de crear el user. El cliente recibe el slug y hace `router.push("/<slug>/admin")`.

Edge case: si por alguna razón el `signIn` falla pero el `Gym` y `User` se crearon, el dueño queda con un account válido pero sin sesión. Mostrar mensaje "tu gym está listo, andá a /<slug>/login" como fallback.

### 9. Expiración: cron extiende el existente, no crea uno nuevo

Hay un cron diario `/api/cron/check-gym-trials` que ya corre todas las mañanas. Decisión: agregar al final del mismo cron una fase 3 que marca como `EXPIRED` las requests cuyo `tokenExpiresAt < now` y `status = APPROVED`.

Beneficios:
- No agregar más entries en `vercel.json`.
- Una sola fuente de truth sobre "qué pasa todos los días".

Alternativa rechazada: crear `/api/cron/expire-signup-tokens` separado. Más limpio conceptualmente pero más infra para mantener.

## Risks / Trade-offs

- **Dependencia de `add-email-service`** → si la API de email no está lista o tiene un gap, este cambio no puede deployear. **Mitigación**: durante implementación de Fase A (schema + actions), arrancamos sin disparar emails reales — los stubs llaman a la futura API. Si al implementar Fase de UI descubrimos que la API no existe, se agrega lo mínimo en línea.
- **Spam en el endpoint público** → rate limiting básico mitigá pero no elimina. **Mitigación**: monitoreo de logs durante la primera semana post-deploy; si hay abuso, agregar captcha.
- **Conflicto de slugs durante onboarding** → dos requests aprobadas eligen el mismo slug → la segunda transacción falla. **Mitigación**: error claro en el form "este slug ya existe, elegí otro". No es prevenible 100% sin reservar el slug al aprobar, lo cual contradice nuestra decisión de "slug elegido por el dueño".
- **Email del lead ya es ADMIN de otro gym** → permitido por schema (`@@unique([email, gymId])`). En el onboarding, se crea un nuevo User con el mismo email para otro gym. El NextAuth login se hace contra `email + gymSlug` (ver auth.ts), así que ambos accounts coexisten sin chocar. **Aceptado**: es feature, no bug. Un dueño puede operar múltiples gyms con un solo email.
- **Token comprometido** → si alguien intercepta el email de aprobación, puede usar el link y crear el gym. **Mitigación**: cuid es no-adivinable, link va por email HTTPS. Si pasa, el super-admin puede ver en la bandeja qué requests están en `COMPLETED` con campos sospechosos.
- **Transacción de onboarding falla parcialmente** → blob huérfano si el gym crea pero luego algo rompe. **Mitigación**: documentar en operación que se aceptan blobs huérfanos como en `createGym`; periódicamente limpiar manualmente desde el dashboard de Vercel Blob.
- **Token re-emitido tiene que usar el mismo o nuevo** → si el super-admin clickea "Re-emitir email", ¿genera token nuevo? Decidimos NO — re-emitir solo manda el mismo email con el mismo link, mientras el token no expiró. Si expiró, el botón "Re-emitir" se reemplaza por "Re-aprobar" que sí genera token nuevo y resetea expiración.

## Migration Plan

**Pre-deploy:**

- Verificar que el cambio `add-email-service` provee la API mínima para mandar emails con destino + template + variables. Si falta, agregar lo necesario en este cambio o coordinar con su autor.

**Deploy:**

1. Mergear PR.
2. Build de Vercel.
3. Aplicar migración con `npx prisma migrate deploy` contra prod.
4. Verificar manualmente:
   - Landing carga con la pricing section nueva.
   - El form de contacto envía y crea entry en `GymSignupRequest`.
   - El super-admin ve la entry en `/admin/signup-requests`.
   - Aprobar manualmente dispara el email (revisar bandeja del email de prueba).
   - El link de onboarding lleva al form.
   - Submit crea Gym + User.

**Rollback:**

- Si algo crítico falla post-deploy: revertir commits con `git revert`, redeployear.
- La migración solo agrega tabla — para revertir se puede mantener la tabla y simplemente no se usa más (es nullable).

## Open Questions

- **Tabla de rate limiting** ¿persiste en el schema principal o usamos un store separado? Por simplicidad arrancamos en el schema. Si crece mucho, se migra a Vercel KV o similar.
- **Tipo de logo en onboarding** ¿permitimos SVG? El helper `uploadPublicImage` ya acepta `image/svg+xml`. Lo dejamos habilitado.
- **Color primario** ¿picker visual o input hex? Por simplicidad: input hex con preview chico. Si UX queda mala, evolucionar después.
- **Notificación al super-admin de leads nuevos** ¿Email? ¿Solo en panel? Decisión inicial: solo en panel. El super-admin chequea su bandeja regularmente. Email al super-admin se puede agregar en un cambio futuro si la frecuencia lo justifica.

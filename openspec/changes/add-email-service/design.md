## Context

Wody hoy crea alumnos con una contraseña inicial que tipea un admin (`createUser` en `src/actions/user.ts:18-123`, hash bcryptjs). NextAuth 5 está configurado con un único provider de Credentials y **sin Prisma adapter** (`src/lib/auth.ts`), por lo que los flujos "magic link" estándar de NextAuth (`EmailProvider`) no aplican sin antes adoptar el adapter — algo que tocaría callbacks, sesión, JWT y bloqueo por gym/usuario/deuda. No hay tests automatizados (AGENTS.md).

El proyecto es multi-tenant por `[gymSlug]` con branding por gym (`Gym.primaryColor`, `Gym.logo`, `Gym.name`, `Gym.kind` ∈ {GYM, BOX}). El copy visible al usuario cambia según `kind`: BOX usa "WOD/RM/box", GYM usa "rutina/PR/gimnasio".

## Goals / Non-Goals

**Goals:**
- Eliminar la contraseña manual en alta de alumnos. El alumno define su contraseña al activar.
- Recuperación de contraseña self-service.
- Reenvío de invitación desde el panel de admin.
- Templates de email con branding por gym y copy adaptado por `kind`.
- Operar dentro del free tier de Resend (3000/mes) con alertas tempranas (80%, 95%).
- Anti-enumeration en reset (no revelar si un email existe).
- Migración no destructiva: usuarios existentes con password siguen operando.

**Non-Goals:**
- Adoptar el Prisma adapter de NextAuth (ver Decisión 1).
- Migrar a magic-link puro (login sin contraseña). Mantenemos email + password por sesión.
- Forzar verificación de email a usuarios existentes ya operativos.
- 2FA / MFA.
- Mails de marketing, newsletters o notificaciones de producto. Solo transaccionales.
- Templates traducibles a múltiples idiomas más allá del eje BOX/GYM. Castellano único.
- Rate limiting agresivo en `requestPasswordReset` más allá de un cap por email/hora simple.

## Decisions

### Decisión 1: Sistema propio de tokens en vez de NextAuth EmailProvider

**Elegido**: Modelo `VerificationToken` propio con tokens generados/validados desde server actions.

**Alternativa considerada**: Adoptar `@auth/prisma-adapter` y usar `EmailProvider` de NextAuth.

**Por qué**:
- El adapter cambia el storage de la sesión (de JWT puro a tabla `Session` en DB) y los callbacks. Tocar eso introduce un blast radius mucho más grande que el alcance de este cambio.
- `EmailProvider` está pensado para magic-link login, no para "alta + setear password". El UX que queremos (form de password después de validar token) es más natural con un flujo custom.
- Los tokens custom permiten dos `type` (INVITE, RESET) con expiraciones distintas, dedup, consumo, y bloqueos finos sin pelear con las convenciones del adapter.

### Decisión 2: Un único modelo `VerificationToken` con enum `type`, no dos modelos separados

**Elegido**: `VerificationToken { type: INVITE | RESET, ... }`.

**Alternativa**: `InvitationToken` + `PasswordResetToken` separados.

**Por qué**: La superficie es idéntica (userId, hash, expiresAt, consumedAt). Un solo modelo simplifica queries, índices y la capa de servicio. La diferencia de TTL (7d vs 1h) y de side effect al consumir vive en la lógica, no en el storage.

### Decisión 3: Guardar hash sha256 del token, no el token plano

**Elegido**: `tokenHash: String` (sha256 hex), índice único en ese campo. El token plano solo existe en memoria al generarlo y en el link del email.

**Por qué**: Mismo principio que con passwords — si la DB se filtra, los tokens no quedan reutilizables. sha256 es suficiente porque el token es un secreto aleatorio de alta entropía (32 bytes, base64url) y no necesita resistencia a ataques de diccionario; bcrypt sería overkill y costoso al validar. Comparación con `crypto.timingSafeEqual` o equivalente.

### Decisión 4: Conteo de cuota propio vía `EmailLog`, no polling a Resend

**Elegido**: Tabla `EmailLog` con un row por envío. Cron diario cuenta `count(*) WHERE sentAt >= startOfMonth()`.

**Alternativa**: Pollear `GET /emails` de Resend para obtener el listado del mes.

**Por qué**:
- Resend no expone un endpoint claro de "usage" — habría que paginar todos los emails, frágil.
- `EmailLog` además sirve para debugging y para el botón "reenviar invitación" (saber si y cuándo se envió).
- Costo de DB despreciable (3000 rows/mes max en tier gratis).

### Decisión 5: Anti-enumeration en `requestPasswordReset`

**Elegido**: La server action siempre devuelve éxito al cliente. Internamente, solo genera token + manda mail si el `(email, gymId)` existe.

**Por qué**: Si revelamos cuándo el email existe, atacantes pueden enumerar usuarios por gym. La latencia ideal sería constante (mismo trabajo en ambos casos), pero un mock del envío para usuarios inexistentes complica el código sin agregar mucha defensa real — aceptamos un timing leak menor.

### Decisión 6: Bloqueo en `authorize` de NextAuth para users con `password == null`

**Elegido**: Cuando `User.password === null`, `authorize` rechaza el login con un error code específico (`PENDING_ACTIVATION`). El componente de login lo detecta y muestra un CTA "tu invitación está pendiente — pedí que la reenvíen".

**Por qué**: No queremos que un usuario invitado pueda probar contraseñas inventadas (timing leak sobre estado de cuenta). El error code permite UX clara sin filtrar info sensible.

### Decisión 7: Branding y copy fluyen como prop al componente `EmailLayout`

**Elegido**: `sendEmail({ to, gymId, react: <InviteEmail gym={gym} ... /> })`. El helper carga el `Gym` (name, primaryColor, logo, kind) y lo pasa al componente. Los templates usan un helper `vocab(kind)` que devuelve `{ workoutWord: "WOD" | "rutina", recordWord: "RM" | "PR", placeWord: "box" | "gimnasio" }`.

**Por qué**: Centraliza la lógica de copy en un solo helper. Los templates leen `vocab.workoutWord` en lugar de tener `if/else` repartidos.

### Decisión 8: Cron de cuota en `src/app/api/cron/email-quota/`, frecuencia diaria

**Elegido**: Diario, dedup por mes vía `EmailLog` con `type=QUOTA_ALERT_80` / `QUOTA_ALERT_95`.

**Por qué**: El free tier es mensual (3000/mes). Diario es suficiente para reaccionar antes de tocar el tope. Más frecuente sería ruido. Vercel ya tiene crons configurados (`vercel.json`); agregamos uno más.

### Decisión 9: Endpoint de Resend webhook (status updates) — fuera de scope

**Elegido**: No suscribirnos a webhooks de Resend en este cambio. `EmailLog.status` se setea a `SENT` al recibir el `resendId` del API call. Bounces, complaints y deliveries quedan para una iteración posterior si los necesitamos.

**Por qué**: Webhooks suman superficie (endpoint público con verificación de firma, manejo de eventos, idempotencia) y no es bloqueante para el primer rollout. Resend ya muestra el detalle en su panel.

## Risks / Trade-offs

- [DNS mal configurado] → SPF/DKIM no verificados resultan en mails al spam o rechazados. **Mitigación**: checklist operativa explícita, runbook en `docs/emails-resend.md`, smoke test post-deploy enviando un mail de prueba a una casilla bajo control.
- [Tope de 3000/mes alcanzado a fin de mes en pico de altas] → Envíos siguientes fallan, alumnos no reciben invitación. **Mitigación**: alerta a 80% y 95%, plan B documentado en runbook (pasar al plan pago de Resend, ~20 USD/mes/50k). El sistema NO debe caer si Resend rechaza: el `createUser` mete el row de `EmailLog` con `status=FAILED` y el admin puede reintentar después con "Reenviar invitación".
- [Token interceptado en mail forwarding] → Riesgo bajo (TLS extremo a extremo en mayoría de proveedores). **Mitigación**: TTL corto en RESET (1h) y consumo único.
- [Usuario inunda `requestPasswordReset` de un email víctima] → Le llegan muchos mails de reset. **Mitigación**: rate limit simple por `(email, gymId)` — máximo 1 token activo a la vez (invalidamos el anterior al generar uno nuevo) y máximo 5 requests/hora por email.
- [Migración del schema sobre prod con datos vivos] → `User.password` pasa de `NOT NULL` a `NULL`. Es backwards-compatible (los rows existentes mantienen su valor). Sin downtime esperado. **Mitigación**: hacer la migración primero, deployar el código que lo usa después.
- [Componentes React Email que renderizan distinto en clientes Outlook/Gmail/Apple Mail] → Aceptable; los componentes oficiales de `@react-email/components` están testeados contra los principales clientes. **Mitigación**: smoke test enviando a las 3 grandes casillas antes de cerrar el cambio.
- [BREAKING en `createUser`] → cualquier llamador externo se rompe. **Mitigación**: `createUser` solo se invoca desde el panel de admin (server action interna, no API pública). Verificar en grep que no haya otros callers antes de mergear.

## Migration Plan

1. **Aplicar migración Prisma** primero: agrega tablas + `User.password` opcional + `User.emailVerifiedAt`. No requiere backfill — usuarios existentes mantienen su password.
2. **Deploy del código**: incluye nuevas server actions, páginas de activar/recuperar, cron, templates, cliente Resend. Hasta que la UI nueva del panel de admin reemplace al form viejo, el flujo de invitación queda detrás de un feature flag (variable env `EMAIL_FLOW_ENABLED=true|false` chequeada en `createUser`). Esto da espacio a verificar Resend en prod sin romper altas.
3. **Verificar dominio en Resend**: el operador agrega los DNS records y confirma verificación.
4. **Smoke test en prod**: crear un alumno de prueba en un gym propio, recibir mail, activar cuenta, login. Probar reset y reenvío.
5. **Activar feature flag** y dejar el flujo viejo deprecado por un release. La pantalla de "alta manual con password" se elimina del UI pero la server action se mantiene un release antes de borrar el código muerto.
6. **Eliminar el toggle y el código muerto** en un cambio posterior (`remove-manual-password-signup`).

**Rollback**: si algo se rompe, basta con setear `EMAIL_FLOW_ENABLED=false` en Vercel. El código viejo de alta con password sigue presente hasta el paso 6.

## Resolved Decisions

- **Sin mail de bienvenida post-activación**. El alta ya implica "bienvenido" — silencio + login. Reduce volumen sobre la cuota.
- **`EMAIL_FROM` global del SaaS**. Valor objetivo: `Wody <noreply@wody.com.ar>`. No usamos subdominios por gym; el branding por tenant vive dentro del cuerpo del mail (logo, color, name), no en el remitente. Esto evita multiplicar registros DNS por gym.
- **Dominio de producción**: `wody.com.ar`. Es el dominio a verificar en Resend (SPF + DKIM + opcionalmente DMARC) y el que firma los links de activación/reset (`APP_URL=https://wody.com.ar`).

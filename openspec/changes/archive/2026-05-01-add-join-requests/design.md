## Context

Wody hoy tiene dos modos de alta de alumnos, ambos disparados por el admin: (a) "Con contraseña", donde el admin tipea todo incluida la password; (b) "Por invitación", donde el admin tipea name+email y el sistema manda mail con link de activación. Ambos son admin-driven. No hay flujo de auto-registro: el alumno no tiene forma de iniciar el alta sin contactar al admin por privado.

El proyecto es multi-tenant por `[gymSlug]`, con admins que típicamente son dueños del gym o profes con permisos extra. Cada gym tiene su propia lista de profes (`role = TEACHER` o `ADMIN`) que pueden ser asignados a alumnos.

El servicio de mails transaccionales (`add-email-service`, recién shippeado) está operativo: dominio `wody.com.ar` verificado en Resend, free tier 3000/mes, alertas a 80%/95%, templates con branding por gym + logo de Wody en footer.

El proxy de Next.js 16 (`src/proxy.ts`) ya gatea las rutas privadas y tiene una lista corta de rutas públicas (`/login`, `/`, `/activar`, `/recuperar`).

## Goals / Non-Goals

**Goals:**

- Que cualquier persona pueda iniciar el alta como alumno desde un link público del gym, sin contactar al admin por privado.
- Mantener al admin como gatekeeper: ninguna alta se concreta sin aprobación explícita.
- Que el alumno defina su contraseña al solicitar (sin necesidad de mail de activación posterior).
- Notificar al alumno por mail cuando el admin aprueba (UX: el alumno sabe cuándo entrar).
- Filtrar bots básicos sin agregar fricción al alumno legítimo (honeypot, sin captcha).
- Anti-enumeration: que un atacante no pueda usar el form para descubrir qué emails están registrados en cada gym.
- Mantener el flujo existente intacto: el admin puede seguir creando alumnos manualmente con cualquiera de los dos modos.

**Non-Goals:**

- Auto-aprobación basada en reglas (whitelist de dominios, etc.). Toda solicitud requiere admin manual.
- Roles distintos a STUDENT desde el form público. Profes y admins se siguen creando sólo desde el panel.
- Captcha (reCAPTCHA / Turnstile / hCaptcha). Si el honeypot no alcanza, sumamos en una iteración posterior.
- Notificación al admin por mail/push cuando llega una request. Solo badge en navbar para MVP.
- Mail al alumno cuando es rechazado. Silencioso por decisión del usuario.
- Foto de perfil, fecha de nacimiento, plan elegido, member number en el form público. El form pide solo lo que pide el admin para alta básica (nombre, email, password, profe opcional). Member number lo asigna el admin después si quiere.
- Revocación / rotación del link público. La URL es estable basada en slug. Si se necesita revocar más adelante, se cambia el slug del gym o se suma un token rotable en una iteración futura.
- Webhook / API pública para integraciones externas. Solo el form web.

## Decisions

### Decisión 1: Modelo separado `JoinRequest` en lugar de extender `User` con un status `PENDING_APPROVAL`

**Elegido**: Tabla `JoinRequest` independiente.

**Alternativa considerada**: Agregar `User.status` (`ACTIVE` | `PENDING_APPROVAL` | etc.) y filtrar la mayoría de queries por `status = ACTIVE`.

**Por qué**:

- Toda query existente sobre `User` (login, listado, búsquedas, paginación, multi-tenant joins) tendría que sumar el filtro `status = ACTIVE`. Es un costo de mantenimiento alto y propenso a bugs (un olvido y el sistema empieza a contar pendientes como activos).
- `JoinRequest` y `User` tienen ciclos de vida distintos: una request puede estar rechazada y eso queda como historial; el user no existe nunca para una request rechazada.
- La separación permite tener triggers/audit trail propios (`reviewedAt`, `reviewedById`) sin contaminar el modelo de `User`.

### Decisión 2: Persistir `passwordHash` en `JoinRequest`, no `password` plana

**Elegido**: `JoinRequest.passwordHash: String` (bcrypt 10 rounds).

**Por qué**:

- Mismo principio que `User.password`. Si la DB se filtra, el hash es inútil sin el plain text.
- Bcrypt 10 rounds matchea exactamente lo que `createUser` hace para passwords manuales — al aprobar simplemente copiamos el hash al `User.password`. No hay re-hash, no hay riesgo de mismatch entre el hash de la request y el del user.
- Una request rechazada deja el hash en la DB. Considerado: en una iteración posterior podemos sumar un cron de cleanup (borrar requests `REJECTED` con más de 90 días). MVP no lo incluye.

### Decisión 3: Anti-enumeration en el submit

**Elegido**: La server action devuelve `{ ok: true }` siempre que la validación pase, exista o no conflicto de email.

**Alternativa considerada**: Devolver mensaje específico ("ya hay una solicitud pendiente con ese email" / "ya estás registrado, andá al login").

**Por qué**:

- Mismo razonamiento que `requestPasswordReset` del cambio anterior: si la respuesta varía según el estado del email, un atacante puede enumerar usuarios por gym.
- El admin tiene la responsabilidad de filtrar duplicados al ver la lista de pendientes — el costo en su lado es bajo (un click de rechazar) comparado con el costo de filtrarlo del UX del legítimo.
- Para usuarios legítimos que ya están registrados: van a recibir "solicitud recibida" y como no les llega mail de aprobación, en algún momento intentan loguearse y resuelven solos.

### Decisión 4: Honeypot en lugar de captcha

**Elegido**: Campo input oculto vía CSS (`display: none` y `tabindex={-1}` y `autocomplete="off"` por las dudas) que los bots básicos rellenan automáticamente. Si el honeypot llega no-vacío, el server descarta el submit silenciosamente (devuelve éxito al "atacante" para no darle señal).

**Alternativa considerada**: Captcha (Cloudflare Turnstile, Google reCAPTCHA).

**Por qué**:

- El usuario indicó que el link se comparte mayormente por mensajería privada en redes del gym, lo cual reduce drásticamente el tráfico de bots indiscriminados. El riesgo principal es bots oportunistas que crawlean URLs públicas.
- El honeypot atrapa el ~80% de los bots básicos sin agregar fricción al humano. Si la detección de bots se vuelve un problema real, sumamos captcha en una iteración con datos.
- Captcha como dependencia inicial sería overkill: requiere registro en el provider, key gestionada en env, integración cliente + server, dialog para captcha de "soy humano" que asusta a usuarios legítimos.

### Decisión 5: Aprobación crea `User` con la password del request, sin mail de invitación

**Elegido**: Al aprobar, el `User` se crea directamente con `password = passwordHash` de la request. Se manda un mail "cuenta aprobada" pero NO un mail de activación con token.

**Alternativa considerada**: Crear el `User` con `password = null` y mandar mail de invitación con token (reutilizando el flujo `add-email-service`).

**Por qué**:

- El alumno ya eligió su password al pedir alta. Forzar otra ronda de "click el link y elegí tu password" es UX pésimo: probablemente ya se olvidó qué password puso, o tipeó la misma y "qué raro que me pida una nueva".
- Confianza implícita: el admin aprueba, el alumno entra. No hay un riesgo de seguridad nuevo: la password fue elegida por el alumno, validada longitud-mínima, hasheada antes de viajar a la DB.
- El mail "cuenta aprobada" sigue siendo importante para que el alumno sepa cuándo puede entrar.

### Decisión 6: URL pública estable basada en slug, sin token

**Elegido**: `/{gymSlug}/invitarme` — pública, indexable si el SEO lo encuentra (improbable porque la página no se enlaza desde la landing).

**Alternativa considerada**: `/{slug}/invitarme?token={signed}` con `Gym.inviteToken` regenerable.

**Por qué**:

- La forma natural de compartir es por mensajería ("acá te paso el link, dale alta"). Un token largo en la URL la hace fea para compartir.
- Si el admin abusa de el link (lo borran de redes y luego suman bots) puede pedir que cambiemos el slug del gym. Es raro pero posible.
- El admin sigue siendo gatekeeper — un link "leakeado" solo lleva al form, no permite alta automática.

### Decisión 7: Atomicidad de la aprobación

**Elegido**: La aprobación corre en `prisma.$transaction` que: (a) crea el `User`, (b) marca la request `APPROVED`. Si (a) falla por unique constraint `@@unique([email, gymId])`, todo se rollbackea, la request queda `PENDING`, y el admin recibe el error.

**Por qué**:

- Garantía: nunca queda un user creado con la request aún `PENDING` (que pasaría si el admin clickea aprobar dos veces o si hay race condition).
- El mail de aprobación se manda DESPUÉS de la transacción. Si falla el mail, el user ya existe (puede loguear igual) y la request ya está `APPROVED`. El admin verá el `EmailLog` con `FAILED` para el caso raro.
- El edge case del email duplicado mid-flight (que entre el moment de crear la request y el de aprobar, el admin haya creado el mismo user manualmente) se maneja con el error explícito y la opción de "rechazar la solicitud".

### Decisión 8: Badge de pendientes vía query directa, no realtime

**Elegido**: En cada render de la navbar (server-side), `prisma.joinRequest.count({ where: { gymId, status: PENDING } })`. El count refresca a cada navegación.

**Alternativa considerada**: Subscribirse a cambios via Supabase realtime / WebSocket / Server-Sent Events.

**Por qué**:

- Un count adicional en el render de la navbar tiene costo despreciable (índice por `gymId, status`).
- Realtime suma complejidad (auth de canal, reconnect, fallbacks) sin beneficio real para este caso (un admin no espera badges en tiempo real, mira cuando entra a la app).

## Risks / Trade-offs

- **[Spam masivo de bots que el honeypot no atrapa]** → Lista de pendientes ahogada. **Mitigación**: si pasa, sumar captcha + rate limit por IP (futuro). El admin puede filtrar masivamente con un botón "Rechazar todos los pendientes con email tipo @gmail.com" si lo necesita (no en MVP).
- **[Alumno olvida la password que tipeó al solicitar antes de ser aprobado]** → No puede loguear cuando llega el mail. **Mitigación**: el flujo de reset password (`requestPasswordReset`) ya cubre esto. El alumno hace reset y listo. El mail de aprobación puede mencionar "Si olvidaste tu contraseña, usá 'Olvidé mi contraseña' en el login."
- **[Email tipeado mal por el alumno]** → No le llega ningún mail (ni el de aprobación). **Mitigación**: el admin ve que la request quedó `APPROVED` pero el `EmailLog` tiene status `FAILED`. Puede rehacer alta manualmente o pedirle que reintente desde otro dispositivo.
- **[Race condition: dos admins aprueban al mismo tiempo]** → Uno gana, otro recibe error de duplicate. **Mitigación**: la transacción ya cubre esto. El segundo admin ve "ya fue procesada".
- **[Race condition: admin aprueba mientras el alumno reenvía la solicitud]** → La aprobación gana primero (crea user). El reenvío del alumno ahora encuentra `User` con ese email → anti-enumeration → "solicitud recibida" pero no genera nada. **Mitigación**: comportamiento aceptable, el alumno ya está activo.
- **[Hash de password queda en `JoinRequest` rechazadas indefinidamente]** → Crece la tabla con datos no usados. **Mitigación**: cleanup cron en una iteración posterior (purgar rechazadas con > 90 días). Para MVP, asumimos que el volumen es bajo.
- **[Migración del schema sobre prod con datos vivos]** → Tabla nueva + nuevo valor de enum `EmailLogType`. Aditivo, no rompe rows existentes. Sin downtime esperado. **Mitigación**: aplicar migración igual que `add-email-service`: SQL manual contra Neon → `prisma migrate resolve --applied`.
- **[Selector de profe muestra todos los TEACHER+ADMIN, incluso los que no toman alumnos]** → UX confuso. **Mitigación**: por ahora mostramos todos. Si hace falta filtrar (ej. campo `Gym.acceptingNewStudents` por teacher), se suma en iteración. Aceptable para MVP.

## Migration Plan

1. **Aplicar migración Prisma** primero: tabla `JoinRequest` + enum `JoinRequestStatus` + nuevo valor `JOIN_APPROVED` en `EmailLogType`. Generar SQL con `prisma migrate diff`, aplicar manualmente a Neon, registrar con `migrate resolve --applied`. Mismo flujo que `add-email-service`.
2. **Deploy del código**: incluye nueva página pública, sección admin, server actions, template de mail, y proxy actualizado.
3. **Smoke test en prod**: abrir `/{gym-de-prueba}/invitarme`, enviar request con email propio, ir al admin, ver la request, aprobar, recibir mail "cuenta aprobada", loguear con la password elegida en el form.
4. **Comunicar a los gyms**: el admin del gym puede empezar a compartir el link `https://www.wody.com.ar/{slug}/invitarme` por sus canales.

**Rollback**: si algo se rompe, basta con (a) borrar la sección admin del menú (un Edit chico para ocultar el item), o (b) hacer el proxy bloquee `/invitarme` (devolviéndolo a la lista de protected). El form deja de ser accesible y los admins siguen creando alumnos a mano. Las requests existentes quedan en la DB y pueden retomarse cuando se restaure el flujo.

## Open Questions

- ¿Querés que el form público muestre el logo del gym arriba (si está cargado en `Gym.logo`) y un breve mensaje de bienvenida? Yo lo asumo en el diseño visual del form pero no es funcional. Decisión de UX que se puede cerrar al implementar.
- ¿La sección admin de invitaciones es un item nuevo en la navbar o una sub-sección dentro de "Admin"? Asumo item top-level del menú admin con badge. Si tu navbar tiene un dropdown, encaja ahí.

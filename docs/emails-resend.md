# Emails transaccionales — Resend

Wody envía mails transaccionales (invitaciones de alta, recuperación de contraseña, alertas de cuota) mediante [Resend](https://resend.com). Los templates se construyen con React Email y el flujo de envío queda auditado en la tabla `EmailLog`.

Referencia análoga: [`docs/notificaciones-push.md`](./notificaciones-push.md) — otro flujo transaccional con cron y dedup.

---

## Setup inicial (una vez por entorno)

### 1. Crear cuenta y obtener API key

1. Ir a [resend.com](https://resend.com) → registrarse.
2. Panel → **API Keys** → **Create API Key**.
3. Copiar el valor (formato `re_xxx...`). Solo se muestra una vez.
4. Guardar en el gestor de secretos del equipo y en Vercel (ver paso 4).

### 2. Verificar el dominio `wody.com.ar`

El remitente `noreply@wody.com.ar` requiere que el dominio esté verificado en Resend. Sin verificación, los mails no salen.

1. Panel de Resend → **Domains** → **Add Domain** → escribir `wody.com.ar`.
2. Resend muestra los DNS records a agregar. Agregar en el proveedor DNS del dominio:

   **SPF** (TXT sobre `wody.com.ar` o como indica Resend):
   ```
   v=spf1 include:amazonses.com ~all
   ```
   Si ya hay un registro SPF, agregar `include:amazonses.com` dentro del existente en lugar de crear uno nuevo.

   **DKIM** (dos TXT con nombres tipo `resend._domainkey.wody.com.ar`):
   Resend muestra los nombres y valores exactos — copiarlos tal cual. Son específicos de cada cuenta y no se pueden predecir.

   **DMARC** (opcional pero recomendado para reducir spam):
   ```
   v=DMARC1; p=none; rua=mailto:juanmalosada01@gmail.com
   ```
   Agregar como TXT en `_dmarc.wody.com.ar`. Con `p=none` solo reporta sin bloquear — bueno para empezar.

3. Volver al panel de Resend → **Verify**. La verificación tarda minutos a pocas horas según el TTL del proveedor DNS. Resend muestra el estado en tiempo real.

### 3. Setear variables de entorno en Vercel

En el dashboard de Vercel → proyecto Wody → **Settings → Environment Variables**. Agregar para **Production** y **Preview**:

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | La API key del paso 1 |
| `EMAIL_FROM` | `Wody <noreply@wody.com.ar>` |
| `EMAIL_REPLY_TO` | (opcional) inbox monitoreado, ej. `soporte@wody.com.ar` |
| `EMAIL_QUOTA_ALERT_TO` | `juanmalosada01@gmail.com` |
| `EMAIL_QUOTA_MONTHLY_LIMIT` | `3000` |
| `APP_URL` | `https://wody.com.ar` |

### 4. Smoke test

1. En un gym propio, crear un alumno de prueba desde el panel de admin usando la pestaña "Por invitación".
2. Verificar que llega el mail de invitación y que el link de activación funciona.
3. Activar la cuenta con una password nueva. Confirmar que el login funciona.
4. Probar **recuperación de contraseña**: desde la pantalla de login → "¿Olvidaste tu contraseña?" → recibir mail → cambiar contraseña → login.
5. Probar **reenviar invitación**: desde el panel de admin, fila del alumno → botón "Reenviar invitación".
6. Probar la pestaña "Con contraseña": crear un alumno de prueba sin mail, verificar login directo.
7. Revisar que el mail se ve bien en Gmail, Outlook y Apple Mail.

---

## Operación cotidiana

### Monitorear cuota

Resend tiene un límite mensual (free tier: 3000 mails/mes). El sistema envía alertas automáticas al llegar al 80% y al 95%, pero también se puede revisar manualmente:

- **Panel de Resend** → **Emails** → filtrar por rango de fechas del mes actual. El conteo aparece en el header de la tabla.
- **Base de datos** (Prisma Studio o SQL directo):
  ```sql
  SELECT COUNT(*) FROM "EmailLog"
  WHERE status = 'SENT'
    AND "sentAt" >= DATE_TRUNC('month', NOW());
  ```

El cron de cuota corre diario y deduplica: si ya envió una alerta de 80% este mes, no la repite aunque corra de nuevo.

### Investigar un mail que no llegó

1. Ir a la tabla `EmailLog` y buscar por el email del alumno, el tipo (`INVITE`, `RESET`) y la fecha aproximada.
2. Si `status = FAILED`, el campo `errorMessage` tiene el detalle del error devuelto por Resend.
3. Si `status = SENT`, el campo `resendId` tiene el ID del envío en Resend. Buscar ese ID en **Resend → Emails** para ver el estado de delivery (delivered, bounced, spam, etc.).
4. Si el mail llegó a spam: ver sección de troubleshooting más abajo.

### Reenviar una invitación

Desde el **panel de admin** del gym → lista de alumnos → fila del alumno sin password (invitación pendiente) → botón **"Reenviar invitación"**. El sistema invalida el token anterior, genera uno nuevo y envía el mail.

No hace falta tocar la DB directamente para esto.

---

## Runbook: "qué hacer si llegamos al tope"

### 1. Llegada de la alerta

El sistema envía un mail a `EMAIL_QUOTA_ALERT_TO` (`juanmalosada01@gmail.com`) al alcanzar el 80% y el 95% del límite mensual. Al recibir la alerta:

1. Confirmar el conteo en el panel de Resend (Emails → filtrar por mes).
2. Cruzar con la tabla `EmailLog` para entender el volumen real: `COUNT(*) WHERE status = 'SENT' AND sentAt >= startOfMonth()`.
3. Estimar si el ritmo del mes alcanza el tope antes del próximo ciclo.

### 2. Plan B: upgrade a Resend Pro

Si se proyecta llegar al tope:

1. En el panel de Resend → **Settings → Billing** → **Upgrade to Pro** (~20 USD/mes, 50 000 mails/mes).
2. El plan cambia instantáneamente. **No requiere cambio de código ni de API key** — la misma key sigue funcionando con el nuevo límite.
3. Actualizar `EMAIL_QUOTA_MONTHLY_LIMIT` en Vercel al nuevo límite (`50000`) para que el cron de alertas calcule los thresholds correctamente. Hacer redeploy.

### 3. Plan C: pausa temporal (mientras cierra el upgrade)

Si no se puede upgradear de inmediato y quedan muy pocos envíos disponibles:

Los admins pueden seguir dando de alta alumnos usando la opción **"Con contraseña"** en el form del panel de admin — no requiere enviar mail. Una vez resuelto el upgrade (o al inicio del mes siguiente con cuota renovada), volver a usar la opción "Por invitación".

---

## Rotación de API key

Cuándo rotar: sospecha de filtración, off-boarding de alguien con acceso a las vars, o rutina anual.

Pasos:
1. En el panel de Resend → **API Keys** → **Create API Key** (crear la nueva antes de revocar la vieja).
2. En Vercel → **Environment Variables** → actualizar `RESEND_API_KEY` con el nuevo valor, para **Production** y **Preview**.
3. Hacer un redeploy (las vars se leen al arrancar; el proceso en curso sigue con la vieja key hasta el redeploy).
4. Verificar que los mails siguen saliendo después del redeploy (crear un alumno de prueba o probar el cron manualmente).
5. Volver a Resend → **API Keys** → revocar la key vieja.

---

## Troubleshooting

### Mail llegó a spam

1. Verificar SPF y DKIM en el panel de Resend → **Domains** → `wody.com.ar`. Si alguno está en rojo, los registros DNS no propagaron o están mal escritos.
2. Agregar DMARC si no está (ver paso 2 del setup). Con `p=none` no bloquea pero ayuda a que los proveedores confíen en el dominio.
3. Revisar el contenido del template: los links deben ser HTTPS, evitar palabras de spam habituales en asunto/cuerpo, mantener un buen ratio texto/imagen.
4. Verificar que el `EMAIL_FROM` matchea exactamente el dominio verificado en Resend (`noreply@wody.com.ar`).

### Mail rechazado por cuota

1. En `EmailLog`, buscar registros con `status = FAILED`. El campo `errorMessage` debería decir algo como `"You've exceeded the email sending limit"`.
2. Revisar el conteo del mes en Resend y en la tabla `EmailLog`.
3. Seguir el runbook de "qué hacer si llegamos al tope" (sección de arriba).

### Token inválido en activación o reset

El link de activación/reset incluye un token de un solo uso. Los motivos más comunes de fallo:

- **Token expirado**: INVITE tiene TTL de 7 días, RESET tiene 1 hora. Si pasó ese tiempo, el link ya no sirve. Solución: el admin reenvía la invitación (INVITE) o el alumno solicita un nuevo reset (RESET).
- **Token ya consumido**: el link se usó en otra pestaña o sesión. Solo se puede consumir una vez.
- **`gymSlug` incorrecto**: el link contiene el slug del gym. Si el alumno lo abre en otro gym o si el slug cambió, falla. Verificar que el link sea de la forma `https://wody.com.ar/{gymSlug}/activar?token=...`.
- **Token inválido**: si la URL fue alterada o copiada mal.

En todos los casos, la página muestra un mensaje de error específico que guía al alumno sobre qué hacer.

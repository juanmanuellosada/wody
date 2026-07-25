## Context

La infraestructura de email ya existe y está probada: `sendEmail()` (`src/lib/email/send.ts`) rendea HTML + texto plano con React Email, envía por Resend y persiste siempre un row en `EmailLog`. Hay 13 templates en producción, 4 de ellos con branding por tenant vía `EmailLayout`. Este cambio no introduce infraestructura nueva: agrega tres templates y tres puntos de envío.

Lo que sí es nuevo es la **naturaleza del tráfico**. Todos los mails actuales son de evento puntual y baja frecuencia (invitación, reset, lead, cobro fallido). Los tres mails de este cambio son **recurrentes y periódicos**: se disparan por calendario, mes a mes, para toda la base. Eso convierte el volumen en la restricción de diseño dominante.

Estado actual de cada uno de los tres frentes:

| Frente | Fecha de vencimiento | Push hoy | Dedup hoy |
|---|---|---|---|
| Alumno → gym | `User.nextPaymentDate` | Sí, ventana `[hoy, hoy+2]` (`sendDueReminderIfNeeded`) | `User.lastDueNotifiedOn` (1/día) |
| Gym → Wody | `Gym.subscriptionNextPaymentDate` | Sí, hitos `{10,7,3,1,0}` (cron fase 2.6) + cada `signIn` de ADMIN con `daysLeft <= 7` | Ninguno |
| Personal → Wody | `User.nextPaymentDate` | **No existe** (solo push de fin de trial) | N/A |

## Goals / Non-Goals

**Goals:**

- Que los tres actores reciban por mail el aviso de que su cuota está por vencer, con la misma cadencia que la push equivalente.
- Que ningún mail se envíe dos veces por el mismo hito, ni siquiera si el cron se ejecuta más de una vez en el día.
- Que un fallo de Resend nunca aborte el cron ni impida el envío al resto de los destinatarios.
- Que los usuarios de Wody Personal dejen de recibir el copy equivocado ("Pasá por tu gym para renovar") y reciban un mensaje que corresponde a su producto.
- Que el consumo de estos mails sea visible en el monitoreo de cuota mensual antes de que se convierta en un incidente.

**Non-Goals:**

- Mails de comprobante o de "pago registrado". Descartado explícitamente.
- Cambiar el canal push existente: los hitos, los copys y los destinatarios de las push quedan intactos.
- Cambiar la lógica de bloqueo automático (`autoBlockAfterDays`) ni el webhook de Mercado Pago.
- Preferencias de notificación / opt-out por usuario. No existen hoy en el modelo y este cambio no las introduce.
- Corregir el drift de documentación sobre trial de 15 vs 7 días y planes de MP.

## Decisions

### D1 — El canal email se emite exclusivamente desde los crons diarios, nunca desde el login

El recordatorio de cuota del gym tiene hoy dos disparadores: el cron (hitos discretos) y `notifyBillingDueIfNeeded` en `events.signIn` de `src/lib/auth.ts`, que dispara en **cada** login de un ADMIN con `daysLeft <= 7`, sin cota inferior ni dedup. Replicar ese disparador por mail produciría hasta 8 mails por ciclo por gym, más uno por cada login adicional.

**Decisión**: el email se envía sólo desde `notify-due-today` (alumno) y `check-gym-trials` (gym y Personal). El path de login queda push-only, sin cambios.

*Alternativa considerada*: emitir mail también en login con dedup diario. Rechazada — el dedup diario acota a 1/día pero no a los hitos, así que un ADMIN que entra todos los días recibiría 8 mails por ciclo. El cron ya cubre el caso con 5 mails en hitos elegidos.

*Consecuencia*: si el cron falla un día, el mail de ese hito se pierde (no hay catch-up). Es aceptable: hay 5 hitos para el gym y 3 para el alumno, y el canal push sigue activo.

### D2 — Dedup con un campo `@db.Date` por entidad, independiente del dedup de push

Se agregan dos campos, siguiendo el patrón ya establecido por `User.lastDueNotifiedOn` y `FixedRoutine.lastRenewalNotifiedOn`:

- `User.lastDueEmailedOn DateTime? @db.Date` — sirve para alumno **y** para Personal, porque son mutuamente excluyentes (un `User` es alumno de un gym o es un usuario del tenant `personal`, nunca ambos).
- `Gym.lastBillingEmailedOn DateTime? @db.Date` — para el recordatorio del gym a Wody.

La regla es idéntica en los tres casos: si el campo es igual al día de hoy en ART, no se envía.

*Alternativa considerada*: reusar `User.lastDueNotifiedOn` para ambos canales. Rechazada — hoy ese campo se escribe **sólo si la push se envió con éxito** (`result.sent > 0`). Un alumno sin `PushSubscription` nunca lo marca, así que compartirlo no rompería el mail, pero un alumno con push exitosa marcaría el campo y **suprimiría el mail**. Justo al revés de lo que se busca: el mail existe precisamente para llegar a quien la push no alcanza. Campos separados mantienen los canales desacoplados.

*Alternativa considerada*: dedup consultando `EmailLog` (hay precedente: `account.ts` cuenta `EmailLog` para rate-limitear los resets). Rechazada por costo — sería un `count` por destinatario dentro del loop del cron, contra una tabla que crece sin límite.

### D3 — Cadencia propia y mínima: hitos `{2, 0}` para los tres mails

El canal email usa **dos hitos: 2 días antes del vencimiento y el día del vencimiento**, uniforme para alumno, gym y Personal. Máximo **2 mails por ciclo mensual** por destinatario.

| Frente | Hitos del mail | Hitos de la push (sin cambios) |
|---|---|---|
| Alumno | `2, 0` | ventana `[hoy, hoy+2]` → 3 envíos |
| Gym | `2, 0` | `10, 7, 3, 1, 0` → 5 envíos |
| Personal | `2, 0` | no existe |

La cadencia del email es **independiente de la del canal push**, que queda intacta. El criterio es minimizar la cantidad de mails: dos avisos alcanzan para que el destinatario reaccione — uno con margen para organizarse y otro el día límite — y evitan que el recordatorio se lea como spam.

*Alternativa considerada*: espejar los hitos de la push equivalente (3 mails para el alumno, 5 para el gym). Descartada por decisión de producto: más volumen sin ganancia proporcional de efectividad, y mayor riesgo de que el destinatario filtre el remitente.

*Consecuencia a tener presente*: para el gym, 2 días de aviso es un margen corto para gestionar el pago de una suscripción mensual, sobre todo cuando el cobro es manual. Si en la práctica aparece mora por falta de anticipación, el hito a recuperar primero es el de 7 días.

### D4 — Segmentación de destinatarios

**Alumno** — mismos filtros que `sendDueReminderIfNeeded`, más los específicos del canal mail:

```
role = STUDENT, deletedAt = null, blockedAt = null, paymentExempt = false,
gym.blockedAt = null, gym.kind != PERSONAL,          ← nuevo: excluye Personal
email != null,                                        ← nuevo: User.email es nullable
nextPaymentDate ∈ [hoy, hoy+2],
lastDueEmailedOn < hoy OR null
```

El filtro `gym.kind != PERSONAL` corrige el bug descripto en el proposal: hoy `notify-due-today` levanta usuarios Personal con `nextPaymentDate` real (los que cobra a mano el super-admin vía `registerPersonalPayment`) y les manda el copy de alumno. El mail nace sin ese defecto. **No se corrige la push en este cambio** — queda registrado como deuda.

**Gym** — mismos filtros que la fase 2.6, más `email != null` sobre los ADMIN, tal como ya hace `sendPaymentFailedEmail`:

```
subscriptionNextPaymentDate != null, paymentExempt = false,
blockedAt = null, kind != PERSONAL,
lastBillingEmailedOn < hoy OR null
→ destinatarios: User where gymId, role = ADMIN, deletedAt = null, email != null
```

**Personal** — el tenant `personal` cobrado a mano:

```
gym.kind = PERSONAL, role = STUDENT, canCreateOwnRoutines = true,
deletedAt = null, blockedAt = null, paymentExempt = false, email != null,
nextPaymentDate != SENTINEL (9999-12-31),  ← nunca cobrado a mano todavía
mpSubscriptionStatus != "authorized",      ← en débito automático de MP, no hay nada que recordar
lastDueEmailedOn < hoy OR null
```

### D5 — Tres templates, dos familias

- **`PaymentDueStudentEmail`** — usa `EmailLayout` con el branding del gym (`gym.primaryColor`, logo, nombre) y `gymTerms(gym.kind).kindWord` / `vocab(gym.kind)` para el vocabulario box vs gimnasio. Es un mail *del gym al alumno*, no de Wody: debe verse como los demás mails del tenant (`InviteEmail` es la referencia). Sin CTA de pago — el alumno paga presencialmente; el copy espeja el de la push ("Pasá por tu {box|gym} para renovar").
- **`PaymentDueGymEmail`** — chrome standalone de Wody, siguiendo `PaymentFailedEmail.tsx`. CTA a `${APP_URL}/${slug}/admin/billing`. Incluye monto (`subscriptionMonthlyAmount`, **guardado en centavos**, dividir por 100) y fecha de vencimiento.
- **`PaymentDuePersonalEmail`** — chrome standalone de Wody, siguiendo `PersonalPaymentFailedEmail.tsx`. CTA a `${APP_URL}/personal/perfil/suscripcion`.

Los tres respetan las convenciones vigentes: estilos inline en objetos `style={{}}`, fechas con `Intl.DateTimeFormat("es-AR")`, `<Html lang="es">`, español rioplatense, y el fix de host `www.` para los assets (el dominio redirige 307 y los clientes de mail no siguen redirects en `<img>`).

*Nota de deuda técnica*: ese bloque de host y el chrome standalone están duplicados a mano en los 9 templates standalone existentes. Este cambio agrega 2 duplicaciones más en vez de extraer un `WodyEmailLayout`. Se deja anotado; extraerlo ahora mezclaría un refactor de 11 archivos con una feature.

### D6 — Tres valores nuevos en `EmailLogType`, y los tres cuentan para la cuota

`PAYMENT_DUE_STUDENT`, `PAYMENT_DUE_GYM`, `PAYMENT_DUE_PERSONAL`. Sin esto `sendEmail` falla al escribir el `EmailLog`.

Los tres se suman al filtro del contador de `src/app/api/cron/email-quota/route.tsx`, que hoy sólo cuenta `INVITE` y `RESET`. Sin esto, el tipo de mail que más volumen genera sería invisible para las alertas del 80% / 95%.

### D7 — Resiliencia: contadores, nunca excepciones

`sendEmail` ya devuelve `{ ok: false, error }` en vez de tirar, salvo por el `EMAIL_NOT_CONFIGURED` que también devuelve. Los loops de envío acumulan `{ sent, failed }` y lo exponen en el JSON de respuesta del cron, igual que hoy se hace con `pushesSent`. Un destinatario que falla no interrumpe al resto, y el campo de dedup **sólo se escribe si el envío fue `ok`**, para que el próximo hito o la próxima corrida tenga otra oportunidad.

## Risks / Trade-offs

**[Volumen: holgado]** → Con los hitos `{2, 0}`, cada destinatario genera **2 mails por mes**. El plan de Resend contratado es **Transactional Pro: 50.000 mails/mes**, así que el techo está en el orden de los **20.000 alumnos activos** en toda la instalación, dejando margen para `INVITE` y `RESET`. No es una restricción a la escala actual ni a la previsible. Queda un riesgo operativo, no de capacidad: `EMAIL_QUOTA_MONTHLY_LIMIT` tiene default **3000** (el free tier), y si en producción quedó con ese valor, las alertas del 80% / 95% van a dispararse en falso apenas entren estos mails. Mitigación: ajustar la env var a 50000 como parte del release.

**[Reputación de dominio / spam]** → Es el primer mail recurrente y masivo que sale de `noreply@wody.com.ar`. Un pico repentino de volumen desde un dominio que hoy manda decenas de mails por día puede afectar la entregabilidad de los mails transaccionales críticos (invitación, reset). Mitigación: verificar que SPF/DKIM/DMARC estén configurados en Resend antes del release, y hacer el rollout progresivo (D8 del plan de migración).

**[No hay opt-out]** → El modelo no tiene preferencias de notificación. Un alumno que no quiere estos mails no tiene forma de desactivarlos salvo pedir que le borren el email. Es aceptable para un recordatorio de cobranza de una relación comercial vigente, pero acumula deuda: cuando se agregue el segundo mail recurrente habrá que introducir preferencias.

**[Push y mail dicen lo mismo, dos veces]** → Un alumno con push habilitada va a recibir ambos canales en el mismo día. Es intencional (el mail existe para cubrir a quien la push no alcanza) y el copy es deliberadamente idéntico para que se lea como el mismo aviso, no como dos avisos distintos.

**[El cron `check-gym-trials` crece]** → Ya tiene 8 fases y ~320 líneas; este cambio le suma envíos en la fase 2.6 y una fase nueva para Personal. Mitigación: las funciones de envío viven en `src/lib/billing-emails.ts`, el cron sólo orquesta y cuenta.

**[Gyms en débito automático de MP reciben recordatorios]** → La fase 2.6 no excluye `mpSubscriptionStatus = "authorized"`, así que un gym que paga automáticamente y además tiene fecha cargada a mano recibe recordatorios que no le corresponden. Para Personal sí se excluye (D4). No se corrige para gym en este cambio para no cambiar el comportamiento del canal push; queda anotado como deuda. El mail hereda el mismo defecto que la push, de forma consistente.

## Migration Plan

1. Agregar los tres valores al enum `EmailLogType` y los dos campos de dedup al schema.
2. Generar la migración y aplicarla con **`prisma migrate deploy`**. En este proyecto la shadow DB de Neon no está configurada: `prisma migrate dev` falla.
3. Los campos nuevos son nullable y sin default: los registros existentes quedan en `null`, lo que significa "nunca notificado" y habilita el primer envío. No hay backfill.
4. Desplegar con los envíos activos. `sendEmail` ya degrada solo si falta `RESEND_API_KEY` / `EMAIL_FROM`, así que un deploy sin las envs no rompe el cron: registra `EMAIL_NOT_CONFIGURED` y sigue.
5. Verificar en la primera corrida del cron los contadores del JSON de respuesta y las filas de `EmailLog`.

**Rollback**: revertir el deploy. Los campos y los valores del enum pueden quedar en la base sin efecto — no hay código que los lea si el deploy se revierte, y un enum de Postgres no se puede reducir sin recrear el tipo.

## Open Questions

1. ~~**¿Cuál es el límite real de Resend contratado?**~~ **Resuelto**: el plan es Transactional Pro, 50.000 mails/mes. La cadencia espejo se mantiene sin recortes. Queda como tarea del release setear `EMAIL_QUOTA_MONTHLY_LIMIT=50000` en producción, hoy en el default de 3000.
2. **¿Se corrige la push de alumno para excluir usuarios Personal?** El mail nace con el filtro correcto; la push sigue mandando "Pasá por tu gym para renovar" a los Personal cobrados a mano. Es un bug preexistente de una línea, pero está fuera del alcance declarado.
3. **¿El mail del alumno debería incluir el monto de la cuota?** Hoy no existe un "monto de cuota" por alumno en el modelo — `Payment.amount` es histórico y variable. Se omite el monto; si se quiere incluirlo hace falta modelar el precio.

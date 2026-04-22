# Notificaciones push

Se mandan a alumnos (STUDENT) cuando falta su cuota:
- **3 días antes** del vencimiento
- **El día** del vencimiento

El cron corre **diariamente a las 12:00 ART** (15:00 UTC) — configurado en `vercel.json`.

## Alcance y exclusiones

- Solo `role = STUDENT`.
- No se manda si el alumno está bloqueado (`blockedAt != null`).
- No se manda si el gym está bloqueado (`Gym.blockedAt != null`).
- Solo se manda a alumnos que hayan dado permiso y tengan al menos una `PushSubscription` guardada.
- La notificación **no es clickeable** — no abre ninguna URL al tocarla; es solo un recordatorio visual.

## UX del alumno

- En el dashboard del alumno aparece un botón "Activar notificaciones" (`NotificationPermissionButton`) debajo del botón de "Instalar WODY". Solo se muestra si el navegador soporta Push API y el permiso todavía no está `granted`.
- **iOS**: las push en PWA solo funcionan si el alumno agregó la app a la pantalla de inicio (iOS 16.4+). En Safari normal, el navegador no expone `PushManager`, y el botón queda oculto automáticamente.
- Si el usuario bloqueó las notificaciones desde la configuración del navegador, el botón queda deshabilitado con el label "Bloqueadas".

## Env vars (requeridas también en Vercel)

| Variable | Expuesta al cliente | Descripción |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Sí | Se usa en cliente y servidor. Generar con `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | No | Solo server — firma los envíos. |
| `VAPID_SUBJECT` | No | `mailto:tu@email.com`. |
| `CRON_SECRET` | No | Protege `/api/cron/notify-due-today` cuando se llama a mano. Vercel Cron bypassea el chequeo con su header `x-vercel-cron: 1`. |

## Regenerar VAPID

Si alguna vez hay que regenerar las keys, **todas las subscriptions existentes quedan inválidas** (vas a tener que `TRUNCATE "PushSubscription"`). Solo se hace si se filtraron o hay un problema real.

## Probar manualmente

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://wody.app/api/cron/notify-due-today
```

Respuesta: `{ ok: true, candidates, pushesSent, expiredSubsRemoved }`.

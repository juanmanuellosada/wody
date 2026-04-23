# Control de accesos — Plan de implementación

Sistema de control de ingresos para gimnasios. Identificación por **número de socio, QR o email** — el primero que matchea gana. En el kiosk se muestra toda la info del usuario (rol, estado de pago, bloqueos) y el **operador decide** permitir o denegar. Todo queda auditado. Funciona **offline-friendly** via PWA para aguantar caídas de internet.

Solo software — no hay integración con hardware de puerta en este plan.

---

## Roles

Se suma un rol nuevo a `Role`:

```
ADMIN    — controla todo el gym (ya existe)
TEACHER  — da clases (ya existe)
STUDENT  — alumno (ya existe)
ACCESS   — operador de la entrada. Solo ve la sección de Ingresos.
```

`ACCESS` es el rol típico para el recepcionista o para la PC/tablet kiosk que queda logueada en la entrada. Se puede loguear desde cualquier dispositivo. `ADMIN` hereda los permisos de `ACCESS`.

---

## Número de socio (en lugar de PIN)

Cada alumno/profe al crearse recibe un **número de socio auto-asignado, secuencial por gym**. Es un entero corto (típicamente 1–4 dígitos), **no editable** ni por el admin ni por el alumno, y funciona como identificador público — se usa en la pantalla de ingresos, puede aparecer en credenciales, admin lists, recibos, etc.

Diseño:

- `User.memberNumber Int` — único por gym.
- `Gym.nextMemberNumber Int @default(1)` — contador del próximo número a asignar. Al crear un usuario, se incrementa atómicamente y se le asigna el valor anterior.
- Display-friendly: se muestra con padding a 4 dígitos (ej. `0042`) para consistencia visual, pero internamente es el entero.
- Backfill: usuarios existentes se numeran en orden de `createdAt`.

**No es un factor de autenticación real.** Es un identificador público. La decisión real de acceso la toma el operador viendo la cara del socio y su estado en pantalla. El factor "fuerte" de auth, para quien lo quiera, es el QR.

---

## Alcance

- Asignación automática de número de socio al crear usuario.
- Regeneración del QR del socio desde el admin o desde el dashboard del alumno (el viejo queda inválido).
- Pantalla "Ingresos" en `/[gymSlug]/ingresos`:
  - Input único que acepta número de socio, QR escaneado o email.
  - Al matchear, muestra nombre + rol + estado de pago + estado de bloqueo.
  - Recomienda (verde / amarillo / rojo), decisión del operador.
  - Dos botones: **Permitir** / **Denegar** (+ razón opcional).
- Historial filtrable por fecha/socio en `/[gymSlug]/ingresos/historial`.
- Dashboard del alumno: tarjeta con su número de socio + QR personal + botón "regenerar QR".
- PWA dedicada: funciona offline con snapshot local de usuarios del gym.

---

## Modelo de datos

### `User` — agregar

| Campo | Tipo | Notas |
| --- | --- | --- |
| `memberNumber` | `Int` | Único por gym, auto-asignado al crear el usuario. No editable. |
| `qrToken` | `String` | Token random 32 bytes base64url, unique global. Al crear un usuario se genera; al regenerar, se pisa el campo y el QR anterior deja de validar. |

Unique `(gymId, memberNumber)`. Unique global en `qrToken`.

El `qrToken` se guarda **raw** (no hasheado). Trade-off explícito: si la DB leakea, los tokens filtran — pero ya filtrarían emails, fechas de pago y demás PII en el mismo incidente, así que el blast radius no cambia significativamente. Además, un token solo pullea la ficha del socio en el kiosk; el gate real de entrada es el operador humano. Simplifica mucho el flujo (re-render del QR entre sesiones) sin aumentar el riesgo real.

### `Gym` — agregar

| Campo | Tipo | Notas |
| --- | --- | --- |
| `nextMemberNumber` | `Int` (default 1) | Contador para asignar números de socio nuevos. |

Se incrementa en la misma transacción que crea al usuario (`prisma.$transaction`) para evitar race conditions.

### `Role` — ampliar

Sumar `ACCESS`.

### Nueva tabla `AccessLog`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | `String` (cuid) | PK |
| `gymId` | `String` | FK → Gym |
| `userId` | `String?` | FK → User. Null si el identifier no matcheó a nadie. |
| `operatorId` | `String` | FK → User. Quien operaba el kiosk. |
| `at` | `DateTime` | default `now()` |
| `method` | `AccessMethod` enum | `MEMBER_NUMBER`, `QR`, `EMAIL` |
| `result` | `AccessResult` enum | `GRANTED`, `DENIED`, `UNKNOWN_IDENTIFIER`, `RATE_LIMITED` |
| `reason` | `String?` | Texto opcional — ej. "cuota vencida", "bloqueado manualmente". |

Índices: `(gymId, at DESC)`, `(gymId, userId, at DESC)`.

---

## Flujo de validación

1. Operador tipea / escanea / pega un identifier en un input único.
2. Submit dispara server action `identifyPerson(gymId, input)`.
3. El server intenta resolver **en este orden** — el primero que matchea gana:
   1. **Email**: si matchea formato → `User.findFirst({ email, gymId })`.
   2. **Número de socio**: si todo dígitos → `User.findFirst({ gymId, memberNumber: parseInt(input) })`.
   3. **QR**: si matchea formato `WODY:{slug}:{token}` → parsea, valida slug y busca `User.findUnique({ qrToken: token })` verificando que pertenezca al gym actual.
4. Si no matcheó nada → retorna `UNKNOWN_IDENTIFIER` + incrementa rate-limit counter de la sesión.
5. Si matcheó → retorna `{ user: {id, memberNumber, name, role, nextPaymentDate, blockedAt, gym.blockedAt, gym.autoBlockAfterDays}, recommendation: "ALLOW" | "REVIEW" | "BLOCK" }`.
6. La UI muestra una tarjeta con los datos + el color de recomendación:
   - **Verde (ALLOW)**: al día, no bloqueado.
   - **Amarillo (REVIEW)**: cuota vencida pero dentro del umbral `autoBlockAfterDays`, o a punto de vencer.
   - **Rojo (BLOCK)**: usuario bloqueado, gym bloqueado, o mora > `autoBlockAfterDays`.
7. Operador clickea **Permitir** o **Denegar** (con razón opcional). Se dispara `logAccessDecision` que graba el `AccessLog` con `operatorId`, `method`, `result`, `reason`.
8. La pantalla vuelve al input vacío después de 2-3s.

**El operador puede override la recomendación.** Aunque el sistema recomiende rojo, puede permitir — queda registrado con su `operatorId` y el `reason` que escriba.

---

## Seguridad

- **Número de socio**: no es secreto. Es un identificador público. Cualquiera que tipee un número existente puede pullear la ficha del socio en pantalla. La privacidad se protege porque:
  - Solo sesiones con rol `ACCESS` o `ADMIN` pueden acceder a `/ingresos`.
  - La pantalla muestra datos mínimos (nombre, rol, badge verde/amarillo/rojo). No muestra monto, historial, ni detalles de la cuota en tipografía grande.
- **QR**: token 32 bytes random base64url, guardado raw con unique index. Regenerar pisa el valor → el QR anterior deja de validar inmediatamente. No es 100% leak-proof ante un DB leak, pero ya explicamos el trade-off arriba.
- **Email**: no es factor de auth — es solo un método de búsqueda.
- **Rate limiting por sesión**: máximo **60 lookups por minuto** por sesión del kiosk. Previene scripts que enumeren socios. Los operadores legítimos no se ven afectados (60 lookups/min ≈ 1 por segundo, muy alto para uso normal). Al excederse: 5 min de bloqueo, registrado como `RATE_LIMITED`.
- **Sesión del kiosk**: dura 90 días (`NextAuth.session.maxAge`). Si el dispositivo se roba, rotar `AUTH_SECRET` invalida todas las sesiones activas.

---

## Offline-friendly

La pantalla de Ingresos es una PWA con service worker propio (`/sw-access.js`, separado del `sw.js` principal):

- **Cache local** en IndexedDB: snapshot de los usuarios del gym con `{id, memberNumber, name, role, email, qrToken, nextPaymentDate, blockedAt, gymBlockedAt, autoBlockAfterDays}`.
- **Sync**: cada 60 segundos con red + al abrir la pantalla. Refresca el snapshot entero.
- **Modo offline**: si el `fetch` al server action falla, valida contra la cache local. El `AccessLog` se buffereaen IndexedDB y se flushea cuando vuelve la conexión.
- **Banner de estado**: amarillo "Sin conexión — datos cacheados hace X min" si la cache está vieja o hay error de red.
- **Stale máximo**: si la cache tiene **>24h** sin sincronizar, el sistema deja de validar y muestra error — evita permitir a alguien dado de baja con datos muy viejos.
- **Datos en cliente**: el snapshot incluye `qrToken` raw (necesario para validar offline). Si el dispositivo se roba, los tokens de los socios se filtran. Mitigación: la cache se borra al desloguearse, y rotar la sesión fuerza re-sync. Si un dispositivo se pierde, el admin puede regenerar los QRs masivamente (TODO: agregar acción bulk).

---

## UI / Rutas

| Ruta | Roles | Descripción |
| --- | --- | --- |
| `/[gymSlug]/ingresos` | `ACCESS`, `ADMIN` | Kiosk: input + tarjeta de resultado |
| `/[gymSlug]/ingresos/historial` | `ACCESS`, `ADMIN` | `AccessLog` con filtros fecha/socio |
| `/[gymSlug]/admin` | `ADMIN` | Muestra `memberNumber` en la lista de usuarios. Botón "regenerar QR" en el editor del socio. |
| `/[gymSlug]/dashboard/athlete` | `STUDENT` | Tarjeta con número de socio + QR + botón "regenerar QR" |

La sección de Ingresos es un item nuevo en la navbar, visible para `ACCESS` y `ADMIN`.

---

## Integración con features existentes

- **Bloqueos** (`User.blockedAt`, `Gym.blockedAt`): la tarjeta de resultado muestra "Bloqueado" en rojo. Recomendación = `BLOCK`. El operador puede permitir igual, el override queda logueado.
- **Auto-bloqueo por mora** (`Gym.autoBlockAfterDays`): el umbral configurable del gym define cuándo la recomendación pasa de `REVIEW` a `BLOCK` por deuda. Consistente con el resto del sistema.
- **Push notifications**: cuando el operador **deniega** y la razón es pago vencido, se dispara una push al alumno usando `sendPushToUser`: *"Acceso denegado: tu cuota está vencida. Acercate a recepción."* Dedupea con `User.lastDueNotifiedOn` para no duplicar con el recordatorio diario de vencimiento.

---

## Auditoría

- **Accesos**: `AccessLog` registra operador, método, resultado, razón, usuario (si hubo match). Queryable desde `/ingresos/historial`.

(No hay `PinChangeLog` — los números de socio no se editan, así que no hay nada que auditar.)

---

## Archivos nuevos / tocados

- `prisma/schema.prisma` — `Role` ampliado con `ACCESS`, `User.memberNumber` + `User.qrLookup`, `Gym.nextMemberNumber`, tabla `AccessLog`, enums `AccessMethod` + `AccessResult`.
- Migración de backfill: asignar `memberNumber` a los usuarios existentes en orden de `createdAt`, y setear `Gym.nextMemberNumber` al máximo+1 de cada gym.
- `src/actions/access.ts` — `identifyPerson`, `logAccessDecision`, `regenerateQrToken`.
- `src/actions/user.ts` — al crear un usuario, incrementar `Gym.nextMemberNumber` en la misma transacción.
- `src/app/[gymSlug]/ingresos/page.tsx` — kiosk.
- `src/app/[gymSlug]/ingresos/historial/page.tsx` — log viewer.
- `src/components/access/AccessInput.tsx` — input multi-modal (texto + scanner QR).
- `src/components/access/AccessResultCard.tsx` — tarjeta de resultado + botones.
- `src/components/access/AccessOfflineBanner.tsx` — banner de estado de conexión.
- `src/components/access/StudentMemberCard.tsx` — número de socio + QR en el dashboard del alumno.
- `src/components/layout/Navbar.tsx` — item "Ingresos" visible para `ACCESS` y `ADMIN`.
- `public/sw-access.js` — service worker dedicado (cache + offline buffer).

---

## Env vars nuevas

No hay env vars nuevas para el sistema de accesos. Los `qrToken` se generan con `crypto.randomBytes(32).toString('base64url')` directamente, sin pepper.

---

## Decisiones pendientes

- [ ] ¿Formato de display del número? `0042` con padding, o `42` directo? Recomendación: padding a 4 dígitos para consistencia visual.
- [ ] Al crear un alumno: ¿el admin ve el número asignado en un toast/pantalla, o lo busca en la lista después? Recomendación: mostrarlo en la confirmación de "Usuario creado".

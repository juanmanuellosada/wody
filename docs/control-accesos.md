# Control de accesos — Plan de implementación

Sistema de control de accesos para gimnasios basado en PIN numérico. Cada socio tiene un PIN asociado; en una pantalla del admin se ingresa el PIN, se identifica al socio, se valida estado de pago y se registra el ingreso.

Dos fases:

1. **Fase 1 — Solo software.** Validación + registro. No dispara nada físico.
2. **Fase 2 — Integración con hardware.** Molinete, cerradura eléctrica, electroimán, etc. (a definir).

---

## Fase 1 — Control de accesos web

### Alcance

- Alta/edición de PIN por socio desde el admin.
- Pantalla kiosk en `/[gymSlug]/admin/accesos` que:
  - Muestra un teclado numérico.
  - Valida el PIN contra la base.
  - Muestra nombre + foto (si hubiera) + estado de pago del socio.
  - Registra un `AccessLog` siempre (otorgado, denegado por PIN inválido, denegado por mora).
- Historial de accesos filtrable por fecha/socio.

### Modelo de datos

**`User`** — agregar:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `pinHash` | `String?` | bcrypt del PIN. |
| `pinLookup` | `String?` | HMAC-SHA256(pin, `PIN_LOOKUP_SECRET`). Indexado. Permite buscar sin traer todos los socios del gym. |

Unique `(gymId, pinLookup)` — el PIN es único por gym, no global.

**Nueva tabla `AccessLog`:**

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | `String` (cuid) | PK |
| `gymId` | `String` | FK → Gym |
| `userId` | `String?` | FK → User. Null si el PIN era desconocido. |
| `at` | `DateTime` | default `now()` |
| `result` | `AccessResult` enum | `GRANTED`, `DENIED_UNKNOWN_PIN`, `DENIED_PAYMENT_DUE`, `DENIED_RATE_LIMIT` |
| `method` | `AccessMethod` enum | `PIN` (por ahora único). Deja lugar a futuro: `CARD`, `QR`, `RFID`. |
| `deviceId` | `String?` | Identificador de la estación que registró el acceso (Fase 2). |

Índices: `(gymId, at DESC)`, `(gymId, userId, at DESC)`.

### Flujo de validación

1. Socio tipea PIN en keypad (pantalla kiosk).
2. Submit dispara server action `validatePin(gymId, pin)`.
3. El server:
   - Computa `pinLookup = HMAC(pin, PIN_LOOKUP_SECRET)`.
   - `SELECT user WHERE gymId = ? AND pinLookup = ?`.
   - Si no existe → `AccessLog { result: DENIED_UNKNOWN_PIN, userId: null }` + rate-limit counter++.
   - Si existe → bcrypt-compare `pin` contra `pinHash` (defensa en profundidad ante colisiones de HMAC o leak de `pinLookup`).
   - Si match y `nextPaymentDate < today` → `AccessLog { result: DENIED_PAYMENT_DUE }` + mensaje "Pago vencido".
   - Si match y al día → `AccessLog { result: GRANTED }` + mensaje "Bienvenido, {nombre}".
4. La UI muestra el resultado 2-3 segundos y vuelve al keypad.

### Rate limiting

- Máximo **3 intentos fallidos** por `(gymId, IP)` en **60 segundos** → bloqueo 5 min con `DENIED_RATE_LIMIT`.
- Implementación simple: tabla `AccessAttempt` o tabla en memoria (si hay un solo worker). Si se escala, mover a Redis/Upstash.

### Seguridad del PIN

- **Mínimo 6 dígitos.** 4 dígitos = 10.000 combinaciones, rompe con rate-limit débil o múltiples IPs.
- `pinHash` con bcrypt (misma config que passwords).
- `pinLookup` con HMAC + pepper en env (`PIN_LOOKUP_SECRET`). Sin la pepper, no se puede reconstruir el lookup desde la DB.
- Nunca loguear el PIN ni en claro ni en errores.
- Rotación: admin puede resetear el PIN de un socio; el anterior queda invalidado.

### UI / Rutas

- `/[gymSlug]/admin/accesos` — pantalla kiosk, solo rol `ADMIN`.
- `/[gymSlug]/admin/accesos/historial` — tabla de `AccessLog` con filtros.
- Form de PIN en la edición del socio (reusa `UserForm` existente).

### Archivos nuevos

- `prisma/schema.prisma` — campos en `User` + tabla `AccessLog` + enums.
- `src/actions/access.ts` — `setUserPin`, `clearUserPin`, `validatePin`.
- `src/app/[gymSlug]/admin/accesos/page.tsx` — kiosk.
- `src/app/[gymSlug]/admin/accesos/historial/page.tsx` — log viewer.
- `src/components/admin/PinKeypad.tsx` — teclado numérico.
- `src/components/admin/AccessResult.tsx` — feedback (nombre, verde/rojo, motivo).

### Env vars nuevas

```
PIN_LOOKUP_SECRET="..."   # >=32 bytes random, no rotar sin re-hashear todos los lookups
```

---

## Fase 2 — Integración con hardware

**A definir en su momento.** Esta sección captura lo pensado para no perder el contexto.

### Opciones de actuador físico

| Tipo | Costo aprox | Notas |
| --- | --- | --- |
| **Cerradura eléctrica** (puerta común) | Cerradura ~30–60 USD + fuente 12V | La más simple. Pulso de 1-3s abre el picaporte. |
| **Electroimán** (maglock) | ~40–80 USD + fuente | Aguanta 150-500 kg. Falla-seguro: sin corriente, la puerta se abre (bueno para escape ante cortes). |
| **Molinete / torniquete** | Mucho más caro (500+ USD) | Típicamente trae su propia controladora con entrada de pulso libre-de-potencial. Wody dispara el pulso igual que a una cerradura. |
| **Barrera vehicular** | Similar a molinete | Mismo patrón: pulso/relé seco. |

Todos se reducen al mismo problema: **disparar un relé** por una duración corta.

### Opciones de controlador de relé

1. **Shelly Plus 1** (~25 USD). HTTP local nativo: `POST http://shelly.lan/rpc/Switch.Set`. Soporta auth. Recomendado.
2. **ESP32 + ESPHome** (~10 USD + trabajo). Más DIY, más flexible.
3. **Controladora comercial** (ZKTeco, Hikvision, etc.). Más robusta pero más cerrada, protocolos propios.

### Arquitectura de integración

La PC del gimnasio (ya es requisito de Fase 1) funciona como **puente LAN**:

```
Socio ──PIN──▶ Browser kiosk (PC del gym) ──server action──▶ Wody cloud (Vercel/Next.js)
                        │                                              │
                        │◀────────── { ok, unlockToken } ──────────────┘
                        │
                        └──HTTP LAN──▶ Shelly ──relé──▶ Cerradura
```

Ventajas:

- Wody cloud **no necesita entrar a la LAN del gym** (sería un nightmare de NAT/firewall/IPs dinámicas).
- El PC ya está en la LAN del gym y ya tiene la sesión ADMIN.
- El `unlockToken` firmado (JWT corto, ~5s TTL) evita que alguien dispare el Shelly directo sin validar PIN.

### Configuración por gym

Agregar a `Gym`:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `doorControllerUrl` | `String?` | Ej: `http://192.168.1.50` |
| `doorControllerToken` | `String?` | Basic auth o API key del Shelly |
| `doorRelayChannel` | `Int?` | Por si el controlador tiene varios canales. |
| `doorPulseMs` | `Int?` | Default 1500. |

Es por gym, no env global — cada local tiene su propia red y hardware.

### Modo kiosk en la PC

- Auto-login de Windows/Linux al arrancar.
- Chromium en modo `--kiosk` apuntando a `/[gymSlug]/admin/accesos`.
- Auto-arranque al boot (Task Scheduler / systemd).
- Pantalla táctil si se quiere, o mouse/teclado común.

### Offline / resiliencia

Opciones discutidas:

- **Descartada:** "sin internet → dejar pasar a todos". El ataque es cortar el router, trivial.
- **Fase 1 simple:** llave mecánica de backup + UPS en el router (~30 USD/mes con 4G de respaldo elimina 99% de caídas). Si el PC no puede llegar al cloud, la puerta no se abre por PIN, se usa la llave.
- **Fase 2 avanzada (si hiciera falta):** PWA con Service Worker en la misma pantalla kiosk:
  - Cachea en IndexedDB la lista de `{ userId, pinLookup, pinHash, paymentOk }` vigente.
  - Sincroniza cada N minutos cuando hay red.
  - Si `fetch` al server falla → valida contra caché local y bufferea `AccessLog` para subir después.
  - Warning visible si la caché tiene >24h sin sincronizar.
- **Fase 3 (solo si crece):** agente Node como servicio del sistema en la PC del gym, con SQLite local. El browser habla a `localhost:3001` en lugar del cloud. El agente sincroniza bidireccionalmente.

### PIN maestro offline

Sobre sellado con un PIN de emergencia que solo el dueño del gym conoce. No va por el sistema normal, no queda en DB con los demás — se resuelve en la cabeza del dueño con la llave física. Sistema pensado para degradar a "llave mecánica", no para tener un bypass digital.

---

## Decisiones pendientes

- [ ] ¿Largo mínimo de PIN? (recomendación: 6 dígitos).
- [ ] ¿Un PIN por socio, o múltiples PINs por socio (ej. uno para el titular y otro para cónyuge)?
- [ ] ¿Historial de accesos visible al propio socio en su dashboard, o solo al admin?
- [ ] Fase 2: ¿molinete, cerradura, o ambos? ¿Una puerta o varias?
- [ ] Fase 2: ¿hay requisito de integrar con hardware existente del gym (lector RFID, tarjetas)?
- [ ] ¿Accesos denegados por mora generan notificación automática al socio? (oportunidad de cobranza).

# Billing con Mercado Pago — Plan de implementación

Plan para cobrar a los gimnasios:

1. **Tarifa de alta** (one-time) vía MP Checkout.
2. **Mantenimiento mensual** (recurrente) vía MP Preapproval, con **30 días gratis** desde que el gym queda listo para usar.

---

## 1. Modelo de negocio

| Momento | Acción | Monto | Estado `billingStatus` resultante |
| --- | --- | --- | --- |
| Gym llena formulario público | Crea `GymSignupRequest` + redirige a MP Checkout | — | `PENDING_PAYMENT` |
| MP confirma pago de alta | Webhook marca request como pagada, email al owner de Wody | Tarifa alta | `PROVISIONING` |
| Owner de Wody provisiona manualmente | Crea `Gym` + admin user + `trialEndsAt = now + 30d` + email al admin | — | `AWAITING_AUTHORIZATION` |
| Admin autoriza preapproval | MP guarda `preapprovalId`, primer cobro agendado en `trialEndsAt` | — | `ACTIVE` (en trial) |
| `trialEndsAt` | MP cobra primer mes | Mantenimiento | `ACTIVE` |
| Cobro recurrente falla | MP reintenta (3 veces, ~7 días) | — | `PAST_DUE` |
| MP agota reintentos | Se corta login | — | `SUSPENDED` |

Guardrails:

- Si admin **no autoriza** preapproval dentro de **7 días** desde provisioning → `SUSPENDED`.
- Trial corre desde provisioning, no desde autorización. El preapproval se crea con `auto_recurring.start_date = trialEndsAt` para que MP no cobre antes.

---

## 2. Máquina de estados (`Gym.billingStatus`)

```
PENDING_PAYMENT ──pago alta OK──▶ PROVISIONING ──provisioning manual──▶ AWAITING_AUTHORIZATION
                                                                              │
                                                 ┌────autoriza en 7d──────────┘
                                                 ▼
                                              ACTIVE ◀──cobro OK──┐
                                                 │                 │
                                     ┌───cobro falla───▶ PAST_DUE ─┘
                                     │                     │
                                     │                     └──3 fallos──▶ SUSPENDED
                                     └──no autorizó en 7d──────────────▶ SUSPENDED
```

Login permitido en: `AWAITING_AUTHORIZATION`, `ACTIVE`, `PAST_DUE`.
Login bloqueado en: `PENDING_PAYMENT`, `PROVISIONING`, `SUSPENDED`.

Recuperación desde `SUSPENDED`: **manual por DB**. Owner de Wody cobra por fuera, cambia `billingStatus = AWAITING_AUTHORIZATION`, resetea `trialEndsAt` si corresponde, manda link nuevo de autorización.

---

## 3. Cambios en Prisma schema

### 3.1 Nuevos enums

```prisma
enum BillingStatus {
  PENDING_PAYMENT
  PROVISIONING
  AWAITING_AUTHORIZATION
  ACTIVE
  PAST_DUE
  SUSPENDED
}

enum SignupRequestStatus {
  PENDING_PAYMENT
  PAID
  PROVISIONED
  REJECTED
}

enum BillingEventType {
  SIGNUP_FEE_PAID
  PREAPPROVAL_AUTHORIZED
  RECURRING_CHARGE_OK
  RECURRING_CHARGE_FAILED
  PREAPPROVAL_CANCELLED
  STATUS_CHANGED
}
```

### 3.2 Cambios en `Gym`

```prisma
model Gym {
  // existentes...
  billingStatus     BillingStatus @default(PENDING_PAYMENT)
  ownerUserId       String?       @unique  // user que autoriza/paga
  trialEndsAt       DateTime?
  mpPreapprovalId   String?       @unique
  mpPayerId         String?
  suspendedAt       DateTime?
  signupRequestId   String?       @unique

  owner          User?             @relation("GymOwner", fields: [ownerUserId], references: [id])
  signupRequest  GymSignupRequest? @relation(fields: [signupRequestId], references: [id])
  billingEvents  BillingEvent[]
}
```

Nota: `ownerUserId` es opcional al principio (antes de provisioning no existe el user). Tras provisioning es obligatorio en la lógica, aunque el schema lo permita nulo para simplificar migraciones.

### 3.3 Nuevo: `GymSignupRequest`

```prisma
model GymSignupRequest {
  id               String              @id @default(cuid())
  status           SignupRequestStatus @default(PENDING_PAYMENT)

  // Datos del gym
  gymName          String
  desiredSlug      String
  contactName      String
  contactEmail     String
  contactPhone     String?

  // Facturación (AR)
  razonSocial      String
  cuit             String
  condicionIva     String  // "RI", "MONOTRIBUTO", "EXENTO", etc.
  domicilioFiscal  String?

  // MP (pago de alta)
  mpPreferenceId   String?
  mpPaymentId      String?  // una vez cobrado
  mpPaymentStatus  String?  // "approved" | "rejected" | ...
  amountCents      Int
  currency         String   @default("ARS")
  paidAt           DateTime?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  gym              Gym?
}
```

### 3.4 Nuevo: `BillingEvent` (auditoría)

```prisma
model BillingEvent {
  id        String           @id @default(cuid())
  gymId     String
  type      BillingEventType
  amountCents Int?
  mpEventId String?          // id del webhook/payment/preapproval para idempotencia
  payload   Json?            // body crudo del webhook para debug
  createdAt DateTime         @default(now())

  gym Gym @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, createdAt(sort: Desc)])
  @@unique([type, mpEventId])  // idempotencia por tipo+id de evento MP
}
```

### 3.5 Relación inversa en `User`

```prisma
model User {
  // existentes...
  ownedGym Gym? @relation("GymOwner")
}
```

---

## 4. Endpoints / rutas

> **Antes de codear cualquier endpoint**, leer `node_modules/next/dist/docs/` para confirmar la convención de Route Handlers y middleware en Next 16.

### 4.1 Públicos (sin auth)

- `GET /signup` — formulario de alta (página pública, fuera del layout de gyms).
- `POST /api/signup/gym`
  - Valida input (incluye CUIT/razón social/IVA).
  - Verifica `desiredSlug` disponible.
  - Crea `GymSignupRequest` en `PENDING_PAYMENT`.
  - Crea MP Preference (Checkout Pro) con `external_reference = signupRequest.id` y `notification_url = /api/webhooks/mercadopago/checkout`.
  - Devuelve `init_point` para redirigir al usuario.
- `GET /signup/pending?id=<requestId>` — pantalla "estamos trabajando en tu solicitud".
- `GET /signup/success`, `GET /signup/failure` — return URLs de MP.

### 4.2 Webhooks (sin auth, validar con firma)

- `POST /api/webhooks/mercadopago/checkout` — eventos de tipo `payment`.
  - Caso `payment.status = approved` sobre un `signupRequest.id`:
    - Marca request como `PAID`, guarda `mpPaymentId`, `paidAt`.
    - Genera `BillingEvent(SIGNUP_FEE_PAID)`.
    - Dispara email al owner de Wody.
  - **Idempotencia**: usar `@@unique(type, mpEventId)` de `BillingEvent`.
- `POST /api/webhooks/mercadopago/preapproval` — eventos `preapproval` y `authorized_payment`.
  - `preapproval.status = authorized` → `Gym.billingStatus = ACTIVE`, guarda `mpPreapprovalId`.
  - `authorized_payment.status = approved` → `BillingEvent(RECURRING_CHARGE_OK)`, si venía de `PAST_DUE` → `ACTIVE`.
  - `authorized_payment.status = rejected` → `billingStatus = PAST_DUE`, `BillingEvent(RECURRING_CHARGE_FAILED)`.
  - `preapproval.status = cancelled/paused` y no hay flujo activo de reautorización → `SUSPENDED`.

### 4.3 Autenticadas (admin de gym)

- `GET /billing` — dashboard billing del gym (estado, próximo cobro, link de autorización si aplica, histórico de `BillingEvent`).
- `POST /api/billing/authorize` — genera (o recupera) el `init_point` del preapproval y devuelve la URL para redirigir.
  - Solo ejecutable por el `ownerUserId` del gym.
  - Crea preapproval en MP con:
    - `reason = "Wody — mantenimiento mensual <gymName>"`
    - `auto_recurring.frequency = 1`, `frequency_type = "months"`
    - `auto_recurring.start_date = gym.trialEndsAt`
    - `auto_recurring.transaction_amount = <monto>`
    - `back_url = <URL de /billing>`
    - `external_reference = gym.id`
  - Guarda `gym.mpPreapprovalId` en estado `pending` (queda confirmado por webhook).

### 4.4 Internas (owner de Wody, no UI)

- Provisioning: **server action** invocada desde un script o una ruta protegida por email del owner (`juanmalosada01@gmail.com`).
  - Input: `signupRequestId`, datos de Gym (nombre final, slug, logo, color), datos del admin (nombre, email, password inicial).
  - Lógica: transacción que crea `Gym` + `User(ADMIN)` + setea `Gym.ownerUserId`, `billingStatus = AWAITING_AUTHORIZATION`, `trialEndsAt = now + 30d`, linkea `signupRequestId`, marca request como `PROVISIONED`.
  - Manda email al admin con link a `/billing` para que autorice.

---

## 5. Guard de login / middleware

Dos capas:

1. **Middleware Next** (corre en edge): lee `gymSlug` de la sesión y consulta estado. Bloquea `PENDING_PAYMENT`, `PROVISIONING`, `SUSPENDED` redirigiendo a `/suspended` (página estática que explica cómo contactar a Wody).
   - Requisito: cachear el `billingStatus` en el JWT de NextAuth para no pegarle a la DB en cada request. Invalidar cache en transiciones de estado (rotando el token o con TTL corto tipo 60s).
2. **Banner en layout** (reusa patrón de `c830e90 feat: banner de estado de cuota para alumnos`):
   - `AWAITING_AUTHORIZATION` → banner "Autorizá tu suscripción antes del <fecha límite = provisioning + 7d>".
   - `PAST_DUE` → banner "Pago rechazado, MP está reintentando. Actualizá tu método de pago".
   - En trial (`ACTIVE` y `now < trialEndsAt`) → banner info "Trial hasta <fecha>".

Cron para expirar `AWAITING_AUTHORIZATION`:

- Job diario (Vercel Cron o equivalente): `gym.billingStatus = AWAITING_AUTHORIZATION AND createdAt + 7d < now` → `SUSPENDED`.

---

## 6. Dependencias nuevas

```bash
npm i mercadopago
```

SDK oficial de MP (paquete `mercadopago` en npm). Usarlo server-side en las rutas de `/api/signup/gym`, `/api/billing/authorize` y los webhooks.

---

## 7. Variables de entorno

Agregar a `env.local.example` y producción:

```
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=<para validar firma HMAC>
MP_SIGNUP_FEE_CENTS=<ej: 5000000 = ARS 50.000>
MP_MONTHLY_FEE_CENTS=<ej: 2000000 = ARS 20.000>
MP_CURRENCY=ARS
APP_PUBLIC_URL=https://wody.app
OWNER_NOTIFICATION_EMAIL=juanmalosada01@gmail.com
```

Para email, reusar lo que ya tenga el proyecto (si no hay nada, usar Resend o Nodemailer — decisión aparte).

---

## 8. Emails

| Trigger | Destinatario | Contenido mínimo |
| --- | --- | --- |
| Signup fee pagado | Owner de Wody | Datos del request, link al panel de provisioning |
| Provisioning terminado | Admin del gym | Credenciales iniciales + link a `/billing` para autorizar |
| Cobro fallido (primer fallo) | Admin del gym | Explicación + link a `/billing` para actualizar medio de pago |
| Suspendido | Admin del gym + owner de Wody | Instrucciones de contacto |
| Recordatorio trial ending (día 25) | Admin del gym | Confirma que el cobro arranca en 5 días |

---

## 9. Orden de implementación sugerido

1. **Schema + migración**: modelos nuevos, enums, campos en `Gym`. Correr migration en dev.
2. **Env + SDK**: instalar `mercadopago`, variables, helper `src/lib/mercadopago.ts`.
3. **Flujo signup fee** (punta a punta):
   - Página `/signup` + formulario.
   - `POST /api/signup/gym` → crea request + preference.
   - Webhook `/api/webhooks/mercadopago/checkout` + idempotencia.
   - Página `/signup/pending`.
   - Email al owner.
4. **Provisioning**: server action interna + email al admin. Por ahora invocable desde un script `prisma/provision-gym.ts` o CLI. UI después si hace falta.
5. **Flujo preapproval**:
   - Página `/billing` (estado + botón autorizar).
   - `POST /api/billing/authorize` → crea preapproval.
   - Webhook `/api/webhooks/mercadopago/preapproval`.
6. **Guard de acceso**: middleware + banner reutilizando patrón de cuota de alumnos.
7. **Cron de expiración** de `AWAITING_AUTHORIZATION` a 7 días.
8. **Emails restantes** (fallo, suspensión, recordatorio).
9. **Hardening**: validación de firma HMAC en webhooks, logs, tests manuales con tarjetas de prueba de MP.

---

## 10. Fuera de alcance (fase 2+)

- **Facturación automática (AFIP)**: el owner emite facturas manualmente con los datos guardados en `GymSignupRequest`.
- **Cambio de admin facturable vía UI**: por ahora, manual en DB (`UPDATE gym SET ownerUserId = ... WHERE id = ...` + nuevo link de autorización).
- **Planes múltiples / pricing por cantidad de usuarios**: hoy tarifa fija única.
- **Dashboard de billing para owner de Wody**: por ahora, queries directas a DB o Prisma Studio.
- **Reintento manual desde UI** tras fallo de cobro: el admin va a MP directamente a actualizar tarjeta; MP reintenta solo.

---

## 11. Preguntas abiertas antes de codear

1. ¿Montos concretos de `MP_SIGNUP_FEE_CENTS` y `MP_MONTHLY_FEE_CENTS`?
2. ¿Hay proveedor de email ya configurado en el repo o arrancamos con Resend?
3. ¿Deploy target (Vercel? otro)? Afecta cómo se configura el cron diario.
4. ¿Tarifa en ARS exclusivamente o también USD/otros?

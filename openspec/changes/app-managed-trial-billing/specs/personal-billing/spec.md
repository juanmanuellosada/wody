## MODIFIED Requirements

### Requirement: Dos planes Mercado Pago para Personal

El sistema SHALL cobrar $7.000 ARS/mes por Personal user mediante un único esquema de suscripción de Mercado Pago **sin `free_trial`**. El período de prueba es propiedad exclusiva de la app (`User.trialEndsAt`); Mercado Pago NO SHALL configurar ningún `free_trial`.

La suscripción SHALL crearse **sin plan asociado** (`POST /preapproval` sin `preapproval_plan_id`): el monto y el ciclo se definen en el payload (`auto_recurring.transaction_amount = 7000`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). El sistema NO SHALL usar ningún `preapproval_plan` para el cobro, NO SHALL mantener un plan de re-activación (`MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING`) ni elegir plan según historial.

#### Scenario: Ninguna suscripción Personal usa free_trial de MP

- **WHEN** el sistema crea la suscripción de un Personal user en Mercado Pago
- **THEN** el payload NO incluye `free_trial` y el período de prueba se gobierna solo por `User.trialEndsAt`

#### Scenario: No hay selección de plan Personal por historial

- **WHEN** un Personal user con `mpPreapprovalId IS NULL` o `IS NOT NULL` inicia el alta de tarjeta
- **THEN** el sistema usa el mismo esquema de suscripción en ambos casos, sin distinguir un plan de re-activación

### Requirement: Suscripción del Personal user vía Mercado Pago Suscripciones

El sistema SHALL ofrecer al Personal user un flujo **in-app** para suscribirse, sin redirigir al checkout hosteado de Mercado Pago. La captura de tarjeta SHALL realizarse con MP Bricks/CardForm, que tokeniza la tarjeta del lado del cliente; los datos de la tarjeta NO SHALL tocar el server de Wody, que SHALL recibir únicamente un `card_token_id`.

Con ese token, el sistema SHALL crear la suscripción mediante `POST /preapproval` **sin plan asociado** con `external_reference = "user_<userId>"`, `status = "authorized"`, `payer_email`, y `auto_recurring.transaction_amount = 7000`. El primer cobro SHALL diferirse hasta el fin del trial mediante un **`free_trial` dinámico**: el sistema calcula `díasRestantes = ceil((User.trialEndsAt - now) / 1 día)` y, si `díasRestantes >= 1`, incluye `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`. El sistema NO SHALL usar `start_date` como mecanismo de diferimiento. La suscripción se modela con `User.mpPreapprovalId: String?` y `User.mpSubscriptionStatus: String?`.

Si `User.trialEndsAt` ya pasó al momento de crear el `preapproval` (`díasRestantes <= 0`), el sistema SHALL omitir `free_trial`, de modo que el primer cobro sea inmediato.

Ante un fallo de la creación (tarjeta rechazada, token inválido/expirado o error de la API de MP), el sistema NO SHALL persistir `mpPreapprovalId`, SHALL devolver un resultado de error a la UI y SHALL permitir reintentar.

#### Scenario: Personal user configura tarjeta in-app durante el trial

- **WHEN** un user con `role = STUDENT` + `canCreateOwnRoutines = true` entra a `/personal/perfil/suscripcion`, carga su tarjeta en el componente de MP Bricks y confirma, con `User.trialEndsAt` en el futuro
- **THEN** el sistema crea el `preapproval` con `free_trial = { frequency: díasRestantes, frequency_type: "days" }` y `external_reference = "user_<userId>"`, y persiste `mpPreapprovalId` y `mpSubscriptionStatus` devueltos por MP, sin cobrar todavía
- **AND** el primer cobro queda programado para el fin del trial

#### Scenario: Configuración Personal con trial ya vencido cobra de inmediato

- **WHEN** un Personal user configura la tarjeta cuando `User.trialEndsAt` ya pasó (`díasRestantes <= 0`)
- **THEN** el sistema crea el `preapproval` sin `free_trial` y el primer cobro se ejecuta de inmediato

#### Scenario: Tarjeta rechazada permite reintento

- **WHEN** la creación del `preapproval` Personal falla por tarjeta rechazada o token inválido
- **THEN** el sistema no persiste `mpPreapprovalId`, muestra el error al user y le permite reintentar el alta de tarjeta

## MODIFIED Requirements

### Requirement: Plan único de $40.000 ARS/mes

El sistema SHALL cobrar $40.000 ARS/mes por gym mediante un único esquema de suscripción de Mercado Pago **sin `free_trial`**. El período de prueba es propiedad exclusiva de la app (`Gym.trialEndsAt`); Mercado Pago NO SHALL configurar ningún `free_trial`.

La suscripción SHALL crearse **sin plan asociado** (`POST /preapproval` sin `preapproval_plan_id`): el monto y el ciclo se definen en el payload (`auto_recurring.transaction_amount = 40000`, `currency_id = "ARS"`, `frequency = 1`, `frequency_type = "months"`). El sistema NO SHALL usar ningún `preapproval_plan` para el cobro, NO SHALL mantener un plan de re-activación (`RETURNING`) ni elegir plan según historial.

El `Gym.subscriptionMonthlyAmount` SHALL tener default `40000` y SHALL ser editable únicamente por el super-admin como referencia del precio negociado, sin afectar el monto que efectivamente cobra MP.

#### Scenario: Default de monto al crear gym

- **WHEN** el super-admin crea un gym sin especificar `subscriptionMonthlyAmount`
- **THEN** el sistema lo persiste con `subscriptionMonthlyAmount = 40000`

#### Scenario: Super-admin puede editar el monto de referencia

- **WHEN** el super-admin edita el campo `subscriptionMonthlyAmount` de un gym desde `/admin/gyms/[id]`
- **THEN** el sistema persiste el nuevo valor sin tocar la suscripción real en Mercado Pago

#### Scenario: Ninguna suscripción usa free_trial de MP

- **WHEN** el sistema crea la suscripción de un gym en Mercado Pago
- **THEN** el payload NO incluye `free_trial` y el período de prueba se gobierna solo por `Gym.trialEndsAt`

#### Scenario: No hay selección de plan por historial

- **WHEN** un dueño con `Gym.mpPreapprovalId IS NULL` o `IS NOT NULL` inicia el alta de tarjeta
- **THEN** el sistema usa el mismo esquema de suscripción en ambos casos, sin distinguir un plan de re-activación

### Requirement: Suscripción del gym vía Mercado Pago Suscripciones

El sistema SHALL ofrecer al dueño de un gym un flujo **in-app** para suscribirse, sin redirigir al checkout hosteado de Mercado Pago. La captura de tarjeta SHALL realizarse con MP Bricks/CardForm, que tokeniza la tarjeta del lado del cliente; los datos de la tarjeta NO SHALL tocar el server de Wody, que SHALL recibir únicamente un `card_token_id`.

Con ese token, el sistema SHALL crear la suscripción mediante `POST /preapproval` **sin plan asociado** con `external_reference = gymId`, `status = "authorized"`, `payer_email`, y `auto_recurring.transaction_amount = 40000`. El primer cobro SHALL diferirse hasta el fin del trial mediante un **`free_trial` dinámico**: el sistema calcula `díasRestantes = ceil((Gym.trialEndsAt - now) / 1 día)` y, si `díasRestantes >= 1`, incluye `auto_recurring.free_trial = { frequency: díasRestantes, frequency_type: "days" }`. El sistema NO SHALL usar `start_date` como mecanismo de diferimiento. La suscripción se modela con `Gym.mpPreapprovalId: String?` (id devuelto por MP) y `Gym.mpSubscriptionStatus: String?` (`pending`, `authorized`, `paused`, `cancelled` o un valor desconocido tratado como "unknown").

Si `Gym.trialEndsAt` ya pasó al momento de crear el `preapproval` (`díasRestantes <= 0`), el sistema SHALL omitir `free_trial`, de modo que el primer cobro sea inmediato.

Ante un fallo de la creación (tarjeta rechazada, token inválido/expirado o error de la API de MP), el sistema NO SHALL persistir `mpPreapprovalId`, SHALL devolver un resultado de error a la UI y SHALL permitir reintentar.

#### Scenario: Dueño del gym configura tarjeta in-app durante el trial

- **WHEN** un usuario con `role = ADMIN` entra a `/[gymSlug]/admin/billing`, carga su tarjeta en el componente de MP Bricks y confirma, con `Gym.trialEndsAt` en el futuro
- **THEN** el sistema crea el `preapproval` con `free_trial = { frequency: díasRestantes, frequency_type: "days" }` y persiste `mpPreapprovalId` y `mpSubscriptionStatus` devueltos por MP, sin cobrar todavía
- **AND** el primer cobro queda programado para el fin del trial

#### Scenario: Configuración de tarjeta con trial ya vencido cobra de inmediato

- **WHEN** un dueño configura la tarjeta cuando `Gym.trialEndsAt` ya pasó (`díasRestantes <= 0`)
- **THEN** el sistema crea el `preapproval` sin `free_trial` y el primer cobro se ejecuta de inmediato

#### Scenario: Tarjeta rechazada permite reintento

- **WHEN** la creación del `preapproval` falla por tarjeta rechazada o token inválido
- **THEN** el sistema no persiste `mpPreapprovalId`, muestra el error al dueño y le permite reintentar el alta de tarjeta

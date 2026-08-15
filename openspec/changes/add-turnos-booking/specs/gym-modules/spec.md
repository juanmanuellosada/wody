## ADDED Requirements

### Requirement: Flags de módulo en Gym

El sistema SHALL exponer dos campos booleanos en `Gym`: `bookingEnabled`, con default `false`, y `trainingEnabled`, con default `true`. Todo gym existente al momento de la migración SHALL quedar con `bookingEnabled = false` y `trainingEnabled = true`, sin cambio de comportamiento observable.

#### Scenario: Un gym existente conserva su comportamiento tras la migración

- **WHEN** se aplica la migración que agrega `bookingEnabled` y `trainingEnabled`
- **AND** el gym ya existía antes de la migración
- **THEN** el gym queda con `bookingEnabled = false` y `trainingEnabled = true`
- **AND** ninguna sección visible por el gym cambia respecto a antes de la migración

#### Scenario: Un gym nuevo nace con los defaults

- **WHEN** se crea un gym sin especificar los flags de módulo
- **THEN** el gym queda con `bookingEnabled = false` y `trainingEnabled = true`

### Requirement: `bookingEnabled` controla la sección Turnos

El sistema SHALL mostrar el enlace de navegación a Turnos y SHALL permitir el acceso a las páginas de Turnos únicamente cuando `Gym.bookingEnabled = true`.

#### Scenario: Turnos visible con el flag activo

- **WHEN** un usuario de un gym con `bookingEnabled = true` ve la navegación
- **THEN** aparece el enlace a Turnos

#### Scenario: Turnos oculto con el flag apagado

- **WHEN** un usuario de un gym con `bookingEnabled = false` ve la navegación
- **THEN** no aparece el enlace a Turnos

#### Scenario: Acceso directo a Turnos con el módulo apagado se rechaza

- **WHEN** un usuario de un gym con `bookingEnabled = false` navega directamente por URL a una página de Turnos
- **THEN** el sistema rechaza el acceso y no renderiza contenido de Turnos, en vez de solo ocultar el enlace del menú

### Requirement: `trainingEnabled` controla WODs, RMs y rutinas

El sistema SHALL ocultar la navegación y SHALL rechazar el acceso a las páginas de WODs, RMs y rutinas cuando `Gym.trainingEnabled = false`.

#### Scenario: Entrenamiento oculto con el flag apagado

- **WHEN** un usuario de un gym con `trainingEnabled = false` ve la navegación
- **THEN** no aparecen los enlaces de WODs/rutinas ni de RMs

#### Scenario: Acceso directo a una página de entrenamiento con el módulo apagado se rechaza

- **WHEN** un usuario de un gym con `trainingEnabled = false` navega directamente por URL a una página de WODs, RMs o rutinas
- **THEN** el sistema rechaza el acceso y no renderiza ese contenido

#### Scenario: Entrenamiento visible por default

- **WHEN** un usuario de un gym con `trainingEnabled = true` ve la navegación
- **THEN** aparecen los enlaces de WODs/rutinas y de RMs, igual que antes de este cambio

### Requirement: El guard de página revalida el flag contra la base de datos

Cada página gateada por `bookingEnabled` o `trainingEnabled` SHALL releer el valor vigente del flag desde la base de datos en cada request, y NO SHALL confiar en el valor propagado por el token de sesión.

#### Scenario: Un flag apagado a mitad de sesión corta el acceso en el siguiente request

- **WHEN** un usuario tiene una sesión activa con `bookingEnabled = true` reflejado en su token
- **AND** un super-admin apaga `bookingEnabled` para ese gym mientras la sesión sigue activa
- **THEN** el siguiente request del usuario a una página de Turnos es rechazado, sin esperar a que el token expire

### Requirement: Los flags de módulo no alteran el billing

El sistema NO SHALL introducir planes, tiers, ni variar `subscriptionMonthlyAmount` ni el monto cobrado por Mercado Pago en función de `bookingEnabled` o `trainingEnabled`. El monto de suscripción SHALL ser el mismo para todos los gyms, con independencia de qué módulos tengan activados.

#### Scenario: Activar Turnos no cambia el monto de suscripción del gym

- **WHEN** un super-admin activa `bookingEnabled = true` para un gym
- **THEN** `Gym.subscriptionMonthlyAmount` no cambia
- **AND** no se recrea ni se modifica el preapproval de Mercado Pago del gym

#### Scenario: Dos gyms con distinta combinación de módulos pagan lo mismo

- **WHEN** un gym tiene `bookingEnabled = true, trainingEnabled = true` y otro gym tiene `bookingEnabled = false, trainingEnabled = true`
- **THEN** ambos gyms tienen el mismo monto de suscripción, sin diferencia atribuible a los módulos activados

### Requirement: `GymKind` no se modifica

El sistema NO SHALL introducir un nuevo valor de `GymKind`. Los valores válidos SHALL seguir siendo `GYM`, `BOX` y `PERSONAL`. La rama de navegación para `isPersonalGym` NO SHALL alterarse por la introducción de los flags de módulo.

#### Scenario: Un gym PERSONAL no se ve afectado por los flags de módulo

- **WHEN** un usuario de un gym `kind = PERSONAL` ve su navegación
- **THEN** el menú se arma igual que antes de este cambio, sin depender de `bookingEnabled` ni `trainingEnabled`

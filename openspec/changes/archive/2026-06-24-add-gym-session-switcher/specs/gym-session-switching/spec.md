## ADDED Requirements

### Requirement: Listado de gyms del alumno en el banner

El sistema SHALL mostrar en el banner (`Navbar`), para un usuario con `role = STUDENT`, los gyms en los que su email tiene una cuenta activa (fila `User` con el mismo `email`, `deletedAt = null`, `role = STUDENT`). El switcher SHALL renderizarse únicamente cuando haya 2 o más gyms para ese email. La lista de gyms SHALL resolverse en el servidor (layout), no en el cliente.

#### Scenario: Alumno en un solo gym

- **WHEN** un alumno cuyo email existe solo en un gym carga cualquier página de su gym
- **THEN** el banner no muestra el switcher de gyms (se ve igual que hoy)

#### Scenario: Alumno en dos o más gyms

- **WHEN** un alumno cuyo email tiene cuenta activa `STUDENT` en 2+ gyms carga una página
- **THEN** el banner muestra el switcher con un ítem por cada gym, incluido el actual

#### Scenario: Cuentas borradas no aparecen

- **WHEN** una de las cuentas del email tiene `deletedAt` distinto de null
- **THEN** ese gym no aparece en el switcher

#### Scenario: El switcher solo aplica a STUDENT

- **WHEN** el usuario logueado tiene `role` ADMIN, TEACHER o ACCESS
- **THEN** el banner no muestra el switcher de gyms, aunque el email exista en varios gyms

### Requirement: Switch instantáneo de sesión gated por email verificado

El sistema SHALL permitir que un alumno cambie su sesión a otro gym sin reingresar contraseña al tocar el logo de ese gym, **solo si** el email de la sesión actual tiene `emailVerifiedAt`. El switch SHALL re-firmar la sesión (JWT) para el `User` del gym destino y SHALL setear la nueva cookie de sesión antes de redirigir al `gymSlug` destino, de modo que el guard cross-gym del proxy no expulse. La verificación de seguridad (sesión actual válida, email verificado, mismo email que la cuenta destino) SHALL aplicarse del lado del servidor en el flujo de autenticación, no solo en la UI.

#### Scenario: Switch directo con email verificado

- **WHEN** un alumno con email verificado toca el logo de otro gym donde tiene cuenta activa
- **THEN** el sistema re-firma su sesión para la cuenta de ese gym y lo redirige a la home de ese gym, ya logueado, sin pedir contraseña

#### Scenario: Tocar el gym actual no hace nada

- **WHEN** el alumno toca el logo del gym en el que ya tiene la sesión activa
- **THEN** no ocurre ningún cambio de sesión ni navegación de switch

#### Scenario: Email no verificado cae al login

- **WHEN** un alumno cuya sesión actual NO tiene `emailVerifiedAt` toca el logo de otro gym
- **THEN** el sistema lo lleva al login de ese gym con el email precargado, sin hacer switch directo

#### Scenario: Bypass directo del endpoint sin sesión verificada

- **WHEN** se invoca el flujo de switch directamente sin una sesión actual válida y verificada del mismo email
- **THEN** el sistema rechaza el switch y no emite una sesión para la cuenta destino

#### Scenario: La cuenta destino no existe o está borrada

- **WHEN** se solicita switch a un gym donde el email no tiene cuenta activa `STUDENT`
- **THEN** el sistema no realiza el switch y no emite una sesión para ese gym

### Requirement: Logos de los gyms en el switcher

El sistema SHALL mostrar en cada ítem del switcher el logo del gym tomado de `Gym.logo` (DB). Cuando `Gym.logo` sea null, el sistema SHALL mostrar un fallback con la inicial o el nombre del gym. El logo principal del gym actual en el banner SHALL seguir resolviéndose por el mapa estático existente (sin cambios).

#### Scenario: Gym con logo en DB

- **WHEN** un gym del switcher tiene `Gym.logo` no nulo
- **THEN** el switcher muestra ese logo para ese gym

#### Scenario: Gym sin logo

- **WHEN** un gym del switcher tiene `Gym.logo` nulo
- **THEN** el switcher muestra un fallback con la inicial o el nombre del gym

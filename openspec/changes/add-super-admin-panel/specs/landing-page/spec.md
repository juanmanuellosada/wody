## ADDED Requirements

### Requirement: Landing pública lista gyms desde la base de datos

El sistema SHALL renderizar la landing pública (`/`) leyendo la lista de gyms desde la base de datos en lugar de un array hardcodeado. La query SHALL filtrar por `blockedAt = null` y ordenar por `createdAt` ascendente. Cada item de la lista SHALL renderizar usando `Gym.name`, `Gym.slug`, `Gym.logo` (URL completa o path absoluto) y `Gym.primaryColor`.

#### Scenario: Landing muestra los gyms activos

- **GIVEN** la tabla `Gym` con tres filas: A (`blockedAt = null`), B (`blockedAt = null`), C (`blockedAt = "2026-01-01"`)
- **WHEN** un usuario sin sesión navega a `/`
- **THEN** la landing muestra A y B en ese orden (por `createdAt` ascendente)
- **AND** no muestra C

#### Scenario: Gym creado desde el panel aparece sin redeploy

- **GIVEN** una landing renderizada (cache o no, según estrategia de fetch del framework)
- **WHEN** el super admin crea un nuevo gym `N` desde el panel
- **THEN** una request siguiente a `/` muestra `N` en la lista
- **AND** no hace falta hacer redeploy ni rebuild para reflejarlo

#### Scenario: Landing tolera `logo` apuntando a `/public` o a URL externa

- **GIVEN** un gym A con `logo = "/logos/unidos-garage.png"` (path local servido desde `/public`) y un gym B con `logo = "https://blob.vercel-storage.com/logos/nuevo-gym-abc123.png"`
- **WHEN** se renderiza la landing
- **THEN** ambos logos cargan correctamente sin lógica condicional adicional en el componente

### Requirement: Redirect de sesión activa en landing

El sistema SHALL preservar el comportamiento actual de la landing: un usuario con sesión activa SHALL ser redirigido al dashboard correspondiente a su rol y gym. Los usuarios con `role === 'SUPERADMIN'` SHALL ser redirigidos a `/admin`.

#### Scenario: Usuario ADMIN logueado entra a `/`

- **GIVEN** una sesión con `role = ADMIN`, `gymSlug = "unidos-garage"`
- **WHEN** el usuario navega a `/`
- **THEN** el sistema redirige a `/unidos-garage/admin`

#### Scenario: Usuario SUPERADMIN logueado entra a `/`

- **GIVEN** una sesión con `role = SUPERADMIN`, `gymId = null`
- **WHEN** el usuario navega a `/`
- **THEN** el sistema redirige a `/admin`

#### Scenario: Usuario sin sesión entra a `/`

- **GIVEN** ninguna sesión activa
- **WHEN** un visitante navega a `/`
- **THEN** el sistema renderiza la landing pública con la lista de gyms

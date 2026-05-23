## ADDED Requirements

### Requirement: Panel `/admin` accesible solo a usuarios con rol SUPERADMIN

El sistema SHALL exponer un panel en la ruta `/admin` (fuera del segmento `[gymSlug]`) cuyo acceso esté restringido a usuarios autenticados con `role === 'SUPERADMIN'`. Cualquier usuario sin sesión, o con sesión cuyo `role` sea distinto de `SUPERADMIN`, SHALL ser redirigido fuera del panel sin ver su contenido.

#### Scenario: Usuario no autenticado intenta acceder

- **GIVEN** una request a `/admin` sin sesión activa
- **WHEN** el layout del panel se ejecuta
- **THEN** el sistema redirige a `/` (landing pública)
- **AND** el contenido del panel no se renderiza en ningún momento

#### Scenario: Usuario con rol distinto de SUPERADMIN

- **GIVEN** una sesión con `role` igual a `ADMIN`, `TEACHER`, `STUDENT` o `ACCESS`
- **WHEN** el usuario navega a `/admin` o a cualquier sub-ruta `/admin/*`
- **THEN** el sistema redirige al dashboard de su rol dentro de su gym (mismo destino que el flujo de login)
- **AND** no se filtra información del panel en el HTML servido

#### Scenario: Usuario SUPERADMIN accede

- **GIVEN** una sesión con `role === 'SUPERADMIN'`
- **WHEN** el usuario navega a `/admin`
- **THEN** el sistema renderiza el layout del panel con navegación a las secciones de cupones, gimnasios y whitelist
- **AND** la sesión propaga `gymId === null` sin que el layout lo trate como error

### Requirement: Login de SUPERADMIN ignora `gymSlug`

El sistema SHALL aceptar el login de un usuario con `role === 'SUPERADMIN'` aunque la request de credenciales no incluya `gymSlug`, o incluya uno arbitrario. Después del login exitoso, el sistema SHALL redirigir al super admin a `/admin`.

#### Scenario: SUPERADMIN se loguea sin gymSlug

- **GIVEN** un usuario `U` con `role = SUPERADMIN`, `gymId = null`, password correcta
- **WHEN** `U` envía credenciales (email + password) sin `gymSlug`
- **THEN** el sistema autentica a `U`
- **AND** la sesión queda con `gymId: null`, `gymSlug: null`, `role: 'SUPERADMIN'`
- **AND** el redirect post-login apunta a `/admin`

#### Scenario: SUPERADMIN se loguea con un gymSlug arbitrario

- **GIVEN** el mismo usuario `U`
- **WHEN** `U` envía credenciales con `gymSlug = "unidos-garage"` (un gym real al que no pertenece)
- **THEN** el sistema autentica a `U` igualmente
- **AND** la sesión NO mete `gymId` ni `gymSlug` del gym pasado en la request
- **AND** el redirect post-login apunta a `/admin`

### Requirement: Vista de próximos cobros de suscripción

El panel SHALL exponer una vista que liste todos los gyms con `blockedAt === null`, ordenados por `subscriptionNextPaymentDate` ascendente (nulls al final), mostrando para cada uno: nombre, slug, `subscriptionNextPaymentDate`, `subscriptionMonthlyAmount`, y un indicador visual cuando `subscriptionNextPaymentDate` ya pasó.

#### Scenario: Vista con gyms en distintos estados

- **GIVEN** tres gyms: A con `subscriptionNextPaymentDate` ayer, B con fecha en 3 días, C con `subscriptionNextPaymentDate = null`
- **WHEN** el super admin abre la vista de suscripciones
- **THEN** el orden de la lista es A, B, C
- **AND** A se marca como "vencido" en la UI
- **AND** C aparece sin fecha y sin indicador

#### Scenario: Gym bloqueado no aparece en la vista

- **GIVEN** un gym `D` con `blockedAt` distinto de null
- **WHEN** el super admin abre la vista de suscripciones
- **THEN** `D` no figura en la lista

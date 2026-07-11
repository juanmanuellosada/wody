## ADDED Requirements

### Requirement: Sección Productos restringida a admins designados

El sistema SHALL exponer la sección `/[gymSlug]/productos` (ABM de productos y categorías) ÚNICAMENTE a usuarios `ADMIN` con `canViewRevenue = true`, evaluado fresco server-side. Cualquier otro usuario SHALL ser redirigido. No SHALL estar disponible en gyms `kind = PERSONAL`.

#### Scenario: Un designado accede a Productos

- **WHEN** un `ADMIN` con `canViewRevenue = true` navega a `/[gymSlug]/productos`
- **THEN** ve la gestión de productos y categorías

#### Scenario: Un no designado es redirigido

- **WHEN** un `ADMIN` con `canViewRevenue = false`, un `TEACHER`, un `STUDENT` o un `ACCESS` navega a `/[gymSlug]/productos`
- **THEN** es redirigido y no ve la sección

### Requirement: Estructura de un producto

El sistema SHALL modelar un producto con: un **código** (entero, único por gym entre no borrados), una **descripción**, una **categoría** (obligatoria), un **precio de venta** (decimal ≥ 0) y un **stock** (entero). Cada producto SHALL pertenecer a un gym (`gymId`).

#### Scenario: Crear un producto con sus datos

- **WHEN** un designado crea un producto con descripción, categoría, precio de venta y stock
- **THEN** el sistema persiste el producto con esos datos y un código asignado, asociado al gym

#### Scenario: Editar un producto

- **WHEN** un designado edita la descripción, categoría, precio o stock de un producto
- **THEN** los cambios se guardan y no alteran las ventas ya registradas de ese producto

### Requirement: Código de producto autogenerable por gym

El sistema SHALL poder generar automáticamente el código de un producto como un contador autoincremental por gym (`Gym.nextProductCode`), y SHALL permitir que el usuario lo ingrese manualmente. Un código SHALL ser único por gym; un código manual duplicado SHALL rechazarse con error explícito.

#### Scenario: Código autogenerado

- **WHEN** un designado crea un producto sin indicar código
- **THEN** el sistema asigna el próximo código disponible del gym y avanza el contador

#### Scenario: Código manual duplicado

- **WHEN** un designado crea o edita un producto con un código que ya usa otro producto activo del mismo gym
- **THEN** el sistema rechaza la operación con un error claro

### Requirement: Categorías de producto

El sistema SHALL permitir a los designados crear categorías de producto, únicas por nombre dentro del gym. El sistema SHALL impedir eliminar una categoría que tenga productos activos asociados.

#### Scenario: Crear una categoría

- **WHEN** un designado crea una categoría con un nombre no usado en el gym
- **THEN** la categoría queda disponible para asignar a productos

#### Scenario: No se puede borrar una categoría en uso

- **WHEN** un designado intenta eliminar una categoría que tiene productos activos
- **THEN** el sistema rechaza la baja con un error explícito

### Requirement: Lectura del catálogo para registrar ventas

El sistema SHALL permitir que cualquier usuario con acceso a Caja (`ADMIN` o `TEACHER`) lea el catálogo de productos del gym para poder registrar ventas, aunque no tenga permiso de gestión. La gestión (crear/editar/eliminar productos y categorías) SHALL quedar restringida a designados.

#### Scenario: Un teacher lee el catálogo al vender

- **WHEN** un `TEACHER` abre el flujo "Nueva venta"
- **THEN** puede buscar y seleccionar productos del catálogo del gym, sin poder crearlos ni editarlos

### Requirement: Aislamiento multi-tenant del catálogo

Toda consulta, creación, edición o eliminación de productos y categorías SHALL filtrarse por `gymId`. Un usuario NO SHALL acceder ni modificar productos o categorías de un gym al que no pertenece.

#### Scenario: No se accede al catálogo de otro gym

- **WHEN** un usuario opera sobre un producto o categoría cuyo `gymId` no coincide con el suyo
- **THEN** el sistema rechaza la operación

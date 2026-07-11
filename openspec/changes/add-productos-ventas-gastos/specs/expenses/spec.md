## ADDED Requirements

### Requirement: Registrar un gasto restringido a admins designados

El sistema SHALL permitir registrar un gasto del gym ÚNICAMENTE a usuarios `ADMIN` con `canViewRevenue = true` (evaluado fresco server-side). Un gasto SHALL indicar un **importe** (decimal > 0) y una **descripción**, y SHALL registrar la **fecha** (default hoy, editable, sin fechas futuras) y el usuario que lo cargó.

#### Scenario: Un designado registra un gasto

- **WHEN** un `ADMIN` con `canViewRevenue = true` confirma un gasto con importe y descripción
- **THEN** el sistema crea el gasto con importe, descripción, fecha y usuario, asociado al gym

#### Scenario: Un no designado no puede registrar gastos

- **WHEN** un `TEACHER`, un `ADMIN` con `canViewRevenue = false`, un `STUDENT` o un `ACCESS` intenta registrar un gasto
- **THEN** el sistema rechaza la operación

#### Scenario: No se aceptan fechas futuras ni importes no positivos

- **WHEN** se intenta registrar un gasto con fecha futura o importe ≤ 0
- **THEN** el sistema rechaza la operación

### Requirement: Los gastos impactan el resultado neto

El importe de los gastos del período SHALL restarse en la vista "Mixta" de la recaudación para calcular el resultado neto `(cuotas + ventas) − gastos`.

#### Scenario: El gasto baja el resultado neto

- **WHEN** se registra un gasto dentro de un período
- **THEN** el resultado neto de la vista "Mixta" de ese período disminuye en el importe del gasto

### Requirement: Corrección y eliminación de gastos

El sistema SHALL permitir que un `ADMIN` con `canViewRevenue = true` edite o elimine un gasto de su gym. Cualquier otro usuario NO SHALL poder hacerlo.

#### Scenario: Un designado corrige o elimina un gasto

- **WHEN** un `ADMIN` con `canViewRevenue = true` edita el importe/descripción o elimina un gasto de su gym
- **THEN** el sistema aplica el cambio y la vista Mixta lo refleja

#### Scenario: Un no designado no puede corregir ni eliminar gastos

- **WHEN** un usuario sin `canViewRevenue` intenta editar o eliminar un gasto
- **THEN** el sistema rechaza la operación

### Requirement: Aislamiento multi-tenant de gastos

Toda consulta, creación, edición o eliminación de un gasto SHALL filtrarse por `gymId`. Un usuario NO SHALL acceder ni modificar gastos de un gym al que no pertenece.

#### Scenario: No se accede a gastos de otro gym

- **WHEN** un usuario intenta operar sobre un gasto cuyo `gymId` no coincide con el suyo
- **THEN** el sistema rechaza la operación

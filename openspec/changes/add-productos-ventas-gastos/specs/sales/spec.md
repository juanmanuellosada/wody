## ADDED Requirements

### Requirement: Registrar una venta

El sistema SHALL permitir a usuarios `ADMIN` y `TEACHER` con acceso a Caja registrar una venta de un producto del mismo gym. Una venta SHALL indicar: el **producto**, una **cantidad** (entero ≥ 1, default 1), un **importe unitario** (decimal ≥ 0, pre-llenado con el precio de venta del producto pero editable), un **método de pago** (obligatorio, del enum `PaymentMethod`) y una **fecha de la venta** (default hoy, sin fechas futuras). El sistema SHALL persistir el **importe total** (cantidad × importe unitario) como snapshot y el usuario que la registró.

#### Scenario: Registrar una venta con sus datos

- **WHEN** un `ADMIN` o `TEACHER` confirma una venta con producto, cantidad, importe unitario, método de pago y fecha válida
- **THEN** el sistema crea la venta con el importe total calculado, el método, la fecha y el usuario que la registró, asociada al gym

#### Scenario: El importe unitario se pre-llena y es editable

- **WHEN** el usuario elige un producto en "Nueva venta"
- **THEN** el importe unitario se pre-llena con el precio de venta del producto y el usuario PUEDE modificarlo antes de confirmar

#### Scenario: No se aceptan fechas futuras

- **WHEN** el usuario intenta registrar una venta con fecha posterior a hoy
- **THEN** el sistema rechaza la operación

### Requirement: La venta descuenta stock con aviso, sin bloquear

Al registrar una venta, el sistema SHALL descontar del `stock` del producto la cantidad vendida, dentro de la misma transacción que crea la venta. El sistema NO SHALL bloquear la venta por falta de stock (el stock PUEDE quedar en cero o negativo). La UI SHALL avisar cuando la venta deje el stock en cero o negativo.

#### Scenario: Venta descuenta stock

- **WHEN** se registra una venta de cantidad N de un producto con stock S
- **THEN** el stock del producto queda en S − N

#### Scenario: Venta sin stock suficiente no se bloquea

- **WHEN** se registra una venta de cantidad N mayor que el stock disponible
- **THEN** el sistema registra la venta igual, deja el stock negativo, y la UI muestra un aviso no bloqueante

### Requirement: La venta impacta la recaudación de productos

El importe total de las ventas del período SHALL contarse en la vista "Productos" de la recaudación y como parte de los ingresos en la vista "Mixta". Editar el producto luego de la venta NO SHALL alterar el importe de ventas ya registradas.

#### Scenario: La venta suma a la recaudación de productos

- **WHEN** se registra una venta dentro de un período
- **THEN** su importe total suma en la vista "Productos" y en los ingresos de la vista "Mixta" de ese período

### Requirement: Corrección y eliminación de ventas

El sistema SHALL permitir que un `ADMIN` edite o elimine una venta. Un `TEACHER` NO SHALL poder editar ni eliminar ventas. La operación SHALL filtrarse por `gymId`.

#### Scenario: Un ADMIN corrige o elimina una venta

- **WHEN** un `ADMIN` edita el importe/cantidad o elimina una venta de su gym
- **THEN** el sistema aplica el cambio y la recaudación de productos y la vista Mixta lo reflejan

#### Scenario: Un TEACHER no puede corregir ni eliminar ventas

- **WHEN** un `TEACHER` intenta editar o eliminar una venta
- **THEN** el sistema rechaza la operación

### Requirement: Aislamiento multi-tenant de ventas

Toda consulta, creación, edición o eliminación de una venta SHALL filtrarse por `gymId`. Un usuario NO SHALL registrar ni acceder a ventas de un gym al que no pertenece, ni vender productos de otro gym.

#### Scenario: No se vende un producto de otro gym

- **WHEN** un usuario intenta registrar una venta de un producto cuyo `gymId` no coincide con el suyo
- **THEN** el sistema rechaza la operación

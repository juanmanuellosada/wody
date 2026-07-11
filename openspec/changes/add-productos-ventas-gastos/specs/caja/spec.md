## ADDED Requirements

### Requirement: Vistas de recaudación (Alumnos / Productos / Mixta)

El panel de recaudación de Caja SHALL ofrecer un selector de vista con tres opciones, todas detrás del mismo gate `canViewRevenue`: **Alumnos** (recaudación de cuotas, comportamiento actual), **Productos** (recaudación por ventas de productos) y **Mixta** (resultado neto del período). La vista **Mixta** SHALL mostrar los ingresos por cuotas, los ingresos por ventas, los gastos, y el **resultado = (cuotas + ventas) − gastos**. La vista por defecto SHALL ser **Alumnos**.

#### Scenario: Cambiar entre vistas

- **WHEN** un `ADMIN` con `canViewRevenue` selecciona la vista "Productos"
- **THEN** el panel muestra la recaudación proveniente de ventas de productos del período
- **WHEN** selecciona la vista "Mixta"
- **THEN** el panel muestra el desglose de ingresos (cuotas + ventas), gastos, y el resultado neto del período

#### Scenario: Las vistas respetan el gate de recaudación

- **WHEN** un `TEACHER` o un `ADMIN` sin `canViewRevenue` abre Caja
- **THEN** no ve el selector de vistas ni ninguna de las tres vistas de recaudación

#### Scenario: La vista Alumnos conserva el comportamiento actual

- **WHEN** un `ADMIN` con `canViewRevenue` abre Caja sin elegir vista
- **THEN** ve la vista "Alumnos" (cuotas) con sus filtros de período, profesor, método y tipo de alumno

### Requirement: Nueva venta disponible para todos los profes en Caja

El sistema SHALL ofrecer el flujo "Nueva venta" dentro de `/[gymSlug]/caja` a todos los usuarios `ADMIN` y `TEACHER`, con independencia de `canViewRevenue`.

#### Scenario: Un profe sin permiso de recaudación registra una venta

- **WHEN** un `TEACHER` (o un `ADMIN` con `canViewRevenue = false`) abre Caja
- **THEN** ve y puede usar el botón "Nueva venta"

### Requirement: Registrar gasto restringido a admins designados en Caja

El sistema SHALL ofrecer el flujo "Registrar gasto" dentro de `/[gymSlug]/caja` ÚNICAMENTE a usuarios `ADMIN` con `canViewRevenue = true` (evaluado fresco server-side). Para el resto NO SHALL mostrarse el botón.

#### Scenario: Un designado ve Registrar gasto

- **WHEN** un `ADMIN` con `canViewRevenue = true` abre Caja
- **THEN** ve el botón "Registrar gasto"

#### Scenario: Un no designado no ve Registrar gasto

- **WHEN** un `TEACHER` o un `ADMIN` con `canViewRevenue = false` abre Caja
- **THEN** no ve el botón "Registrar gasto"

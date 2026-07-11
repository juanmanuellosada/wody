# caja Specification

## Purpose
TBD - created by archiving change add-caja-section. Update Purpose after archive.
## Requirements
### Requirement: Acceso a la sección Caja

El sistema SHALL exponer la sección `/[gymSlug]/caja` únicamente a usuarios con `role` `ADMIN` o `TEACHER` del gym. Un `STUDENT` o `ACCESS` SHALL ser redirigido fuera de la sección. En un gym `kind = PERSONAL` la sección NO SHALL estar disponible.

#### Scenario: Un ADMIN o TEACHER entra a Caja

- **WHEN** un usuario con `role` `ADMIN` o `TEACHER` navega a `/[gymSlug]/caja`
- **THEN** el sistema muestra la sección Caja

#### Scenario: Un STUDENT o ACCESS es redirigido

- **WHEN** un usuario con `role` `STUDENT` o `ACCESS` navega a `/[gymSlug]/caja`
- **THEN** el sistema lo redirige fuera de la sección (a `/login` o su dashboard) y no renderiza contenido de Caja

#### Scenario: Gym PERSONAL no tiene Caja

- **WHEN** se navega a `/[gymSlug]/caja` en un gym `kind = PERSONAL`
- **THEN** el sistema redirige al dashboard correspondiente y no muestra la sección

### Requirement: Visibilidad de la recaudación y el historial condicionada a `canViewRevenue`

Dentro de `/[gymSlug]/caja`, el sistema SHALL mostrar la recaudación (montos y gráficos de evolución) y el historial de pagos ÚNICAMENTE a usuarios con `role = ADMIN` y `canViewRevenue = true`. Para cualquier otro usuario con acceso a Caja (otros `ADMIN` sin el permiso y todos los `TEACHER`), el sistema NO SHALL renderizar ni enviar al cliente esos datos. El gate SHALL evaluarse server-side leyendo el valor vigente de `canViewRevenue` del usuario.

#### Scenario: Admin designado ve la recaudación y el historial

- **WHEN** un `ADMIN` con `canViewRevenue = true` abre Caja
- **THEN** ve el panel de recaudación (recaudación total, cantidad de pagos, evolución mensual) y el historial de pagos

#### Scenario: Admin no designado no ve la recaudación ni el historial

- **WHEN** un `ADMIN` con `canViewRevenue = false` abre Caja
- **THEN** NO ve el panel de recaudación ni el historial de pagos, y esos datos no llegan al cliente

#### Scenario: Un TEACHER no ve la recaudación ni el historial

- **WHEN** un `TEACHER` abre Caja
- **THEN** NO ve el panel de recaudación ni el historial de pagos

### Requirement: Registrar pago disponible para todos los profes en Caja

El sistema SHALL ofrecer el flujo "Registrar pago" (botón prominente) dentro de `/[gymSlug]/caja` a todos los usuarios `ADMIN` y `TEACHER`, con independencia de `canViewRevenue`. El alcance de alumnos SHALL respetar el rol: un `TEACHER` solo puede registrar pagos de sus alumnos asignados.

#### Scenario: Un TEACHER sin permiso de recaudación registra un pago

- **WHEN** un `TEACHER` (o un `ADMIN` con `canViewRevenue = false`) abre Caja
- **THEN** ve y puede usar el botón "Registrar pago"

#### Scenario: El alcance del registro respeta el rol

- **WHEN** un `TEACHER` usa "Registrar pago" en Caja
- **THEN** solo puede seleccionar y registrar pagos de alumnos asignados a él

### Requirement: Filtro de recaudación por tipo de alumno

El panel de recaudación de Caja SHALL permitir filtrar los montos y gráficos por tipo de alumno (`StudentType`). Las opciones ofrecidas SHALL depender del `kind` del gym: `MUSCULACION_LIBRE` SHALL ofrecerse solo en gyms `kind = GYM`.

#### Scenario: Filtrar la recaudación por un tipo de alumno

- **WHEN** un `ADMIN` con `canViewRevenue` selecciona un tipo de alumno en el filtro
- **THEN** la recaudación total, la cantidad de pagos y el gráfico consideran únicamente los pagos de alumnos de ese `studentType`

#### Scenario: Las opciones de tipo se adaptan al gym

- **WHEN** el gym es `kind = BOX`
- **THEN** el filtro no ofrece `MUSCULACION_LIBRE`; en un gym `kind = GYM` sí lo ofrece

### Requirement: Navegación a Caja

El sistema SHALL exponer un enlace "Caja" hacia `/[gymSlug]/caja` en la navegación para usuarios `ADMIN` y `TEACHER`.

#### Scenario: El link Caja aparece para staff

- **WHEN** un `ADMIN` o `TEACHER` ve la navegación
- **THEN** aparece un enlace "Caja"; un `STUDENT` o `ACCESS` no lo ve


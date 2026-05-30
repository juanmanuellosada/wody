## ADDED Requirements

### Requirement: Modo EMOM

El sistema SHALL ofrecer un modo de cronómetro **EMOM** que ejecute un intervalo de duración configurable de forma repetida durante una cantidad de rondas configurable, señalando el cruce de cada intervalo.

El modo EMOM SHALL exponer dos parámetros de configuración: `intervalSeconds` (duración de cada intervalo, por defecto 60) y `rounds` (cantidad de intervalos a ejecutar). Cambiar `intervalSeconds` SHALL permitir variantes como E2MOM (120s) o E90s (90s) sin configuración adicional.

Durante la ejecución, el sistema SHALL mostrar la ronda actual y el total (ej. "Ronda 3/10") y el tiempo restante del intervalo en curso, y SHALL emitir una señal sonora/vibración al cruzar cada intervalo (`beepPhaseChange`) y al finalizar la última ronda (`beepComplete`).

#### Scenario: Configurar y ejecutar un EMOM estándar

- **WHEN** el usuario selecciona el modo EMOM, deja `intervalSeconds` en 60 y `rounds` en 10, y presiona Iniciar
- **THEN** tras el pre-conteo el sistema ejecuta 10 intervalos de 60 segundos consecutivos
- **AND** al inicio de cada nuevo intervalo emite la señal de cambio de fase y actualiza el contador de ronda
- **AND** al terminar el décimo intervalo entra en estado `complete` y emite la señal de finalización

#### Scenario: Variante E2MOM cambiando el intervalo

- **WHEN** el usuario configura `intervalSeconds` en 120 y `rounds` en 5
- **THEN** el sistema ejecuta 5 intervalos de 120 segundos cada uno sin requerir ninguna otra opción

### Requirement: Modo Custom por rondas

El sistema SHALL ofrecer un modo **Custom** en el que el cronómetro se define como una secuencia ordenada de rondas, donde cada ronda contiene un bloque de **trabajo** obligatorio y un bloque de **descanso** opcional.

Cada bloque de trabajo SHALL permitir configurar: la **dirección** de conteo (descendente hacia 00:00, o ascendente desde 00:00), la **duración**, y el **modo de avance** (automático al cumplir la duración, o manual mediante un control "Siguiente"). Un bloque de avance automático SHALL requerir una duración definida. Un bloque de conteo abierto (sin duración) SHALL permitirse únicamente con avance manual.

Cada bloque de descanso SHALL ser opcional por ronda y, cuando esté habilitado, SHALL tener su propia duración y contar de forma descendente con avance automático.

Durante la ejecución, el sistema SHALL recorrer los bloques en orden, mostrar la ronda y fase actuales, emitir la señal de cambio al pasar de un bloque al siguiente, y entrar en `complete` al finalizar el último bloque.

#### Scenario: Ronda con trabajo descendente y descanso

- **WHEN** una ronda se configura con trabajo de 40s descendente, avance automático, y descanso habilitado de 20s
- **THEN** al ejecutarla el sistema cuenta 40→0 en el trabajo, emite la señal de cambio, cuenta 20→0 en el descanso, y avanza a la ronda siguiente

#### Scenario: Ronda con conteo ascendente y avance manual

- **WHEN** una ronda se configura con trabajo ascendente, sin duración (conteo abierto) y avance manual
- **THEN** el sistema cuenta hacia arriba desde 00:00 sin límite y muestra un control "Siguiente"
- **AND** solo avanza a la ronda siguiente cuando el usuario activa "Siguiente"

#### Scenario: Validación de avance automático sin duración

- **WHEN** el usuario intenta configurar un bloque con avance automático y sin duración definida
- **THEN** el sistema no permite esa combinación (el avance automático exige una duración)

### Requirement: Configuración Custom por ronda base con overrides

El modo Custom SHALL permitir definir una **ronda base** cuya configuración se aplique a todas las rondas, y SHALL permitir **sobreescribir** la configuración de rondas individuales sin afectar a las demás.

La pantalla de configuración SHALL indicar visualmente qué rondas tienen una configuración propia (override) distinta de la base, y SHALL permitir editarlas y revertirlas a la base.

#### Scenario: Aplicar la ronda base a todas

- **WHEN** el usuario define una ronda base de 40s descendente con 20s de descanso y fija la cantidad de rondas en 8
- **THEN** las 8 rondas se ejecutan con esa configuración salvo las que tengan override

#### Scenario: Sobreescribir una ronda individual

- **WHEN** sobre una configuración base, el usuario edita la ronda 3 para que sea conteo ascendente libre con avance manual y sin descanso
- **THEN** las rondas 1, 2 y 4–8 conservan la configuración base
- **AND** únicamente la ronda 3 se ejecuta con conteo ascendente, avance manual y sin bloque de descanso

### Requirement: Reutilización del motor y feedback existentes

Los modos EMOM y Custom SHALL reutilizar la infraestructura de ejecución existente del cronómetro: el pre-conteo previo al inicio, el tick de actualización, y el sistema de señales de audio y vibración (tick de cuenta atrás, cambio de fase, inicio y finalización). La incorporación de estos modos SHALL preservar el comportamiento de los modos preexistentes (stopwatch, countdown, interval, tabata, amrap, fortime).

#### Scenario: Pre-conteo y sonidos en los modos nuevos

- **WHEN** el usuario inicia un timer en modo EMOM o Custom
- **THEN** el sistema ejecuta el mismo pre-conteo que los presets de entrenamiento existentes antes de arrancar
- **AND** emite las señales de inicio, cambio de fase y finalización mediante el sistema de sonidos existente

#### Scenario: Los modos existentes no cambian de comportamiento

- **WHEN** el usuario usa los modos interval o tabata tras la incorporación de EMOM y Custom
- **THEN** su configuración (trabajo, descanso, rondas), sus transiciones, su pre-conteo y sus sonidos se comportan igual que antes del cambio

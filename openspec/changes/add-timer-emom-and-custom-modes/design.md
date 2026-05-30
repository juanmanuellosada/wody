## Context

El cronómetro vive enteramente en `src/components/timers/TimersClient.tsx` (~620 líneas, un solo client component con `useState`). El motor actual modela los intervalos con un único `IntervalConfig = { workSeconds, restSeconds, rounds }` y un par de flags (`isWork`, `currentRound`, `phaseRemaining`). Esto asume que **todas las rondas son homogéneas** (mismo work, mismo rest, siempre cuenta regresiva, siempre auto-avance). Los modos `interval` y `tabata` se apoyan en este modelo.

Para soportar EMOM y un modo Custom donde cada ronda puede diferir, hay que generalizar el modelo de "una config homogénea" a "una **secuencia de bloques** que el motor recorre". El resto de la infraestructura (tick de 50ms con `setInterval`, pre-conteo `PREP_SECONDS = 10`, sonidos en `sounds.ts`, `TimerDisplay`) se reutiliza tal cual.

Restricciones: sin DB, sin server actions, sin dependencias nuevas. Preservar el comportamiento exacto de los 6 modos actuales.

## Goals / Non-Goals

**Goals:**
- Modo **EMOM** simple: `intervalSeconds` × `rounds`, beep al cruzar cada intervalo, display de ronda actual.
- Modo **Custom**: secuencia de rondas heterogéneas; por ronda → trabajo (dirección ↑/↓, duración, avance auto/manual) + descanso opcional (duración).
- UX Custom: ronda base aplicada a todas + override por ronda individual.
- Generalizar el motor a una **lista de bloques** sin romper interval/tabata/amrap/fortime/countdown/stopwatch.
- Reutilizar audio/vibración y pre-conteo existentes.

**Non-Goals:**
- Persistencia / presets guardados (efímero, como hoy).
- EMOM alternado o etiquetas de ejercicio por ronda (descartado en la fase de scoping).
- Integración con WODs.
- Cambios en `prisma/schema.prisma`, server actions o rutas server.
- Reescritura de los modos existentes más allá de lo necesario para compartir el motor de bloques.

## Decisions

### Decisión 1: Modelar la ejecución como una secuencia plana de "segmentos"

Introducir un tipo `TimerSegment` que es la unidad atómica que el motor ejecuta:

```ts
type CountDirection = "down" | "up";
type Advance = "auto" | "manual";

interface TimerSegment {
  kind: "work" | "rest";
  direction: CountDirection;   // "down" = MM:SS→00:00, "up" = 00:00→duración (o libre)
  durationSeconds: number | null; // null = conteo abierto (solo válido con advance "manual")
  advance: Advance;            // "auto" avanza al cumplir duración; "manual" espera tap
  round: number;               // 1-based, para el display "Ronda X/N"
  totalRounds: number;
  label: string;               // "Trabajo" | "Descanso" | "EMOM" etc.
}
```

El motor mantiene `segments: TimerSegment[]` + `segmentIndex`. Cada modo configurable se compila a una lista de segmentos vía una función pura `buildSegments(mode, config): TimerSegment[]`. El loop de tick solo conoce segmentos: decrementa/incrementa `phaseRemaining|phaseElapsed`, y al terminar un segmento (`auto` + duración cumplida, o tap en `manual`) avanza `segmentIndex` y dispara `beepPhaseChange()`. Al pasar el último segmento → `complete` + `beepComplete()`.

**Por qué:** unifica EMOM, Custom, interval y tabata bajo un mismo recorrido. interval/tabata se vuelven simplemente "compiladores a segmentos homogéneos", garantizando paridad de comportamiento. Evita ramas `if (mode === ...)` dispersas en el loop.

**Alternativa descartada:** mantener `IntervalConfig` y agregar arrays paralelos (`directions[]`, `advances[]`). Más estado desincronizable y más ramas en el tick. La lista de segmentos es una sola fuente de verdad.

### Decisión 2: EMOM se compila a N segmentos `work` idénticos

EMOM = `rounds` segmentos `{ kind: "work", direction: "down", durationSeconds: intervalSeconds, advance: "auto", label: "EMOM" }`. El "descanso" del EMOM es implícito (el atleta descansa dentro del propio intervalo tras terminar el trabajo), así que **no** se modela un segmento de rest. El beep de cruce de minuto cae naturalmente en la transición entre segmentos.

**Por qué:** es exactamente la semántica de EMOM y reusa el motor sin caso especial. Cambiar `intervalSeconds` cubre E2MOM/E90s sin UI extra.

### Decisión 3: Custom — modelo "base + overrides"

Estado de configuración:

```ts
interface CustomRoundConfig {
  work: { direction: CountDirection; durationSeconds: number | null; advance: Advance };
  rest: { enabled: boolean; durationSeconds: number };
}
interface CustomConfig {
  rounds: number;
  base: CustomRoundConfig;                 // plantilla aplicada a todas
  overrides: Record<number, Partial<CustomRoundConfig>>; // por índice de ronda (1-based)
}
```

`buildSegments("custom", cfg)` recorre `1..rounds`, resuelve cada ronda como `{ ...base, ...overrides[i] }`, y emite el segmento de trabajo + (si `rest.enabled`) el de descanso. El descanso siempre es `direction: "down"`, `advance: "auto"` (un descanso de conteo libre no tiene sentido práctico; se mantiene simple).

**Por qué:** cubre el pedido "todo personalizable por ronda" sin obligar a configurar N rondas a mano. La UI muestra la ronda base + una lista de rondas donde las que tienen override se marcan visualmente y son editables en un sub-panel.

### Decisión 4: Avance manual y conteo abierto

Cuando el segmento activo es `advance: "manual"`, el motor **no** auto-avanza: muestra un botón "Siguiente" y, si `durationSeconds` es `null` con `direction: "up"`, el display cuenta hacia arriba indefinidamente (For-Time por ronda). El tap llama a `nextSegment()`. Validación de UI: `durationSeconds: null` solo se permite con `advance: "manual"` (un auto-avance necesita una duración para saber cuándo cortar).

**Por qué:** habilita el caso "una ronda sube libre y avanzo a mano" que pidió el usuario, sin romper el auto-avance del resto.

### Decisión 5: Refactor incremental, no big-bang

Paso 1: introducir `TimerSegment` + `buildSegments` + un `runSegments()` interno, y migrar **solo** `interval` y `tabata` a ese motor, verificando paridad. Paso 2: agregar `emom`. Paso 3: agregar `custom` con su UI base+overrides. countdown/stopwatch/amrap/fortime pueden quedar en su rama actual o compilarse a 1 segmento — se decide en implementación según cuál sea más limpio, pero **no es requisito** tocarlos.

**Por qué:** minimiza el riesgo de regresión en los modos existentes; cada paso es verificable de forma aislada.

## Risks / Trade-offs

- **Regresión en interval/tabata al migrar al motor de segmentos** → Mitigación: migrarlos primero y comparar comportamiento (rondas, transiciones, sonidos, pre-conteo) contra el actual antes de agregar modos nuevos. Mantener `formatTime` y los disparos de sonido idénticos.
- **Complejidad de UI en Custom (base + overrides)** → Mitigación: arrancar con la ronda base funcionando end-to-end; los overrides por ronda son una capa encima que reusa los mismos controles. Si el tiempo aprieta, los overrides pueden entregarse como sub-iteración sin bloquear EMOM ni la ronda base.
- **Conteo abierto + tick de 50ms en background** → Mitigación: ya existe el patrón actual; el conteo ascendente libre no cambia el manejo de `setInterval`. No depender de precisión sub-segundo para audio (ya se usa `lastSoundSecRef`).
- **Estado creciente en un único componente** → Trade-off aceptado: se mantiene la arquitectura mono-componente actual (sin custom hooks ni context) para no expandir el scope; `buildSegments` se extrae como función pura para testear/razonar aparte.

## Migration Plan

No aplica migración de datos (sin DB). Despliegue normal por Vercel. Rollback = revertir el commit; al ser client-side puro y aditivo, no deja estado persistente.

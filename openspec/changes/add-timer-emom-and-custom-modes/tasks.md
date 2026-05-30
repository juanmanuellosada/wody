## 1. Motor de segmentos (refactor base)

- [x] 1.1 Definir los tipos `CountDirection`, `Advance`, `TimerSegment` (kind, direction, durationSeconds nullable, advance, round, totalRounds, label) en `src/components/timers/TimersClient.tsx` (o un archivo `timerTypes.ts` adyacente si queda más limpio).
- [x] 1.2 Implementar `buildSegments(mode, config): TimerSegment[]` como función pura, con soporte inicial para `interval` y `tabata` (segmentos homogéneos work/rest × rounds).
- [x] 1.3 Refactorizar el loop de ejecución para recorrer `segments[segmentIndex]` en lugar de `IntervalConfig` + flags `isWork`/`currentRound`/`phaseRemaining`, preservando tick de 50ms, pre-conteo de 10s y disparos de sonido (`beepTick`, `beepPhaseChange`, `beepGo`, `beepComplete`).
- [x] 1.4 Verificar paridad de comportamiento de `interval` y `tabata` (rondas, transiciones work→rest, pre-conteo, sonidos) contra el comportamiento previo al refactor.

## 2. Modo EMOM

- [x] 2.1 Agregar `"emom"` a `TimerMode` y al selector de modos de la pantalla inicial (sección presets de entrenamiento).
- [x] 2.2 Agregar estado de configuración EMOM (`emomIntervalSeconds` por defecto 60, `emomRounds`) y los inputs de configuración en el panel `idle` reutilizando `<TimeInput />`.
- [x] 2.3 Compilar EMOM a N segmentos `work` descendentes idénticos en `buildSegments` (sin segmento de descanso explícito).
- [x] 2.4 Mostrar ronda actual/total y restante del intervalo durante la ejecución; confirmar señal de cambio por intervalo y señal de finalización.

## 3. Modo Custom — ronda base

- [x] 3.1 Definir tipos `CustomRoundConfig` (work: {direction, durationSeconds nullable, advance}; rest: {enabled, durationSeconds}) y `CustomConfig` (rounds, base, overrides).
- [x] 3.2 Agregar `"custom"` a `TimerMode`, al selector, y el estado de configuración con una ronda base por defecto (ej. 40s↓ auto + 20s descanso) y `rounds`.
- [x] 3.3 Construir la UI de configuración de la ronda base: selector de dirección (↑/↓), input de duración, selector de avance (auto/manual), toggle de descanso + duración de descanso.
- [x] 3.4 Implementar la validación: avance `auto` exige duración; conteo abierto (`durationSeconds = null`) solo con avance `manual`.
- [x] 3.5 Compilar Custom a segmentos en `buildSegments` recorriendo `1..rounds` con `{ ...base, ...override }`, emitiendo segmento de trabajo + descanso (si habilitado).
- [x] 3.6 Soportar en el motor el avance manual (botón "Siguiente" → `nextSegment()`) y el conteo abierto ascendente sin límite.

## 4. Modo Custom — overrides por ronda

- [x] 4.1 Renderizar la lista de rondas (`1..rounds`) marcando visualmente las que tienen override distinto de la base.
- [x] 4.2 Permitir editar la configuración de una ronda individual (sub-panel que reutiliza los controles de la ronda base) y guardarla en `overrides[i]`.
- [x] 4.3 Permitir revertir una ronda a la configuración base (quitar su entrada de `overrides`).

## 5. Display y feedback

- [x] 5.1 Ajustar `TimerDisplay` / labels para reflejar ronda, fase (Trabajo/Descanso/EMOM) y dirección de conteo en los modos nuevos.
- [x] 5.2 Confirmar que audio y vibración (`sounds.ts`) funcionan en EMOM y Custom sin cambios en `sounds.ts`.

## 6. Verificación

- [ ] 6.1 Probar manualmente en `/[gymSlug]/dashboard/timers`: EMOM (60s×10 y E2MOM 120s×5), Custom ronda base, Custom con override de ronda ascendente/manual/sin descanso.
- [ ] 6.2 Regresión de los 6 modos preexistentes (stopwatch, countdown, interval, tabata, amrap, fortime).
- [x] 6.3 `npm run lint` y `npm run build` sin errores nuevos.

## Why

El cronómetro actual (`/[gymSlug]/dashboard/timers`) cubre formatos fijos (Tabata, AMRAP, For Time, intervalo simple), pero no soporta **EMOM** — uno de los formatos más usados en CrossFit y entrenamiento por intervalos — ni permite armar timers donde cada ronda se comporta distinto (dirección de conteo, descanso, avance manual). Los profes y alumnos hoy tienen que usar apps externas para esos casos.

## What Changes

- Agregar un modo **EMOM** ("Every Minute On the Minute"): intervalo configurable (ej. 60s → cubre E2MOM, E90s, etc.) × cantidad de rondas, con señal sonora/visual al cruzar cada intervalo.
- Agregar un modo **Custom** (personalizable total): el timer es una secuencia ordenada de rondas; cada ronda tiene un bloque de **trabajo** con dirección (cuenta ascendente o descendente), duración y modo de avance (**automático** al cumplir la duración, o **manual** vía tap para conteo abierto/libre), más un bloque de **descanso** opcional con su propia duración.
- UX de configuración del modo Custom basada en **ronda base + overrides**: se define una "ronda tipo" que se aplica a todas las N rondas, y luego se pueden editar rondas individuales para sobreescribir su configuración.
- Generalizar el motor de timing interno: de un `IntervalConfig` fijo (work/rest/rounds homogéneo) a una **secuencia de bloques heterogéneos**, reutilizando el tick de 50ms, el pre-conteo de 10s y el sistema de sonidos/vibración existente (`sounds.ts`).
- Los 6 modos actuales (stopwatch, countdown, interval, tabata, amrap, fortime) se mantienen sin cambios de comportamiento.

No se agregan modos breaking ni se elimina nada. Todo sigue siendo **efímero y client-side**: sin cambios de Prisma/DB, sin persistencia, sin server actions.

## Capabilities

### New Capabilities
- `workout-timers`: cronómetros de entrenamiento client-side en `/[gymSlug]/dashboard/timers` — modos disponibles, su configuración y comportamiento de ejecución (pre-conteo, transiciones de ronda/fase, avance automático vs. manual, señales de audio/visuales). Captura el comportamiento actual ya implementado más los modos EMOM y Custom nuevos.

### Modified Capabilities
<!-- Ninguna: no existe spec previa de timers en openspec/specs/. Se crea la capability nueva que documenta el estado actual + lo nuevo. -->

## Impact

- **Código**: `src/components/timers/TimersClient.tsx` (motor de estado y UI de configuración — refactor del modelo de intervalos a secuencia de bloques), `src/components/timers/TimerDisplay.tsx` (posible nuevo label/sublabel para ronda y dirección), `src/components/timers/sounds.ts` (reutilizado, sin cambios esperados).
- **Rutas**: `/[gymSlug]/dashboard/timers` (sin cambios en la page server; solo el client component).
- **DB / Prisma**: ninguno.
- **APIs / server actions**: ninguno.
- **Riesgo**: el refactor del motor de intervalos debe preservar el comportamiento exacto de los modos `interval` y `tabata` actuales (work/rest/rounds homogéneo).

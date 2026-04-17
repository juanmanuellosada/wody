# WODY — Remotion

Videos promocionales de WODY hechos con [Remotion](https://www.remotion.dev/).

## Requisitos

- Node.js 18+
- `npm install` en esta carpeta (instala los deps de Remotion sin tocar el Next.js)

## Scripts

- `npm run studio` — abre el editor interactivo en el navegador
- `npm run render` — renderiza `CuponeraPromo` a `out/cuponera.mp4`
- `npm run render:gif` — idem a GIF
- `npm run render:timers` — renderiza `TimersPromo` a `out/timers.mp4`
- `npm run render:timers:gif` — idem a GIF
- `npm run render:pagos` — renderiza `PagosPromo` a `out/pagos.mp4`
- `npm run render:pagos:gif` — idem a GIF

## Composiciones

### `CuponeraPromo`

Reel vertical de 20s (1080×1920, 30fps) para promocionar la cuponera.

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo WODY + "Beneficios" |
| Carousel | 90–360 | 9s | 7 comercios con su descuento |
| Código | 360–480 | 4s | Generación del código único |
| Validación | 480–540 | 2s | "Cupón válido" |
| CTA | 540–600 | 2s | "Ingresá a WODY · @wody.app" |

Los logos vienen de `public/logos/`. Si agregás/cambiás comercios, actualizá
`COMERCIOS` en `src/CuponeraPromo.tsx`.

### `TimersPromo`

Reel vertical de 30s (1080×1920, 30fps) mostrando los 6 modos de cronómetro.

| Escena | Frames | Duración | Modo |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo WODY + "Cronómetros" |
| Demo 1 | 90–210 | 4s | Stopwatch (cuenta progresiva) |
| Demo 2 | 210–330 | 4s | Countdown (cuenta regresiva) |
| Demo 3 | 330–450 | 4s | Intervalos (trabajo/descanso) |
| Demo 4 | 450–570 | 4s | TABATA (8 rondas 20/10) |
| Demo 5 | 570–690 | 4s | AMRAP |
| Demo 6 | 690–810 | 4s | FOR TIME (con cap) |
| CTA | 810–900 | 3s | "Todo el cronómetro que tu box necesita" |

Los números de cada demo se animan con `interpolate`; cambiá los valores en
`src/TimersPromo.tsx` si querés otros tiempos.

### `PagosPromo`

Reel vertical de 30s (1080×1920, 30fps) mostrando el control de pagos.

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo WODY + "Pagos" |
| Overview | 90–330 | 8s | "¿Quién debe?" + 4 tiles (Todos / Atrasados / Por vencer / Al día) con contadores animando |
| Filtro | 330–540 | 7s | Cursor tocando "Atrasados", tabla aparece con 3 filas rojas |
| Pago | 540–780 | 8s | Cursor sobre "Pagar", fila pasa a "Al día", counts se actualizan, flash verde |
| CTA | 780–900 | 4s | "Controlá los pagos de tu box · @wody.app" |

Los datos mockeados (nombres, fechas, counts) están hardcodeados en
`src/PagosPromo.tsx` — tocá ahí si querés otros números.

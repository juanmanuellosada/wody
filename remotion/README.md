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
- `npm run render:usuarios` — renderiza `UsuariosPromo` a `out/usuarios.mp4`
- `npm run render:usuarios:gif` — idem a GIF
- `npm run render:validar` — renderiza `ValidarPromo` a `out/validar.mp4`
- `npm run render:validar:gif` — idem a GIF
- `npm run render:logo` — renderiza `WodyLogoIntro` a `out/wody-logo.mp4`
- `npm run render:logo:gif` — idem a GIF

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

### `UsuariosPromo`

Reel vertical de 30s (1080×1920, 30fps) con **estética Rompiendo Limites**
(paleta verde `#7ed957` + negro) mostrando el alta de usuarios y asignación.

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo Rompiendo Limites + "Profes y alumnos · En 3 pasos" |
| Paso 01 | 90–330 | 8s | Crear profe: form autocompleta, rol = Profe, botón verde, ✓ |
| Paso 02 | 330–570 | 8s | Crear alumno: mismo form, rol = Alumno revela "Tipo", ✓ |
| Paso 03 | 570–810 | 8s | Asignar: dropdown alumno, chips de profes se marcan, botón verde, ✓ |
| CTA | 810–900 | 3s | Logo Rompiendo Limites + "Cada gym · su branding" + Powered by WODY + @wody.app |

Paleta verde definida arriba del archivo (`GREEN`, `GREEN_DIM`, `GREEN_BORDER`).
Para otros gyms con colores propios, duplicá la composición y cambiá esas 3
constantes.

### `ValidarPromo`

Reel vertical de 30s (1080×1920, 30fps) para mandarle a los comercios
aliados explicándoles cómo validar un cupón WODY.

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo WODY + "Validar un cupón · Para comercios aliados · En 3 pasos" |
| Paso 01 | 90–300 | 7s | Mockup de chat de Instagram: el alumno manda el código `WODY-XXXX-XXXX` y el link `wody.com.ar/validar/...` |
| Paso 02 | 300–480 | 6s | Mockup de browser con la URL tipeándose, se aprieta Enter, barra de carga roja |
| Paso 03 | 480–720 | 8s | Página de validación real con "✓ Cupón válido", logo Quinque, datos del alumno/gym/fechas |
| Warning | 720–810 | 3s | Mismo cupón tras reload → "Ya fue usado" con banner de alerta |
| CTA | 810–900 | 3s | "Aplicás el descuento · wody.com.ar/validar/EL-CODIGO · @wody.app" |

Look and feel espejado de `src/app/validar/[codigo]/page.tsx`. El código y los
datos de ejemplo (`WODY-8K4R-Z9P2`, Camila Torres, Rompiendo Limites, Quinque)
están hardcodeados arriba del archivo — tocá ahí para cambiarlos.

### `WodyLogoIntro`

Bumper / intro de logo de 8s (1080×1920, 30fps) que anima la "O" del wordmark
de WODY sobre fondo negro. Pensado para usar como intro o cierre en reels.

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Awakening | 0–30 | 1s | Negro absoluto. Desde el frame 10 aparece un punto de luz cream que pulsa y se expande |
| Spin reveal | 30–90 | 2s | La "O" standalone (`wody-negro-512.png`) entra con spring scale + 720° de rotación con ease-out; glow radial se expande; motion blur con 2 copias offset |
| Energy pulse | 90–150 | 2s | La "O" queda upright y pulsa en escala (1.0 ↔ 1.05) en seno, glow respira sincronizado |
| Logo lock-in | 150–180 | 1s | Crossfade: la "O" standalone hace fade out mientras `wody-texto.png` hace fade in alineado |
| Hold | 180–240 | 2s | Wordmark estático con glow suave respirando; últimos 10 frames bajan a ~85% de opacidad |

Assets usados: `public/logos/wody-negro-512.png` (la O standalone) y
`public/logos/wody-texto.png` (el wordmark completo). Si la "O" del wordmark no
queda perfectamente alineada con la O standalone, ajustá las constantes de
tamaño y posición en `src/WodyLogoIntro.tsx` abriendo Remotion Studio.

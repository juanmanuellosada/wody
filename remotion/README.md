# WODY — Remotion

Videos promocionales de WODY hechos con [Remotion](https://www.remotion.dev/).

## Requisitos

- Node.js 18+
- `npm install` en esta carpeta (instala los deps de Remotion sin tocar el Next.js)

## Scripts

- `npm run studio` — abre el editor interactivo en el navegador
- `npm run render` — renderiza `CuponeraPromo` a `out/cuponera.mp4`
- `npm run render:gif` — idem a GIF

## Composiciones

### `CuponeraPromo`

Reel vertical de 20s (1080×1920, 30fps) para promocionar la cuponera.

Estructura:

| Escena | Frames | Duración | Contenido |
|---|---|---|---|
| Intro | 0–90 | 3s | Logo WODY + "Beneficios" |
| Carousel | 90–360 | 9s | 7 comercios con su descuento |
| Código | 360–480 | 4s | Generación del código único |
| Validación | 480–540 | 2s | "Cupón válido" |
| CTA | 540–600 | 2s | "Ingresá a WODY · @wody.app" |

Los logos vienen de `public/logos/`. Si agregás/cambiás comercios, actualizá
`COMERCIOS` en `src/CuponeraPromo.tsx`.

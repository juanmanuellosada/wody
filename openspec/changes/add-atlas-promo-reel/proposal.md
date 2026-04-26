## Why

El subproyecto `remotion/` ya tiene cinco promos que venden **features del producto WODY** (CuponeraPromo, TimersPromo, PagosPromo, UsuariosPromo, ValidarPromo) pero no hay ninguna que **venda un gym puntual** usando su propia identidad visual. Atlas (`atlas-gym`) necesita un Reel vertical de 60s para Instagram que muestre cómo se ve y funciona su instalación — primer ejemplo de promo *tenant-flavored* que después puede replicarse para otros gyms cambiando paleta y copy.

## What Changes

- Nueva composition `AtlasPromo` en `remotion/src/AtlasPromo.tsx` (1080×1920 @ 30fps, 1800 frames = 60s).
- Registro de la composition en `remotion/src/Root.tsx` con `id: "AtlasPromo"`.
- Scripts `render:atlas` (mp4) y `render:atlas:gif` en `remotion/package.json`.
- Mockeo (no screen-recording) de seis pantallas reales de la app dentro del propio archivo de composition: panel admin, alta de profe, creación de WOD, vista del alumno, registro de RM, check-in con QR — más intro y CTA con wordmark Atlas.
- Reuso del patrón visual existente (`AbsoluteFill` + `BackgroundGlow` + `GrainOverlay` + `Sequence` anidadas + fonts via `@remotion/google-fonts`) tomando `UsuariosPromo.tsx` como referencia técnica.
- Paleta del archivo: brand rojo `#f80710` (de `prisma/seed-atlas-gym.ts`) sobre fondo dark `#0A0A0F`.

No hay cambios en la app principal, ni en `package.json` raíz, ni en el schema de Prisma.

## Capabilities

### New Capabilities
- `tenant-promo-videos`: composiciones de Remotion que promocionan un gym/box puntual (no el producto WODY) usando su brand del seed. Cubre dimensiones del Reel, escenas obligatorias, fidelidad visual respecto a la app real, fuentes y constraints de assets.

### Modified Capabilities
<!-- Ninguna: no se modifican capabilities existentes. -->

## Impact

- **Código nuevo**: `remotion/src/AtlasPromo.tsx`.
- **Código modificado**: `remotion/src/Root.tsx` (registro), `remotion/package.json` (scripts).
- **Dependencias**: ninguna nueva en raíz. En `remotion/` solo si se agrega `lucide-react` para íconos (decisión a tomar en `design.md`); el resto sale con lo que ya está instalado (`remotion`, `@remotion/google-fonts`).
- **Assets**: cero externos. Todo el "logo" Atlas se compone con tipografía Barlow Condensed black + glyphs vectoriales inline.
- **Audio**: fuera de alcance (silencio). Si después se quiere sumar música, va como cambio aparte.
- **CI/Deploy**: sin impacto. El render se dispara manualmente desde `remotion/`.
- **Sistemas afectados**: solo el subproyecto `remotion/` (regla `.claude/rules/remotion-subproject.md`: instalar y correr scripts dentro de `remotion/`, nunca en raíz).

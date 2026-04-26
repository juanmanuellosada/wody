## ADDED Requirements

### Requirement: Reel format and dimensions

Las composiciones tenant-flavored SHALL renderizar como video vertical 1080×1920 a 30 fps. La duración total SHALL ser exactamente 60 segundos (1800 frames) salvo que un cambio futuro modifique este requisito.

#### Scenario: AtlasPromo composition is registered with the correct format
- **WHEN** se inspecciona `remotion/src/Root.tsx`
- **THEN** existe una `<Composition id="AtlasPromo" ... />` con `width={1080}`, `height={1920}`, `fps={30}` y `durationInFrames={1800}`

#### Scenario: Render script outputs a 60s video
- **WHEN** se corre `npm run render:atlas` desde `remotion/`
- **THEN** el archivo generado en `remotion/out/atlas.mp4` dura 60 segundos

### Requirement: Brand sourced from gym seed and logo asset

La composition SHALL usar el `primaryColor` y el `name` del gym tomados de `prisma/seed-atlas-gym.ts` (`#f80710` y "Atlas"). El acento brand SHALL aparecer en al menos: glow de fondo, highlights de interacción y CTA final.

Si existe un archivo `src/logos/{slug}.png` para el gym, dicho logo SHALL copiarse a `remotion/public/logos/{slug}.png` y mostrarse en el intro y en el CTA usando `<Img src={staticFile("logos/{slug}.png")} />`. Para Atlas, el archivo es `atlas-gym.png`.

#### Scenario: Brand red appears as primary accent
- **WHEN** se inspecciona el código fuente de `remotion/src/AtlasPromo.tsx`
- **THEN** existe una constante con valor `#f80710` (o equivalente RGB) usada como acento principal

#### Scenario: Atlas logo is included in intro and CTA
- **WHEN** se reproduce el intro (frames 0–150) y el CTA (frames 1650–1800)
- **THEN** se ve el logo `atlas-gym.png` en ambos momentos, cargado via `staticFile`

#### Scenario: Logo asset lives in remotion/public/
- **WHEN** se inspecciona `remotion/public/logos/`
- **THEN** existe el archivo `atlas-gym.png` (copia del original en `src/logos/`)

### Requirement: Required scene structure (day-in-the-life narrative)

La composition SHALL contener, en orden y dentro de la duración total, las siguientes nueve escenas que reproducen un recorrido coherente de uso de la app en un día del gym:

1. **Intro** — wordmark/logo del gym + ubicación.
2. **Alta de usuario** — admin crea un usuario nuevo (alumno o profe) desde el formulario real (`UserForm`). El flow NO SHALL ser una "promoción" de alumno a profe; el rol se elige directamente en el alta.
3. **Crear rutina** — profe arma una rutina nueva con título + editor markdown (`WodManagerClient`).
4. **Vista alumno de la rutina** — `WodCard` mostrando la rutina del día con accent rojo y header "HOY — {fecha}".
5. **Cronómetros** — pantalla de selector + configuración + display de un timer (`TimersClient`).
6. **Beneficios** — grid de cupones (`BenefitsSection` + `CouponCard`) con foco en obtener un código.
7. **Ingresos** — `KioskView` con QR Y formulario de ingreso manual de código/socio (ManualLookup). Ambos modos SHALL aparecer.
8. **Pagos** — admin marca pagado vía `PayButton` con su diálogo de confirmación real.
9. **CTA** — wordmark/logo + handle de Instagram + ubicación.

Cada escena SHALL durar al menos 5 segundos (150 frames) para que sea legible en mobile sin pausar.

#### Scenario: All nine scenes are present in Sequence order
- **WHEN** se inspecciona `AtlasPromo.tsx`
- **THEN** se identifican nueve `<Sequence>` (o sub-componentes equivalentes) en el orden enumerado arriba

#### Scenario: Each scene meets minimum duration
- **WHEN** se mide la duración de cada escena
- **THEN** ninguna dura menos de 150 frames (5 segundos)

#### Scenario: Ingresos scene shows both QR and manual entry
- **WHEN** se reproduce la escena de ingresos (frames 1260–1500)
- **THEN** se ve un panel con QR animado y otro panel con un input de ingreso manual con placeholder estilo "0042 o email@..."

### Requirement: Visual fidelity to the live app

Las pantallas mockeadas dentro del video SHALL espejar el look-and-feel de los componentes reales de la app en cuanto a tipografía (Barlow + Barlow Condensed), tema dark, layout móvil, **terminología del gym** según `src/lib/gym-terms.ts` y **copy textual** de strings visibles (labels de campos, placeholders, copy de botones, copy de diálogos de confirmación).

Para gyms tipo "GYM" (como Atlas), la terminología SHALL ser "Rutina/Rutinas" y "PR/PRs". NO SHALL usarse "WOD" ni "RM/RMS" en strings visibles.

La composition NO SHALL tomar screenshots ni importar componentes del proyecto principal — todo se reescribe inline con divs estilados.

#### Scenario: Fonts are loaded from @remotion/google-fonts
- **WHEN** se revisan los imports de `AtlasPromo.tsx`
- **THEN** existen imports de `@remotion/google-fonts/BarlowCondensed` y `@remotion/google-fonts/Barlow`

#### Scenario: No imports from the main app
- **WHEN** se revisan los imports de `AtlasPromo.tsx`
- **THEN** ningún import comienza con `@/` ni resuelve a archivos de `src/` del proyecto principal

#### Scenario: Domain copy uses gym-correct terminology
- **WHEN** se reproducen las escenas mockeadas
- **THEN** los labels visibles usan "Rutina"/"Rutinas" (no "WOD"/"WODs") y "PR"/"PRs" (no "RM"/"RMS")

#### Scenario: Real button copy is preserved
- **WHEN** se reproducen las escenas de alta de usuario, crear rutina, ingresos y pagos
- **THEN** los botones muestran copy idéntico al de la UI real: "Crear Usuario", "Guardar Rutina", "Buscar", "Permitir", "Denegar", "Marcar pagado", "Registrar"

#### Scenario: User creation uses direct role selection
- **WHEN** se reproduce la escena de alta de usuario (frames 150–390)
- **THEN** se ve el `UserForm` real con un select de rol (Admin (Profe) / Profe / Alumno), NO un flujo de "promoción"

### Requirement: Subproject isolation

El cambio NO SHALL modificar archivos fuera de `remotion/` salvo los artefactos OpenSpec. Todas las dependencias necesarias SHALL declararse en `remotion/package.json`. La regla `.claude/rules/remotion-subproject.md` SHALL respetarse: instalar y correr todos los comandos dentro de `remotion/`.

La copia del logo desde `src/logos/{slug}.png` a `remotion/public/logos/{slug}.png` SHALL ser una copia (no symlink, no import desde la app); `src/logos/` queda intacta.

#### Scenario: No changes to root package.json
- **WHEN** se compara `package.json` raíz antes y después del cambio
- **THEN** los archivos son idénticos

#### Scenario: src/ logos directory is untouched
- **WHEN** se compara `src/logos/` antes y después del cambio
- **THEN** los archivos son idénticos (la operación fue copia, no move)

### Requirement: Render scripts and composition registration

`remotion/package.json` SHALL incluir un script `render:atlas` (mp4) y `render:atlas:gif` (gif), siguiendo el patrón de las promos existentes. La composition SHALL estar registrada en `remotion/src/Root.tsx`.

#### Scenario: Render scripts exist
- **WHEN** se inspecciona `remotion/package.json`
- **THEN** existen claves `scripts.render:atlas` con valor `remotion render AtlasPromo out/atlas.mp4` y `scripts.render:atlas:gif` con valor `remotion render AtlasPromo out/atlas.gif`

#### Scenario: Composition is registered
- **WHEN** se ejecuta `cd remotion && npx remotion compositions`
- **THEN** la lista incluye `AtlasPromo` con `1080x1920 @ 30fps, 1800 frames`

### Requirement: No external assets beyond gym logo, no audio

La composition NO SHALL depender de imágenes binarias, fuentes o archivos de audio externos al subproyecto `remotion/`, **con la única excepción del logo del gym** copiado a `remotion/public/logos/{slug}.png` desde `src/logos/`. Wordmarks y otros gráficos SHALL componerse con tipografía + SVG inline. La composition NO SHALL incluir un `<Audio>` track.

#### Scenario: Only logo image is referenced
- **WHEN** se revisan los `staticFile()` y `<Img>` en `AtlasPromo.tsx`
- **THEN** el único asset binario referenciado es `logos/atlas-gym.png`

#### Scenario: No audio component
- **WHEN** se revisa `AtlasPromo.tsx`
- **THEN** no se importa ni usa el componente `<Audio>` de Remotion

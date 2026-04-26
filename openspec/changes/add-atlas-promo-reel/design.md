## Context

El subproyecto `remotion/` ya tiene un patrón visual establecido (`UsuariosPromo.tsx` es el ejemplo más completo): `AbsoluteFill` con `BackgroundGlow` + `GrainOverlay`, secuencias anidadas con `Sequence`, paleta tipada en constantes top-level, fonts de Google Fonts cargadas via `@remotion/google-fonts`, animaciones con `spring()` y `interpolate()`. Las cinco promos existentes (Cuponera, Timers, Pagos, Usuarios, Validar) son de 30s/900 frames y promocionan **features del producto WODY**.

El reel a crear es la primera promo *tenant-flavored*: vende el gym Atlas (no el producto). Es 2× más largo que las existentes (60s/1800 frames), incluye nueve escenas que reproducen pantallas reales de la app con fidelidad de "demo de uso" (copy textual y layout idénticos a la UI real), usa el logo PNG del gym y la paleta del seed (`#f80710` rojo). Se entrega como spec ejecutable que después puede plantillarse para otros gyms.

Esta versión del design sustituye una primera iteración (7 escenas, sin logo, con flow incorrecto de "promoción a profe", sin ingreso manual de código, con label "RMS" incorrecto). El relevamiento detallado de los componentes reales informa esta nueva tabla de escenas y copy.

Stakeholders: dueño del proyecto (publica el Reel en Instagram), futuro replicador del patrón para otros tenants.

## Goals / Non-Goals

**Goals:**
- Reel de 60s exactos (1800 frames @ 30fps), 1080×1920 vertical, listo para Instagram Reels.
- Look-and-feel **indistinguible visualmente** de un screen-recording de la app real: copy textual idéntico, layouts idénticos, terminología del gym (Atlas es kind GYM → "Rutinas", "PRs", no "WODs", no "RMs").
- Recorrido coherente "día en la vida del gym": admin da de alta a un usuario → profe crea una rutina → alumno ve la rutina → alumno usa cronómetro → alumno consulta beneficios → alumno hace check-in en la puerta (QR + manual) → admin marca pago.
- Logo de Atlas (`atlas-gym.png`) presente en intro y CTA.
- Patrón replicable: si otro gym quiere su Reel, debería poder duplicarse el archivo cambiando paleta + logo + copy del header.

**Non-Goals:**
- Audio / música. Si después se quiere, va como cambio aparte.
- Subtítulos quemados, hashtags, watermark de Instagram. El video sale "limpio".
- Templating real para multi-tenant. Este cambio entrega el primero; la abstracción se evalúa cuando aparezca el segundo.
- Pantalla completa de pagos con Mercado Pago (estado de cuota del alumno, link de autorización, etc.) — eso está en `docs/billing-mercadopago.md` como plan futuro y aún no existe en la UI productiva. La escena de pagos refleja **lo que sí existe hoy**: admin marcando pago manualmente vía `PayButton`.
- Escena de PRs: el usuario la sacó del scope en este rework. Si se quiere reincorporar, va como iteración posterior.
- Slogan/tagline propio de Atlas. No existe oficial en el código; el video usa solo wordmark + ubicación + handle de Instagram en lugar de inventar copy.
- Cambios en la app principal (Next.js), en el schema de Prisma o en el `package.json` raíz.

## Decisions

### 1. Reusar 100% el patrón visual de `UsuariosPromo.tsx`

Decisión: copiar la estructura técnica (`AbsoluteFill` + `BackgroundGlow` + `GrainOverlay` + `Sequence` por escena), las constantes de paleta tipadas, el load de fonts via `@remotion/google-fonts`. Solo cambian: nombre de constantes brand (`BRAND = "#f80710"` en lugar de `GREEN`), color del glow, contenido y orden de las escenas, y el agregado del logo PNG.

Alternativa considerada: armar un módulo `_shared.tsx` con utilidades extraídas. Rechazada — solo hay un archivo nuevo, abstraer es prematuro. Si aparece la segunda promo tenant, recién ahí refactorizar.

### 2. Timing por escena (suma exacta a 1800 frames)

Recorrido "día en la vida":

| # | Escena | Start | Duración | End | Segundos |
|---|---|---|---|---|---|
| 0 | Intro (logo Atlas + ubicación) | 0 | 150 | 150 | 5.0 |
| 1 | Admin da de alta a un usuario | 150 | 240 | 390 | 8.0 |
| 2 | Profe crea una rutina | 390 | 270 | 660 | 9.0 |
| 3 | Alumno ve la rutina (vista WodCard) | 660 | 180 | 840 | 6.0 |
| 4 | Alumno usa cronómetro (TABATA) | 840 | 240 | 1080 | 8.0 |
| 5 | Alumno consulta beneficios | 1080 | 180 | 1260 | 6.0 |
| 6 | Ingresos: QR + manual | 1260 | 240 | 1500 | 8.0 |
| 7 | Pagos: admin marca pagado | 1500 | 150 | 1650 | 5.0 |
| 8 | CTA (logo + @atlasgimnasio_) | 1650 | 150 | 1800 | 5.0 |

Suma: 1800 frames = 60.0s exactos. Cada escena absorbe sus propias transiciones de entrada/salida (12 frames de slide-in al inicio, 12 frames de slide-out al final usando `interpolate` sobre `frame` local).

### 3. Transiciones: slide vertical entre escenas

Cada escena se desplaza desde abajo hacia arriba al entrar (12 frames) y hacia arriba/fade al salir (12 frames). Implementación: `translateY` interpolado de `+80` a `0` (entrada) y de `0` a `-80` con `opacity` 1→0 (salida), aplicado al wrapper de la escena. Usa `interpolate` con `Easing.out(Easing.cubic)`.

### 4. Simulación de cursor / interacción

No se renderiza un cursor. La "acción del usuario" se sugiere con dos primitivas:
- **Pulse ring**: un círculo SVG con `box-shadow` animado que aparece sobre el botón a presionar (3 frames antes del cambio de estado).
- **Highlight outline**: un `outline` rojo del brand que envuelve el elemento focal por ~10 frames. Implementación inline en el `border` y `background` de la card focal — mismo efecto visual, sin necesidad de portales.

### 5. Mobile-first respetando layout real

Las pantallas mockeadas se diseñan asumiendo viewport mobile (logical 1080×1920 → ~390×844 escalado al canvas). Cuando la pantalla real es responsive y se ve distinto en mobile vs desktop:
- KioskView en desktop es split (QR izq + feed der). En la promo, se muestran los dos paneles uno arriba del otro, simulando scroll vertical entre ellos.
- Lista de usuarios admin se muestra como cards apiladas verticalmente.
- Configuración del cronómetro se muestra en stack vertical (no grid 3-cols).

Cuando la app real **ya es mobile-first** (WodCard, RmsClient, BenefitsSection, formularios), se reproduce 1:1 sin reflow.

### 6. Inspirarse en componentes reales sin importarlos

El executor lee los componentes de `src/components/{admin,wod,rms,timers,benefits,access}/` y `src/app/[gymSlug]/**` para capturar **layout y copy textual exacto**. Pero **no** importa nada del proyecto principal en `remotion/` (subproyectos aislados). Cada pantalla mockeada se reescribe inline en `AtlasPromo.tsx` con divs estilados.

Copy textual de referencia (de `src/lib/gym-terms.ts` para kind GYM como Atlas):
- `wod` → "Rutina"
- `wods` → "Rutinas"
- `rm` → "PR"
- `rms` → "PRs"

### 7. Sin `lucide-react` en el subproyecto

Decisión confirmada: glyphs SVG inline en vez de agregar `lucide-react`. Se necesitan: check, plus, edit (lápiz), user, qr, lock, copy, ticket, instagram (logo), search, play, pause, refresh.

### 8. Logo del gym desde `src/logos/{slug}.png`

**Cambio respecto a la primera iteración:** sí se permite usar el logo PNG del gym. El archivo `src/logos/atlas-gym.png` (6 MB, 6000×3375 px, RGBA) se copia a `remotion/public/logos/atlas-gym.png` y se carga via `staticFile("logos/atlas-gym.png")` + `<Img>` de Remotion. La carpeta `remotion/public/logos/` ya existe y contiene logos de otros gyms (atr, ger, quinque, etc.) — se sigue ese mismo patrón.

Se usa en:
- Intro: logo grande con scale-up + fade-in.
- CTA: logo grande + handle Instagram + ubicación.

Cuando otra promo tenant-flavored se cree para otro gym, se copia su logo a `remotion/public/logos/{slug}.png` siguiendo la misma convención.

### 9. Copy y datos plausibles (TODOS los strings que aparecen)

**Intro (frames 0–150):**
- Logo Atlas (Img de `staticFile("logos/atlas-gym.png")`).
- Subtítulo: "Los Polvorines · Buenos Aires" (ubicación real del gym).

**Scene Alta de usuario (UserForm) (frames 150–390):**
- H1 de la pantalla: "Nuevo usuario"
- Form con: label "Nombre" → input "Carla Méndez"; label "Email" → input "carla.mendez@atlas.gym"; label "Contraseña" → input "••••••••"; label "Rol" → select "Profe" (de las opciones reales: Admin (Profe) / Profe / Alumno).
- Botón submit: copy textual "Crear Usuario" (variant primary).
- Después del submit: card verde con border `border-green-500/40` y bg `bg-green-500/5`, copy "Usuario creado" + "Nº de socio: 0042".

**Scene Crear rutina (WodManagerClient) (frames 390–660):**
- Click botón "+ Nuevo WOD" (variant primary) en la lista.
- Header del editor: "Nueva Rutina" + DatePicker (`w-44`) mostrando "25/04/2026".
- Input título: placeholder real `"Título (ej: Rutina, Fuerza, Upper Body...)"` → typing animation hasta "Fran".
- MarkdownEditor (TipTap) con placeholder real `"Escribi la Rutina aca..."` → typing animation hasta:
  ```
  21-15-9 reps por tiempo:
  Thrusters 95 lb
  Pull ups
  ```
- Botones: "Cancelar" + "Guardar Rutina" (con pulse ring sobre Guardar).
- Card aparece en la lista con fecha en brand-red, título "Fran" y badge target "TODOS".

**Scene Vista alumno (WodCard) (frames 660–840):**
- Card con accent rojo (prop `accent={highlight}`).
- Header: dot rojo pulsante (`animate-pulse`) + "HOY — Viernes, 25 de abril" + título "Fran" en gray-400 abajo.
- Body: MarkdownRenderer del contenido del WOD (mismo texto que se tipeó en escena 2).

**Scene Cronómetros (TimersClient) (frames 840–1080):**
- H1 "Cronómetros" (uppercase, font-heading font-black).
- Sección "Básicos" con 3 ModeCards: "Cronómetro" / "Cuenta progresiva simple"; "Temporizador" / "Cuenta regresiva configurable"; "Intervalos" / "Trabajo / descanso personalizable".
- Sección "Presets de entrenamiento" con 3 ModeCards (accent rojo): "TABATA" / "Trabajo, descanso y rondas configurables"; "AMRAP" / "Cuenta regresiva — tantas rondas como puedas"; "FOR TIME" / "Cronómetro progresivo con time cap opcional".
- Click TABATA → vista de configuración: TimeInputs "Trabajo (s)" 20, "Descanso (s)" 10, "Rondas" 8. Subtítulo "Total: 04:00".
- Click "Iniciar" → pre-countdown "Preparate!" en brand-red + "3" "2" "1".
- Display TABATA corriendo: label "Trabajo" en rojo (porque es tabata), TimerDisplay grande "00:18", subtítulo "Ronda 1 / 8" + "Total: 03:58".

**Scene Beneficios (BenefitsSection + CouponCard) (frames 1080–1260):**
- Header: label "EXCLUSIVO PARA ALUMNOS" (xs, brand-red) + Title "Beneficios" (text-3xl font-black) + descripción "Descuentos y regalos de comercios aliados, para alumnos de cualquier gym que use WODY."
- Grid de 3 CouponCards mockeadas:
  - "ATR" — "Tienda online" — descuento 15%
  - "BV Sports" — "Un solo uso" — descuento 20%
  - "Nutrite con Lu" — "Uso libre" — primera consulta gratis
- Foco en una card: click "Obtener código" (Ticket icon) → aparece código "FRAN15" en font-heading font-black tracking-[0.2em] black bg + border-brand-red/40.
- Botón debajo: "Copiar código" (Copy icon).

**Scene Ingresos (KioskView) (frames 1260–1500):**
- Layout split vertical: panel superior QR, panel inferior ingreso manual + feed.
- Panel QR: H1 "Ingresos" (text-2xl font-black) + texto "Escaneá este QR desde la app de WODY para registrar el ingreso. El código rota cada 5 minutos." + QR SVG blanco (mockear como grid 21×21 de cuadrados).
- Panel manual: label "INGRESO MANUAL" (uppercase, tracking-[0.2em], gray-500) + descripción "Si el socio no puede escanear, buscalo por nº o email." + input con placeholder "0042 o email@..." → typing "0042" + botón "Buscar" (variant secondary, sm).
- Resultado (ManualLookupCard): card border-brand-red/30 bg-brand-red/5 con: número "0042" (gray-500 monospace) + nombre "Tomás López" (white font-bold) + status badge "Al día" (green) + botones "Denegar" (danger sm) + "Permitir" (primary sm con pulse ring).
- Click Permitir → toast verde arriba: "Ingresó · Tomás López".

**Scene Pagos (PayButton + lista admin) (frames 1500–1650):**
- Vista admin con lista de alumnos (mock simple): 3 cards mostrando nombre + estado de cuota.
  - "Lucía Ferrari" — badge "Vence hoy" (yellow)
  - "Tomás López" — badge "Al día" (green)
  - "Mateo Ruiz" — badge "Atrasado 3 días" (yellow/orange)
- Foco en Lucía Ferrari: pulse ring sobre botón "Marcar pagado".
- Click → diálogo de confirmación con copy real: "¿Registrar pago de Lucía Ferrari? La fecha avanza 1 mes." + botones "Cancelar" + "Registrar".
- Click Registrar → estado de Lucía cambia a "Al día" (green) con animación.

**CTA (frames 1650–1800):**
- Logo Atlas grande (más grande que el intro) con fade-in + scale.
- Handle "@atlasgimnasio_" (Instagram, brand-red).
- Línea inferior: "Los Polvorines · Buenos Aires".
- Glow rojo intensificado, fondo con leve zoom-in. Cierre con fade-out suave en los últimos 15 frames.

### 10. Render scripts

Mantener convención existente del `package.json` de `remotion/`:

```json
"render:atlas": "remotion render AtlasPromo out/atlas.mp4",
"render:atlas:gif": "remotion render AtlasPromo out/atlas.gif"
```

### 11. Estructura de sub-componentes en `AtlasPromo.tsx`

```
AtlasPromo (export)
├─ BackgroundGlow (rojo)
├─ GrainOverlay
├─ <Sequence from={0} dur={150}>     <SceneIntro/>
├─ <Sequence from={150} dur={240}>   <SceneAltaUsuario/>
├─ <Sequence from={390} dur={270}>   <SceneCrearRutina/>
├─ <Sequence from={660} dur={180}>   <SceneAlumnoRutina/>
├─ <Sequence from={840} dur={240}>   <SceneCronometro/>
├─ <Sequence from={1080} dur={180}>  <SceneBeneficios/>
├─ <Sequence from={1260} dur={240}>  <SceneIngresos/>
├─ <Sequence from={1500} dur={150}>  <ScenePagos/>
└─ <Sequence from={1650} dur={150}>  <SceneCta/>

Helpers (mismo archivo):
├─ Colors (constantes)
├─ <PhoneFrame> (wrapper visual mobile-first)
├─ <PulseRing/>
├─ Glyph SVGs (Check, Plus, Edit, User, Qr, Lock, Copy, Ticket, Instagram, Search, Play, Pause, Refresh)
└─ animation utilities (slideIn, slideOut, typewriter)
```

## Risks / Trade-offs

- **[Riesgo] Logo PNG de 6 MB infla el bundle de Remotion** → Mitigación: aceptarlo. Es local-only (no se sirve por la web), se renderea una vez y queda en `out/atlas.mp4`. Si crece el problema, optimizar con `sharp` antes de entrar a `remotion/public/`.
- **[Riesgo] Mockup envejece si la UI real cambia** → Mitigación: aceptarlo. El Reel es un *snapshot* del producto a abril 2026.
- **[Riesgo] Pagos no tiene UI productiva completa** → Mitigación: la escena solo muestra el botón "Marcar pagado" y su diálogo, que SÍ existe (`src/components/admin/PayButton.tsx`). El mockup del listado de alumnos con badges de cuota es minimalista (no inventa pantallas que no existen).
- **[Riesgo] Sin audio el video puede sentirse plano** → Mitigación: animaciones con peso visual (pulses, slides marcados, highlights). Si después se quiere música, va aparte.
- **[Trade-off] 9 escenas en 60s da ~6.7s por escena promedio** → Las escenas más densas (alta de usuario, crear rutina, cronómetro, ingresos) tienen 8-9s. Las más simples (vista WodCard, beneficios, pagos, intro, CTA) tienen 5-6s. El ritmo es apretado a propósito (reels rinden mejor con dinámica alta).

## Migration Plan

No aplica — composition nueva, no rompe ninguna existente. El despliegue es manual: `cd remotion && npm run render:atlas` cuando se quiera regenerar el video.

Rollback: borrar `AtlasPromo.tsx`, sacar el registro de `Root.tsx`, los dos scripts del `package.json` y opcionalmente `remotion/public/logos/atlas-gym.png` (o dejarlo si se va a usar para futuras iteraciones).

## Open Questions

- Ninguna bloqueante. Slogan oficial: confirmado que no existe en el código; el video usa solo wordmark + ubicación + handle Instagram. Si después aparece un slogan oficial de marketing, va como iteración posterior.

> **Estado:** segunda iteración (fix puntual). Después del primer rework (9 escenas) el usuario marcó 5 problemas: la escena de alta debe mostrar **dos altas** (profe + alumno asignándole ese profe); crear rutina debe mostrar **TargetSelector** y usar una rutina de gimnasio tradicional ("Rutina de pecho y hombros") en lugar de "Fran" (CrossFit, fuera de contexto para Atlas que es kind GYM); en la transición post-guardar de SceneCrearRutina **no debe aparecer el botón "+ Nueva Rutina"** (confunde con la vista del alumno); los **beneficios deben ser los reales del seed `prisma/seed-coupons.ts` con sus logos en `remotion/public/logos/`** (no inventados); el **toast de ingresos** se ve mal (texto todo uppercase tracking-wide gritado, sin check icon).
>
> Las cajas de las secciones afectadas vuelven a `[ ]`. Las que no cambian quedan como estaban.

## 1. Setup

- [x] 1.1 Logo del gym ya copiado a `remotion/public/logos/atlas-gym.png`.
- [x] 1.2 Logo de Tica ya copiado a `remotion/public/logos/tica.png` (operación previa al rework, necesaria para la escena de beneficios).
- [x] 1.3 Logos de cupones ya disponibles en `remotion/public/logos/`: `nutrite-con-lu.png`, `ready-for-wod.png`, `tica.png`, `atr.png`, `quinque.png`, `ger.png`, `becalsualf-ft.png`, `bv-sports.png`.

## 2. Recalcular timing total (suma exacta 1800 frames)

- [x] 2.1 Actualizar las constantes de timing en el archivo:
  - `INTRO_START=0`, `INTRO_DUR=90` (era 150)
  - `ALTA_START=90`, `ALTA_DUR=360` (era 240 — sube +120 para acomodar doble alta)
  - `RUTINA_START=450`, `RUTINA_DUR=300` (era 270 — sube +30 para target selector)
  - `WOD_START=750`, `WOD_DUR=150` (era 180)
  - `TIMER_START=900`, `TIMER_DUR=210` (era 240)
  - `BENEF_START=1110`, `BENEF_DUR=180`
  - `INGRESO_START=1290`, `INGRESO_DUR=240`
  - `PAGO_START=1530`, `PAGO_DUR=120` (era 150)
  - `CTA_START=1650`, `CTA_DUR=150`
- [x] 2.2 Verificar `90+360+300+150+210+180+240+120+150 = 1800`.

## 3. SceneIntro (90 frames, 3s) — comprimir

- [x] 3.1 Mantener el contenido (logo + ubicación + barra brand) pero comprimir las animaciones para que entren en 90 frames. Logo aparece rápido (spring en primeros 18 frames), subtítulo a frame ~25, barra a ~35. Hold + slideOut.

## 4. SceneAltaUsuario (360 frames, 12s) — REWORK: doble alta

> **Inspirarse en `src/components/UserForm.tsx` líneas 1-198.** El form real cuando rol=STUDENT muestra extras adicionales: "Tipo de alumno" (Personalizado/General), "Profe (opcional)" con default "Sin profe (se autogestiona)", y checkbox "Puede crear sus propias rutinas" con sub-label.

### Sub-fase A: Alta de profe (frames 0-180, 6s)

- [x] 4.1 PhoneFrame con header "Nuevo usuario" + crumb "Admin · Atlas" arriba en gray-500.
- [x] 4.2 Form vacío. Typing en "Nombre" → "Carla Méndez" (typewriter, 4 frames/char).
- [x] 4.3 Typing en "Email" → "carla.mendez@atlas.gym".
- [x] 4.4 "Contraseña" pre-tipeado "••••••••" (no animación).
- [x] 4.5 Select rol abierto, dropdown muestra opciones reales ("Admin (Profe)", "Profe", "Alumno") con "Profe" highlighted brand-red, después se cierra con "Profe" seleccionado.
- [x] 4.6 PulseRing sobre botón "Crear Usuario" (variant primary full-width). Click simulado.
- [x] 4.7 Success card aparece (border-green-500/40, bg-green-500/5): "✓ Usuario creado" + "Nº de socio: 0042" en mono.

### Transición: limpieza del form (frames 180-200, 0.7s)

- [x] 4.8 Success card hace fade-out en ~10 frames. Inputs se vacían (transición suave). Selector de rol vuelve al placeholder "Selecciona un rol".

### Sub-fase B: Alta de alumno con profe asignado (frames 200-360, 5.3s)

- [x] 4.9 Typing "Nombre" → "Tomás López".
- [x] 4.10 Typing "Email" → "tomas.lopez@atlas.gym".
- [x] 4.11 Password "••••••••" (pre-tipeado).
- [x] 4.12 Select rol → "Alumno" seleccionado.
- [x] 4.13 **Aparecen extras (animación fade-in/slide-down)** en este orden:
  - Selector "Tipo de alumno": valor "Personalizado (Rutinas + PRs)" (terminología real para kind=GYM).
  - Selector "Profe (opcional)": dropdown se abre brevemente, "Carla Méndez" highlighted brand-red, se cierra con "Carla Méndez" seleccionada (la profe que se acaba de crear).
  - Checkbox "Puede crear sus propias rutinas" enabled (NO disabled, porque tiene profe asignado), no marcado por default.
  - Sub-label en gray-500: "El alumno va a poder crear rutinas asignadas a sí mismo." (terminología real, NO "WODs").
- [x] 4.14 PulseRing sobre "Crear Usuario" → click → success card "✓ Usuario creado · Nº de socio: 0043".

## 5. SceneCrearRutina (300 frames, 10s) — REWORK: TargetSelector + rutina de gym

> **Inspirarse en `src/components/wod/WodManagerClient.tsx` líneas 1-336 + `src/components/wod/TargetSelector.tsx` líneas 23-159.**

- [x] 5.1 Modo CREAR. Header "Nueva Rutina" izq + DatePicker `w-44` valor "25/04/2026" der.
- [x] 5.2 **Nueva subsección — TargetSelector** (después del header, antes del título):
  - Label "Destinatario" en uppercase tracking-[0.15em] gray-500.
  - 4 botones horizontales: "Todos" / "Personalizados" / "Grupo" / "Alumno". Estilo: `px-4 py-2 border` con bg `bg-elev` y hover/active brand-red.
  - Inicialmente "Todos" seleccionado (default real).
  - PulseRing aparece sobre "Alumno" → click → "Alumno" se vuelve activo (border brand-red, bg brand-red/10) y aparece sub-selector dropdown.
  - Sub-selector dropdown abierto mostrando "Tomás López" (entre otros mock como "Lucía Ferrari", "Mateo Ruiz") con "Tomás López" highlighted brand-red. Se cierra con "Tomás López" seleccionado.
- [x] 5.3 Input título: placeholder real `"Título (ej: Rutina, Fuerza, Upper Body...)"`. Typewriter escribiendo "Rutina de pecho y hombros" (5 frames/char).
- [x] 5.4 MarkdownEditor mockeado con toolbar (B / I / • / 1. / H2 / ❝, todo gray-500). Placeholder real `"Escribi la Rutina aca..."`. Typewriter escribiendo (más rápido, ~2-3 frames/char):
  ```
  ## CALENTAMIENTO
  - 5 min bici, movilidad articular

  ## PECHO
  Press de banca plano — 4×8-10 al 85% RM

  ## HOMBRO
  Desarrollo militar — 3×10-12
  Elevaciones laterales — 3×12-15

  ## ACCESORIOS
  Fondos en paralelas — 3× max reps
  ```
  Renderizar el `##` como heading en font-heading uppercase y los bullets como `<ul>` para que parezca markdown renderizado, no texto plano.
- [x] 5.5 Botones "Cancelar" + "Guardar Rutina" con PulseRing sobre Guardar.
- [x] 5.6 Click Guardar → transición a fase post-guardar.

### Fase post-guardar (sub-fase del final de SceneCrearRutina)

- [x] 5.7 **CRÍTICO**: en esta fase, mostrar SOLO la card recién creada con animación slide-up. **NO incluir** el botón "+ Nueva Rutina" arriba. **NO incluir** el header "Rutinas". Solo la card flotando sobre el fondo, simulando que la rutina se acaba de publicar.
- [x] 5.8 La card tiene: fecha "25/04/2026" en brand-red uppercase + título "Rutina de pecho y hombros" en white font-bold + badge "Tomás López" (porque target=STUDENT con ese alumno) en `bg-brand-red/10 text-brand-red border-brand-red/20` + preview del contenido (primeras 3 líneas) en gray-400.

## 6. SceneAlumnoRutina (150 frames, 5s) — actualizar contenido

- [x] 6.1 PhoneFrame con header "ATLAS · MI RUTINA" arriba.
- [x] 6.2 Card con accent rojo (border-l-2 brand-red, bg brand_dim). CardHeader: dot rojo pulsante + "HOY — Viernes, 25 de abril" + título "Rutina de pecho y hombros" debajo en gray-400.
- [x] 6.3 CardBody: renderizar el mismo contenido markdown de la rutina creada en escena 5 (## CALENTAMIENTO, ## PECHO, ## HOMBRO, ## ACCESORIOS) — fiel a lo que el alumno vería. Ajustar tamaño de tipografía si no entra todo (acortar a ## PECHO + ## HOMBRO solamente si es necesario).
- [x] 6.4 Confirmar que NO hay botón ni elemento de creación. Solo header + card + opcional scroll hint.

## 7. SceneCronometro (210 frames, 7s) — comprimir timing

- [x] 7.1 Mantener TODO el contenido (selector con 6 cards, click TABATA, config con TimeInputs, pre-countdown 3-2-1, display TABATA running con label "Trabajo" + "Ronda 1/8" + "Total: 03:58", botones Pausar/Reiniciar). Ajustar los tiempos internos (sub-frames) para que entre en 210 frames en lugar de 240.

## 8. SceneBeneficios (180 frames, 6s) — REWORK con cupones reales y logos

> **Cupones reales del seed `prisma/seed-coupons.ts`. Logos disponibles en `remotion/public/logos/`.**

- [x] 8.1 Header: label "EXCLUSIVO PARA ALUMNOS" (xs uppercase brand-red tracking-[0.2em]) + Title "Beneficios" (text-3xl font-heading font-black) + descripción real "Descuentos y regalos de comercios aliados, para alumnos de cualquier gym que use WODY."
- [x] 8.2 Stack vertical de 3 CouponCards REALES (mobile-first). **Cada card usa el logo PNG real**, no inicial en círculo.

  - **Card 1: Nutrite con Lu**
    - Logo: `<Img src={staticFile("logos/nutrite-con-lu.png")} />` width 64 height 64 object-contain en container `bg-white/[0.03] border-white/[0.06]`.
    - Nombre: "NUTRITE CON LU" (uppercase font-bold).
    - Badge: "Un solo uso" en `text-brand-red/80`.
    - Descripción: "Bioimpedancia de regalo con tu consulta nutricional."

  - **Card 2: Ready For Wod**
    - Logo: `<Img src={staticFile("logos/ready-for-wod.png")} />`.
    - Nombre: "READY FOR WOD".
    - Badge: "Un solo uso".
    - Descripción: "10% de descuento en tu primera compra."

  - **Card 3: Tica** (FOCO de la escena)
    - Logo: `<Img src={staticFile("logos/tica.png")} />`.
    - Nombre: "TICA".
    - Badge: "Tienda online" (porque tiene `fixedCode` y `websiteUrl`).
    - Descripción: "10% de descuento en ticaclothes.com.ar."

- [x] 8.3 Foco en Card 3 (Tica): PulseRing sobre botón "Obtener código" (Ticket icon + texto, variant primary). Click a ~3.5s.
- [x] 8.4 Card 3 expande revelando el código fijo "WODY10" en font-heading font-black tracking-[0.2em] sobre fondo black con border `brand-red/40`. Animación scale 0.95 → 1 + fade-in.
- [x] 8.5 Botones inferiores: "Copiar código" (Copy icon, ghost) + "Ir a la tienda" (External link icon o flecha, variant primary brand-red, copy "Ir a la tienda").

## 9. SceneIngresos toast (revisión visual del toast)

> El resto de la escena (panel QR, ManualLookup, búsqueda "0042", ManualLookupCard con Permitir/Denegar) queda como está. Solo se reescribe el bloque del toast.

- [x] 9.1 Reescribir el toast para que se vea limpio y profesional:
  - Container: `position: absolute, top: 16, left: 16, right: 16, zIndex: 20, padding: "14px 18px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)"`. Animación slideIn-down + fade-in en 12 frames, hold, fade-out en 12 frames antes del fin.
  - Estructura interna: `display: flex, alignItems: center, gap: 12`:
    - Check icon verde (`<CheckGlyph size={20} color={GREEN}/>`).
    - Stack vertical (`display: flex, flexDirection: column, gap: 2`):
      - Línea 1: "INGRESÓ" en `fontFamily: heading, fontWeight: 700, fontSize: 12, letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase"`.
      - Línea 2: "Tomás López" en `fontFamily: body, fontWeight: 700, fontSize: 22, color: "white", textTransform: "none"` (importante: NO uppercase, NO tracking-wide).

## 10. ScenePagos (120 frames, 4s) — comprimir timing

- [x] 10.1 Mantener flujo (lista 3 alumnos + click Marcar pagado en Lucía + diálogo "¿Registrar pago de Lucía Ferrari? La fecha avanza 1 mes." + click Registrar + estado cambia a "Al día"). Ajustar tiempos internos para entrar en 120 frames.
- [x] 10.2 Confirmar que el title del modal usa el copy real "Registrar pago" (no "Confirmar pago").

## 11. SceneCta (150 frames, 5s) — sin cambios

- [x] 11.1 Logo Atlas grande + "@atlasgimnasio_" + "Los Polvorines · Buenos Aires" + fade-out final. Sin cambios respecto al rework anterior.

## 12. Composición principal

- [x] 12.1 Ajustar las constantes de timing nuevas y que cada `<Sequence>` use las nuevas durations. Suma exacta 1800.

## 13. Verificación

- [x] 13.1 `cd remotion && npx remotion compositions` — confirmar `AtlasPromo 30 1080x1920 1800 (60.00 sec)`.
- [x] 13.2 `git status` — solo `remotion/src/AtlasPromo.tsx`, `remotion/public/logos/tica.png` (nuevo), y los artefactos de openspec deben estar modificados/agregados por este rework. Los cambios pre-existentes en `src/`/`prisma/` son del WIP `add-user-soft-delete` del usuario, no de este cambio.
- [x] 13.3 Marcar las cajas y avisar al usuario.

## 14. Manual del usuario (no automatizable)

- [ ] 14.1 (Usuario) Preview con `cd remotion && npx remotion studio` y revisar las 9 escenas.
- [ ] 14.2 (Usuario) Render con `cd remotion && npm run render:atlas`.
- [ ] 14.3 (Usuario) Si todo OK: `/opsx:archive add-atlas-promo-reel`.

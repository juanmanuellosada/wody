import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBody } from "@remotion/google-fonts/Barlow";

const heading = loadHeading("normal", {
  weights: ["700", "900"],
  subsets: ["latin"],
});
const body = loadBody("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

/* Rompiendo Limites palette (black + green) */
const GREEN = "#7ed957";
const GREEN_DIM = "rgba(126,217,87,0.15)";
const GREEN_BORDER = "rgba(126,217,87,0.5)";
const BG = "#000000";
const PANEL_BG = "#0A0A0A";
const PANEL_BORDER = "#1A1A1A";
const INPUT_BG = "#121212";
const INPUT_BORDER = "#232323";
const GRAY_TEXT = "rgba(255,255,255,0.5)";
const GRAY_TEXT_DIM = "rgba(255,255,255,0.3)";

/* Scene timing (30s @ 30fps = 900 frames) */
const INTRO = 90; //          0–90    · 3s
const APP_FRAMES = 720; //   90–810   · 24s   (walkthrough)
const CTA = 90; //           810–900  · 3s

/* Scroll layout — virtual content coordinates */
const CONTENT_TOP = 180; // below navbar+navstrip
const BANNER_Y = 40; // inside content
const FORM_Y = 400;
const ASIGNAR_Y = 1540;
const USUARIOS_Y = 2580;

export const UsuariosPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>

      <Sequence from={INTRO} durationInFrames={APP_FRAMES}>
        <AppView />
      </Sequence>

      <Sequence from={INTRO + APP_FRAMES} durationInFrames={CTA}>
        <CTAScene />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

/* ---------- Shared glow + grain ---------- */

const BackgroundGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.08 + 0.9;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${pulse})`,
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(126,217,87,0.28) 0%, rgba(126,217,87,0.06) 35%, transparent 65%)",
          filter: "blur(150px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-15%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(126,217,87,0.18) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
    </AbsoluteFill>
  );
};

const GrainOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.03,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    }}
  />
);

/* ---------- Intro ---------- */

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.6 },
  });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const eyebrowOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [25, 50], [30, 0], {
    extrapolateRight: "clamp",
  });
  const outOpacity = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
        textAlign: "center",
        opacity: outOpacity,
      }}
    >
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
        <Img
          src={staticFile("logos/rompiendo-limites.png")}
          style={{ width: 320, height: "auto" }}
        />
      </div>
      <div
        style={{
          marginTop: 60,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: "0.35em",
          color: GREEN,
          textTransform: "uppercase",
          opacity: eyebrowOpacity,
        }}
      >
        Panel de administración
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 140,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "white",
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Alta de usuarios
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 32,
          color: GRAY_TEXT,
          opacity: titleOpacity,
        }}
      >
        Como lo harías en tu celular
      </div>
    </AbsoluteFill>
  );
};

/* ---------- App view with navbar + scrolling content ---------- */

const AppView: React.FC = () => {
  const frame = useCurrentFrame(); // 0..APP_FRAMES

  // Fade the whole app in
  const appOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scroll keyframes: (frame, scrollY) — scrollY is how much content is pushed up
  const scrollKeyframes: Array<{ at: number; y: number }> = [
    { at: 0, y: 0 }, // welcome banner top
    { at: 50, y: 0 },
    { at: 90, y: FORM_Y - 40 }, // form header comes into view
    { at: 420, y: FORM_Y - 40 }, // stay while filling profe + alumno
    { at: 490, y: ASIGNAR_Y - 40 }, // scroll to Asignaciones
    { at: 640, y: ASIGNAR_Y - 40 }, // stay during asignar
    { at: 700, y: USUARIOS_Y - 40 }, // scroll to Usuarios
    { at: APP_FRAMES, y: USUARIOS_Y - 40 },
  ];
  const scrollY = sampleKeyframes(scrollKeyframes, frame);

  return (
    <AbsoluteFill style={{ opacity: appOpacity }}>
      {/* Scrollable content (rendered behind the navbar) */}
      <AbsoluteFill
        style={{
          top: CONTENT_TOP,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: `translateY(-${scrollY}px)`,
            transition: "none",
            padding: "0 40px",
            paddingBottom: 400,
          }}
        >
          <WelcomeBanner />
          <div style={{ height: 60 }} />
          <CrearUsuarioPanel appFrame={frame} />
          <div style={{ height: 40 }} />
          <AsignacionesPanel appFrame={frame} />
          <div style={{ height: 40 }} />
          <UsuariosPanel appFrame={frame} />
        </div>
      </AbsoluteFill>

      {/* Navbar / NavStrip (sticky on top) */}
      <Navbar />

      {/* Global cursor */}
      <GlobalCursor appFrame={frame} />
    </AbsoluteFill>
  );
};

function sampleKeyframes(
  frames: Array<{ at: number; y: number }>,
  frame: number
): number {
  if (frame <= frames[0].at) return frames[0].y;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (frame <= b.at) {
      const t = (frame - a.at) / (b.at - a.at || 1);
      // ease in-out cubic
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return a.y + (b.y - a.y) * e;
    }
  }
  return frames[frames.length - 1].y;
}

/* ---------- Navbar ---------- */

const NAV_ITEMS = [
  { label: "Panel Admin", active: true },
  { label: "Dashboard Profe" },
  { label: "Pagos" },
  { label: "Mis RMs" },
  { label: "Cronómetros" },
  { label: "Beneficios" },
];

const Navbar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${PANEL_BORDER}`,
    }}
  >
    {/* Top bar — logos + user */}
    <div
      style={{
        padding: "18px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Img
          src={staticFile("logos/wody-blanco.png")}
          style={{ width: 36, height: 36, opacity: 0.9 }}
        />
        <span
          style={{
            width: 1,
            height: 32,
            background: "rgba(255,255,255,0.18)",
          }}
        />
        <Img
          src={staticFile("logos/rompiendo-limites-horizontal.png")}
          style={{ height: 52, width: "auto", opacity: 0.9 }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "0.15em",
            color: GRAY_TEXT,
            textTransform: "uppercase",
          }}
        >
          Tomás{" "}
          <span style={{ color: GREEN }}>(Admin)</span>
        </span>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "0.15em",
            color: GRAY_TEXT_DIM,
            textTransform: "uppercase",
          }}
        >
          Salir
        </span>
      </div>
    </div>

    {/* Nav strip */}
    <div
      style={{
        padding: "0 40px",
        display: "flex",
        gap: 28,
        paddingBottom: 12,
        overflow: "hidden",
      }}
    >
      {NAV_ITEMS.map((item) => (
        <div
          key={item.label}
          style={{
            position: "relative",
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "0.15em",
            color: item.active ? GREEN : GRAY_TEXT,
            textTransform: "uppercase",
            padding: "8px 0",
          }}
        >
          {item.label}
          {item.active && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: GREEN,
              }}
            />
          )}
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Welcome banner ---------- */

const WelcomeBanner: React.FC = () => {
  const frame = useCurrentFrame();
  // Number counters come in shortly after app mount
  const t = interpolate(frame, [5, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const profes = Math.round(4 * t);
  const alumnos = Math.round(32 * t);
  const total = profes + alumnos + 1; // +1 admin

  return (
    <section
      style={{
        marginTop: BANNER_Y,
        border: `1px solid ${PANEL_BORDER}`,
        background: PANEL_BG,
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "0.2em",
            color: GREEN,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Panel de Control
        </div>
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 54,
            color: "white",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1,
          }}
        >
          Hola, Tomás
        </div>
      </div>
      <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
        <Stat label="Profes" value={profes} />
        <div
          style={{
            width: 1,
            height: 52,
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <Stat label="Alumnos" value={alumnos} accent />
        <div
          style={{
            width: 1,
            height: 52,
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <Stat label="Total" value={total} />
      </div>
    </section>
  );
};

const Stat: React.FC<{ label: string; value: number; accent?: boolean }> = ({
  label,
  value,
  accent = false,
}) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 900,
        fontSize: 56,
        lineHeight: 1,
        color: accent ? GREEN : "white",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    <div
      style={{
        marginTop: 8,
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: "0.2em",
        color: GRAY_TEXT,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  </div>
);

/* ---------- Crear Usuario panel (renders profe then alumno) ---------- */

/* Timeline within appFrame:
   90   → panel in view
   100-170: fill profe (name/email/pwd/rol)
   170-200: click Crear
   200-240: success + form reset
   240-310: fill alumno (name/email/pwd/rol=Alumno reveals tipo)
   310-340: click Crear
   340-390: success + keep visible
   390-490: form stays visible, scrolling begins away
*/

const CrearUsuarioPanel: React.FC<{ appFrame: number }> = ({ appFrame }) => {
  const f = appFrame;

  // Which user is being created
  type Stage =
    | "idle"
    | "profe-typing"
    | "profe-submitted"
    | "profe-success"
    | "alumno-typing"
    | "alumno-submitted"
    | "alumno-success";

  let stage: Stage = "idle";
  if (f < 100) stage = "idle";
  else if (f < 170) stage = "profe-typing";
  else if (f < 200) stage = "profe-submitted";
  else if (f < 240) stage = "profe-success";
  else if (f < 310) stage = "alumno-typing";
  else if (f < 340) stage = "alumno-submitted";
  else stage = "alumno-success";

  const isAlumnoPhase = f >= 240;
  const fieldFrame = isAlumnoPhase ? f - 240 : f - 100;

  const name = isAlumnoPhase ? "Camila Torres" : "Lucas Medina";
  const email = isAlumnoPhase
    ? "camila@rompiendolimites.com"
    : "lucas@rompiendolimites.com";
  const rol = isAlumnoPhase ? "Alumno" : "Profe";
  const showStudentTypeField = isAlumnoPhase && fieldFrame >= 50;

  const submitted = stage === "profe-submitted" || stage === "alumno-submitted";
  const success = stage === "profe-success" || stage === "alumno-success";

  // Button press state
  const pressed = submitted;
  const successIn = interpolate(
    f,
    isAlumnoPhase ? [340, 360] : [200, 220],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const successOut = interpolate(
    f,
    isAlumnoPhase ? [380, 410] : [230, 260],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <section
      style={{
        border: `1px solid ${PANEL_BORDER}`,
        background: PANEL_BG,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <PanelHeader title="Crear Usuario" />
      <div style={{ padding: 36, display: "flex", flexDirection: "column", gap: 28 }}>
        <FormField
          label="Nombre"
          value={name}
          typingFrame={fieldFrame}
          typingRange={[0, 25]}
        />
        <FormField
          label="Email"
          value={email}
          typingFrame={fieldFrame}
          typingRange={[28, 58]}
        />
        <FormField
          label="Contraseña"
          value={fieldFrame >= 62 ? "••••••••••" : ""}
          typingFrame={fieldFrame}
          typingRange={[62, 75]}
        />
        <FormSelect
          label="Rol"
          value={fieldFrame >= 80 ? rol : "Seleccioná un rol"}
          highlighted={fieldFrame >= 80 && fieldFrame < 100}
          chosen={fieldFrame >= 80}
        />
        {showStudentTypeField && (
          <div
            style={{
              opacity: interpolate(fieldFrame, [50, 80], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(
                fieldFrame,
                [50, 80],
                [12, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )}px)`,
            }}
          >
            <FormSelect
              label="Tipo de alumno"
              value="Personalizado (WODs + RMs)"
              chosen
            />
          </div>
        )}

        {/* Submit */}
        <div
          style={{
            alignSelf: "flex-start",
            padding: "20px 48px",
            marginTop: 8,
            background: pressed || success ? GREEN : "rgba(255,255,255,0.06)",
            color: pressed || success ? "black" : "white",
            border: pressed || success ? "none" : "1px solid rgba(255,255,255,0.15)",
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            transform: `scale(${pressed ? 0.96 : 1})`,
            transition: "background 200ms, transform 120ms",
          }}
        >
          Crear usuario
        </div>
      </div>

      {/* Success toast inside panel */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 36,
          opacity: successIn * successOut,
          padding: "14px 22px",
          background: GREEN_DIM,
          border: `1px solid ${GREEN_BORDER}`,
          color: GREEN,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        ✓ Usuario creado correctamente
      </div>
    </section>
  );
};

const PanelHeader: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      padding: "16px 28px",
      borderBottom: `1px solid ${PANEL_BORDER}`,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}
  >
    <span
      style={{
        width: 10,
        height: 10,
        background: GREEN,
        display: "block",
        flexShrink: 0,
      }}
    />
    <span
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: "0.2em",
        color: "white",
        textTransform: "uppercase",
      }}
    >
      {title}
    </span>
  </div>
);

/* ---------- Form field primitives ---------- */

const FormField: React.FC<{
  label: string;
  value: string;
  typingFrame: number;
  typingRange: [number, number];
}> = ({ label, value, typingFrame, typingRange }) => {
  const [a, b] = typingRange;
  const revealed =
    typingFrame <= a
      ? 0
      : typingFrame >= b
      ? value.length
      : Math.floor(((typingFrame - a) / (b - a)) * value.length);
  const text = value.slice(0, revealed);
  const active = typingFrame >= a && typingFrame <= b;
  const showCaret = active && revealed < value.length;

  return (
    <div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: "0.2em",
          color: GRAY_TEXT,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: INPUT_BG,
          border: `2px solid ${active ? GREEN_BORDER : INPUT_BORDER}`,
          padding: "20px 22px",
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 30,
          color: value ? "white" : "rgba(255,255,255,0.3)",
          minHeight: 72,
          boxShadow: active ? `0 0 20px ${GREEN_DIM}` : "none",
          transition: "all 150ms",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span>{text}</span>
        {showCaret && (
          <span
            style={{
              marginLeft: 2,
              display: "inline-block",
              width: 2,
              height: 28,
              background: GREEN,
              opacity: Math.floor(typingFrame / 6) % 2 === 0 ? 1 : 0.2,
            }}
          />
        )}
      </div>
    </div>
  );
};

const FormSelect: React.FC<{
  label: string;
  value: string;
  highlighted?: boolean;
  chosen?: boolean;
}> = ({ label, value, highlighted = false, chosen = false }) => (
  <div>
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: "0.2em",
        color: GRAY_TEXT,
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {label}
    </div>
    <div
      style={{
        background: INPUT_BG,
        border: `2px solid ${highlighted ? GREEN_BORDER : INPUT_BORDER}`,
        padding: "20px 22px",
        fontFamily: body.fontFamily,
        fontWeight: 500,
        fontSize: 30,
        color: chosen ? "white" : "rgba(255,255,255,0.35)",
        minHeight: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: highlighted ? `0 0 20px ${GREEN_DIM}` : "none",
        transition: "all 150ms",
      }}
    >
      <span>{value}</span>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 22 }}>▾</span>
    </div>
  </div>
);

/* ---------- Asignaciones panel ---------- */

const TEACHERS = [
  { name: "Lucas Medina", select: "lucas" },
  { name: "Martín Aguirre", select: "martin" },
  { name: "Ana Sosa", select: "ana" },
  { name: "Julián Reyes", select: "julian" },
  { name: "Nico Vera", select: "nico" },
];

/* Timeline (appFrame):
   490-520: scrolled into view
   540-560: pick Lucas chip
   580-600: pick Martín chip
   620-640: press Asignar button
   660-700: success toast
*/

const AsignacionesPanel: React.FC<{ appFrame: number }> = ({ appFrame }) => {
  const f = appFrame;

  const lucasOn = f >= 555;
  const martinOn = f >= 598;
  const selectedCount = (lucasOn ? 1 : 0) + (martinOn ? 1 : 0);

  const buttonPressed = f >= 625 && f < 650;
  const buttonReady = selectedCount > 0;
  const success = f >= 650;

  const successIn = interpolate(f, [650, 680], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <section
      style={{
        border: `1px solid ${PANEL_BORDER}`,
        background: PANEL_BG,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <PanelHeader title="Asignaciones" />
      <div
        style={{
          padding: 36,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <FormSelect label="Alumno" value="Camila Torres" chosen />

        <div>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "0.2em",
              color: GRAY_TEXT,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Profes ({selectedCount})
          </div>
          <div
            style={{
              background: INPUT_BG,
              border: `2px solid ${INPUT_BORDER}`,
              padding: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {TEACHERS.map((t) => {
              const on =
                (t.select === "lucas" && lucasOn) ||
                (t.select === "martin" && martinOn);
              return (
                <div
                  key={t.select}
                  style={{
                    padding: "12px 20px",
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 22,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: on ? `2px solid ${GREEN}` : "2px solid #303030",
                    background: on ? GREEN_DIM : "transparent",
                    color: on ? "white" : "rgba(255,255,255,0.55)",
                    transition: "all 200ms",
                    boxShadow: on ? `0 0 16px rgba(126,217,87,0.25)` : "none",
                  }}
                >
                  {t.name}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            alignSelf: "flex-start",
            padding: "20px 48px",
            marginTop: 8,
            background: buttonReady || success ? GREEN : "rgba(255,255,255,0.06)",
            color: buttonReady || success ? "black" : "rgba(255,255,255,0.4)",
            border:
              buttonReady || success
                ? "none"
                : "1px solid rgba(255,255,255,0.12)",
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            transform: `scale(${buttonPressed ? 0.96 : 1})`,
            transition: "background 200ms, transform 120ms",
          }}
        >
          Asignar {selectedCount > 0 ? `(${selectedCount})` : ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 36,
          opacity: successIn,
          padding: "14px 22px",
          background: GREEN_DIM,
          border: `1px solid ${GREEN_BORDER}`,
          color: GREEN,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        ✓ 2 profes asignados
      </div>
    </section>
  );
};

/* ---------- Usuarios list panel ---------- */

type UserRow = {
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  tipo?: string;
  profes?: string[];
  highlight?: boolean;
};

const BASE_USERS: UserRow[] = [
  { name: "Tomás (vos)", email: "tomas@rompiendolimites.com", role: "ADMIN" },
  { name: "Martín Aguirre", email: "martin@rompiendolimites.com", role: "TEACHER" },
  { name: "Ana Sosa", email: "ana@rompiendolimites.com", role: "TEACHER" },
  {
    name: "Camila Torres",
    email: "camila@rompiendolimites.com",
    role: "STUDENT",
    tipo: "Personalizado",
    profes: ["Lucas Medina", "Martín A."],
    highlight: true,
  },
  {
    name: "Lucas Medina",
    email: "lucas@rompiendolimites.com",
    role: "TEACHER",
    highlight: true,
  },
  {
    name: "Julián Reyes",
    email: "julian@rompiendolimites.com",
    role: "TEACHER",
  },
  {
    name: "Valentina Ríos",
    email: "valentina@rompiendolimites.com",
    role: "STUDENT",
    tipo: "Personalizado",
    profes: ["Ana Sosa"],
  },
];

const UsuariosPanel: React.FC<{ appFrame: number }> = ({ appFrame }) => {
  const f = appFrame;
  // Highlight rows (Lucas + Camila) pulse green when list comes into view
  const highlightPulse = interpolate(
    (f - 700) % 40,
    [0, 20, 40],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const countTick = interpolate(f, [700, 730], [5, 7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <section
      style={{
        border: `1px solid ${PANEL_BORDER}`,
        background: PANEL_BG,
      }}
    >
      <div
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${PANEL_BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: "0.2em",
            color: "white",
            textTransform: "uppercase",
          }}
        >
          Usuarios
        </span>
        <span
          style={{
            background: GREEN_DIM,
            color: GREEN,
            padding: "2px 12px",
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "0.1em",
          }}
        >
          {Math.round(countTick)}
        </span>
        <div style={{ flex: 1, height: 1, background: PANEL_BORDER }} />
      </div>

      <div>
        {BASE_USERS.map((u, idx) => (
          <UsuarioRow
            key={u.email}
            user={u}
            pulse={u.highlight ? highlightPulse : 0}
            last={idx === BASE_USERS.length - 1}
          />
        ))}
      </div>
    </section>
  );
};

const UsuarioRow: React.FC<{ user: UserRow; pulse: number; last: boolean }> = ({
  user,
  pulse,
  last,
}) => {
  const roleStyle =
    user.role === "ADMIN"
      ? { bg: GREEN_DIM, color: GREEN, border: GREEN_BORDER }
      : user.role === "TEACHER"
      ? {
          bg: "rgba(255,255,255,0.05)",
          color: "white",
          border: "rgba(255,255,255,0.15)",
        }
      : {
          bg: "rgba(26,26,26,1)",
          color: GRAY_TEXT,
          border: "rgba(42,42,42,1)",
        };
  const roleLabel =
    user.role === "ADMIN" ? "Admin" : user.role === "TEACHER" ? "Profe" : "Alumno";

  return (
    <div
      style={{
        padding: "18px 24px",
        borderBottom: last ? "none" : `1px solid ${PANEL_BORDER}`,
        background: `rgba(126,217,87,${pulse * 0.08})`,
        display: "grid",
        gridTemplateColumns: "2fr 2.2fr 1fr 1.6fr",
        alignItems: "center",
        gap: 12,
        transition: "background 100ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            background: INPUT_BG,
            border: `1px solid ${INPUT_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 18,
            color: GRAY_TEXT,
            flexShrink: 0,
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 22,
            color: "white",
          }}
        >
          {user.name}
        </span>
      </div>
      <span
        style={{
          fontFamily: body.fontFamily,
          fontSize: 20,
          color: GRAY_TEXT,
        }}
      >
        {user.email}
      </span>
      <span
        style={{
          display: "inline-block",
          padding: "4px 12px",
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "0.15em",
          color: roleStyle.color,
          background: roleStyle.bg,
          border: `1px solid ${roleStyle.border}`,
          textTransform: "uppercase",
          justifySelf: "start",
        }}
      >
        {roleLabel}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {user.profes?.map((p) => (
          <span
            key={p}
            style={{
              padding: "3px 10px",
              background: INPUT_BG,
              border: `1px solid ${INPUT_BORDER}`,
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 16,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ---------- Global cursor ---------- */

/* Cursor positions in "viewport" coordinates (not scrolled).
   appFrame drives the keyframes. */
const GlobalCursor: React.FC<{ appFrame: number }> = ({ appFrame }) => {
  const f = appFrame;

  /* Keyframes (timeline):
     90-100: cursor appears near form
     100-170: over fields (moves between them subtly)
     170-200: press Crear button (profe)
     200-240: rest, move to fields again
     240-310: over fields (alumno)
     310-340: press Crear button (alumno)
     340-490: rest, then scroll moment — cursor hides
     540-560: over Lucas chip
     580-600: over Martín chip
     620-640: press Asignar button
     640+: hide
  */
  const kf: Array<{ at: number; x: number; y: number; opacity?: number }> = [
    { at: 85, x: 700, y: 900, opacity: 0 },
    { at: 100, x: 420, y: 480, opacity: 1 }, // at name field
    { at: 130, x: 470, y: 620 }, // email field
    { at: 160, x: 460, y: 890 }, // rol select
    { at: 180, x: 210, y: 1190 }, // Crear button
    { at: 200, x: 210, y: 1190 },
    { at: 215, x: 210, y: 1190, opacity: 0 },
    // Alumno phase
    { at: 250, x: 420, y: 480, opacity: 1 },
    { at: 290, x: 460, y: 890 },
    { at: 320, x: 210, y: 1330 }, // Crear button (form taller)
    { at: 340, x: 210, y: 1330 },
    { at: 360, x: 210, y: 1330, opacity: 0 },
    // Scroll to asignaciones (hide)
    // Asignar phase
    { at: 540, x: 280, y: 700, opacity: 1 }, // Lucas chip
    { at: 555, x: 280, y: 700 },
    { at: 580, x: 520, y: 700 }, // Martín chip
    { at: 598, x: 520, y: 700 },
    { at: 620, x: 260, y: 870 }, // Asignar button
    { at: 640, x: 260, y: 870 },
    { at: 660, x: 260, y: 870, opacity: 0 },
    { at: APP_FRAMES, x: 260, y: 870, opacity: 0 },
  ];

  let x = kf[0].x;
  let y = kf[0].y;
  let opacity = kf[0].opacity ?? 1;

  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (f >= a.at && f <= b.at) {
      const t = (f - a.at) / (b.at - a.at || 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      x = a.x + (b.x - a.x) * e;
      y = a.y + (b.y - a.y) * e;
      const aOp = a.opacity ?? 1;
      const bOp = b.opacity ?? 1;
      opacity = aOp + (bOp - aOp) * t;
      break;
    }
    if (f > b.at) {
      x = b.x;
      y = b.y;
      opacity = b.opacity ?? 1;
    }
  }

  // Click press effect on key frames
  const pressAt = [195, 335, 635];
  const pressPulse = Math.max(
    0,
    ...pressAt.map((p) => {
      const d = Math.abs(f - p);
      return d < 8 ? 1 - d / 8 : 0;
    })
  );
  const scale = 1 - pressPulse * 0.2;

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: x,
        opacity,
        transform: `scale(${scale})`,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {/* Click ripple */}
      {pressPulse > 0 && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `3px solid ${GREEN}`,
            opacity: pressPulse * 0.6,
            transform: `scale(${1 + (1 - pressPulse) * 0.6})`,
          }}
        />
      )}
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 3l14 9-6 1 3 7-3 1-3-7-5 3V3z"
          fill="white"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/* ---------- CTA ---------- */

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rlSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });
  const rlScale = interpolate(rlSpring, [0, 1], [0.7, 1]);
  const rlOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateRight: "clamp",
  });
  const wodyOpacity = interpolate(frame, [35, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        textAlign: "center",
      }}
    >
      <div style={{ transform: `scale(${rlScale})`, opacity: rlOpacity }}>
        <Img
          src={staticFile("logos/rompiendo-limites.png")}
          style={{ width: 280, height: "auto" }}
        />
      </div>

      <div
        style={{
          marginTop: 50,
          opacity: ctaOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 78,
          lineHeight: 1.05,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Cada gym
        <br />
        <span style={{ color: GREEN }}>su branding</span>
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: wodyOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.3em",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
        }}
      >
        Powered by
      </div>
      <div style={{ marginTop: 18, opacity: wodyOpacity }}>
        <Img
          src={staticFile("logos/wody-texto.png")}
          style={{ width: 260, height: "auto" }}
        />
      </div>
      <div
        style={{
          marginTop: 36,
          opacity: wodyOpacity,
          fontFamily: body.fontFamily,
          fontWeight: 600,
          fontSize: 34,
          color: GREEN,
          letterSpacing: "0.05em",
        }}
      >
        @wody.app
      </div>
    </AbsoluteFill>
  );
};

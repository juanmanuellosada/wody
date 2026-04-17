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

/* Rompiendo Limites palette */
const GREEN = "#7ed957";
const GREEN_DIM = "rgba(126,217,87,0.15)";
const GREEN_BORDER = "rgba(126,217,87,0.5)";
const BG = "#070707";

/* Scene timing (30s @ 30fps = 900 frames) */
const INTRO = 90;
const PROFE = 240;
const ALUMNO = 240;
const ASIGNAR = 240;
const CTA = 90;

export const UsuariosPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>

      <Sequence from={INTRO} durationInFrames={PROFE}>
        <CrearUsuarioScene variant="profe" />
      </Sequence>

      <Sequence from={INTRO + PROFE} durationInFrames={ALUMNO}>
        <CrearUsuarioScene variant="alumno" />
      </Sequence>

      <Sequence from={INTRO + PROFE + ALUMNO} durationInFrames={ASIGNAR}>
        <AsignarScene />
      </Sequence>

      <Sequence from={INTRO + PROFE + ALUMNO + ASIGNAR} durationInFrames={CTA}>
        <CTAScene />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

/* ---------- Shared layers (green palette) ---------- */

const BackgroundGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.1 + 0.9;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: "-12%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${pulse})`,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(126,217,87,0.35) 0%, rgba(126,217,87,0.08) 35%, transparent 65%)",
          filter: "blur(130px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          right: "-15%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(126,217,87,0.22) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </AbsoluteFill>
  );
};

const GrainOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.04,
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
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const eyebrowOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [25, 50], [30, 0], { extrapolateRight: "clamp" });
  const outOpacity = interpolate(frame, [70, 90], [1, 0], { extrapolateLeft: "clamp" });

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
        Administración
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 150,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "white",
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Profes y alumnos
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 36,
          color: "rgba(255,255,255,0.55)",
          opacity: titleOpacity,
        }}
      >
        En 3 pasos
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Form field ---------- */

const Field: React.FC<{
  label: string;
  value: string;
  typed?: boolean; // animate typing
  frameOffset?: number;
  totalFrames?: number;
  select?: boolean;
  selectHighlight?: boolean;
}> = ({ label, value, typed = false, frameOffset = 0, totalFrames = 20, select = false, selectHighlight = false }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - frameOffset);
  const revealedChars = typed
    ? Math.min(
        value.length,
        Math.floor(interpolate(localFrame, [0, totalFrames], [0, value.length]))
      )
    : value.length;
  const displayed = value.slice(0, revealedChars);
  const showCaret = typed && localFrame > 0 && revealedChars < value.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: "rgba(26,26,26,1)",
          border: `2px solid ${selectHighlight ? GREEN_BORDER : "rgba(42,42,42,1)"}`,
          padding: "24px 26px",
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 36,
          color: value ? "white" : "rgba(255,255,255,0.35)",
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: selectHighlight ? `0 0 30px ${GREEN_DIM}` : "none",
          transition: "all 150ms",
        }}
      >
        <span>
          {displayed}
          {showCaret && (
            <span
              style={{
                marginLeft: 3,
                borderLeft: "2px solid white",
                height: 36,
                display: "inline-block",
                verticalAlign: "middle",
                opacity: Math.floor(localFrame / 10) % 2 === 0 ? 1 : 0,
              }}
            />
          )}
        </span>
        {select && (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 28 }}>▾</span>
        )}
      </div>
    </div>
  );
};

/* ---------- Create-user scene (shared) ---------- */

const CrearUsuarioScene: React.FC<{ variant: "profe" | "alumno" }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isProfe = variant === "profe";
  const name = isProfe ? "Lucas Medina" : "Camila Torres";
  const email = isProfe ? "lucas@rompiendolimites.com" : "camila@rompiendolimites.com";
  const rol = isProfe ? "Profe" : "Alumno";
  const tipoAlumno = "Personalizado (WODs + RMs)";

  // Enter/exit fades (scene lasts 240f)
  const inOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const outOpacity = interpolate(frame, [220, 240], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const opacity = inOpacity * outOpacity;

  // Field animations: name types 0-35, email 35-75, password fill 80-100, role select 110-140
  // studentType appears (alumno only) 145-170, button click 180-205, success 210+
  const showStudentType = !isProfe && frame >= 145;
  const studentTypeIn = interpolate(frame, [145, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonPress = spring({
    frame: frame - 180,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.4 },
  });
  const buttonScale = interpolate(buttonPress, [0, 1], [1, 0.94]);
  const buttonGreen = frame >= 180;

  const successOpacity = interpolate(frame, [205, 225], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const successY = interpolate(frame, [205, 225], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cursorX = frame < 110
    ? 0
    : frame < 140
    ? interpolate(frame, [110, 140], [0, 0])
    : frame < 180
    ? interpolate(frame, [140, 180], [0, 0])
    : 0;

  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 160, opacity }}>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.35em",
          color: GREEN,
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Paso {isProfe ? "01" : "02"} · Crear {isProfe ? "profe" : "alumno"}
      </div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 96,
          color: "white",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
          lineHeight: 1,
          marginBottom: 60,
        }}
      >
        Nuevo usuario
      </div>

      {/* Panel */}
      <div
        style={{
          background: "rgba(10,10,10,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 32,
          position: "relative",
        }}
      >
        <Field label="Nombre" value={name} typed frameOffset={0} totalFrames={30} />
        <Field label="Email" value={email} typed frameOffset={35} totalFrames={40} />
        <Field
          label="Contraseña"
          value={frame >= 80 ? "••••••••••" : ""}
          typed
          frameOffset={80}
          totalFrames={18}
        />
        <Field
          label="Rol"
          value={frame >= 110 ? rol : "Seleccioná un rol"}
          select
          selectHighlight={frame >= 110 && frame < 150}
        />
        {showStudentType && (
          <div style={{ opacity: studentTypeIn, transform: `translateY(${(1 - studentTypeIn) * 20}px)` }}>
            <Field label="Tipo de alumno" value={tipoAlumno} select />
          </div>
        )}

        {/* Submit button */}
        <div
          style={{
            marginTop: 16,
            alignSelf: "center",
            padding: "22px 60px",
            background: buttonGreen ? GREEN : "rgba(255,255,255,0.06)",
            color: buttonGreen ? "black" : "white",
            border: buttonGreen ? "none" : "1px solid rgba(255,255,255,0.15)",
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            transform: `scale(${buttonScale})`,
            transition: "background 200ms",
          }}
        >
          Crear usuario
        </div>

        {/* Cursor approaching role at 100f, then button at 170f */}
        <Cursor
          fromTo={[
            { at: 95, x: 700, y: 450 }, // arrive at rol
            { at: 115, x: 700, y: 450 }, // on rol
            { at: 175, x: 540, y: showStudentType ? 820 : 740 }, // arrive at button
            { at: 200, x: 540, y: showStudentType ? 820 : 740 },
            { at: 215, x: 540, y: showStudentType ? 820 : 740, opacity: 0 },
          ]}
        />
      </div>

      {/* Success */}
      <div
        style={{
          marginTop: 40,
          opacity: successOpacity,
          transform: `translateY(${successY}px)`,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 56,
          color: GREEN,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        ✓ {isProfe ? "Profe" : "Alumno"} creado
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Asignar scene ---------- */

const TEACHERS = [
  "Lucas Medina",
  "Martín Aguirre",
  "Ana Sosa",
  "Julián Reyes",
  "Nico Vera",
];

const AsignarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const outOpacity = interpolate(frame, [220, 240], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = inOpacity * outOpacity;

  // Timeline:
  // 0-30: header + panel appears
  // 60-85: first chip toggled (Lucas)
  // 110-135: second chip toggled (Martín)
  // 170-195: button press
  // 205+: success message
  const lucasOn = frame >= 75;
  const martinOn = frame >= 125;
  const selectedCount = (lucasOn ? 1 : 0) + (martinOn ? 1 : 0);

  const buttonPress = spring({
    frame: frame - 170,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.4 },
  });
  const buttonScale = interpolate(buttonPress, [0, 1], [1, 0.94]);
  const buttonReady = selectedCount > 0 && frame >= 170;

  const successOpacity = interpolate(frame, [200, 225], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 160, opacity }}>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.35em",
          color: GREEN,
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Paso 03 · Conectarlos
      </div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 96,
          color: "white",
          textAlign: "center",
          textTransform: "uppercase",
          lineHeight: 1,
          marginBottom: 50,
        }}
      >
        Asignar profes
      </div>

      {/* Panel */}
      <div
        style={{
          background: "rgba(10,10,10,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 32,
          position: "relative",
        }}
      >
        <Field label="Alumno" value="Camila Torres" select />

        {/* Chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}
          >
            Profes ({selectedCount})
          </div>
          <div
            style={{
              background: "rgba(26,26,26,1)",
              border: "2px solid rgba(42,42,42,1)",
              padding: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {TEACHERS.map((t) => {
              const selected =
                (t === "Lucas Medina" && lucasOn) ||
                (t === "Martín Aguirre" && martinOn);
              return (
                <div
                  key={t}
                  style={{
                    padding: "14px 22px",
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 26,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    border: selected ? `2px solid ${GREEN}` : "2px solid rgba(60,60,60,1)",
                    background: selected ? GREEN_DIM : "transparent",
                    color: selected ? "white" : "rgba(255,255,255,0.55)",
                    transition: "all 200ms",
                    boxShadow: selected ? `0 0 20px rgba(126,217,87,0.25)` : "none",
                  }}
                >
                  {t}
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div
          style={{
            marginTop: 12,
            alignSelf: "center",
            padding: "22px 60px",
            background: buttonReady ? GREEN : "rgba(255,255,255,0.06)",
            color: buttonReady ? "black" : "rgba(255,255,255,0.4)",
            border: buttonReady ? "none" : "1px solid rgba(255,255,255,0.12)",
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            transform: `scale(${buttonScale})`,
            transition: "background 200ms",
          }}
        >
          Asignar {selectedCount > 0 ? `(${selectedCount})` : ""}
        </div>

        {/* Cursor over chips and button */}
        <Cursor
          fromTo={[
            { at: 55, x: 340, y: 520 }, // approach Lucas chip
            { at: 75, x: 340, y: 520 }, // on Lucas
            { at: 105, x: 500, y: 520 }, // approach Martín
            { at: 125, x: 500, y: 520 },
            { at: 160, x: 540, y: 860 }, // approach button
            { at: 195, x: 540, y: 860, opacity: 0 },
          ]}
        />
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: successOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 52,
          color: GREEN,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        ✓ 2 profes asignados a Camila
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Cursor with keyframes ---------- */

type Keyframe = { at: number; x: number; y: number; opacity?: number };

const Cursor: React.FC<{ fromTo: Keyframe[] }> = ({ fromTo }) => {
  const frame = useCurrentFrame();

  // Find current segment
  let x = fromTo[0].x;
  let y = fromTo[0].y;
  let opacity = fromTo[0].opacity ?? 1;

  for (let i = 0; i < fromTo.length - 1; i++) {
    const a = fromTo[i];
    const b = fromTo[i + 1];
    if (frame >= a.at && frame <= b.at) {
      const t = (frame - a.at) / (b.at - a.at || 1);
      x = a.x + (b.x - a.x) * t;
      y = a.y + (b.y - a.y) * t;
      const aOp = a.opacity ?? 1;
      const bOp = b.opacity ?? 1;
      opacity = aOp + (bOp - aOp) * t;
      break;
    }
    if (frame > b.at) {
      x = b.x;
      y = b.y;
      opacity = b.opacity ?? 1;
    }
  }

  const startOpacity = interpolate(frame, [fromTo[0].at - 10, fromTo[0].at], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: x,
        opacity: opacity * startOpacity,
        pointerEvents: "none",
        transition: "none",
      }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
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
  const rlOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const wodyOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });

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

import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBody } from "@remotion/google-fonts/Barlow";

const heading = loadHeading("normal", {
  weights: ["500", "700", "900"],
  subsets: ["latin"],
});
const body = loadBody("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

/* ─── Palette ─── */
const BRAND = "#f80710";
const BRAND_DIM = "rgba(248,7,16,0.15)";
const BRAND_BORDER = "rgba(248,7,16,0.5)";
const BRAND_BORDER_DIM = "rgba(248,7,16,0.3)";
const BG = "#000000";
const PANEL_BG = "#0A0A0A";
const PANEL_BORDER = "#1A1A1A";
const INPUT_BG = "#121212";
const INPUT_BORDER = "#232323";
const GRAY_TEXT = "rgba(255,255,255,0.5)";
const GRAY_TEXT_DIM = "rgba(255,255,255,0.3)";
const GREEN = "#22c55e";
const GREEN_DIM = "rgba(34,197,94,0.1)";
const GREEN_BORDER = "rgba(34,197,94,0.3)";
const YELLOW = "#eab308";
const YELLOW_DIM = "rgba(234,179,8,0.1)";
const YELLOW_BORDER = "rgba(234,179,8,0.3)";

/* ─── Timing constants (must sum to 1800) ─── */
// 90+360+300+150+210+180+240+120+150 = 1800
const INTRO_START = 0;
const INTRO_DUR = 90;
const ALTA_START = 90;
const ALTA_DUR = 360;
const RUTINA_START = 450;
const RUTINA_DUR = 300;
const WOD_START = 750;
const WOD_DUR = 150;
const TIMER_START = 900;
const TIMER_DUR = 210;
const BENEF_START = 1110;
const BENEF_DUR = 180;
const INGRESO_START = 1290;
const INGRESO_DUR = 240;
const PAGO_START = 1530;
const PAGO_DUR = 120;
const CTA_START = 1650;
const CTA_DUR = 150;

/* ─── Animation utilities ─── */

function slideIn(frame: number, durIn = 12): { translateY: number; opacity: number } {
  const translateY = interpolate(frame, [0, durIn], [80, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, durIn], [0, 1], {
    extrapolateRight: "clamp",
  });
  return { translateY, opacity };
}

function slideOut(
  frame: number,
  totalDur: number,
  durOut = 12
): { translateY: number; opacity: number } {
  const start = totalDur - durOut;
  const translateY = interpolate(frame, [start, totalDur], [0, -80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const opacity = interpolate(frame, [start, totalDur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { translateY, opacity };
}

function combineSlide(
  frame: number,
  totalDur: number
): { transform: string; opacity: number } {
  const inn = slideIn(frame);
  const out = slideOut(frame, totalDur);
  const opacity = Math.min(inn.opacity, out.opacity);
  const translateY = inn.translateY + out.translateY;
  return { transform: `translateY(${translateY}px)`, opacity };
}

function typewriter(text: string, frame: number, startFrame: number, framesPerChar: number): string {
  if (frame < startFrame) return "";
  const chars = Math.floor((frame - startFrame) / framesPerChar);
  return text.slice(0, Math.min(chars, text.length));
}

/* ─── BackgroundGlow & GrainOverlay ─── */

const BackgroundGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 4) * 0.07 + 0.9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${pulse})`,
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(248,7,16,0.22) 0%, rgba(248,7,16,0.05) 40%, transparent 65%)",
          filter: "blur(160px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(248,7,16,0.12) 0%, transparent 70%)",
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
      opacity: 0.035,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    }}
  />
);

/* ─── PhoneFrame ─── */

const PhoneFrame: React.FC<{ children: React.ReactNode; padTop?: number }> = ({
  children,
  padTop = 60,
}) => (
  <div
    style={{
      position: "absolute",
      top: padTop,
      left: 40,
      right: 40,
      bottom: 60,
      background: PANEL_BG,
      border: `1px solid ${PANEL_BORDER}`,
      borderRadius: 24,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Notch */}
    <div
      style={{
        height: 32,
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 80, height: 10, background: "#1A1A1A", borderRadius: 10 }} />
    </div>
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      {children}
    </div>
  </div>
);

/* ─── PulseRing ─── */

const PulseRing: React.FC<{ active: boolean; color?: string }> = ({
  active,
  color = BRAND,
}) => {
  const frame = useCurrentFrame();
  if (!active) return null;
  const t = (frame % 30) / 30;
  const scale = 0.8 + t * 0.6;
  const opacity = 0.8 * (1 - t);
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 80,
        height: 80,
        borderRadius: "50%",
        border: `3px solid ${color}`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/* ─── SVG Glyphs ─── */

const CheckGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SearchGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <path d="M16.5 16.5l4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TicketGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="7" width="20" height="10" rx="1" stroke={color} strokeWidth="1.5" />
    <path d="M9 7v10M15 7v10" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
  </svg>
);

const CopyGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.5" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={color} strokeWidth="1.5" />
  </svg>
);

const PlayGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5 3l14 9-14 9V3z" />
  </svg>
);

const PauseGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="5" y="3" width="4" height="18" />
    <rect x="15" y="3" width="4" height="18" />
  </svg>
);

const RefreshGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 4v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 10A10 10 0 1014 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ─── QR mock ─── */

function makeQrPattern(size: number): boolean[][] {
  const grid: boolean[][] = [];
  let v = 0x5a3c;
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= size - 7) ||
        (r >= size - 7 && c < 7);
      if (inFinder) {
        const isEdgeRow = r === 0 || r === 6 || r === size - 7 || r === size - 1;
        const isEdgeCol = c === 0 || c === 6;
        const innerTL = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const innerTR = r >= 2 && r <= 4 && c >= size - 5 && c <= size - 3;
        const innerBL = r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4;
        row.push(isEdgeRow || isEdgeCol || innerTL || innerTR || innerBL);
      } else {
        v = (v * 1103515245 + 12345) & 0x7fffffff;
        row.push((v >> 10) % 3 !== 0);
      }
    }
    grid.push(row);
  }
  return grid;
}

const QR_PATTERN = makeQrPattern(21);

const QrMock: React.FC<{ size?: number; pulseOpacity?: number }> = ({ size = 220, pulseOpacity = 1 }) => {
  const cell = (size - 24) / 21;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "white",
        padding: 12,
        opacity: pulseOpacity,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {QR_PATTERN.map((row, ri) => (
          <div key={ri} style={{ display: "flex" }}>
            {row.map((cell_val, ci) => (
              <div
                key={ci}
                style={{ width: cell, height: cell, background: cell_val ? "black" : "white" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   SCENES
══════════════════════════════════════════════════════════ */

/* ─── Scene 0: Intro (0–150, 5s) ─── */

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSp = spring({ frame, fps, config: { damping: 16, stiffness: 110, mass: 0.6 } });
  const logoScale = interpolate(logoSp, [0, 1], [0.82, 1]);
  const logoOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [20, 36], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [20, 36], [20, 0], { extrapolateRight: "clamp" });

  const barScale = interpolate(frame, [36, 52], [0, 1], { extrapolateRight: "clamp" });

  const outOpacity = interpolate(frame, [72, 90], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        textAlign: "center",
        padding: 80,
        opacity: outOpacity,
      }}
    >
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
        <Img src={staticFile("logos/atlas-gym.png")} style={{ width: 700, height: "auto" }} />
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 36,
          letterSpacing: "0.08em",
          color: GRAY_TEXT,
        }}
      >
        Los Polvorines · Buenos Aires
      </div>

      <div
        style={{
          marginTop: 24,
          width: 280,
          height: 3,
          background: BRAND,
          transform: `scaleX(${barScale})`,
          transformOrigin: "center",
        }}
      />
    </AbsoluteFill>
  );
};

/* ─── Scene 1: Alta de Usuario (90–450, 12s) — DOBLE ALTA ─── */

const SceneAltaUsuario: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = ALTA_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  /* ── Sub-fase A: Profe (frames 0-180) ── */
  const nombreAText = typewriter("Carla Méndez", frame, 15, 4);
  const emailAText = typewriter("carla.mendez@atlas.gym", frame, 65, 3);
  const rolADropdownOpen = frame >= 118 && frame < 136;
  const rolASelected = frame >= 136;
  const submitAPulse = frame >= 155 && frame < 176;
  const submittedA = frame >= 170;

  const successAOpacity = interpolate(frame, [172, 185], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Transición (frames 180-200): fade-out success card ── */
  const transitionFadeOut = interpolate(frame, [180, 200], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Sub-fase B: Alumno (frames 200-360) ── */
  const phaseB = frame >= 200;
  const frameBLocal = frame - 200;

  const nombreBText = typewriter("Tomás López", frameBLocal, 5, 4);
  const emailBText = typewriter("tomas.lopez@atlas.gym", frameBLocal, 52, 3);
  const rolBDropdownOpen = frameBLocal >= 105 && frameBLocal < 122;
  const rolBSelected = frameBLocal >= 122;
  const extrasVisible = frameBLocal >= 130;

  const profeDropdownOpen = frameBLocal >= 140 && frameBLocal < 158;
  const profeSelected = frameBLocal >= 158;

  const extrasOpacity = interpolate(frameBLocal, [130, 148], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const extrasY = interpolate(frameBLocal, [130, 148], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const submitBPulse = frameBLocal >= 130 && frameBLocal < 150;
  const submittedB = frameBLocal >= 143;

  const successBOpacity = interpolate(frameBLocal, [145, 158], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: heading.fontFamily,
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: "0.15em",
    color: GRAY_TEXT,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const inputBase: React.CSSProperties = {
    background: INPUT_BG,
    border: `1px solid ${INPUT_BORDER}`,
    padding: "14px 16px",
    fontFamily: body.fontFamily,
    fontWeight: 500,
    fontSize: 24,
    color: "white",
    minHeight: 52,
    display: "flex",
    alignItems: "center",
  };

  const headerSection = (
    <>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.2em",
          color: GRAY_TEXT_DIM,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Admin · Atlas
      </div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 38,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 20,
        }}
      >
        Nuevo usuario
      </div>
    </>
  );

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div
          style={{
            padding: "14px 24px 20px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflowY: "auto",
          }}
        >
          {!phaseB ? (
            /* ── Sub-fase A ── */
            <>
              {headerSection}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Nombre */}
                <div>
                  <div style={labelStyle}>Nombre</div>
                  <div style={inputBase}>
                    {nombreAText}
                    {frame >= 15 && frame < 63 && (
                      <span style={{ marginLeft: 2, display: "inline-block", width: 2, height: 20, background: BRAND, opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0.2 }} />
                    )}
                  </div>
                </div>
                {/* Email */}
                <div>
                  <div style={labelStyle}>Email</div>
                  <div style={inputBase}>
                    {emailAText}
                    {frame >= 65 && frame < 116 && (
                      <span style={{ marginLeft: 2, display: "inline-block", width: 2, height: 20, background: BRAND, opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0.2 }} />
                    )}
                  </div>
                </div>
                {/* Contraseña */}
                <div>
                  <div style={labelStyle}>Contraseña</div>
                  <div style={{ ...inputBase, color: GRAY_TEXT }}>••••••••</div>
                </div>
                {/* Rol */}
                <div style={{ position: "relative" }}>
                  <div style={labelStyle}>Rol</div>
                  <div style={{ ...inputBase, border: `1px solid ${rolADropdownOpen ? BRAND_BORDER : INPUT_BORDER}`, justifyContent: "space-between" }}>
                    <span style={{ color: rolASelected ? "white" : GRAY_TEXT_DIM }}>
                      {rolASelected ? "Profe" : "Selecciona un rol"}
                    </span>
                    <span style={{ color: GRAY_TEXT_DIM, fontSize: 20 }}>▾</span>
                  </div>
                  {rolADropdownOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0f0f0f", border: `1px solid ${BRAND_BORDER}`, zIndex: 10 }}>
                      {["Admin (Profe)", "Profe", "Alumno"].map((opt) => (
                        <div key={opt} style={{ padding: "12px 16px", fontFamily: body.fontFamily, fontSize: 22, color: opt === "Profe" ? BRAND : "white", background: opt === "Profe" ? BRAND_DIM : "transparent", borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Crear Usuario / Success A */}
                {!submittedA ? (
                  <div style={{ position: "relative", marginTop: 4 }}>
                    <div style={{ width: "100%", padding: "16px 0", background: BRAND, color: "white", fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 26, letterSpacing: "0.15em", textTransform: "uppercase", textAlign: "center", transform: `scale(${submitAPulse ? 0.97 : 1})` }}>
                      Crear Usuario
                    </div>
                    {submitAPulse && <PulseRing active color={BRAND} />}
                  </div>
                ) : (
                  <div style={{ opacity: successAOpacity * (frame < 180 ? 1 : transitionFadeOut), border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.05)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <CheckGlyph size={16} color={GREEN} />
                      <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", color: GREEN, textTransform: "uppercase" }}>Usuario creado</span>
                    </div>
                    <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.15em", color: GREEN, textTransform: "uppercase", fontVariantNumeric: "tabular-nums" }}>Nº de socio: 0042</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Sub-fase B: Alumno ── */
            <>
              {headerSection}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nombre */}
                <div>
                  <div style={labelStyle}>Nombre</div>
                  <div style={inputBase}>
                    {nombreBText}
                    {frameBLocal >= 5 && frameBLocal < 50 && (
                      <span style={{ marginLeft: 2, display: "inline-block", width: 2, height: 20, background: BRAND, opacity: Math.floor(frameBLocal / 6) % 2 === 0 ? 1 : 0.2 }} />
                    )}
                  </div>
                </div>
                {/* Email */}
                <div>
                  <div style={labelStyle}>Email</div>
                  <div style={inputBase}>
                    {emailBText}
                    {frameBLocal >= 52 && frameBLocal < 104 && (
                      <span style={{ marginLeft: 2, display: "inline-block", width: 2, height: 20, background: BRAND, opacity: Math.floor(frameBLocal / 6) % 2 === 0 ? 1 : 0.2 }} />
                    )}
                  </div>
                </div>
                {/* Contraseña */}
                <div>
                  <div style={labelStyle}>Contraseña</div>
                  <div style={{ ...inputBase, color: GRAY_TEXT }}>••••••••</div>
                </div>
                {/* Rol */}
                <div style={{ position: "relative" }}>
                  <div style={labelStyle}>Rol</div>
                  <div style={{ ...inputBase, border: `1px solid ${rolBDropdownOpen ? BRAND_BORDER : INPUT_BORDER}`, justifyContent: "space-between" }}>
                    <span style={{ color: rolBSelected ? "white" : GRAY_TEXT_DIM }}>
                      {rolBSelected ? "Alumno" : "Selecciona un rol"}
                    </span>
                    <span style={{ color: GRAY_TEXT_DIM, fontSize: 20 }}>▾</span>
                  </div>
                  {rolBDropdownOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0f0f0f", border: `1px solid ${BRAND_BORDER}`, zIndex: 10 }}>
                      {["Admin (Profe)", "Profe", "Alumno"].map((opt) => (
                        <div key={opt} style={{ padding: "12px 16px", fontFamily: body.fontFamily, fontSize: 22, color: opt === "Alumno" ? BRAND : "white", background: opt === "Alumno" ? BRAND_DIM : "transparent", borderBottom: `1px solid ${PANEL_BORDER}` }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extras cuando rol = Alumno */}
                {extrasVisible && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: extrasOpacity, transform: `translateY(${extrasY}px)` }}>
                    {/* Tipo de alumno */}
                    <div>
                      <div style={labelStyle}>Tipo de alumno</div>
                      <div style={{ ...inputBase, justifyContent: "space-between" }}>
                        <span>Personalizado (Rutinas + PRs)</span>
                        <span style={{ color: GRAY_TEXT_DIM, fontSize: 20 }}>▾</span>
                      </div>
                    </div>
                    {/* Profe opcional */}
                    <div style={{ position: "relative" }}>
                      <div style={labelStyle}>Profe (opcional)</div>
                      <div style={{ ...inputBase, border: `1px solid ${profeDropdownOpen ? BRAND_BORDER : INPUT_BORDER}`, justifyContent: "space-between" }}>
                        <span style={{ color: profeSelected ? "white" : GRAY_TEXT_DIM }}>
                          {profeSelected ? "Carla Méndez" : "Sin profe (se autogestiona)"}
                        </span>
                        <span style={{ color: GRAY_TEXT_DIM, fontSize: 20 }}>▾</span>
                      </div>
                      {profeDropdownOpen && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0f0f0f", border: `1px solid ${BRAND_BORDER}`, zIndex: 10 }}>
                          {["Sin profe (se autogestiona)", "Carla Méndez"].map((opt) => (
                            <div key={opt} style={{ padding: "12px 16px", fontFamily: body.fontFamily, fontSize: 22, color: opt === "Carla Méndez" ? BRAND : "white", background: opt === "Carla Méndez" ? BRAND_DIM : "transparent", borderBottom: `1px solid ${PANEL_BORDER}` }}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Checkbox */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 22, height: 22, border: `1px solid ${INPUT_BORDER}`, background: INPUT_BG, flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontFamily: body.fontFamily, fontWeight: 500, fontSize: 20, color: "white" }}>
                          Puede crear sus propias rutinas
                        </div>
                        <div style={{ fontFamily: body.fontFamily, fontSize: 16, color: GRAY_TEXT, marginTop: 4, lineHeight: 1.4 }}>
                          El alumno va a poder crear rutinas asignadas a sí mismo.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Crear Usuario / Success B */}
                {!submittedB ? (
                  <div style={{ position: "relative", marginTop: 4 }}>
                    <div style={{ width: "100%", padding: "16px 0", background: BRAND, color: "white", fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 26, letterSpacing: "0.15em", textTransform: "uppercase", textAlign: "center", transform: `scale(${submitBPulse ? 0.97 : 1})` }}>
                      Crear Usuario
                    </div>
                    {submitBPulse && <PulseRing active color={BRAND} />}
                  </div>
                ) : (
                  <div style={{ opacity: successBOpacity, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.05)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <CheckGlyph size={16} color={GREEN} />
                      <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", color: GREEN, textTransform: "uppercase" }}>Usuario creado</span>
                    </div>
                    <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.15em", color: GREEN, textTransform: "uppercase", fontVariantNumeric: "tabular-nums" }}>Nº de socio: 0043</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 2: Crear Rutina (450–750, 10s) — TargetSelector + rutina de gym ─── */

const SceneCrearRutina: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = RUTINA_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  // Phase: list → editor → saved
  const showEditor = frame >= 30;
  const showSavedCard = frame >= 255;

  const listPulse = frame >= 14 && frame < 30;

  // TargetSelector state: starts "Todos", click "Alumno" at frame ~70
  const targetAlumno = frame >= 78;
  const alumnoDropdownOpen = frame >= 78 && frame < 100;
  const alumnoSelected = frame >= 100;

  const titleStartFrame = 50;
  const titleText = typewriter("Rutina de pecho y hombros", frame, titleStartFrame, 4);

  const contentStartFrame = 160;
  // Typed content with markdown headings and bullets
  const fullContent = [
    { type: "h2", text: "CALENTAMIENTO" },
    { type: "li", text: "5 min bici, movilidad articular" },
    { type: "h2", text: "PECHO" },
    { type: "p", text: "Press de banca plano — 4×8-10 al 85% RM" },
    { type: "h2", text: "HOMBRO" },
    { type: "p", text: "Desarrollo militar — 3×10-12" },
    { type: "p", text: "Elevaciones laterales — 3×12-15" },
    { type: "h2", text: "ACCESORIOS" },
    { type: "p", text: "Fondos en paralelas — 3× max reps" },
  ];
  // Build the raw text for typewriter progress tracking
  const rawLines = fullContent.map((l) => (l.type === "h2" ? `## ${l.text}` : l.type === "li" ? `- ${l.text}` : l.text));
  const rawFull = rawLines.join("\n");
  const typedRaw = typewriter(rawFull, frame, contentStartFrame, 2);
  const typedLen = typedRaw.length;

  // Build rendered content based on how many chars have been typed
  let charsConsumed = 0;
  const renderedLines: Array<{ type: string; text: string }> = [];
  for (const line of fullContent) {
    const raw = line.type === "h2" ? `## ${line.text}` : line.type === "li" ? `- ${line.text}` : line.text;
    const lineLen = raw.length + 1; // +1 for \n
    if (charsConsumed >= typedLen) break;
    const partial = typedRaw.slice(charsConsumed, charsConsumed + lineLen - 1);
    renderedLines.push({ type: line.type, text: partial.replace(/^(##\s|- )/, "") });
    charsConsumed += lineLen;
  }

  const guardarPulse = frame >= 230 && frame < 255;

  const cardOpacity = interpolate(frame, [255, 272], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [255, 272], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: heading.fontFamily,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "0.15em",
    color: GRAY_TEXT,
    textTransform: "uppercase",
    marginBottom: 5,
  };

  const targetButtons = ["Todos", "Personalizados", "Grupo", "Alumno"];

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div
          style={{
            padding: "14px 22px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {!showEditor ? (
            /* List phase */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 34, color: "white", textTransform: "uppercase" }}>
                  Rutinas
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ padding: "10px 18px", background: BRAND, color: "white", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <PlusGlyph size={13} color="white" />
                    Nueva Rutina
                  </div>
                  {listPulse && <PulseRing active color={BRAND} />}
                </div>
              </div>
              <p style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.15em", color: "#4a4a4a", textTransform: "uppercase", marginTop: 40, textAlign: "center" }}>
                No hay Rutinas cargadas todavia.
              </p>
            </div>
          ) : !showSavedCard ? (
            /* Editor phase */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${PANEL_BORDER}`, paddingBottom: 10 }}>
                <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, letterSpacing: "0.15em", color: "white", textTransform: "uppercase" }}>
                  Nueva Rutina
                </div>
                <div style={{ width: 148, border: `1px solid ${INPUT_BORDER}`, background: INPUT_BG, padding: "6px 12px", fontFamily: body.fontFamily, fontSize: 20, color: "white", textAlign: "center" }}>
                  25/04/2026
                </div>
              </div>

              {/* TargetSelector */}
              <div>
                <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 13, letterSpacing: "0.15em", color: GRAY_TEXT, textTransform: "uppercase", marginBottom: 6 }}>
                  Destinatario
                </div>
                <div style={{ display: "flex", gap: 6, position: "relative" }}>
                  {targetButtons.map((btn) => {
                    const isActive = btn === "Alumno" ? targetAlumno : btn === "Todos" ? !targetAlumno : false;
                    return (
                      <div
                        key={btn}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          textAlign: "center",
                          border: `1px solid ${isActive ? BRAND_BORDER : INPUT_BORDER}`,
                          background: isActive ? "rgba(248,7,16,0.10)" : INPUT_BG,
                          fontFamily: body.fontFamily,
                          fontWeight: 500,
                          fontSize: 14,
                          color: isActive ? BRAND : GRAY_TEXT,
                          position: "relative",
                        }}
                      >
                        {btn}
                        {btn === "Alumno" && !targetAlumno && frame >= 60 && frame < 78 && (
                          <PulseRing active color={BRAND} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Alumno sub-selector dropdown */}
                {alumnoDropdownOpen && (
                  <div style={{ border: `1px solid ${BRAND_BORDER}`, background: "#0f0f0f", marginTop: 4, zIndex: 10 }}>
                    {["Tomás López", "Lucía Ferrari", "Mateo Ruiz"].map((name) => (
                      <div key={name} style={{ padding: "10px 14px", fontFamily: body.fontFamily, fontSize: 20, color: name === "Tomás López" ? BRAND : "white", background: name === "Tomás López" ? BRAND_DIM : "transparent", borderBottom: `1px solid ${PANEL_BORDER}` }}>
                        {name}
                      </div>
                    ))}
                  </div>
                )}
                {alumnoSelected && !alumnoDropdownOpen && (
                  <div style={{ marginTop: 6, padding: "8px 12px", background: INPUT_BG, border: `1px solid ${BRAND_BORDER_DIM}`, fontFamily: body.fontFamily, fontSize: 18, color: "white", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <span>Tomás López</span>
                    <span style={{ color: GRAY_TEXT_DIM, fontSize: 18 }}>▾</span>
                  </div>
                )}
              </div>

              {/* Title input */}
              <div>
                <div style={labelStyle}>Título</div>
                <div style={{ background: INPUT_BG, border: `1px solid ${titleText ? BRAND_BORDER_DIM : INPUT_BORDER}`, padding: "10px 14px", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 22, color: titleText ? "white" : GRAY_TEXT_DIM, minHeight: 46, display: "flex", alignItems: "center" }}>
                  {titleText || "Título (ej: Rutina, Fuerza, Upper Body...)"}
                  {frame >= titleStartFrame && frame < titleStartFrame + 25 * 4 + 10 && titleText.length < 25 && (
                    <span style={{ marginLeft: 2, display: "inline-block", width: 2, height: 18, background: BRAND, opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0.2 }} />
                  )}
                </div>
              </div>

              {/* Markdown editor */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={labelStyle}>Contenido</div>
                <div style={{ display: "flex", gap: 6, padding: "6px 10px", background: "#0a0a0a", border: `1px solid ${INPUT_BORDER}`, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                  {["B", "I", "•", "1.", "H2", "❝"].map((t) => (
                    <span key={t} style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 16, color: GRAY_TEXT_DIM, padding: "2px 5px" }}>{t}</span>
                  ))}
                </div>
                <div style={{ flex: 1, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderTop: "none", padding: "10px 14px", overflow: "hidden" }}>
                  {frame < contentStartFrame ? (
                    <span style={{ fontFamily: body.fontFamily, fontSize: 18, color: GRAY_TEXT_DIM }}>Escribi la Rutina aca...</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {renderedLines.map((line, idx) => {
                        if (line.type === "h2") {
                          return (
                            <div key={idx} style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 17, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase", marginTop: idx > 0 ? 6 : 0 }}>
                              {line.text}
                            </div>
                          );
                        } else if (line.type === "li") {
                          return (
                            <div key={idx} style={{ fontFamily: body.fontFamily, fontSize: 17, color: "white", paddingLeft: 12, lineHeight: 1.4 }}>
                              · {line.text}
                            </div>
                          );
                        } else {
                          return (
                            <div key={idx} style={{ fontFamily: body.fontFamily, fontSize: 17, color: GRAY_TEXT, lineHeight: 1.4 }}>
                              {line.text}
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 2, flexShrink: 0 }}>
                <div style={{ padding: "10px 20px", border: `1px solid ${PANEL_BORDER}`, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 19, letterSpacing: "0.1em", color: GRAY_TEXT, textTransform: "uppercase" }}>
                  Cancelar
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ padding: "10px 20px", background: BRAND, color: "white", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 19, letterSpacing: "0.1em", textTransform: "uppercase", transform: `scale(${guardarPulse ? 0.97 : 1})` }}>
                    Guardar Rutina
                  </div>
                  {guardarPulse && <PulseRing active color={BRAND} />}
                </div>
              </div>
            </div>
          ) : (
            /* Saved — SOLO la card, sin header "Rutinas" ni botón "+ Nueva Rutina" */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center", height: "100%" }}>
              <div
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  background: "#0f0f0f",
                  border: `1px solid ${INPUT_BORDER}`,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${PANEL_BORDER}`, paddingBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.15em", color: BRAND, textTransform: "uppercase" }}>25/04/2026</span>
                  <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, color: "white" }}>Rutina de pecho y hombros</span>
                  <span style={{ padding: "3px 10px", background: "rgba(248,7,16,0.10)", border: "1px solid rgba(248,7,16,0.20)", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND }}>
                    Tomás López
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase" }}>CALENTAMIENTO</div>
                  <div style={{ fontFamily: body.fontFamily, fontSize: 16, color: GRAY_TEXT }}>· 5 min bici, movilidad articular</div>
                  <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase", marginTop: 4 }}>PECHO</div>
                  <div style={{ fontFamily: body.fontFamily, fontSize: 16, color: GRAY_TEXT }}>Press de banca plano — 4×8-10 al 85% RM</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 3: Alumno ve la Rutina (660–840, 6s) ─── */

const SceneAlumnoRutina: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = WOD_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  const dotOpacity = 0.5 + 0.5 * Math.sin((frame / 8) * Math.PI);

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div
          style={{
            padding: "12px 24px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "0.2em",
              color: GRAY_TEXT_DIM,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            ATLAS · MI RUTINA
          </div>

          {/* WodCard with accent */}
          <div
            style={{
              background: BRAND_DIM,
              border: `1px solid ${BRAND_BORDER_DIM}`,
              borderLeft: `3px solid ${BRAND}`,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(248,7,16,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: BRAND,
                    borderRadius: "50%",
                    flexShrink: 0,
                    opacity: dotOpacity,
                  }}
                />
                <span
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 900,
                    fontSize: 24,
                    color: BRAND,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  HOY — Viernes, 25 de abril
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: heading.fontFamily,
                  fontWeight: 700,
                  fontSize: 20,
                  color: GRAY_TEXT,
                  paddingLeft: 18,
                }}
              >
                Rutina de pecho y hombros
              </div>
            </div>
            <div
              style={{
                padding: "14px 18px",
                fontFamily: body.fontFamily,
                fontSize: 20,
                color: "white",
                lineHeight: 1.6,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase" }}>CALENTAMIENTO</div>
              <div style={{ color: GRAY_TEXT, fontSize: 18 }}>· 5 min bici, movilidad articular</div>
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase", marginTop: 6 }}>PECHO</div>
              <div style={{ color: GRAY_TEXT, fontSize: 18 }}>Press de banca plano — 4×8-10 al 85% RM</div>
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", color: BRAND, textTransform: "uppercase", marginTop: 6 }}>HOMBRO</div>
              <div style={{ color: GRAY_TEXT, fontSize: 18 }}>Desarrollo militar — 3×10-12</div>
              <div style={{ color: GRAY_TEXT, fontSize: 18, opacity: 0.7 }}>Elevaciones laterales — 3×12-15</div>
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8, opacity: 0.3 }}>
            <div
              style={{
                width: 2,
                height: 28,
                background: GRAY_TEXT,
                borderRadius: 4,
                opacity: 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI),
              }}
            />
          </div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 4: Cronómetros (840–1080, 8s) ─── */

const SceneCronometro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = TIMER_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  const showSelector = frame < 70;
  const showConfig = frame >= 70 && frame < 135;
  const showPreCountdown = frame >= 135 && frame < 162;
  const showRunning = frame >= 162;

  const tabataPulse = frame >= 55 && frame < 72;
  const iniciarPulse = frame >= 120 && frame < 138;

  const timerSeconds = Math.max(0, 20 - Math.floor((frame - 162) / 3));
  const mm = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const ss = String(timerSeconds % 60).padStart(2, "0");

  const countNum = frame < 152 ? "3" : frame < 162 ? "2" : "1";

  const basicCards = [
    { label: "Cronómetro", desc: "Cuenta progresiva simple" },
    { label: "Temporizador", desc: "Cuenta regresiva configurable" },
    { label: "Intervalos", desc: "Trabajo / descanso personalizable" },
  ];
  const presetCards = [
    { label: "TABATA", desc: "Trabajo, descanso y rondas configurables" },
    { label: "AMRAP", desc: "Cuenta regresiva — tantas rondas como puedas" },
    { label: "FOR TIME", desc: "Cronómetro progresivo con time cap opcional" },
  ];

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100%",
            overflowY: "auto",
          }}
        >
          {showSelector && (
            <>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 42,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                Cronómetros
              </div>

              <div>
                <div
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 17,
                    letterSpacing: "0.15em",
                    color: GRAY_TEXT,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Básicos
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {basicCards.map((c) => (
                    <div
                      key={c.label}
                      style={{
                        border: `1px solid ${PANEL_BORDER}`,
                        background: PANEL_BG,
                        padding: "12px 16px",
                      }}
                    >
                      <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 22, color: "white", textTransform: "uppercase" }}>{c.label}</div>
                      <div style={{ fontFamily: body.fontFamily, fontSize: 17, color: GRAY_TEXT, marginTop: 2 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 17,
                    letterSpacing: "0.15em",
                    color: GRAY_TEXT,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Presets de entrenamiento
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {presetCards.map((c) => (
                    <div
                      key={c.label}
                      style={{
                        border: `1px solid ${BRAND_BORDER_DIM}`,
                        background: BRAND_DIM,
                        padding: "12px 16px",
                        position: "relative",
                      }}
                    >
                      <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 22, color: "white", textTransform: "uppercase" }}>{c.label}</div>
                      <div style={{ fontFamily: body.fontFamily, fontSize: 17, color: GRAY_TEXT, marginTop: 2 }}>{c.desc}</div>
                      {c.label === "TABATA" && tabataPulse && <PulseRing active color={BRAND} />}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {showConfig && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, color: GRAY_TEXT_DIM, letterSpacing: "0.1em" }}>← Volver</span>
                <span style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 34, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>TABATA</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[{ label: "Trabajo (s)", value: "20" }, { label: "Descanso (s)", value: "10" }, { label: "Rondas", value: "8" }].map((f) => (
                  <div key={f.label}>
                    <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 16, letterSpacing: "0.2em", color: GRAY_TEXT, textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>{f.label}</div>
                    <div style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, padding: "16px 0", fontFamily: body.fontFamily, fontWeight: 600, fontSize: 52, color: "white", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: body.fontFamily, fontSize: 20, color: GRAY_TEXT, textAlign: "center", marginTop: 2 }}>Total: 04:00</div>

              <div style={{ position: "relative", marginTop: 6 }}>
                <div
                  style={{
                    padding: "18px 0",
                    width: "100%",
                    background: BRAND,
                    color: "white",
                    fontFamily: heading.fontFamily,
                    fontWeight: 900,
                    fontSize: 28,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transform: `scale(${iniciarPulse ? 0.97 : 1})`,
                  }}
                >
                  <PlayGlyph size={22} color="white" />
                  Iniciar
                </div>
                {iniciarPulse && <PulseRing active color={BRAND} />}
              </div>
            </>
          )}

          {showPreCountdown && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 48,
                  color: BRAND,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  opacity: 0.7 + 0.3 * Math.sin((frame / 8) * Math.PI),
                }}
              >
                Preparate!
              </div>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 160,
                  color: "white",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {countNum}
              </div>
            </div>
          )}

          {showRunning && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 24, letterSpacing: "0.2em", color: BRAND, textTransform: "uppercase" }}>
                Trabajo
              </div>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 120,
                  color: BRAND,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {mm}:{ss}
              </div>
              <div style={{ fontFamily: body.fontFamily, fontSize: 22, color: GRAY_TEXT, textAlign: "center" }}>Ronda 1 / 8</div>
              <div style={{ fontFamily: body.fontFamily, fontSize: 20, color: GRAY_TEXT_DIM }}>Total: 03:58</div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <div style={{ padding: "14px 28px", border: `1px solid ${PANEL_BORDER}`, color: GRAY_TEXT, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                  <PauseGlyph size={16} color={GRAY_TEXT} />
                  Pausar
                </div>
                <div style={{ padding: "14px 28px", border: `1px solid ${BRAND_BORDER_DIM}`, background: BRAND_DIM, color: BRAND, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                  <RefreshGlyph size={16} color={BRAND} />
                  Reiniciar
                </div>
              </div>
            </div>
          )}
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 5: Beneficios (1110–1290, 6s) — cupones REALES con logos REALES ─── */

const SceneBeneficios: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = BENEF_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  // Foco en Tica (card 3, index 2): click "Obtener código" at ~3.5s ≈ frame 105
  const ticaPulse = frame >= 90 && frame < 108;
  const codeVisible = frame >= 105;

  const codeScale = interpolate(frame, [105, 118], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const codeOpacity = interpolate(frame, [105, 118], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const coupons = [
    {
      logo: staticFile("logos/nutrite-con-lu.png"),
      name: "NUTRITE CON LU",
      badge: "Un solo uso",
      desc: "Bioimpedancia de regalo con tu consulta nutricional.",
    },
    {
      logo: staticFile("logos/ready-for-wod.png"),
      name: "READY FOR WOD",
      badge: "Un solo uso",
      desc: "10% de descuento en tu primera compra.",
    },
    {
      logo: staticFile("logos/tica.png"),
      name: "TICA",
      badge: "Tienda online",
      desc: "10% de descuento en ticaclothes.com.ar.",
    },
  ];

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div
          style={{
            padding: "12px 22px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            height: "100%",
            overflowY: "auto",
          }}
        >
          <div>
            <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 13, letterSpacing: "0.3em", color: BRAND, textTransform: "uppercase", marginBottom: 3 }}>
              EXCLUSIVO PARA ALUMNOS
            </div>
            <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 36, color: "white", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Beneficios
            </div>
            <div style={{ fontFamily: body.fontFamily, fontSize: 15, color: GRAY_TEXT, marginTop: 3, lineHeight: 1.4 }}>
              Descuentos y regalos de comercios aliados, para alumnos de cualquier gym que use WODY.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {coupons.map((c, i) => {
              const isTica = i === 2;
              return (
                <div
                  key={c.name}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${isTica && frame >= 88 ? BRAND_BORDER_DIM : "rgba(255,255,255,0.08)"}`,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Logo real */}
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        flexShrink: 0,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <Img src={c.logo} style={{ width: 64, height: 64, objectFit: "contain" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", color: "white", textTransform: "uppercase" }}>{c.name}</div>
                      <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 12, letterSpacing: "0.15em", color: "rgba(248,7,16,0.8)", textTransform: "uppercase", marginTop: 2 }}>{c.badge}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: body.fontFamily, fontSize: 15, color: GRAY_TEXT, lineHeight: 1.4 }}>{c.desc}</div>

                  {isTica ? (
                    codeVisible ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: codeOpacity, transform: `scale(${codeScale})` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "black", border: "1px solid rgba(248,7,16,0.4)", padding: "14px 16px" }}>
                          <span style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 28, letterSpacing: "0.2em", color: "white" }}>•••••</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "10px 12px", border: `1px solid ${PANEL_BORDER}`, justifyContent: "center", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", color: GRAY_TEXT, textTransform: "uppercase" }}>
                            <CopyGlyph size={14} color={GRAY_TEXT} />
                            Copiar código
                          </div>
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "10px 12px", background: BRAND, justifyContent: "center", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", color: "white", textTransform: "uppercase" }}>
                            Ir a la tienda
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: "relative" }}>
                        <div style={{ padding: "11px 14px", background: BRAND, color: "white", fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                          <TicketGlyph size={15} color="white" />
                          Obtener código
                        </div>
                        {ticaPulse && <PulseRing active color={BRAND} />}
                      </div>
                    )
                  ) : (
                    <div style={{ padding: "9px 12px", background: BRAND_DIM, border: `1px solid ${BRAND_BORDER_DIM}`, color: BRAND, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, justifyContent: "center", opacity: 0.55 }}>
                      <TicketGlyph size={13} color={BRAND} />
                      Obtener código
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 6: Ingresos (1260–1500, 8s) ─── */

const SceneIngresos: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = INGRESO_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  const qrPulse = 0.85 + 0.15 * Math.sin((frame / 20) * Math.PI);

  const typingInput = typewriter("0042", frame, 85, 8);
  const buscarPulse = frame >= 112 && frame < 130;
  const showLookupCard = frame >= 125;

  const permitirPulse = frame >= 180 && frame < 205;
  const showToast = frame >= 200;

  const toastOpacity = interpolate(frame, [200, 215], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const toastY = interpolate(frame, [200, 215], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [125, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardY = interpolate(frame, [125, 140], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
          {/* Toast */}
          {showToast && (
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                right: 16,
                zIndex: 20,
                opacity: toastOpacity,
                transform: `translateY(${toastY}px)`,
                padding: "14px 18px",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.35)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckGlyph size={20} color={GREEN} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 12, letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase" }}>
                  Ingresó
                </span>
                <span style={{ fontFamily: body.fontFamily, fontWeight: 700, fontSize: 22, color: "white" }}>
                  Tomás López
                </span>
              </div>
            </div>
          )}

          <div style={{ padding: "12px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            {/* QR Panel */}
            <h1 style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 38, letterSpacing: "0.08em", color: "white", textTransform: "uppercase", margin: 0 }}>
              Ingresos
            </h1>
            <p style={{ fontFamily: body.fontFamily, fontSize: 17, color: GRAY_TEXT, lineHeight: 1.5, margin: 0 }}>
              Escaneá este QR desde la app de WODY para registrar el ingreso. El código rota cada 5 minutos.
            </p>
            <QrMock size={200} pulseOpacity={qrPulse} />

            {/* Separator */}
            <div style={{ height: 1, background: PANEL_BORDER }} />

            {/* Manual lookup */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.2em", color: GRAY_TEXT, textTransform: "uppercase" }}>
                INGRESO MANUAL
              </div>
              <p style={{ fontFamily: body.fontFamily, fontSize: 16, color: GRAY_TEXT_DIM, lineHeight: 1.4, margin: 0 }}>
                Si el socio no puede escanear, buscalo por nº o email.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    background: INPUT_BG,
                    border: `1px solid ${typingInput ? BRAND_BORDER_DIM : INPUT_BORDER}`,
                    padding: "12px 14px",
                    fontFamily: body.fontFamily,
                    fontSize: 22,
                    color: typingInput ? "white" : GRAY_TEXT_DIM,
                    minHeight: 48,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {typingInput || "0042 o email@..."}
                </div>
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      padding: "12px 18px",
                      border: `1px solid ${PANEL_BORDER}`,
                      background: PANEL_BG,
                      fontFamily: heading.fontFamily,
                      fontWeight: 700,
                      fontSize: 19,
                      letterSpacing: "0.1em",
                      color: "white",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <SearchGlyph size={15} color="white" />
                    Buscar
                  </div>
                  {buscarPulse && <PulseRing active color={BRAND} />}
                </div>
              </div>
            </div>

            {/* ManualLookupCard */}
            {showLookupCard && (
              <div
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  border: "1px solid rgba(248,7,16,0.3)",
                  background: "rgba(248,7,16,0.05)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <p style={{ fontFamily: body.fontFamily, fontWeight: 600, fontSize: 22, color: "white", margin: 0 }}>
                      <span style={{ fontFamily: body.fontFamily, fontSize: 17, color: GRAY_TEXT, marginRight: 8, fontVariantNumeric: "tabular-nums", letterSpacing: "0.1em" }}>0042</span>
                      TOMÁS LÓPEZ
                    </p>
                    <p style={{ fontFamily: body.fontFamily, fontSize: 15, color: GRAY_TEXT, margin: "3px 0 0" }}>
                      Alumno · Próximo pago 15/05/2026
                    </p>
                  </div>
                  <span style={{ padding: "4px 10px", background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 15, letterSpacing: "0.15em", color: GREEN, textTransform: "uppercase", flexShrink: 0 }}>
                    Al día
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <div style={{ padding: "10px 16px", border: "1px solid rgba(248,7,16,0.5)", background: "rgba(248,7,16,0.1)", color: BRAND, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Denegar
                  </div>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        padding: "10px 20px",
                        background: BRAND,
                        color: "white",
                        fontFamily: heading.fontFamily,
                        fontWeight: 700,
                        fontSize: 18,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        transform: `scale(${permitirPulse ? 0.97 : 1})`,
                      }}
                    >
                      Permitir
                    </div>
                    {permitirPulse && <PulseRing active color={BRAND} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 7: Pagos (1500–1650, 5s) ─── */

const ScenePagos: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = PAGO_DUR;
  const { transform, opacity } = combineSlide(frame, dur);

  const luciaPulse = frame >= 30 && frame < 48;
  const showDialog = frame >= 44 && frame < 100;
  const registrarPulse = frame >= 68 && frame < 86;
  const luciaAlDia = frame >= 84;

  const dialogOpacity = interpolate(frame, [44, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dialogScale = interpolate(frame, [44, 58], [0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dialogOut = interpolate(frame, [90, 104], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const students = [
    {
      name: "Lucía Ferrari",
      badge: luciaAlDia ? "Al día" : "Vence hoy",
      badgeBg: luciaAlDia ? GREEN_DIM : YELLOW_DIM,
      badgeBorder: luciaAlDia ? GREEN_BORDER : YELLOW_BORDER,
      badgeColor: luciaAlDia ? GREEN : YELLOW,
      sub: luciaAlDia ? "Próximo pago 25/05/2026" : "Próximo pago 25/04/2026",
    },
    { name: "Tomás López", badge: "Al día", badgeBg: GREEN_DIM, badgeBorder: GREEN_BORDER, badgeColor: GREEN, sub: "Próximo pago 15/05/2026" },
    { name: "Mateo Ruiz", badge: "Atrasado 3 días", badgeBg: "rgba(248,7,16,0.08)", badgeBorder: "rgba(248,7,16,0.3)", badgeColor: BRAND, sub: "Próximo pago 22/04/2026" },
  ];

  return (
    <AbsoluteFill style={{ transform, opacity, overflow: "hidden" }}>
      <PhoneFrame>
        <div style={{ padding: "14px 24px", display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 38, color: "white", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Pagos
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {students.map((s, idx) => {
              const isLucia = idx === 0;
              return (
                <div
                  key={s.name}
                  style={{
                    border: `1px solid ${PANEL_BORDER}`,
                    background: PANEL_BG,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 22, color: "white" }}>{s.name}</div>
                    <div style={{ fontFamily: body.fontFamily, fontSize: 15, color: GRAY_TEXT, marginTop: 2 }}>{s.sub}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: "4px 8px", background: s.badgeBg, border: `1px solid ${s.badgeBorder}`, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 14, letterSpacing: "0.12em", color: s.badgeColor, textTransform: "uppercase" }}>
                      {s.badge}
                    </span>
                    {!luciaAlDia || !isLucia ? (
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            padding: "8px 12px",
                            border: `1px solid ${PANEL_BORDER}`,
                            background: "#0f0f0f",
                            fontFamily: heading.fontFamily,
                            fontWeight: 700,
                            fontSize: 16,
                            letterSpacing: "0.08em",
                            color: "white",
                            textTransform: "uppercase",
                            transform: `scale(${isLucia && luciaPulse ? 0.97 : 1})`,
                          }}
                        >
                          Marcar pagado
                        </div>
                        {isLucia && luciaPulse && <PulseRing active color={BRAND} />}
                      </div>
                    ) : (
                      <CheckGlyph size={20} color={GREEN} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dialog overlay */}
        {showDialog && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              opacity: dialogOpacity * dialogOut,
            }}
          >
            <div
              style={{
                background: PANEL_BG,
                border: `1px solid ${PANEL_BORDER}`,
                padding: "24px",
                width: "100%",
                transform: `scale(${dialogScale})`,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ fontFamily: heading.fontFamily, fontWeight: 900, fontSize: 26, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Registrar pago
              </div>
              <p style={{ fontFamily: body.fontFamily, fontSize: 20, color: GRAY_TEXT, lineHeight: 1.5, margin: 0 }}>
                ¿Registrar pago de Lucía Ferrari? La fecha avanza 1 mes.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <div style={{ padding: "12px 22px", border: `1px solid ${PANEL_BORDER}`, fontFamily: heading.fontFamily, fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", color: GRAY_TEXT, textTransform: "uppercase" }}>
                  Cancelar
                </div>
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      padding: "12px 22px",
                      background: BRAND,
                      color: "white",
                      fontFamily: heading.fontFamily,
                      fontWeight: 700,
                      fontSize: 20,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      transform: `scale(${registrarPulse ? 0.97 : 1})`,
                    }}
                  >
                    Registrar
                  </div>
                  {registrarPulse && <PulseRing active color={BRAND} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </PhoneFrame>
    </AbsoluteFill>
  );
};

/* ─── Scene 8: CTA (1650–1800, 5s) ─── */

const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSp = spring({ frame, fps, config: { damping: 14, stiffness: 90, mass: 0.7 } });
  const logoScale = interpolate(logoSp, [0, 1], [0.88, 1]);
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const handleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const handleY = interpolate(frame, [25, 45], [16, 0], { extrapolateRight: "clamp" });
  const locOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });

  const outOpacity = interpolate(frame, [135, 150], [1, 0], { extrapolateLeft: "clamp" });

  const glowPulse = 0.9 + 0.1 * Math.sin((frame / CTA_DUR) * Math.PI * 3);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        textAlign: "center",
        padding: 80,
        opacity: outOpacity,
      }}
    >
      {/* Intensified glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${glowPulse})`,
          width: 1600,
          height: 1600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(248,7,16,0.30) 0%, rgba(248,7,16,0.08) 40%, transparent 65%)",
          filter: "blur(180px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, position: "relative" }}>
        <Img src={staticFile("logos/atlas-gym.png")} style={{ width: 800, height: "auto" }} />
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: handleOpacity,
          transform: `translateY(${handleY}px)`,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 52,
          letterSpacing: "0.15em",
          color: BRAND,
          textTransform: "uppercase",
        }}
      >
        @atlasgimnasio_
      </div>

      <div
        style={{
          marginTop: 16,
          opacity: locOpacity,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 30,
          letterSpacing: "0.05em",
          color: GRAY_TEXT,
        }}
      >
        Los Polvorines · Buenos Aires
      </div>
    </AbsoluteFill>
  );
};

/* ══════════════════════════════════════════════════════════
   COMPOSITION
══════════════════════════════════════════════════════════ */

export const AtlasPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={INTRO_START} durationInFrames={INTRO_DUR}>
        <SceneIntro />
      </Sequence>

      <Sequence from={ALTA_START} durationInFrames={ALTA_DUR}>
        <SceneAltaUsuario />
      </Sequence>

      <Sequence from={RUTINA_START} durationInFrames={RUTINA_DUR}>
        <SceneCrearRutina />
      </Sequence>

      <Sequence from={WOD_START} durationInFrames={WOD_DUR}>
        <SceneAlumnoRutina />
      </Sequence>

      <Sequence from={TIMER_START} durationInFrames={TIMER_DUR}>
        <SceneCronometro />
      </Sequence>

      <Sequence from={BENEF_START} durationInFrames={BENEF_DUR}>
        <SceneBeneficios />
      </Sequence>

      <Sequence from={INGRESO_START} durationInFrames={INGRESO_DUR}>
        <SceneIngresos />
      </Sequence>

      <Sequence from={PAGO_START} durationInFrames={PAGO_DUR}>
        <ScenePagos />
      </Sequence>

      <Sequence from={CTA_START} durationInFrames={CTA_DUR}>
        <SceneCta />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

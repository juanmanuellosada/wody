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

const heading = loadHeading("normal", { weights: ["700", "900"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["500", "600"], subsets: ["latin"] });

/* ── Palette ── */
const BRAND = "#f80710";
const BRAND_BORDER = "rgba(248,7,16,0.5)";
const BRAND_DIM = "rgba(248,7,16,0.12)";
const BG = "#0A0A0F";
const PANEL_BG = "#0d0d12";
const PANEL_BORDER = "#1c1c24";
const INPUT_BG = "#111118";
const INPUT_BORDER = "#252530";
const GRAY = "rgba(255,255,255,0.45)";
const GRAY_DIM = "rgba(255,255,255,0.25)";
const GREEN = "#4ADE80";
const GREEN_DIM = "rgba(74,222,128,0.12)";
const GREEN_BORDER = "rgba(74,222,128,0.5)";
const YELLOW = "#FACC15";
const YELLOW_DIM = "rgba(250,204,21,0.12)";
const YELLOW_BORDER = "rgba(250,204,21,0.5)";

/* ── Scene timing (15s @ 30fps = 450 frames) ── */
const INTRO_DUR = 60;        //  0–60   · 2s
const DASHBOARD_DUR = 120;   // 60–180  · 4s
const MODAL_DUR = 150;       // 180–330 · 5s
const STATS_DUR = 120;       // 330–450 · 4s

/* ══════════════════════════════════════════════════════════
   SHARED HELPERS
══════════════════════════════════════════════════════════ */

const BackgroundGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 3) * 0.08 + 0.92;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${pulse})`,
          width: 1300,
          height: 1300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(248,7,16,0.30) 0%, rgba(248,7,16,0.07) 38%, transparent 65%)",
          filter: "blur(130px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-8%",
          right: "-8%",
          width: 550,
          height: 550,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(248,7,16,0.14) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
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

const Cursor: React.FC = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
    <path
      d="M5 3l14 9-6 1 3 7-3 1-3-7-5 3V3z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/* Caption label displayed above the content area */
const Caption: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => (
  <div
    style={{
      position: "absolute",
      top: 60,
      left: 60,
      right: 60,
      fontFamily: heading.fontFamily,
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: "0.25em",
      color: BRAND,
      textTransform: "uppercase",
      textAlign: "center",
      opacity,
    }}
  >
    {text}
  </div>
);

/* Status badge component */
type BadgeKind = "ok" | "due-soon" | "overdue";
const STATUS_STYLES: Record<BadgeKind, { text: string; border: string; bg: string }> = {
  ok: { text: GREEN, border: GREEN_BORDER, bg: GREEN_DIM },
  "due-soon": { text: YELLOW, border: YELLOW_BORDER, bg: YELLOW_DIM },
  overdue: { text: BRAND, border: BRAND_BORDER, bg: BRAND_DIM },
};

const StatusBadge: React.FC<{ kind: BadgeKind; label: string }> = ({ kind, label }) => {
  const s = STATUS_STYLES[kind];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 14px",
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 19,
        letterSpacing: "0.12em",
        color: s.text,
        border: `1px solid ${s.border}`,
        background: s.bg,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

/* Table row */
const TableRow: React.FC<{
  name: string;
  date: string;
  kind: BadgeKind;
  label: string;
  highlighted?: boolean;
}> = ({ name, date, kind, label, highlighted = false }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2.6fr 1.6fr 2.8fr",
      alignItems: "center",
      padding: "20px 20px",
      borderBottom: `1px solid ${PANEL_BORDER}`,
      background: highlighted
        ? "rgba(74,222,128,0.04)"
        : kind === "overdue"
        ? "rgba(248,7,16,0.03)"
        : "transparent",
      transition: "background 400ms",
    }}
  >
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 24,
        color: "white",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {name}
    </div>
    <div
      style={{
        fontFamily: body.fontFamily,
        fontWeight: 500,
        fontSize: 20,
        color: GRAY,
        whiteSpace: "nowrap",
      }}
    >
      {date}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
      <StatusBadge kind={kind} label={label} />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════
   SCENE 1 — INTRO (0–60 frames, 2s)
══════════════════════════════════════════════════════════ */

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSp = spring({ frame, fps, config: { damping: 13, stiffness: 100, mass: 0.6 } });
  const logoScale = interpolate(logoSp, [0, 1], [0.78, 1]);
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  const moduleOpacity = interpolate(frame, [18, 36], [0, 1], { extrapolateRight: "clamp" });
  const moduleY = interpolate(frame, [18, 36], [24, 0], { extrapolateRight: "clamp" });

  const taglineOpacity = interpolate(frame, [32, 52], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [32, 52], [20, 0], { extrapolateRight: "clamp" });

  const outOpacity = interpolate(frame, [48, 60], [1, 0], { extrapolateLeft: "clamp" });

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
        <Img
          src={staticFile("logos/atlas-gym.png")}
          style={{ width: 600, height: "auto" }}
        />
      </div>

      <div
        style={{
          marginTop: 64,
          opacity: moduleOpacity,
          transform: `translateY(${moduleY}px)`,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 112,
          lineHeight: 0.95,
          letterSpacing: "-0.01em",
          color: "white",
          textTransform: "uppercase",
        }}
      >
        Módulo
        <br />
        de Pagos
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: body.fontFamily,
          fontWeight: 600,
          fontSize: 34,
          color: GRAY,
          letterSpacing: "0.04em",
          lineHeight: 1.35,
        }}
      >
        Cobrá rápido,
        <br />
        sin perder un alumno.
      </div>

      {/* Accent bar */}
      <div
        style={{
          marginTop: 48,
          width: interpolate(taglineOpacity, [0, 1], [0, 260]),
          height: 3,
          background: BRAND,
          transition: "width 400ms",
        }}
      />
    </AbsoluteFill>
  );
};

/* ══════════════════════════════════════════════════════════
   SCENE 2 — DASHBOARD + FILTERS (60–180 frames, 4s)
══════════════════════════════════════════════════════════ */

const STUDENTS = [
  { name: "Carlos Pérez",      date: "28/06",  kind: "ok"       as BadgeKind, label: "Al día" },
  { name: "Sofía García",      date: "23/05",  kind: "due-soon" as BadgeKind, label: "Vence en 3 días" },
  { name: "Mariano Acosta",    date: "15/05",  kind: "overdue"  as BadgeKind, label: "Atrasado 5 días" },
  { name: "Lucía Romero",      date: "02/07",  kind: "ok"       as BadgeKind, label: "Al día" },
  { name: "Tomás Fernández",   date: "27/05",  kind: "due-soon" as BadgeKind, label: "Vence en 7 días" },
  { name: "Valentina Suárez",  date: "08/05",  kind: "overdue"  as BadgeKind, label: "Atrasado 12 días" },
  { name: "Joaquín Méndez",    date: "10/07",  kind: "ok"       as BadgeKind, label: "Al día" },
] as const;

const SceneDashboard: React.FC = () => {
  const frame = useCurrentFrame();

  const captionOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const tableOpacity = interpolate(frame, [10, 32], [0, 1], { extrapolateRight: "clamp" });
  const tableY = interpolate(frame, [10, 32], [30, 0], { extrapolateRight: "clamp" });

  // Filter tabs highlight appears around frame 60 (within this scene)
  const tabsHighlight = frame >= 60;
  const tabsOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Cursor moves toward the "Registrar pago" header button from frame 72
  // Button is in the top-bar area, right side — approximately top: 310px, right: 48px from frame edge
  const cursorOpacity = interpolate(frame, [72, 84, 108, 118], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Cursor starts bottom-center and moves up-right toward the header button
  const cursorX = interpolate(frame, [72, 102], [340, 900], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(frame, [72, 102], [900, 310], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorScale = interpolate(frame, [100, 112], [1, 0.87], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Registrar pago" button press animation in sync with cursor click
  const btnPressed = frame >= 100 && frame < 118;
  const btnPressScale = interpolate(frame, [100, 108, 118], [1, 0.93, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const btnFlash = interpolate(frame, [100, 112, 118], [0, 0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outOpacity = interpolate(frame, [108, 120], [1, 0], { extrapolateLeft: "clamp" });

  const activeTab = tabsHighlight ? "overdue" : "all";
  const tabs = [
    { id: "all",     label: "Todos",      count: 7  },
    { id: "overdue", label: "Atrasados",  count: 2  },
    { id: "due-soon",label: "Por vencer", count: 2  },
    { id: "ok",      label: "Al día",     count: 3  },
  ] as const;

  const tabColors: Record<string, { active: string; border: string; bg: string }> = {
    all:       { active: "white",  border: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.06)" },
    overdue:   { active: BRAND,    border: BRAND_BORDER,             bg: BRAND_DIM               },
    "due-soon":{ active: YELLOW,   border: YELLOW_BORDER,            bg: YELLOW_DIM              },
    ok:        { active: GREEN,    border: GREEN_BORDER,             bg: GREEN_DIM               },
  };

  return (
    <AbsoluteFill style={{ padding: "0 48px", opacity: outOpacity, paddingTop: 120 }}>
      <Caption text="Tu cartera de alumnos al instante" opacity={captionOpacity} />

      {/* Top bar: filter tabs + "Registrar pago" button (mirrors real PaymentStatsPanel layout) */}
      <div
        style={{
          marginTop: 120,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          opacity: tabsOpacity,
        }}
      >
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const c = tabColors[tab.id];
            return (
              <div
                key={tab.id}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  textAlign: "center",
                  border: `1.5px solid ${isActive ? c.border : PANEL_BORDER}`,
                  background: isActive ? c.bg : "transparent",
                  transition: "all 200ms",
                }}
              >
                <div
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 900,
                    fontSize: 48,
                    lineHeight: 1,
                    color: isActive ? c.active : GRAY_DIM,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {tab.count}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 17,
                    letterSpacing: "0.18em",
                    color: isActive ? c.active : GRAY_DIM,
                    textTransform: "uppercase",
                  }}
                >
                  {tab.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* "Registrar pago" button — top-right of the panel, matching PaymentStatsPanel */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              padding: "18px 32px",
              background: BRAND,
              color: "white",
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              transform: `scale(${btnPressScale})`,
              boxShadow: btnPressed ? `0 0 32px rgba(248,7,16,0.6)` : "none",
              transition: "box-shadow 120ms",
            }}
          >
            + Registrar pago
          </div>
          {/* Click flash overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "white",
              opacity: btnFlash,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          marginTop: 32,
          border: `1px solid ${PANEL_BORDER}`,
          background: PANEL_BG,
          opacity: tableOpacity,
          transform: `translateY(${tableY}px)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.6fr 1.6fr 2.8fr",
            padding: "14px 20px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
            background: "rgba(255,255,255,0.02)",
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "0.2em",
            color: GRAY_DIM,
            textTransform: "uppercase",
          }}
        >
          <div>Alumno</div>
          <div>Vto.</div>
          <div style={{ textAlign: "right" }}>Estado</div>
        </div>

        {STUDENTS.map((s) => (
          <TableRow
            key={s.name}
            name={s.name}
            date={s.date}
            kind={s.kind}
            label={s.label}
          />
        ))}
      </div>

      {/* Cursor moving toward the header "Registrar pago" button */}
      <div
        style={{
          position: "absolute",
          left: cursorX,
          top: cursorY,
          opacity: cursorOpacity,
          transform: `scale(${cursorScale})`,
          pointerEvents: "none",
        }}
      >
        <Cursor />
      </div>
    </AbsoluteFill>
  );
};

/* ══════════════════════════════════════════════════════════
   SCENE 3 — MODAL DE PAGO (180–330 frames, 5s)
══════════════════════════════════════════════════════════ */

function typewriter(text: string, frame: number, startFrame: number, fps: number): string {
  if (frame < startFrame) return "";
  const chars = Math.floor((frame - startFrame) * fps);
  return text.slice(0, Math.min(chars, text.length));
}

const SceneModal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  // Modal slides down from above into upper-third of frame
  const modalY = interpolate(frame, [0, 22], [-80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const modalOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Typewriter for amount: starts at frame 20, 1.2 chars/frame
  const importeText = typewriter("8.500,00", frame, 20, 1.2);
  const importeCursor = frame >= 20 && frame < 50;

  // Dropdown "Transferencia" opens at frame 52, selected at 68
  const metodoOpen = frame >= 52 && frame < 68;
  const metodoSelected = frame >= 68;

  // Dates and next date shown once student is selected (pre-filled from frame 0 — student already selected)
  const fechaVisible = true;

  // Button press at frame 110
  const btnPressed = frame >= 110 && frame < 130;
  const btnPressScale = interpolate(frame, [110, 120, 130], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Success flash
  const flashOpacity = interpolate(frame, [118, 128, 148], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Pago registrado" confirmation
  const confirmOpacity = interpolate(frame, [128, 148], [0, 1], { extrapolateLeft: "clamp" });

  const outOpacity = interpolate(frame, [138, 150], [1, 0], { extrapolateLeft: "clamp" });

  const labelStyle: React.CSSProperties = {
    fontFamily: heading.fontFamily,
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: "0.18em",
    color: GRAY,
    textTransform: "uppercase",
    marginBottom: 5,
  };

  const inputStyle: React.CSSProperties = {
    background: INPUT_BG,
    border: `1px solid ${INPUT_BORDER}`,
    padding: "12px 14px",
    fontFamily: body.fontFamily,
    fontWeight: 500,
    fontSize: 23,
    color: "white",
    minHeight: 48,
    display: "flex",
    alignItems: "center",
  };

  return (
    <AbsoluteFill style={{ padding: "0 48px", opacity: outOpacity, paddingTop: 120 }}>
      <Caption text="Registrá un pago en segundos" opacity={captionOpacity} />

      {/* Backdrop overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          opacity: modalOpacity,
        }}
      />

      {/* Modal — positioned in upper third of frame (top ~300px from frame top) */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 48,
          right: 48,
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          opacity: modalOpacity,
          transform: `translateY(${modalY}px)`,
          overflow: "hidden",
        }}
      >
        {/* Modal header — title "Registrar Pago" matching the real dialog */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 32,
              color: "white",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Registrar Pago
          </div>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 22,
              color: GRAY_DIM,
            }}
          >
            ✕
          </div>
        </div>

        {/* Form — all fields in real order: Alumno / Importe / Fecha del pago / Método de pago / Próximo vencimiento */}
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 15 }}>

          {/* 1. Alumno — typeahead, student pre-selected (shown as filled input with brand highlight) */}
          <div>
            <div style={labelStyle}>Alumno</div>
            <div
              style={{
                ...inputStyle,
                border: `1px solid ${BRAND_BORDER}`,
                background: BRAND_DIM,
                color: BRAND,
              }}
            >
              Mariano Acosta
            </div>
          </div>

          {/* 2. Importe — $ prefix, typewriter animation */}
          <div>
            <div style={labelStyle}>Importe</div>
            <div style={{ ...inputStyle, fontWeight: 600, fontSize: 28, position: "relative" }}>
              <span style={{ color: GRAY, marginRight: 4, fontSize: 22 }}>$</span>
              {importeText || <span style={{ color: GRAY_DIM }}>Ej: 15000</span>}
              {importeCursor && (
                <span
                  style={{
                    marginLeft: 2,
                    display: "inline-block",
                    width: 2,
                    height: 22,
                    background: BRAND,
                    opacity: Math.floor(frame / 5) % 2 === 0 ? 1 : 0.2,
                  }}
                />
              )}
            </div>
          </div>

          {/* 3. Fecha del pago */}
          <div>
            <div style={labelStyle}>Fecha del pago</div>
            <div style={{ ...inputStyle, justifyContent: "space-between" }}>
              <span>20/05/2026</span>
              <span style={{ color: GRAY_DIM, fontSize: 20 }}>📅</span>
            </div>
          </div>

          {/* 4. Método de pago — select with real options */}
          <div style={{ position: "relative" }}>
            <div style={labelStyle}>Método de pago</div>
            <div
              style={{
                ...inputStyle,
                border: `1px solid ${metodoOpen ? BRAND_BORDER : INPUT_BORDER}`,
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: metodoSelected ? "white" : GRAY_DIM }}>
                {metodoSelected ? "Transferencia" : "Seleccioná un método"}
              </span>
              <span style={{ color: GRAY_DIM, fontSize: 18 }}>▾</span>
            </div>
            {metodoOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#0e0e14",
                  border: `1px solid ${BRAND_BORDER}`,
                  zIndex: 20,
                }}
              >
                {[
                  "Efectivo",
                  "Transferencia",
                  "Tarjeta (débito/crédito)",
                  "Mercado Pago",
                ].map((opt) => (
                  <div
                    key={opt}
                    style={{
                      padding: "11px 14px",
                      fontFamily: body.fontFamily,
                      fontSize: 21,
                      color: opt === "Transferencia" ? BRAND : "white",
                      background: opt === "Transferencia" ? BRAND_DIM : "transparent",
                      borderBottom: `1px solid ${PANEL_BORDER}`,
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Próximo vencimiento — date picker, suggested date pre-filled */}
          <div>
            <div style={labelStyle}>Próximo vencimiento</div>
            <div style={{ ...inputStyle, justifyContent: "space-between" }}>
              <span>20/06/2026</span>
              <span style={{ color: GRAY_DIM, fontSize: 20 }}>📅</span>
            </div>
          </div>

          {/* Footer buttons — Cancelar (secondary) + Registrar (primary), matching real dialog */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4, position: "relative" }}>
            {/* Cancelar */}
            <div
              style={{
                padding: "13px 24px",
                background: "transparent",
                color: GRAY,
                border: `1px solid ${INPUT_BORDER}`,
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Cancelar
            </div>

            {/* Registrar */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  padding: "13px 28px",
                  background: BRAND,
                  color: "white",
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  transform: `scale(${btnPressScale})`,
                  boxShadow: btnPressed ? `0 0 32px rgba(248,7,16,0.5)` : "none",
                  transition: "box-shadow 150ms",
                }}
              >
                Registrar
              </div>

              {/* Success flash */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: GREEN,
                  opacity: flashOpacity,
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Confirmation */}
          <div
            style={{
              opacity: confirmOpacity,
              textAlign: "center",
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 48,
              color: GREEN,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            ✓ Pago registrado
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ══════════════════════════════════════════════════════════
   SCENE 4 — CONFIRMACIÓN + STATS (330–450 frames, 4s)
══════════════════════════════════════════════════════════ */

const BAR_HEIGHTS = [0.55, 0.62, 0.71, 0.68, 0.83, 0.92];
const BAR_LABELS = ["Dic", "Ene", "Feb", "Mar", "Abr", "May"];

const SceneStats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  // Table with Mariano now "Al día"
  const tableOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const tableY = interpolate(frame, [0, 20], [24, 0], { extrapolateRight: "clamp" });

  // KPIs appear
  const kpiOpacity = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });
  const kpiY = interpolate(frame, [16, 36], [24, 0], { extrapolateRight: "clamp" });

  // Bar chart grows from frame 36
  const barProgress = interpolate(frame, [36, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Outro logo
  const outroOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: "clamp" });
  const outroScale = spring({ frame: frame - 90, fps, config: { damping: 14, stiffness: 90, mass: 0.7 } });

  const BAR_MAX_H = 120;

  return (
    <AbsoluteFill style={{ padding: "0 48px", paddingTop: 120 }}>
      <Caption text="Cobranza al día, en tiempo real" opacity={captionOpacity} />

      {/* Table — Mariano now Al día */}
      <div
        style={{
          marginTop: 120,
          border: `1px solid ${PANEL_BORDER}`,
          background: PANEL_BG,
          opacity: tableOpacity,
          transform: `translateY(${tableY}px)`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.6fr 1.6fr 2.8fr",
            padding: "12px 20px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
            background: "rgba(255,255,255,0.02)",
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.2em",
            color: GRAY_DIM,
            textTransform: "uppercase",
          }}
        >
          <div>Alumno</div>
          <div>Vto.</div>
          <div style={{ textAlign: "right" }}>Estado</div>
        </div>
        <TableRow name="Carlos Pérez"   date="28/06" kind="ok"       label="Al día"          />
        <TableRow name="Sofía García"   date="23/05" kind="due-soon" label="Vence en 3 días" />
        {/* Mariano now green */}
        <TableRow name="Mariano Acosta" date="20/06" kind="ok"       label="Al día" highlighted />
        <TableRow name="Lucía Romero"   date="02/07" kind="ok"       label="Al día"          />
      </div>

      {/* KPI panel */}
      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          opacity: kpiOpacity,
          transform: `translateY(${kpiY}px)`,
        }}
      >
        {/* KPI: Recaudación */}
        <div
          style={{
            gridColumn: "1 / -1",
            background: PANEL_BG,
            border: `1px solid ${GREEN_BORDER}`,
            padding: "18px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "0.2em",
              color: GRAY,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Recaudación mayo
          </div>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 72,
              lineHeight: 1,
              color: GREEN,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            $487.500
          </div>
        </div>

        {/* KPI: Pagos */}
        <div
          style={{
            background: PANEL_BG,
            border: `1px solid ${PANEL_BORDER}`,
            padding: "16px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.18em",
              color: GRAY,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Pagos
          </div>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 64,
              lineHeight: 1,
              color: "white",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            58
          </div>
        </div>

        {/* KPI: Al día % */}
        <div
          style={{
            background: PANEL_BG,
            border: `1px solid ${PANEL_BORDER}`,
            padding: "16px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.18em",
              color: GRAY,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Al día
          </div>
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 900,
              fontSize: 64,
              lineHeight: 1,
              color: GREEN,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            87%
          </div>
        </div>
      </div>

      {/* Mini bar chart */}
      <div
        style={{
          marginTop: 20,
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          padding: "16px 20px",
          opacity: kpiOpacity,
          transform: `translateY(${kpiY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.2em",
            color: GRAY,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Evolución mensual
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: BAR_MAX_H + 28 }}>
          {BAR_HEIGHTS.map((h, i) => {
            const animH = h * barProgress;
            const isLast = i === BAR_HEIGHTS.length - 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: Math.round(animH * BAR_MAX_H),
                    background: isLast ? BRAND : `rgba(248,7,16,0.45)`,
                    transition: "height 300ms",
                    boxShadow: isLast ? `0 0 18px rgba(248,7,16,0.4)` : "none",
                  }}
                />
                <div
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: 16,
                    color: isLast ? BRAND : GRAY_DIM,
                    letterSpacing: "0.1em",
                  }}
                >
                  {BAR_LABELS[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outro: Atlas logo + Wody */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: outroOpacity,
          transform: `scale(${interpolate(outroScale, [0, 1], [0.85, 1])})`,
        }}
      >
        <Img
          src={staticFile("logos/atlas-gym.png")}
          style={{ width: 200, height: "auto", opacity: 0.9 }}
        />
        <div
          style={{
            fontFamily: body.fontFamily,
            fontWeight: 600,
            fontSize: 22,
            color: GRAY,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          wody.app
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOT COMPOSITION
══════════════════════════════════════════════════════════ */

export const AtlasPagosPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO_DUR}>
        <SceneIntro />
      </Sequence>

      <Sequence from={INTRO_DUR} durationInFrames={DASHBOARD_DUR}>
        <SceneDashboard />
      </Sequence>

      <Sequence from={INTRO_DUR + DASHBOARD_DUR} durationInFrames={MODAL_DUR}>
        <SceneModal />
      </Sequence>

      <Sequence from={INTRO_DUR + DASHBOARD_DUR + MODAL_DUR} durationInFrames={STATS_DUR}>
        <SceneStats />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

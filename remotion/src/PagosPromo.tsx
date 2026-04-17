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

const BRAND_RED = "#E31414";
const BG = "#0A0A0F";
const GREEN = "#4ADE80";
const YELLOW = "#FACC15";

/* Scene timing (30s @ 30fps = 900 frames) */
const INTRO = 90; //        0–90    · 3s
const OVERVIEW = 240; //   90–330   · 8s
const FILTER = 210; //    330–540   · 7s
const PAY = 240; //        540–780  · 8s
const CTA = 120; //        780–900  · 4s

export const PagosPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>

      <Sequence from={INTRO} durationInFrames={OVERVIEW}>
        <OverviewScene />
      </Sequence>

      <Sequence from={INTRO + OVERVIEW} durationInFrames={FILTER}>
        <FilterScene />
      </Sequence>

      <Sequence from={INTRO + OVERVIEW + FILTER} durationInFrames={PAY}>
        <PayScene />
      </Sequence>

      <Sequence from={INTRO + OVERVIEW + FILTER + PAY} durationInFrames={CTA}>
        <CTAScene />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

/* ---------- Shared layers ---------- */

const BackgroundGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.1 + 0.9;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${pulse})`,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(227,20,20,0.35) 0%, rgba(227,20,20,0.08) 35%, transparent 65%)",
          filter: "blur(120px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(227,20,20,0.25) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
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
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.6 } });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const eyebrowOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [25, 50], [30, 0], { extrapolateRight: "clamp" });
  const outOpacity = interpolate(frame, [70, 90], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60, textAlign: "center", opacity: outOpacity }}>
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
        <Img src={staticFile("logos/wody-texto.png")} style={{ width: 520, height: "auto" }} />
      </div>
      <div
        style={{
          marginTop: 80,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: "0.35em",
          color: BRAND_RED,
          textTransform: "uppercase",
          opacity: eyebrowOpacity,
        }}
      >
        Para admins y profes
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 200,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "white",
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Pagos
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Tile (filter chip) ---------- */

type TileColor = "white" | "red" | "yellow" | "green";

const TILE_STYLES: Record<TileColor, { text: string; border: string; bg: string }> = {
  white: { text: "white", border: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.05)" },
  red: { text: BRAND_RED, border: "rgba(227,20,20,0.6)", bg: "rgba(227,20,20,0.1)" },
  yellow: { text: YELLOW, border: "rgba(250,204,21,0.6)", bg: "rgba(250,204,21,0.1)" },
  green: { text: GREEN, border: "rgba(74,222,128,0.6)", bg: "rgba(74,222,128,0.1)" },
};

const Tile: React.FC<{
  label: string;
  value: number;
  color: TileColor;
  active?: boolean;
  highlight?: boolean;
}> = ({ label, value, color, active = false, highlight = false }) => {
  const style = TILE_STYLES[color];
  return (
    <div
      style={{
        flex: 1,
        padding: "22px 12px",
        textAlign: "center",
        border: `2px solid ${active ? style.border : "rgba(255,255,255,0.08)"}`,
        background: active ? style.bg : "transparent",
        transition: "all 200ms",
        boxShadow: highlight ? `0 0 40px ${style.bg}` : "none",
      }}
    >
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1,
          color: style.text,
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
          fontSize: 20,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const TilesRow: React.FC<{
  todos: number;
  atrasados: number;
  porVencer: number;
  alDia: number;
  activeFilter?: "all" | "overdue" | "due-soon" | "ok";
  highlightFilter?: "overdue" | "due-soon" | "ok";
}> = ({ todos, atrasados, porVencer, alDia, activeFilter = "all", highlightFilter }) => (
  <div style={{ display: "flex", gap: 12 }}>
    <Tile label="Todos" value={todos} color="white" active={activeFilter === "all"} />
    <Tile
      label="Atrasados"
      value={atrasados}
      color="red"
      active={activeFilter === "overdue"}
      highlight={highlightFilter === "overdue"}
    />
    <Tile
      label="Por vencer"
      value={porVencer}
      color="yellow"
      active={activeFilter === "due-soon"}
      highlight={highlightFilter === "due-soon"}
    />
    <Tile
      label="Al día"
      value={alDia}
      color="green"
      active={activeFilter === "ok"}
      highlight={highlightFilter === "ok"}
    />
  </div>
);

/* ---------- Status Badge ---------- */

const StatusBadge: React.FC<{ kind: "overdue" | "due-soon" | "ok"; label: string }> = ({
  kind,
  label,
}) => {
  const color = kind === "overdue" ? "red" : kind === "due-soon" ? "yellow" : "green";
  const style = TILE_STYLES[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "8px 18px",
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: "0.15em",
        color: style.text,
        border: `1px solid ${style.border}`,
        background: style.bg,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
};

/* ---------- Table row ---------- */

type RowState = "overdue" | "due-soon" | "ok";

const TableRow: React.FC<{
  name: string;
  date: string;
  state: RowState;
  stateLabel: string;
  opacity?: number;
  showPayButton?: boolean;
  payPressed?: boolean;
}> = ({ name, date, state, stateLabel, opacity = 1, showPayButton = false, payPressed = false }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "3fr 2fr 2.4fr",
      alignItems: "center",
      padding: "28px 24px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: state === "overdue" ? "rgba(227,20,20,0.04)" : "transparent",
      opacity,
      transition: "all 300ms",
    }}
  >
    <div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 30,
          color: "white",
        }}
      >
        {name}
      </div>
    </div>
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 26,
        color: "rgba(255,255,255,0.75)",
      }}
    >
      {date}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
      <StatusBadge kind={state} label={stateLabel} />
      {showPayButton && (
        <div
          style={{
            padding: "10px 22px",
            background: payPressed ? BRAND_RED : "transparent",
            color: payPressed ? "white" : BRAND_RED,
            border: `2px solid ${BRAND_RED}`,
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            transition: "all 150ms",
          }}
        >
          Pagar
        </div>
      )}
    </div>
  </div>
);

/* ---------- Overview: tiles animate counters ---------- */

const OverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const targets = { todos: 45, atrasados: 3, porVencer: 8, alDia: 34 };
  const t = interpolate(frame, [0, 50], [0, 1], { extrapolateRight: "clamp" });
  const todos = Math.round(targets.todos * t);
  const atrasados = Math.round(targets.atrasados * t);
  const porVencer = Math.round(targets.porVencer * t);
  const alDia = Math.round(targets.alDia * t);

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const outOpacity = interpolate(frame, [OVERVIEW - 20, OVERVIEW], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 60, opacity: outOpacity }}>
      <div style={{ marginTop: 200 }}>
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "0.35em",
            color: BRAND_RED,
            textTransform: "uppercase",
            textAlign: "center",
            opacity: headerOpacity,
          }}
        >
          Un panel · Toda tu caja
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 120,
            lineHeight: 1,
            color: "white",
            textTransform: "uppercase",
            textAlign: "center",
            letterSpacing: "-0.01em",
            opacity: headerOpacity,
          }}
        >
          ¿Quién debe?
        </div>
        <div
          style={{
            marginTop: 90,
            opacity: headerOpacity,
          }}
        >
          <TilesRow
            todos={todos}
            atrasados={atrasados}
            porVencer={porVencer}
            alDia={alDia}
          />
        </div>
        <div
          style={{
            marginTop: 60,
            fontFamily: body.fontFamily,
            fontWeight: 500,
            fontSize: 32,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            opacity: subOpacity,
          }}
        >
          Cuatro filtros, un click.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Filter scene: click Atrasados, see table ---------- */

const FilterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Click happens at frame 30
  const clickSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });
  const cursorScale = interpolate(clickSpring, [0, 1], [1, 0.85]);
  const cursorOpacity = interpolate(frame, [0, 10, 55, 75], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  const tilesHighlight = frame >= 30;
  const tableOpacity = interpolate(frame, [55, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tableSlide = interpolate(frame, [55, 95], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outOpacity = interpolate(frame, [FILTER - 20, FILTER], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 60, opacity: outOpacity, paddingTop: 180 }}>
      {/* Tiles */}
      <div style={{ position: "relative" }}>
        <TilesRow
          todos={45}
          atrasados={3}
          porVencer={8}
          alDia={34}
          activeFilter={tilesHighlight ? "overdue" : "all"}
          highlightFilter={tilesHighlight ? "overdue" : undefined}
        />
        {/* Cursor over Atrasados tile */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "32%",
            opacity: cursorOpacity,
            transform: `scale(${cursorScale})`,
            pointerEvents: "none",
          }}
        >
          <Cursor />
        </div>
      </div>

      {/* Table of overdue students */}
      <div
        style={{
          marginTop: 60,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,10,10,0.7)",
          opacity: tableOpacity,
          transform: `translateY(${tableSlide}px)`,
        }}
      >
        {/* Head */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr 2.4fr",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
          }}
        >
          <div>Alumno</div>
          <div>Próximo pago</div>
          <div style={{ textAlign: "right" }}>Estado</div>
        </div>

        <TableRow
          name="Martín García"
          date="02 / 04 / 2026"
          state="overdue"
          stateLabel="Atrasado 14 días"
        />
        <TableRow
          name="Sofía Ruiz"
          date="10 / 04 / 2026"
          state="overdue"
          stateLabel="Atrasado 6 días"
        />
        <TableRow
          name="Luciano Pérez"
          date="14 / 04 / 2026"
          state="overdue"
          stateLabel="Atrasado 2 días"
        />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Pay scene: click Pagar, row turns green ---------- */

const PayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Intro label
  const labelOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Click at frame 50
  const clickSpring = spring({
    frame: frame - 50,
    fps,
    config: { damping: 10, stiffness: 170, mass: 0.5 },
  });
  const cursorPress = interpolate(clickSpring, [0, 1], [1, 0.82]);
  const cursorOpacity = interpolate(frame, [0, 10, 80, 95], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pressed = frame >= 50 && frame < 90;
  const becomesOk = frame >= 90;

  // Count flip: atrasados 3→2, al día 34→35, both step at frame 95
  const atrasados = becomesOk ? 2 : 3;
  const alDia = becomesOk ? 35 : 34;

  // Success flash
  const flashOpacity = interpolate(frame, [90, 100, 125], [0, 0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outOpacity = interpolate(frame, [PAY - 20, PAY], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 60, opacity: outOpacity, paddingTop: 180 }}>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "0.35em",
          color: BRAND_RED,
          textTransform: "uppercase",
          textAlign: "center",
          opacity: labelOpacity,
          marginBottom: 20,
        }}
      >
        Un click, queda al día
      </div>

      <TilesRow todos={45} atrasados={atrasados} porVencer={8} alDia={alDia} activeFilter="all" />

      <div
        style={{
          marginTop: 60,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,10,10,0.7)",
          position: "relative",
          opacity: labelOpacity,
        }}
      >
        {becomesOk ? (
          <TableRow
            name="Martín García"
            date="04 / 05 / 2026"
            state="ok"
            stateLabel="Al día"
          />
        ) : (
          <TableRow
            name="Martín García"
            date="02 / 04 / 2026"
            state="overdue"
            stateLabel="Atrasado 14 días"
            showPayButton
            payPressed={pressed}
          />
        )}
        <TableRow
          name="Sofía Ruiz"
          date="10 / 04 / 2026"
          state="overdue"
          stateLabel="Atrasado 6 días"
        />
        <TableRow
          name="Luciano Pérez"
          date="14 / 04 / 2026"
          state="overdue"
          stateLabel="Atrasado 2 días"
        />

        {/* Cursor hovering over "Pagar" of first row (right side) */}
        <div
          style={{
            position: "absolute",
            top: 50,
            right: 110,
            opacity: cursorOpacity,
            transform: `scale(${cursorPress})`,
            pointerEvents: "none",
          }}
        >
          <Cursor />
        </div>

        {/* Success flash overlay over first row */}
        <div
          style={{
            position: "absolute",
            top: 80, // row height approx
            left: 0,
            right: 0,
            height: 120,
            background: GREEN,
            opacity: flashOpacity,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Message after pay */}
      <div
        style={{
          marginTop: 40,
          textAlign: "center",
          opacity: becomesOk ? interpolate(frame, [95, 120], [0, 1], { extrapolateLeft: "clamp" }) : 0,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 64,
          color: GREEN,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        ✓ Pago registrado
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Cursor ---------- */

const Cursor: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
    <path
      d="M5 3l14 9-6 1 3 7-3 1-3-7-5 3V3z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---------- CTA ---------- */

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100, mass: 0.7 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);
  const ctaOpacity = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", padding: 80, textAlign: "center" }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <Img src={staticFile("logos/wody-texto.png")} style={{ width: 480, height: "auto" }} />
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: ctaOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 80,
          lineHeight: 1.05,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Controlá los pagos
        <br />
        de tu box
      </div>
      <div
        style={{
          marginTop: 50,
          opacity: ctaOpacity,
          fontFamily: body.fontFamily,
          fontWeight: 600,
          fontSize: 42,
          color: BRAND_RED,
          letterSpacing: "0.05em",
        }}
      >
        @wody.app
      </div>
    </AbsoluteFill>
  );
};

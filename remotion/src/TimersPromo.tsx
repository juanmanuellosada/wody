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
const DEMO_FRAMES = 120; // 4s each
const INTRO_FRAMES = 90;
const CTA_FRAMES = 90;

function formatTime(totalSeconds: number): string {
  const abs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const TimersPromo: React.FC = () => {
  let cursor = INTRO_FRAMES;
  const demoStarts = [0, 1, 2, 3, 4, 5].map((i) => INTRO_FRAMES + i * DEMO_FRAMES);
  cursor = demoStarts[5] + DEMO_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro />
      </Sequence>

      <Sequence from={demoStarts[0]} durationInFrames={DEMO_FRAMES}>
        <StopwatchDemo />
      </Sequence>

      <Sequence from={demoStarts[1]} durationInFrames={DEMO_FRAMES}>
        <CountdownDemo />
      </Sequence>

      <Sequence from={demoStarts[2]} durationInFrames={DEMO_FRAMES}>
        <IntervalDemo />
      </Sequence>

      <Sequence from={demoStarts[3]} durationInFrames={DEMO_FRAMES}>
        <TabataDemo />
      </Sequence>

      <Sequence from={demoStarts[4]} durationInFrames={DEMO_FRAMES}>
        <AmrapDemo />
      </Sequence>

      <Sequence from={demoStarts[5]} durationInFrames={DEMO_FRAMES}>
        <ForTimeDemo />
      </Sequence>

      <Sequence from={cursor} durationInFrames={CTA_FRAMES}>
        <CTA />
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
          src={staticFile("logos/wody-texto.png")}
          style={{ width: 520, height: "auto" }}
        />
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
        6 modos · 1 herramienta
      </div>

      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 160,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "white",
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Cronómetros
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Reusable demo layout ---------- */

const DemoShell: React.FC<{
  badge: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ badge, title, subtitle, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 10, DEMO_FRAMES - 10, DEMO_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const slideIn = interpolate(frame, [0, 12], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        opacity,
        transform: `translateY(${slideIn}px)`,
      }}
    >
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.35em",
          color: BRAND_RED,
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        {badge}
      </div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1,
          letterSpacing: "0.02em",
          color: "white",
          textTransform: "uppercase",
          marginBottom: subtitle ? 12 : 60,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: body.fontFamily,
            fontWeight: 500,
            fontSize: 30,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 60,
            textAlign: "center",
            maxWidth: 850,
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </AbsoluteFill>
  );
};

/* Shared TimerDisplay replicating the app's look */
const TimerDisplay: React.FC<{
  seconds: number;
  accent?: boolean;
  label?: string;
}> = ({ seconds, accent = false, label }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
    }}
  >
    {label && (
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: "0.2em",
          color: accent ? BRAND_RED : "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    )}
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 900,
        fontSize: 320,
        lineHeight: 0.9,
        fontVariantNumeric: "tabular-nums",
        color: accent ? BRAND_RED : "white",
        letterSpacing: "-0.02em",
      }}
    >
      {formatTime(seconds)}
    </div>
  </div>
);

/* ---------- Demo 1: Stopwatch ---------- */

const StopwatchDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // Speed up: reach ~03:45 (225s) across 120 frames
  const seconds = interpolate(frame, [0, DEMO_FRAMES], [0, 225]);

  return (
    <DemoShell
      badge="01 · Cuenta Progresiva"
      title="Cronómetro"
      subtitle="Arrancá y dejalo correr. Tiempo total a la vista."
    >
      <TimerDisplay seconds={seconds} />
    </DemoShell>
  );
};

/* ---------- Demo 2: Countdown ---------- */

const CountdownDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // From 00:30 down to 00:00, last ~20f at 0 with red accent
  const seconds = interpolate(frame, [0, DEMO_FRAMES - 20], [30, 0], {
    extrapolateRight: "clamp",
  });
  const done = frame >= DEMO_FRAMES - 20;

  return (
    <DemoShell
      badge="02 · Cuenta Regresiva"
      title="Temporizador"
      subtitle="Configurás minutos y segundos, avisa cuando termina."
    >
      <TimerDisplay
        seconds={seconds}
        accent={done || seconds <= 10}
        label={done ? "Terminó!" : undefined}
      />
    </DemoShell>
  );
};

/* ---------- Demo 3: Intervalos ---------- */

const IntervalDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // 4 sub-phases inside 120 frames: WORK R1 → REST R1 → WORK R2 → REST R2
  const phase = Math.floor(frame / 30); // 0..3
  const localFrame = frame % 30;
  const phaseSeconds = interpolate(localFrame, [0, 30], [30, 0]);
  const isWork = phase % 2 === 0;
  const round = Math.floor(phase / 2) + 1;

  return (
    <DemoShell badge="03 · Trabajo / Descanso" title="Intervalos">
      <TimerDisplay
        seconds={phaseSeconds}
        accent={!isWork}
        label={isWork ? "Trabajo" : "Descanso"}
      />
      <div
        style={{
          marginTop: 40,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
        }}
      >
        Ronda {round} / 4
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 26,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Trabajo · Descanso · Rondas configurables
      </div>
    </DemoShell>
  );
};

/* ---------- Demo 4: TABATA ---------- */

const TabataDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // Fast cycles to convey the TABATA rhythm: 4 phases of 30 frames
  // WORK 20s → REST 10s (accent on WORK for TABATA per app)
  const phase = Math.floor(frame / 30); // 0..3
  const localFrame = frame % 30;
  const isWork = phase % 2 === 0;
  const phaseSeconds = isWork
    ? interpolate(localFrame, [0, 30], [20, 0])
    : interpolate(localFrame, [0, 30], [10, 0]);
  const round = Math.floor(phase / 2) + 1;

  return (
    <DemoShell badge="04 · 8 Rondas Clásicas" title="Tabata">
      <TimerDisplay
        seconds={phaseSeconds}
        accent={isWork}
        label={isWork ? "Trabajo" : "Descanso"}
      />
      <div
        style={{
          marginTop: 40,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
        }}
      >
        Ronda {round} / 8
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 26,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        20s trabajo · 10s descanso · 8 rondas
      </div>
    </DemoShell>
  );
};

/* ---------- Demo 5: AMRAP ---------- */

const AmrapDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // From 12:00 down to 11:48 (~12s sped up)
  const totalStart = 12 * 60;
  const seconds = interpolate(frame, [0, DEMO_FRAMES], [totalStart, totalStart - 12]);

  return (
    <DemoShell
      badge="05 · As Many Rounds As Possible"
      title="Amrap"
      subtitle="Cuenta regresiva. Las rondas las contás vos."
    >
      <TimerDisplay seconds={seconds} label="Amrap" />
    </DemoShell>
  );
};

/* ---------- Demo 6: FOR TIME ---------- */

const ForTimeDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // Counts up from 00:00 to 01:30 with a 10:00 cap indicator
  const seconds = interpolate(frame, [0, DEMO_FRAMES], [0, 90]);

  return (
    <DemoShell badge="06 · Contra Reloj" title="For Time">
      <TimerDisplay seconds={seconds} />
      <div
        style={{
          marginTop: 40,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.6)",
          textTransform: "uppercase",
        }}
      >
        Cap · 10:00
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 26,
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        Mejor tiempo con tope opcional
      </div>
    </DemoShell>
  );
};

/* ---------- CTA ---------- */

const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);

  const ctaOpacity = interpolate(frame, [12, 30], [0, 1], {
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
      <div style={{ transform: `scale(${logoScale})` }}>
        <Img
          src={staticFile("logos/wody-texto.png")}
          style={{ width: 480, height: "auto" }}
        />
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
        Todo el cronómetro
        <br />
        que tu box necesita
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

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

const COMERCIOS: Array<{
  logo: string;
  name: string;
  offer: string;
  subline: string;
}> = [
  {
    logo: "nutrite-con-lu.png",
    name: "Nutrite con Lu",
    offer: "BIOIMPEDANCIA\nDE REGALO",
    subline: "con tu consulta nutricional",
  },
  {
    logo: "ready-for-wod.png",
    name: "Ready For Wod",
    offer: "10% OFF",
    subline: "en tu primera compra",
  },
  {
    logo: "ger.png",
    name: "German Masajista",
    offer: "25% OFF",
    subline: "en masajes deportivos",
  },
  {
    logo: "quinque.png",
    name: "Quinque",
    offer: "15% OFF",
    subline: "pasteleria saludable",
  },
  {
    logo: "atr.png",
    name: "A Todo Ritmo",
    offer: "10% OFF",
    subline: "efectivo o transferencia",
  },
  {
    logo: "becalsualf-ft.png",
    name: "Becasual",
    offer: "10% OFF",
    subline: "desde 2 prendas",
  },
  {
    logo: "bv-sports.png",
    name: "Buena Vibra Sport",
    offer: "10% OFF",
    subline: "indumentaria deportiva",
  },
];

export const CuponeraPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={90}>
        <Intro />
      </Sequence>

      <Sequence from={90} durationInFrames={270}>
        <Carousel />
      </Sequence>

      <Sequence from={360} durationInFrames={120}>
        <CodigoReveal />
      </Sequence>

      <Sequence from={480} durationInFrames={60}>
        <Validacion />
      </Sequence>

      <Sequence from={540} durationInFrames={60}>
        <CTA />
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

/* ---------- Shared visual layers ---------- */

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

/* ---------- Scene 1: Intro ---------- */

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
        Exclusivo para alumnos
      </div>

      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 180,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "white",
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Beneficios
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 2: Carousel of comercios ---------- */

const Carousel: React.FC = () => {
  const perSlide = 38;
  return (
    <AbsoluteFill>
      {COMERCIOS.map((c, i) => (
        <Sequence key={c.logo} from={i * perSlide} durationInFrames={perSlide + 4}>
          <ComercioSlide comercio={c} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const ComercioSlide: React.FC<{
  comercio: (typeof COMERCIOS)[number];
  index: number;
}> = ({ comercio, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  const slideIn = interpolate(enterSpring, [0, 1], [160, 0]);
  const opacity = interpolate(frame, [0, 6, 34, 42], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  const chipDelay = 6;
  const chipSpring = spring({
    frame: frame - chipDelay,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.5 },
  });
  const chipScale = interpolate(chipSpring, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        opacity,
        transform: `translateX(${slideIn}px)`,
      }}
    >
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.3em",
          color: BRAND_RED,
          textTransform: "uppercase",
          marginBottom: 30,
        }}
      >
        {String(index + 1).padStart(2, "0")} / {String(COMERCIOS.length).padStart(2, "0")}
      </div>

      <div
        style={{
          width: 520,
          height: 520,
          background: "rgba(255,255,255,0.04)",
          border: "2px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          marginBottom: 60,
        }}
      >
        <Img
          src={staticFile(`logos/${comercio.logo}`)}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 44,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 30,
          textAlign: "center",
        }}
      >
        {comercio.name}
      </div>

      <div
        style={{
          transform: `scale(${chipScale})`,
          background: BRAND_RED,
          padding: "28px 56px",
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          whiteSpace: "pre-line",
          textAlign: "center",
        }}
      >
        {comercio.offer}
      </div>

      <div
        style={{
          marginTop: 36,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 36,
          color: "rgba(255,255,255,0.7)",
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        {comercio.subline}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 3: Código generándose ---------- */

const CodigoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const cardSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.85, 1]);

  // Code "scrambles" then settles on real code
  const finalCode = "WODY-8K4R-Z9P2";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const settleStart = 50;
  const settleEnd = 80;

  let displayCode = "";
  if (frame < settleStart) {
    displayCode = scramble(frame, alphabet);
  } else if (frame < settleEnd) {
    const settled = Math.floor(
      interpolate(frame, [settleStart, settleEnd], [0, finalCode.length])
    );
    displayCode =
      finalCode.slice(0, settled) +
      scramble(frame, alphabet).slice(settled, finalCode.length);
  } else {
    displayCode = finalCode;
  }

  const igOpacity = interpolate(frame, [85, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.3em",
          color: BRAND_RED,
          textTransform: "uppercase",
          marginBottom: 40,
          opacity: eyebrowOpacity,
        }}
      >
        Tu código único
      </div>

      <div
        style={{
          transform: `scale(${cardScale})`,
          width: 880,
          background: "rgba(10,10,10,0.9)",
          border: `3px solid ${BRAND_RED}`,
          padding: "80px 40px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 96,
            lineHeight: 1,
            letterSpacing: "0.15em",
            color: "white",
          }}
        >
          {displayCode}
        </div>
      </div>

      <div
        style={{
          marginTop: 60,
          opacity: igOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Mostralo al comercio en Instagram
      </div>
    </AbsoluteFill>
  );
};

const scramble = (frame: number, alphabet: string) => {
  const len = 14; // WODY-XXXX-XXXX length
  let result = "WODY-";
  for (let i = 0; i < 9; i++) {
    if (i === 4) {
      result += "-";
      continue;
    }
    const idx = (frame * 7 + i * 13) % alphabet.length;
    result += alphabet[idx];
  }
  return result.slice(0, len);
};

/* ---------- Scene 4: Validación ---------- */

const Validacion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tickSpring = spring({
    frame: frame - 2,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
  });
  const tickScale = interpolate(tickSpring, [0, 1], [0, 1]);

  const textOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: BRAND_RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${tickScale})`,
          boxShadow: `0 0 120px rgba(227,20,20,0.5)`,
        }}
      >
        <svg width="180" height="180" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12l5 5L20 6"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        style={{
          marginTop: 60,
          opacity: textOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 120,
          color: "white",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          textAlign: "center",
        }}
      >
        Cupón
        <br />
        válido
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 5: CTA ---------- */

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
        Ingresá a WODY
        <br />
        y obtené el tuyo
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

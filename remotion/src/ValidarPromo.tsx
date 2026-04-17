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
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

/* WODY palette — matches the real /validar/[codigo] page */
const BG = "#0A0A0F";
const PANEL_BG = "#0A0A0A";
const PANEL_BORDER = "#1A1A1A";
const HEADER_BG_VALID = "rgba(227,20,20,0.10)";
const HEADER_BORDER_VALID = "rgba(227,20,20,0.30)";
const HEADER_BG_USED = "#141414";
const HEADER_BORDER_USED = "rgba(255,255,255,0.06)";
const BRAND_RED = "#E31414";
const BRAND_RED_80 = "rgba(227,20,20,0.8)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_MUTED = "rgba(255,255,255,0.5)";
const TEXT_DIM = "rgba(255,255,255,0.3)";
const TEXT_DIMMER = "rgba(255,255,255,0.2)";

/* Data used throughout */
const CODE = "WODY-8K4R-Z9P2";
const STUDENT = "Camila Torres";
const GYM = "Rompiendo Limites";
const GENERATED = "17 de abril de 2026, 09:24";
const VALIDATED = "17 de abril de 2026, 14:08";
const COUPON_NAME = "Quinque · Primera compra";
const COUPON_HANDLE = "quinque.pasteleria";
const COUPON_DESC =
  "15% de descuento en tu primera compra. Productos integrales, monto mínimo $10.000. Pastelería saludable.";

/* Scene timing (30s @ 30fps = 900 frames) */
const INTRO_END = 90; //             0–90    · 3s
const CHAT_END = 300; //            90–300   · 7s  · IG DM
const BROWSER_END = 480; //        300–480   · 6s  · URL typing
const VALID_END = 720; //          480–720   · 8s  · Cupón válido
const REUSE_END = 810; //          720–810   · 3s  · Ya fue usado
// 810-900 · 3s · CTA

export const ValidarPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: body.fontFamily }}>
      <BackgroundGlow />

      <Sequence from={0} durationInFrames={INTRO_END}>
        <Intro />
      </Sequence>

      <Sequence from={INTRO_END} durationInFrames={CHAT_END - INTRO_END}>
        <ChatScene />
      </Sequence>

      <Sequence from={CHAT_END} durationInFrames={BROWSER_END - CHAT_END}>
        <BrowserScene />
      </Sequence>

      <Sequence from={BROWSER_END} durationInFrames={VALID_END - BROWSER_END}>
        <ValidPage />
      </Sequence>

      <Sequence from={VALID_END} durationInFrames={REUSE_END - VALID_END}>
        <AlreadyUsedPage />
      </Sequence>

      <Sequence from={REUSE_END} durationInFrames={900 - REUSE_END}>
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
  const pulse = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.08 + 0.9;
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
            "radial-gradient(circle, rgba(227,20,20,0.30) 0%, rgba(227,20,20,0.06) 35%, transparent 65%)",
          filter: "blur(130px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-8%",
          left: "-12%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(227,20,20,0.22) 0%, transparent 70%)",
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
          src={staticFile("logos/wody-texto.png")}
          style={{ width: 520, height: "auto" }}
        />
      </div>
      <div
        style={{
          marginTop: 80,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.35em",
          color: BRAND_RED,
          textTransform: "uppercase",
          opacity: eyebrowOpacity,
        }}
      >
        Para comercios aliados
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: heading.fontFamily,
          fontWeight: 900,
          fontSize: 160,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: TEXT_PRIMARY,
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Validar
        <br />
        un cupón
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: body.fontFamily,
          fontWeight: 500,
          fontSize: 34,
          color: TEXT_MUTED,
          opacity: titleOpacity,
        }}
      >
        En 3 pasos
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene: step indicator ---------- */

const StepBadge: React.FC<{ num: string; text: string; opacity?: number }> = ({
  num,
  text,
  opacity = 1,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      opacity,
    }}
  >
    <div
      style={{
        padding: "10px 22px",
        background: BRAND_RED,
        color: "white",
        fontFamily: heading.fontFamily,
        fontWeight: 900,
        fontSize: 24,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
      }}
    >
      Paso {num}
    </div>
    <div
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: "0.15em",
        color: TEXT_PRIMARY,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  </div>
);

/* ---------- Scene 2: IG DM chat ---------- */

const ChatScene: React.FC = () => {
  const frame = useCurrentFrame(); // 0..210

  const introIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const introY = interpolate(frame, [0, 18], [20, 0], {
    extrapolateRight: "clamp",
  });

  // Bubbles appear one by one
  // Bubble 1: "Hola! Te mando el código del cupón"  → 25
  // Bubble 2 (code): WODY-8K4R-Z9P2                  → 80
  // Bubble 3: "Lo podés validar en este link..."     → 130
  // Bubble 4 (link): https://www.wody.com.ar/validar/... → 170

  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 80 }}>
      <div style={{ opacity: introIn, transform: `translateY(${introY}px)` }}>
        <StepBadge num="01" text="Te mandan el código" />
      </div>

      <div
        style={{
          marginTop: 40,
          alignSelf: "center",
          width: 880,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <PhoneFrame>
          <IGChatHeader />
          <div
            style={{
              padding: "28px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <ChatBubble
              side="left"
              text="Hola! Te mando el código del cupón 🎟"
              visibleAt={25}
              frame={frame}
            />
            <ChatBubble
              side="left"
              text={CODE}
              mono
              visibleAt={80}
              frame={frame}
            />
            <ChatBubble
              side="left"
              text="Lo podés validar en este link 👇"
              visibleAt={130}
              frame={frame}
            />
            <ChatBubble
              side="left"
              text={`https://www.wody.com.ar/validar/${CODE}`}
              link
              visibleAt={170}
              frame={frame}
            />
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: "100%",
      background: "#000",
      border: "6px solid #1A1A1A",
      borderRadius: 48,
      overflow: "hidden",
      boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
    }}
  >
    {/* Status bar */}
    <div
      style={{
        padding: "14px 32px 10px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#000",
      }}
    >
      <span
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 22,
          color: "white",
        }}
      >
        14:05
      </span>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 18,
            color: "white",
          }}
        >
          ••••
        </span>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 16,
            color: "white",
          }}
        >
          5G
        </span>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 18,
            color: "white",
          }}
        >
          ▮▮▮
        </span>
      </div>
    </div>
    {children}
  </div>
);

const IGChatHeader: React.FC = () => (
  <div
    style={{
      padding: "16px 24px",
      borderTop: "1px solid #1A1A1A",
      borderBottom: "1px solid #1A1A1A",
      display: "flex",
      alignItems: "center",
      gap: 16,
      background: "#000",
    }}
  >
    <span
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 28,
        color: "white",
      }}
    >
      ←
    </span>
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background:
          "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: heading.fontFamily,
        fontWeight: 900,
        fontSize: 22,
        color: "white",
      }}
    >
      C
    </div>
    <div>
      <div
        style={{
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 22,
          color: "white",
          letterSpacing: "0.05em",
        }}
      >
        camila.torres
      </div>
      <div
        style={{
          fontFamily: body.fontFamily,
          fontSize: 16,
          color: TEXT_MUTED,
        }}
      >
        Activa ahora · Instagram
      </div>
    </div>
  </div>
);

const ChatBubble: React.FC<{
  side: "left" | "right";
  text: string;
  mono?: boolean;
  link?: boolean;
  visibleAt: number;
  frame: number;
}> = ({ side, text, mono = false, link = false, visibleAt, frame }) => {
  const opacity = interpolate(frame, [visibleAt, visibleAt + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [visibleAt, visibleAt + 14], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const base: React.CSSProperties = {
    padding: "16px 22px",
    borderRadius: 24,
    maxWidth: "78%",
    fontFamily: mono ? heading.fontFamily : body.fontFamily,
    fontWeight: mono ? 900 : 500,
    fontSize: mono ? 32 : 26,
    letterSpacing: mono ? "0.18em" : "0.01em",
    color: side === "left" ? "white" : "white",
    opacity,
    transform: `translateY(${y}px)`,
    alignSelf: side === "left" ? "flex-start" : "flex-end",
    background: side === "left" ? "#1F1F1F" : "#3B5FFF",
    borderTopLeftRadius: side === "left" ? 6 : 24,
    borderTopRightRadius: side === "left" ? 24 : 6,
  };

  if (mono) {
    base.background = "rgba(227,20,20,0.12)";
    base.color = BRAND_RED;
    base.border = "2px solid rgba(227,20,20,0.45)";
    base.borderTopLeftRadius = 6;
  }
  if (link) {
    base.color = "#7FB8FF";
    base.fontFamily = body.fontFamily;
    base.fontSize = 22;
    base.wordBreak = "break-all";
    base.textDecoration = "underline";
  }

  return <div style={base}>{text}</div>;
};

/* ---------- Scene 3: Browser URL typing ---------- */

const BrowserScene: React.FC = () => {
  const frame = useCurrentFrame(); // 0..180

  const introIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const introY = interpolate(frame, [0, 18], [20, 0], {
    extrapolateRight: "clamp",
  });

  // URL typing: starts at 30, finishes at 110
  const fullUrl = `https://www.wody.com.ar/validar/${CODE}`;
  const revealed = Math.min(
    fullUrl.length,
    Math.max(0, Math.floor(interpolate(frame, [30, 110], [0, fullUrl.length])))
  );
  const typedUrl = fullUrl.slice(0, revealed);
  const showCaret = frame >= 30 && revealed < fullUrl.length;

  // Enter pressed at 125, loading until 175, then transition out
  const enterPressed = frame >= 125;
  const loadingOpacity = interpolate(frame, [125, 140, 170, 180], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const loadingProgress = interpolate(frame, [125, 175], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 80 }}>
      <div style={{ opacity: introIn, transform: `translateY(${introY}px)` }}>
        <StepBadge num="02" text="Abrís el link" />
      </div>

      <div
        style={{
          marginTop: 60,
          background: "#1A1A1A",
          border: "1px solid #2A2A2A",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 22px",
            background: "#0F0F0F",
            borderBottom: "1px solid #2A2A2A",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FF5F57",
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FEBC2E",
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#28C840",
            }}
          />
          <div style={{ flex: 1 }} />
        </div>
        <div
          style={{
            padding: "18px 22px",
            background: "#0F0F0F",
            borderBottom: "1px solid #2A2A2A",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 22,
              color: TEXT_DIM,
            }}
          >
            ← →
          </span>
          {/* URL bar */}
          <div
            style={{
              flex: 1,
              background: "#1F1F1F",
              border: "1px solid #2A2A2A",
              padding: "14px 22px",
              minHeight: 58,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: body.fontFamily,
              fontSize: 26,
              color: TEXT_PRIMARY,
            }}
          >
            <span style={{ color: BRAND_RED, fontSize: 22 }}>🔒</span>
            <span>
              {typedUrl}
              {showCaret && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 28,
                    background: TEXT_PRIMARY,
                    marginLeft: 2,
                    verticalAlign: "middle",
                    opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
                  }}
                />
              )}
            </span>
          </div>
          {/* Enter key hint */}
          {frame >= 115 && frame < 145 && (
            <div
              style={{
                padding: "10px 18px",
                background: enterPressed ? BRAND_RED : "transparent",
                border: `2px solid ${BRAND_RED}`,
                color: enterPressed ? "white" : BRAND_RED,
                fontFamily: heading.fontFamily,
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                transform: `scale(${enterPressed ? 0.9 : 1})`,
                transition: "all 120ms",
              }}
            >
              Enter ↵
            </div>
          )}
        </div>

        {/* Content area — shows blank with loading bar */}
        <div
          style={{
            height: 1000,
            background: BG,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 4,
              width: `${loadingProgress}%`,
              background: BRAND_RED,
              opacity: loadingOpacity,
            }}
          />
          {frame >= 135 && frame < 175 && (
            <div
              style={{
                position: "absolute",
                top: "45%",
                left: 0,
                right: 0,
                textAlign: "center",
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: "0.25em",
                color: TEXT_DIM,
                textTransform: "uppercase",
              }}
            >
              Cargando…
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Validation page layout (matches real /validar page) ---------- */

const ValidationPageFrame: React.FC<{
  state: "valid" | "used";
  consumedAt?: string;
  children?: React.ReactNode;
  infoRevealFrame?: number;
}> = ({ state, consumedAt, children, infoRevealFrame = 0 }) => {
  const frame = useCurrentFrame();
  void children;

  // Header pulse on valid
  const headerGlow =
    state === "valid"
      ? interpolate((frame % 60) - 30, [-30, 0, 30], [0.2, 0.5, 0.2])
      : 0;

  // Info rows reveal sequentially
  const rowReveal = (offset: number) =>
    interpolate(frame, [infoRevealFrame + offset, infoRevealFrame + offset + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const rowY = (offset: number) =>
    interpolate(frame, [infoRevealFrame + offset, infoRevealFrame + offset + 12], [8, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <div style={{ padding: "40px 60px", minHeight: "100%" }}>
      {/* WODY logo at top */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 40,
          opacity: 0.6,
        }}
      >
        <Img
          src={staticFile("logos/wody-texto.png")}
          style={{ width: 160, height: "auto", display: "inline-block" }}
        />
      </div>

      {/* Main card */}
      <div
        style={{
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          overflow: "hidden",
          maxWidth: 860,
          margin: "0 auto",
          boxShadow:
            state === "valid"
              ? `0 0 ${40 + headerGlow * 60}px rgba(227,20,20,${0.15 + headerGlow * 0.15})`
              : "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 32px",
            background: state === "valid" ? HEADER_BG_VALID : HEADER_BG_USED,
            borderBottom: `1px solid ${
              state === "valid" ? HEADER_BORDER_VALID : HEADER_BORDER_USED
            }`,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          {state === "valid" ? <CheckCircleIcon /> : <ClockIcon />}
          <div>
            <div
              style={{
                fontFamily: heading.fontFamily,
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: "0.15em",
                color: TEXT_PRIMARY,
                textTransform: "uppercase",
              }}
            >
              {state === "valid" ? "Cupón válido" : "Ya fue usado"}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "0.18em",
                color: state === "valid" ? BRAND_RED_80 : TEXT_MUTED,
                textTransform: "uppercase",
              }}
            >
              {state === "valid"
                ? "Recién canjeado · No se puede usar de nuevo"
                : consumedAt
                ? `El ${consumedAt}`
                : ""}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 36, display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Coupon header: logo + name + @handle */}
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 120,
                height: 120,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.06)`,
                padding: 10,
                flexShrink: 0,
              }}
            >
              <Img
                src={staticFile("logos/quinque.png")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 900,
                  fontSize: 36,
                  letterSpacing: "0.05em",
                  color: TEXT_PRIMARY,
                  textTransform: "uppercase",
                  lineHeight: 1.05,
                }}
              >
                {COUPON_NAME}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: body.fontFamily,
                  fontSize: 22,
                  color: TEXT_MUTED,
                }}
              >
                @{COUPON_HANDLE}
              </div>
            </div>
          </div>

          {/* Description */}
          <div
            style={{
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              fontFamily: body.fontFamily,
              fontSize: 24,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5,
            }}
          >
            {COUPON_DESC}
          </div>

          {/* Info rows */}
          <div
            style={{
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <InfoRow label="Código" value={CODE} mono opacity={rowReveal(0)} y={rowY(0)} />
            <InfoRow
              label="Alumno"
              value={STUDENT}
              opacity={rowReveal(10)}
              y={rowY(10)}
            />
            <InfoRow label="Gym" value={GYM} opacity={rowReveal(20)} y={rowY(20)} />
            <InfoRow
              label="Generado"
              value={GENERATED}
              opacity={rowReveal(30)}
              y={rowY(30)}
            />
            {state === "used" && consumedAt && (
              <InfoRow
                label="Validado"
                value={consumedAt}
                opacity={rowReveal(40)}
                y={rowY(40)}
              />
            )}
            {state === "valid" && (
              <InfoRow
                label="Validado"
                value={VALIDATED}
                opacity={rowReveal(40)}
                y={rowY(40)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  opacity: number;
  y: number;
}> = ({ label, value, mono = false, opacity, y }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 20,
      opacity,
      transform: `translateY(${y}px)`,
    }}
  >
    <span
      style={{
        fontFamily: heading.fontFamily,
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: "0.2em",
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        width: 160,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: mono ? heading.fontFamily : body.fontFamily,
        fontWeight: mono ? 900 : 500,
        fontSize: mono ? 28 : 22,
        letterSpacing: mono ? "0.18em" : "0.01em",
        color: mono ? BRAND_RED : "rgba(255,255,255,0.9)",
        wordBreak: "break-all",
      }}
    >
      {value}
    </span>
  </div>
);

const CheckCircleIcon: React.FC = () => (
  <div
    style={{
      width: 64,
      height: 64,
      borderRadius: "50%",
      background: "rgba(227,20,20,0.15)",
      border: `2px solid rgba(227,20,20,0.45)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={BRAND_RED} strokeWidth="2" />
      <path
        d="M8 12l3 3 5-6"
        stroke={BRAND_RED}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const ClockIcon: React.FC = () => (
  <div
    style={{
      width: 64,
      height: 64,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.06)",
      border: `2px solid rgba(255,255,255,0.15)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={TEXT_MUTED} strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke={TEXT_MUTED}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/* ---------- Scene 4: Valid page ---------- */

const ValidPage: React.FC = () => {
  const frame = useCurrentFrame(); // 0..240

  const pageOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Step badge fades in after a beat
  const badgeOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Success flash when page loads
  const successFlash = interpolate(frame, [10, 25, 55], [0, 0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ paddingTop: 60, opacity: pageOpacity }}>
      <div style={{ padding: "0 40px", marginBottom: 20 }}>
        <div style={{ opacity: badgeOpacity }}>
          <StepBadge num="03" text="Se valida automáticamente" />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <ValidationPageFrame state="valid" infoRevealFrame={55} />
        {/* Success flash overlay */}
        <AbsoluteFill
          style={{
            background: BRAND_RED,
            opacity: successFlash * 0.2,
            pointerEvents: "none",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 5: Already used page ---------- */

const AlreadyUsedPage: React.FC = () => {
  const frame = useCurrentFrame(); // 0..90

  // Transition: simulate browser reload (fade out → fade in)
  const reloadFlash = interpolate(frame, [0, 8, 18], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pageOpacity = interpolate(frame, [4, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  const warningIn = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div style={{ opacity: pageOpacity }}>
        <ValidationPageFrame
          state="used"
          consumedAt={VALIDATED}
          infoRevealFrame={14}
        />
      </div>

      {/* Warning banner at top */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 60,
          right: 60,
          padding: "18px 26px",
          background: "rgba(0,0,0,0.85)",
          border: `2px solid ${BRAND_RED}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          opacity: warningIn,
          transform: `translateY(${(1 - warningIn) * -20}px)`,
        }}
      >
        <span style={{ fontSize: 32 }}>⚠️</span>
        <span
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: "0.15em",
            color: "white",
            textTransform: "uppercase",
          }}
        >
          Si recargás, ya queda usado
        </span>
      </div>

      {/* Reload flash */}
      <AbsoluteFill
        style={{
          background: "white",
          opacity: reloadFlash * 0.15,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- CTA ---------- */

const CTAScene: React.FC = () => {
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
  const urlOpacity = interpolate(frame, [25, 50], [0, 1], {
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
          fontSize: 82,
          lineHeight: 1.05,
          color: TEXT_PRIMARY,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Aplicás
        <br />
        el descuento
      </div>

      <div
        style={{
          marginTop: 50,
          opacity: urlOpacity,
          fontFamily: body.fontFamily,
          fontWeight: 600,
          fontSize: 32,
          color: BRAND_RED,
          letterSpacing: "0.02em",
          wordBreak: "break-all",
          maxWidth: 900,
        }}
      >
        wody.com.ar/validar/EL-CODIGO
      </div>

      <div
        style={{
          marginTop: 28,
          opacity: urlOpacity,
          fontFamily: heading.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.3em",
          color: TEXT_MUTED,
          textTransform: "uppercase",
        }}
      >
        @wody.app
      </div>
    </AbsoluteFill>
  );
};

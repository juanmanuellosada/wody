import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const CREAM = "#F5F2EB";

export const WodyLogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 5: fade out the last 10 frames (230–240) to ~85%
  const finalOpacity = interpolate(frame, [230, 240], [1, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", opacity: finalOpacity }}>
      <Phase1Awakening />
      <Phase2SpinReveal />
      <Phase3EnergyPulse />
      <Phase4LockIn />
      <Phase5Hold />
    </AbsoluteFill>
  );
};

/* ---- Phase 1: Awakening (frames 0–30) ---- */

const Phase1Awakening: React.FC = () => {
  const frame = useCurrentFrame();

  // Dot appears from frame 10 and pulses
  const dotOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dotPulse = Math.sin(((frame - 10) / 15) * Math.PI) * 0.5 + 0.5;
  const dotRadius = interpolate(dotPulse, [0, 1], [4, 10]);

  // From frame 20, dot expands quickly to cover screen
  const expandProgress = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const expandRadius = interpolate(expandProgress, [0, 1], [dotRadius, 0]);

  // Whole phase fades out at frame 30
  const phaseOpacity = interpolate(frame, [28, 31], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame > 31) return null;

  return (
    <AbsoluteFill style={{ opacity: phaseOpacity }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: expandRadius * 2,
          height: expandRadius * 2,
          borderRadius: "50%",
          backgroundColor: CREAM,
          opacity: dotOpacity,
          boxShadow: `0 0 ${expandRadius * 4}px ${expandRadius}px rgba(245,242,235,0.6)`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---- Phase 2: Spin reveal (frames 30–90) ---- */

const Phase2SpinReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < 29 || frame > 92) return null;

  const localFrame = frame - 30;

  // Scale-in with spring (slight overshoot)
  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // 720° rotation with ease-out
  const rotation = interpolate(localFrame, [0, 60], [0, 720], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Glow breathes with rotation progress
  const glowOpacity = interpolate(localFrame, [0, 30, 60], [0, 0.5, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowScale = interpolate(scaleSpring, [0, 1], [0.5, 1.2]);

  // Fade in
  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // standaloneSize matches the visible O ring diameter in the wordmark (measured):
  // wmHeight=217px, O glyph ≈203px, wody-negro-512 ring occupies 0.5981 of its frame
  const size = 340;
  const center = { left: 540 - size / 2, top: 960 - size / 2 };

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Radial glow behind the O */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 960 - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,242,235,0.4) 0%, transparent 60%)`,
          filter: "blur(40px)",
          opacity: glowOpacity,
          transform: `scale(${glowScale})`,
          transformOrigin: "center center",
        }}
      />

      {/* Motion blur: trailing copy at -30° */}
      <Img
        src={staticFile("logos/wody-negro-512.png")}
        style={{
          position: "absolute",
          left: center.left,
          top: center.top,
          width: size,
          height: size,
          transform: `rotate(${rotation - 30}deg)`,
          opacity: 0.2,
          // Show only the white ring, hide the black corners
          mixBlendMode: "lighten",
        }}
      />

      {/* Motion blur: trailing copy at -15° */}
      <Img
        src={staticFile("logos/wody-negro-512.png")}
        style={{
          position: "absolute",
          left: center.left,
          top: center.top,
          width: size,
          height: size,
          transform: `rotate(${rotation - 15}deg)`,
          opacity: 0.4,
          mixBlendMode: "lighten",
        }}
      />

      {/* Main O */}
      <Img
        src={staticFile("logos/wody-negro-512.png")}
        style={{
          position: "absolute",
          left: center.left,
          top: center.top,
          width: size,
          height: size,
          transform: `rotate(${rotation}deg) scale(${scaleSpring})`,
          transformOrigin: "center center",
          // Hide black corners against black background
          mixBlendMode: "lighten",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---- Phase 3: Energy pulse (frames 90–150) ---- */

const Phase3EnergyPulse: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame < 89 || frame > 152) return null;

  const localFrame = frame - 90;

  // Pulse scale: 1.0 ↔ 1.05 in sine
  const pulseCycle = Math.sin((localFrame / 30) * Math.PI * 2);
  const pulseScale = interpolate(pulseCycle, [-1, 1], [1.0, 1.05]);

  // Glow breathes in sync
  const glowOpacity = interpolate(pulseCycle, [-1, 1], [0.25, 0.45]);

  const size = 340;
  const center = { left: 540 - size / 2, top: 960 - size / 2 };

  return (
    <AbsoluteFill>
      {/* Breathing glow */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 960 - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,242,235,${glowOpacity}) 0%, transparent 60%)`,
          filter: "blur(40px)",
          transform: `scale(${pulseScale * 1.1})`,
          transformOrigin: "center center",
        }}
      />

      {/* O upright and pulsing */}
      <Img
        src={staticFile("logos/wody-negro-512.png")}
        style={{
          position: "absolute",
          left: center.left,
          top: center.top,
          width: size,
          height: size,
          transform: `scale(${pulseScale})`,
          transformOrigin: "center center",
          mixBlendMode: "lighten",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---- Phase 4: Logo lock-in (frames 150–180) ---- */

const Phase4LockIn: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame < 149 || frame > 182) return null;

  const localFrame = frame - 150;

  // O fades out
  const oOpacity = interpolate(localFrame, [0, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Wordmark fades in with slight scale-in
  const wordmarkOpacity = interpolate(localFrame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkScale = interpolate(localFrame, [0, 30], [0.95, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tenue glow over the O area of the wordmark
  const glowOpacity = interpolate(localFrame, [10, 30], [0, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // standaloneSize matches the visible O ring in the wordmark
  const oSize = 340;
  const oCenter = { left: 540 - oSize / 2, top: 960 - oSize / 2 };

  // wody-texto.png: 3775×950px. O glyph center measured at column 1699 → ratio 0.4501.
  // Wordmark positioned so its O falls exactly at canvas center (540, 960).
  const wmWidth = 864;
  const wmHeight = Math.round(wmWidth * (950 / 3775)); // 217
  const oCenterRatio = 0.4501;
  const wmLeft = Math.round(540 - oCenterRatio * wmWidth);   // 151
  const wmTop = Math.round(960 - wmHeight / 2);              // 851

  return (
    <AbsoluteFill>
      {/* O standalone fading out */}
      <Img
        src={staticFile("logos/wody-negro-512.png")}
        style={{
          position: "absolute",
          left: oCenter.left,
          top: oCenter.top,
          width: oSize,
          height: oSize,
          opacity: oOpacity,
          mixBlendMode: "lighten",
        }}
      />

      {/* Glow over the O zone persists tenuously */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 960 - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,242,235,0.3) 0%, transparent 60%)`,
          filter: "blur(40px)",
          opacity: glowOpacity,
        }}
      />

      {/* Wordmark fading in, anchored so its O stays at canvas center (540, 960).
          transform-origin at the O's horizontal position so the scale-in grows from the O. */}
      <Img
        src={staticFile("logos/wody-texto.png")}
        style={{
          position: "absolute",
          left: wmLeft,
          top: wmTop,
          width: wmWidth,
          height: wmHeight,
          opacity: wordmarkOpacity,
          transform: `scale(${wordmarkScale})`,
          transformOrigin: `${oCenterRatio * 100}% 50%`,
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---- Phase 5: Hold (frames 180–240) ---- */

const Phase5Hold: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame < 179) return null;

  const localFrame = frame - 180;

  // Slow glow breathing: period 60 frames
  const breathe = Math.sin((localFrame / 60) * Math.PI * 2);
  const glowOpacity = interpolate(breathe, [-1, 1], [0.15, 0.3]);

  const wmWidth = 864;
  const wmHeight = Math.round(wmWidth * (950 / 3775)); // 217
  const oCenterRatio = 0.4501;
  const wmLeft = Math.round(540 - oCenterRatio * wmWidth);
  const wmTop = Math.round(960 - wmHeight / 2);

  return (
    <AbsoluteFill>
      {/* Subtle glow over the O area */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 960 - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,242,235,${glowOpacity}) 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Wordmark static */}
      <Img
        src={staticFile("logos/wody-texto.png")}
        style={{
          position: "absolute",
          left: wmLeft,
          top: wmTop,
          width: wmWidth,
          height: wmHeight,
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};

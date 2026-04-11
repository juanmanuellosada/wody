let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume = 0.5) {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (mobile browsers)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.value = volume;

    // Fade out to avoid clicks
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — try vibration
    vibrate(100);
  }
}

function vibrate(ms: number) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    // Vibration not available
  }
}

/** Short beep for countdown ticks (3, 2, 1) */
export function beepTick() {
  playTone(800, 0.15, 0.4);
  vibrate(50);
}

/** Medium beep for phase change (work → rest, rest → work) */
export function beepPhaseChange() {
  playTone(1000, 0.3, 0.6);
  vibrate(200);
}

/** Long ascending beep for GO / start work */
export function beepGo() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.4);
    gain.gain.value = 0.6;
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    vibrate(150);
  }
}

/** Triple beep for timer complete */
export function beepComplete() {
  playTone(1200, 0.2, 0.7);
  setTimeout(() => playTone(1200, 0.2, 0.7), 250);
  setTimeout(() => playTone(1600, 0.4, 0.7), 500);
  vibrate(500);
}

/**
 * Unlock audio on mobile — MUST be called from a direct user gesture (click/tap).
 * Plays a silent buffer to unblock the AudioContext for future programmatic playback.
 */
export function initAudio() {
  if (unlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    // Play a silent buffer to unlock audio on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    // Audio not available
  }
}

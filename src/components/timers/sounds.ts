let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume = 0.5) {
  try {
    const ctx = getAudioContext();
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
    // Audio not available
  }
}

/** Short beep for countdown ticks (3, 2, 1) */
export function beepTick() {
  playTone(800, 0.15, 0.4);
}

/** Medium beep for phase change (work → rest, rest → work) */
export function beepPhaseChange() {
  playTone(1000, 0.3, 0.6);
}

/** Long ascending beep for GO / start work */
export function beepGo() {
  try {
    const ctx = getAudioContext();
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
    // Audio not available
  }
}

/** Triple beep for timer complete */
export function beepComplete() {
  playTone(1200, 0.2, 0.7);
  setTimeout(() => playTone(1200, 0.2, 0.7), 250);
  setTimeout(() => playTone(1600, 0.4, 0.7), 500);
}

/** Warm up the audio context (must be called from user gesture) */
export function initAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {
    // Audio not available
  }
}

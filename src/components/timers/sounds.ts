// Timer sounds using pre-made WAV files based on janhgm's beep (freesound.org/s/237993, CC BY 3.0)
// Variations generated with ffmpeg: pitch shifts, delays, volume adjustments.

let tickAudio: HTMLAudioElement | null = null;
let phaseAudio: HTMLAudioElement | null = null;
let goAudio: HTMLAudioElement | null = null;
let completeAudio: HTMLAudioElement | null = null;
let initialized = false;

function buildAudios() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;

  tickAudio = new Audio("/sounds/tick.wav");
  phaseAudio = new Audio("/sounds/phase.wav");
  goAudio = new Audio("/sounds/go.wav");
  completeAudio = new Audio("/sounds/complete.wav");

  tickAudio.load();
  phaseAudio.load();
  goAudio.load();
  completeAudio.load();
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {
    vibrate(100);
  });
}

function vibrate(ms: number) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch { /* not available */ }
}

/** Short beep for countdown ticks (3, 2, 1) */
export function beepTick() {
  playAudio(tickAudio);
  vibrate(50);
}

/** Medium beep for phase change (work → rest, rest → work) */
export function beepPhaseChange() {
  playAudio(phaseAudio);
  vibrate(200);
}

/** Ascending beep for GO / start */
export function beepGo() {
  playAudio(goAudio);
  vibrate(150);
}

/** Triple beep for timer complete */
export function beepComplete() {
  playAudio(completeAudio);
  vibrate(500);
}

/**
 * MUST be called from a direct user gesture (click/tap).
 * Builds audio elements and plays a silent tick to unlock mobile audio.
 */
export function initAudio() {
  buildAudios();
  if (tickAudio) {
    tickAudio.volume = 0.01;
    tickAudio.currentTime = 0;
    tickAudio.play().then(() => {
      if (tickAudio) tickAudio.volume = 1;
    }).catch(() => { /* will work on next gesture */ });
  }
}

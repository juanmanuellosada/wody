// Generate WAV audio data programmatically for maximum mobile compatibility.
// Uses HTML Audio elements instead of Web Audio API oscillators.

const SAMPLE_RATE = 22050;

function generateWav(samples: Float32Array): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Write samples
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function generateTone(frequency: number, duration: number, volume = 0.5): Blob {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.min(1, Math.min(t * 50, (duration - t) * 20)); // attack/release
    samples[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
  }
  return generateWav(samples);
}

function generateSweep(startFreq: number, endFreq: number, duration: number, volume = 0.5): Blob {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;
    const freq = startFreq + (endFreq - startFreq) * progress;
    const envelope = Math.min(1, Math.min(t * 50, (duration - t) * 15));
    samples[i] = Math.sin(2 * Math.PI * freq * t) * volume * envelope;
  }
  return generateWav(samples);
}

function generateTripleBeep(): Blob {
  const beepDur = 0.15;
  const gap = 0.1;
  const totalDur = beepDur * 3 + gap * 2 + 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * totalDur);
  const samples = new Float32Array(numSamples);

  const beeps = [
    { start: 0, freq: 1200 },
    { start: beepDur + gap, freq: 1200 },
    { start: (beepDur + gap) * 2, freq: 1600 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    for (const beep of beeps) {
      const bt = t - beep.start;
      if (bt >= 0 && bt < beepDur) {
        const env = Math.min(1, Math.min(bt * 80, (beepDur - bt) * 20));
        samples[i] += Math.sin(2 * Math.PI * beep.freq * bt) * 0.6 * env;
      }
    }
  }
  return generateWav(samples);
}

// Pre-build audio elements
let tickAudio: HTMLAudioElement | null = null;
let phaseAudio: HTMLAudioElement | null = null;
let goAudio: HTMLAudioElement | null = null;
let completeAudio: HTMLAudioElement | null = null;
let initialized = false;

function buildAudios() {
  if (initialized) return;
  initialized = true;

  const tickBlob = generateTone(800, 0.15, 0.5);
  const phaseBlob = generateTone(1000, 0.3, 0.6);
  const goBlob = generateSweep(600, 1200, 0.4, 0.6);
  const completeBlob = generateTripleBeep();

  tickAudio = new Audio(URL.createObjectURL(tickBlob));
  phaseAudio = new Audio(URL.createObjectURL(phaseBlob));
  goAudio = new Audio(URL.createObjectURL(goBlob));
  completeAudio = new Audio(URL.createObjectURL(completeBlob));

  // Pre-load
  tickAudio.load();
  phaseAudio.load();
  goAudio.load();
  completeAudio.load();
}

function playAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Playback failed — try vibration
    vibrate(100);
  });
}

function vibrate(ms: number) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch { /* not available */ }
}

export function beepTick() {
  playAudio(tickAudio);
  vibrate(50);
}

export function beepPhaseChange() {
  playAudio(phaseAudio);
  vibrate(200);
}

export function beepGo() {
  playAudio(goAudio);
  vibrate(150);
}

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
  // Unlock by playing the tick audio silently
  if (tickAudio) {
    tickAudio.volume = 0.01;
    tickAudio.currentTime = 0;
    tickAudio.play().then(() => {
      if (tickAudio) tickAudio.volume = 1;
    }).catch(() => { /* will work on next user gesture */ });
  }
}

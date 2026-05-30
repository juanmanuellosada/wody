"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TimerDisplay, formatTime } from "./TimerDisplay";
import { beepTick, beepPhaseChange, beepGo, beepComplete, initAudio } from "./sounds";

// ─── Types ───

type CountDirection = "down" | "up";
type Advance = "auto" | "manual";
type TimerMode = "stopwatch" | "countdown" | "interval" | "tabata" | "amrap" | "fortime" | "emom" | "custom";
type TimerState = "idle" | "countdown-prep" | "running" | "paused" | "complete";

interface TimerSegment {
  kind: "work" | "rest";
  direction: CountDirection;
  durationSeconds: number | null; // null = open (only valid with advance "manual")
  advance: Advance;
  round: number;       // 1-based
  totalRounds: number;
  label: string;
}

interface CustomRoundConfig {
  work: { direction: CountDirection; durationSeconds: number | null; advance: Advance };
  rest: { enabled: boolean; durationSeconds: number };
}

interface CustomConfig {
  rounds: number;
  base: CustomRoundConfig;
  overrides: Record<number, Partial<CustomRoundConfig>>;
}

const TICK_MS = 50;
const PREP_SECONDS = 10;

// ─── buildSegments (pure function) ───

function buildSegments(
  mode: "interval" | "tabata" | "emom" | "custom",
  config: {
    // interval / tabata
    workSeconds?: number;
    restSeconds?: number;
    rounds?: number;
    // emom
    emomIntervalSeconds?: number;
    emomRounds?: number;
    // custom
    custom?: CustomConfig;
  }
): TimerSegment[] {
  const segments: TimerSegment[] = [];

  if (mode === "interval" || mode === "tabata") {
    const work = config.workSeconds ?? 20;
    const rest = config.restSeconds ?? 10;
    const rounds = config.rounds ?? 8;
    for (let r = 1; r <= rounds; r++) {
      segments.push({
        kind: "work",
        direction: "down",
        durationSeconds: work,
        advance: "auto",
        round: r,
        totalRounds: rounds,
        label: "Trabajo",
      });
      if (rest > 0) {
        segments.push({
          kind: "rest",
          direction: "down",
          durationSeconds: rest,
          advance: "auto",
          round: r,
          totalRounds: rounds,
          label: "Descanso",
        });
      }
    }
  } else if (mode === "emom") {
    const intervalSecs = config.emomIntervalSeconds ?? 60;
    const rounds = config.emomRounds ?? 10;
    for (let r = 1; r <= rounds; r++) {
      segments.push({
        kind: "work",
        direction: "down",
        durationSeconds: intervalSecs,
        advance: "auto",
        round: r,
        totalRounds: rounds,
        label: "EMOM",
      });
    }
  } else if (mode === "custom" && config.custom) {
    const cfg = config.custom;
    for (let r = 1; r <= cfg.rounds; r++) {
      const override = cfg.overrides[r] ?? {};
      const resolved: CustomRoundConfig = {
        work: { ...cfg.base.work, ...(override.work ?? {}) },
        rest: { ...cfg.base.rest, ...(override.rest ?? {}) },
      };
      segments.push({
        kind: "work",
        direction: resolved.work.direction,
        durationSeconds: resolved.work.durationSeconds,
        advance: resolved.work.advance,
        round: r,
        totalRounds: cfg.rounds,
        label: "Trabajo",
      });
      if (resolved.rest.enabled) {
        segments.push({
          kind: "rest",
          direction: "down",
          durationSeconds: resolved.rest.durationSeconds,
          advance: "auto",
          round: r,
          totalRounds: cfg.rounds,
          label: "Descanso",
        });
      }
    }
  }

  return segments;
}

// ─── Component ───

export function TimersClient() {
  const [mode, setMode] = useState<TimerMode | null>(null);
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);

  // Prep countdown
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  // Segment runner state (interval, tabata, emom, custom)
  const [segments, setSegments] = useState<TimerSegment[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0); // for "up" direction
  // For pause/resume of segment runner
  const pausedPhaseRemainingRef = useRef(0);
  const pausedPhaseElapsedRef = useRef(0);
  const pausedSegmentIndexRef = useRef(0);
  const pausedElapsedRef = useRef(0);

  // Countdown / AMRAP config
  const [countdownMinutes, setCountdownMinutes] = useState(12);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // FOR TIME config
  const [timeCapMinutes, setTimeCapMinutes] = useState(10);
  const [timeCapEnabled, setTimeCapEnabled] = useState(true);

  // Interval config
  const [customWork, setCustomWork] = useState(40);
  const [customRest, setCustomRest] = useState(20);
  const [customRounds, setCustomRounds] = useState(8);

  // Tabata config
  const [tabataWork, setTabataWork] = useState(20);
  const [tabataRest, setTabataRest] = useState(10);
  const [tabataRounds, setTabataRounds] = useState(8);

  // EMOM config
  const [emomIntervalSeconds, setEmomIntervalSeconds] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);

  // Custom config
  const defaultCustomBase: CustomRoundConfig = {
    work: { direction: "down", durationSeconds: 40, advance: "auto" },
    rest: { enabled: true, durationSeconds: 20 },
  };
  const [customConfig, setCustomConfig] = useState<CustomConfig>({
    rounds: 8,
    base: defaultCustomBase,
    overrides: {},
  });
  const [editingRound, setEditingRound] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundSecRef = useRef(-1);
  const pendingStartRef = useRef<(() => void) | null>(null);
  // Mutable ref to current segment index for the interval callback
  const segmentIndexRef = useRef(0);
  const segmentsRef = useRef<TimerSegment[]>([]);
  const manualAdvancePendingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastSoundSecRef.current = -1;
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  function reset() {
    clearTimer();
    setState("idle");
    setElapsed(0);
    setRemaining(0);
    setSegments([]);
    setSegmentIndex(0);
    setPhaseRemaining(0);
    setPhaseElapsed(0);
    setPrepRemaining(PREP_SECONDS);
    pendingStartRef.current = null;
    segmentIndexRef.current = 0;
    segmentsRef.current = [];
    manualAdvancePendingRef.current = false;
  }

  function selectMode(m: TimerMode) {
    reset();
    setMode(m);
  }

  function goBack() {
    reset();
    setMode(null);
  }

  // ─── Sound helper ───
  function triggerSoundAtSecond(sec: number, soundFn: () => void) {
    if (sec !== lastSoundSecRef.current && sec >= 0) {
      lastSoundSecRef.current = sec;
      soundFn();
    }
  }

  // ─── Prep Countdown ───
  function startPrep(afterPrep: () => void) {
    initAudio();
    pendingStartRef.current = afterPrep;
    setState("countdown-prep");
    setPrepRemaining(PREP_SECONDS);
    lastSoundSecRef.current = -1;

    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const passed = (Date.now() - start) / 1000;
      const left = Math.max(0, PREP_SECONDS - passed);
      const leftInt = Math.ceil(left);
      setPrepRemaining(leftInt);

      if (leftInt <= 3 && leftInt > 0) {
        triggerSoundAtSecond(leftInt, beepTick);
      }

      if (left <= 0) {
        clearTimer();
        lastSoundSecRef.current = -1;
        const fn = pendingStartRef.current;
        pendingStartRef.current = null;
        if (fn) fn();
      }
    }, TICK_MS);
  }

  // ─── Stopwatch ───
  function startStopwatch() {
    initAudio();
    setState("running");
    beepGo();
    const start = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, TICK_MS);
  }

  // ─── FOR TIME ───
  function _startForTime() {
    setState("running");
    beepGo();
    const capSecs = timeCapEnabled ? timeCapMinutes * 60 : Infinity;
    const start = Date.now();
    lastSoundSecRef.current = -1;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - start) / 1000);
      setElapsed(secs);
      if (timeCapEnabled) {
        const left = Math.max(0, capSecs - secs);
        setRemaining(left);
        if (left <= 3 && left > 0) triggerSoundAtSecond(left, beepTick);
      }
      if (secs >= capSecs) {
        clearTimer();
        setState("complete");
        beepComplete();
      }
    }, TICK_MS);
  }

  function startForTime() {
    initAudio();
    startPrep(_startForTime);
  }

  // ─── Countdown ───
  function _startCountdown() {
    const total = countdownMinutes * 60 + countdownSeconds;
    if (total <= 0) return;
    setState("running");
    beepGo();
    const start = Date.now();
    lastSoundSecRef.current = -1;

    intervalRef.current = setInterval(() => {
      const passed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, total - passed);
      setRemaining(left);
      setElapsed(total - left);
      if (left <= 3 && left > 0) triggerSoundAtSecond(left, beepTick);
      if (left <= 0) {
        clearTimer();
        setState("complete");
        beepComplete();
      }
    }, TICK_MS);
  }

  function startCountdownDirect() {
    initAudio();
    _startCountdown();
  }

  function startCountdownResume() {
    initAudio();
    const resumeFrom = remaining;
    if (resumeFrom <= 0) return;
    setState("running");
    const start = Date.now();
    lastSoundSecRef.current = -1;

    intervalRef.current = setInterval(() => {
      const passed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, resumeFrom - passed);
      setRemaining(left);
      if (left <= 3 && left > 0) triggerSoundAtSecond(left, beepTick);
      if (left <= 0) {
        clearTimer();
        setState("complete");
        beepComplete();
      }
    }, TICK_MS);
  }

  // ─── AMRAP ───
  function startAmrap() {
    initAudio();
    startPrep(_startCountdown);
  }

  // ─── Segment runner (interval, tabata, emom, custom) ───
  function _runSegments(
    segs: TimerSegment[],
    startSegIdx: number = 0,
    initialPhaseRemaining: number | null = null,
    initialPhaseElapsed: number = 0,
    startElapsed: number = 0
  ) {
    if (segs.length === 0) {
      setState("complete");
      beepComplete();
      return;
    }

    segmentsRef.current = segs;
    segmentIndexRef.current = startSegIdx;
    setSegments(segs);
    setSegmentIndex(startSegIdx);
    setState("running");

    const seg = segs[startSegIdx];
    const initRemaining = initialPhaseRemaining !== null
      ? initialPhaseRemaining
      : (seg.durationSeconds ?? 0);
    const initElapsed = initialPhaseElapsed;

    setPhaseRemaining(initRemaining);
    setPhaseElapsed(initElapsed);

    beepGo();

    let phaseRem = initRemaining;
    let overallElapsed = startElapsed;
    const tickStart = Date.now();
    const elapsedAtTickStart = startElapsed;
    let phaseStart = Date.now();
    lastSoundSecRef.current = -1;
    manualAdvancePendingRef.current = false;

    function advanceToSegment(nextIdx: number, now: number) {
      if (nextIdx >= segs.length) {
        clearTimer();
        setState("complete");
        setSegmentIndex(segs.length - 1);
        beepComplete();
        return;
      }
      segmentIndexRef.current = nextIdx;
      setSegmentIndex(nextIdx);

      const nextSeg = segs[nextIdx];
      phaseRem = nextSeg.durationSeconds ?? 0;
      phaseStart = now;
      setPhaseRemaining(phaseRem);
      setPhaseElapsed(0);
      lastSoundSecRef.current = -1;
      manualAdvancePendingRef.current = false;
      beepPhaseChange();
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const curIdx = segmentIndexRef.current;
      const curSeg = segs[curIdx];
      overallElapsed = elapsedAtTickStart + Math.floor((now - tickStart) / 1000);
      setElapsed(overallElapsed);

      const passedInPhase = (now - phaseStart) / 1000;

      if (curSeg.direction === "down") {
        const dur = curSeg.durationSeconds ?? 0;
        const leftRaw = Math.max(0, dur - passedInPhase);
        const leftInt = Math.ceil(leftRaw);
        phaseRem = leftInt;
        setPhaseRemaining(leftInt);

        if (leftInt <= 3 && leftInt > 0) triggerSoundAtSecond(leftInt, beepTick);

        if (curSeg.advance === "auto" && leftRaw <= 0) {
          advanceToSegment(curIdx + 1, now);
        } else if (curSeg.advance === "manual" && manualAdvancePendingRef.current) {
          manualAdvancePendingRef.current = false;
          advanceToSegment(curIdx + 1, now);
        }
      } else {
        // direction = "up"
        const elInt = Math.floor(passedInPhase);
        setPhaseElapsed(elInt);
        setPhaseRemaining(0);

        if (curSeg.advance === "manual" && manualAdvancePendingRef.current) {
          manualAdvancePendingRef.current = false;
          advanceToSegment(curIdx + 1, now);
        }
      }
    }, TICK_MS);
  }

  function nextSegment() {
    manualAdvancePendingRef.current = true;
  }

  // ─── Start functions for segment-based modes ───
  function startInterval() {
    initAudio();
    const segs = buildSegments("interval", {
      workSeconds: customWork,
      restSeconds: customRest,
      rounds: customRounds,
    });
    startPrep(() => _runSegments(segs));
  }

  function startTabata() {
    initAudio();
    const segs = buildSegments("tabata", {
      workSeconds: tabataWork,
      restSeconds: tabataRest,
      rounds: tabataRounds,
    });
    startPrep(() => _runSegments(segs));
  }

  function startEmom() {
    initAudio();
    const segs = buildSegments("emom", {
      emomIntervalSeconds,
      emomRounds,
    });
    startPrep(() => _runSegments(segs));
  }

  function startCustomTimer() {
    initAudio();
    const segs = buildSegments("custom", { custom: customConfig });
    if (segs.length === 0) return;
    startPrep(() => _runSegments(segs));
  }

  // ─── Pause / resume ───
  function pause() {
    clearTimer();
    pausedSegmentIndexRef.current = segmentIndexRef.current;
    pausedPhaseRemainingRef.current = phaseRemaining;
    pausedPhaseElapsedRef.current = phaseElapsed;
    pausedElapsedRef.current = elapsed;
    setState("paused");
  }

  function resume() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown") {
      initAudio();
      startCountdownResume();
    } else if (mode === "amrap") {
      initAudio();
      startCountdownResume();
    } else if (mode === "fortime") {
      initAudio();
      setState("running");
      const capSecs = timeCapEnabled ? timeCapMinutes * 60 : Infinity;
      const start = Date.now() - elapsed * 1000;
      lastSoundSecRef.current = -1;
      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - start) / 1000);
        setElapsed(secs);
        if (timeCapEnabled) {
          const left = Math.max(0, capSecs - secs);
          setRemaining(left);
          if (left <= 3 && left > 0) triggerSoundAtSecond(left, beepTick);
        }
        if (secs >= capSecs) {
          clearTimer();
          setState("complete");
          beepComplete();
        }
      }, TICK_MS);
    } else if (
      mode === "interval" || mode === "tabata" || mode === "emom" || mode === "custom"
    ) {
      initAudio();
      const segs = segmentsRef.current;
      const idx = pausedSegmentIndexRef.current;
      const curSeg = segs[idx];
      const initRemaining = curSeg.direction === "down"
        ? pausedPhaseRemainingRef.current
        : null;
      const initElapsed = pausedPhaseElapsedRef.current;
      _runSegments(segs, idx, initRemaining, initElapsed, pausedElapsedRef.current);
    }
  }

  function handleStart() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown") startCountdownDirect();
    else if (mode === "amrap") startAmrap();
    else if (mode === "fortime") startForTime();
    else if (mode === "tabata") startTabata();
    else if (mode === "interval") startInterval();
    else if (mode === "emom") startEmom();
    else if (mode === "custom") startCustomTimer();
  }

  // ─── Custom config helpers ───
  function updateCustomRounds(n: number) {
    setCustomConfig((prev) => ({ ...prev, rounds: n }));
  }

  function updateCustomBaseWork(patch: Partial<CustomRoundConfig["work"]>) {
    setCustomConfig((prev) => ({
      ...prev,
      base: { ...prev.base, work: { ...prev.base.work, ...patch } },
    }));
  }

  function updateCustomBaseRest(patch: Partial<CustomRoundConfig["rest"]>) {
    setCustomConfig((prev) => ({
      ...prev,
      base: { ...prev.base, rest: { ...prev.base.rest, ...patch } },
    }));
  }

  function setRoundOverride(round: number, patch: Partial<CustomRoundConfig>) {
    setCustomConfig((prev) => {
      const existing = prev.overrides[round] ?? {};
      const merged = { ...existing, ...patch };
      return { ...prev, overrides: { ...prev.overrides, [round]: merged } };
    });
  }

  function revertRoundOverride(round: number) {
    setCustomConfig((prev) => {
      const next = { ...prev.overrides };
      delete next[round];
      return { ...prev, overrides: next };
    });
  }

  function resolvedRound(round: number): CustomRoundConfig {
    const override = customConfig.overrides[round] ?? {};
    return {
      work: { ...customConfig.base.work, ...(override.work ?? {}) },
      rest: { ...customConfig.base.rest, ...(override.rest ?? {}) },
    };
  }

  // ─── Derived display values for segment modes ───
  const currentSeg = segments[segmentIndex] ?? null;
  const isSegmentMode = mode === "interval" || mode === "tabata" || mode === "emom" || mode === "custom";

  // ─── Mode selector ───
  if (!mode) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Cronómetros
        </h1>

        <section>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
            Básicos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ModeCard label="Cronómetro" description="Cuenta progresiva simple" onClick={() => selectMode("stopwatch")} />
            <ModeCard label="Temporizador" description="Cuenta regresiva configurable" onClick={() => selectMode("countdown")} />
            <ModeCard label="Intervalos" description="Trabajo / descanso personalizable" onClick={() => selectMode("interval")} />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
            Presets de entrenamiento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ModeCard label="TABATA" description="Trabajo, descanso y rondas configurables" accent onClick={() => selectMode("tabata")} />
            <ModeCard label="AMRAP" description="Cuenta regresiva — tantas rondas como puedas" accent onClick={() => selectMode("amrap")} />
            <ModeCard label="FOR TIME" description="Cronómetro progresivo con time cap opcional" accent onClick={() => selectMode("fortime")} />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
            Avanzado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ModeCard label="EMOM" description="Every Minute On the Minute — intervalo y rondas configurables" accent onClick={() => selectMode("emom")} />
            <ModeCard label="Custom" description="Secuencia de rondas personalizada con trabajo y descanso por ronda" accent onClick={() => selectMode("custom")} />
          </div>
        </section>
      </div>
    );
  }

  // ─── Timer view ───
  const modeLabel = mode === "stopwatch" ? "Cronómetro"
    : mode === "countdown" ? "Temporizador"
    : mode === "interval" ? "Intervalos"
    : mode === "tabata" ? "TABATA"
    : mode === "amrap" ? "AMRAP"
    : mode === "fortime" ? "FOR TIME"
    : mode === "emom" ? "EMOM"
    : "Custom";

  const showPrep = state === "countdown-prep";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="text-xs text-gray-600 hover:text-brand-red uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer"
        >
          <span aria-hidden="true">&#8592;</span> Volver
        </button>
        <h1 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white">
          {modeLabel}
        </h1>
      </div>

      {/* Config (only in idle) */}
      {state === "idle" && (
        <div className="border border-line bg-panel p-5 flex flex-col gap-4">
          {(mode === "countdown" || mode === "amrap") && (
            <div className="flex items-center gap-4 justify-center">
              <TimeInput label="Min" value={countdownMinutes} onChange={setCountdownMinutes} max={99} />
              <span className="text-2xl font-heading font-black text-gray-600">:</span>
              <TimeInput label="Seg" value={countdownSeconds} onChange={setCountdownSeconds} max={59} />
            </div>
          )}

          {mode === "fortime" && (
            <div className="flex flex-col gap-3 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeCapEnabled}
                  onChange={(e) => setTimeCapEnabled(e.target.checked)}
                  className="accent-brand-red"
                />
                <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400">
                  Time Cap
                </span>
              </label>
              {timeCapEnabled && (
                <TimeInput label="Min" value={timeCapMinutes} onChange={setTimeCapMinutes} max={99} />
              )}
            </div>
          )}

          {mode === "interval" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <TimeInput label="Trabajo (s)" value={customWork} onChange={setCustomWork} max={300} />
                <TimeInput label="Descanso (s)" value={customRest} onChange={setCustomRest} max={300} />
                <TimeInput label="Rondas" value={customRounds} onChange={setCustomRounds} max={50} />
              </div>
              <p className="text-xs text-gray-600 font-heading text-center">
                Total: {formatTime((customWork + customRest) * customRounds)}
              </p>
            </div>
          )}

          {mode === "tabata" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <TimeInput label="Trabajo (s)" value={tabataWork} onChange={setTabataWork} max={300} />
                <TimeInput label="Descanso (s)" value={tabataRest} onChange={setTabataRest} max={60} />
                <TimeInput label="Rondas" value={tabataRounds} onChange={setTabataRounds} max={50} />
              </div>
              <p className="text-xs text-gray-600 font-heading text-center">
                Total: {formatTime((tabataWork + tabataRest) * tabataRounds)}
              </p>
            </div>
          )}

          {mode === "emom" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 justify-center max-w-xs mx-auto w-full">
                <TimeInput label="Intervalo (s)" value={emomIntervalSeconds} onChange={setEmomIntervalSeconds} max={600} />
                <TimeInput label="Rondas" value={emomRounds} onChange={setEmomRounds} max={99} />
              </div>
              <p className="text-xs text-gray-600 font-heading text-center">
                Total: {formatTime(emomIntervalSeconds * emomRounds)}
              </p>
            </div>
          )}

          {mode === "custom" && (
            <CustomConfigPanel
              config={customConfig}
              editingRound={editingRound}
              setEditingRound={setEditingRound}
              updateCustomRounds={updateCustomRounds}
              updateCustomBaseWork={updateCustomBaseWork}
              updateCustomBaseRest={updateCustomBaseRest}
              setRoundOverride={setRoundOverride}
              revertRoundOverride={revertRoundOverride}
              resolvedRound={resolvedRound}
            />
          )}
        </div>
      )}

      {/* Prep countdown */}
      {showPrep && (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-brand-red animate-pulse">
            Preparate!
          </p>
          <p className="text-8xl sm:text-9xl font-heading font-black tabular-nums text-white">
            {prepRemaining}
          </p>
        </div>
      )}

      {/* Display */}
      {!showPrep && (
        <div className="flex flex-col items-center gap-4 py-8">
          {(mode === "stopwatch" || mode === "fortime") && (
            <>
              <TimerDisplay
                seconds={elapsed}
                large
                label={state === "complete" ? "Tiempo!" : undefined}
                accent={state === "complete"}
              />
              {mode === "fortime" && timeCapEnabled && state !== "idle" && (
                <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-600">
                  Cap: {formatTime(remaining)}
                </p>
              )}
            </>
          )}

          {(mode === "countdown" || mode === "amrap") && (
            <TimerDisplay
              seconds={state === "idle" ? countdownMinutes * 60 + countdownSeconds : remaining}
              large
              label={state === "complete" ? (mode === "amrap" ? "Tiempo!" : "Terminó!") : mode === "amrap" ? "AMRAP" : undefined}
              accent={state === "complete" || (remaining <= 10 && state === "running")}
            />
          )}

          {isSegmentMode && (
            <SegmentDisplay
              mode={mode as "interval" | "tabata" | "emom" | "custom"}
              state={state}
              currentSeg={currentSeg}
              phaseRemaining={phaseRemaining}
              phaseElapsed={phaseElapsed}
              elapsed={elapsed}
              // idle preview values
              idlePreviewSeconds={
                mode === "tabata" ? tabataWork
                : mode === "interval" ? customWork
                : mode === "emom" ? emomIntervalSeconds
                : (customConfig.base.work.durationSeconds ?? 0)
              }
              idlePreviewRounds={
                mode === "tabata" ? tabataRounds
                : mode === "interval" ? customRounds
                : mode === "emom" ? emomRounds
                : customConfig.rounds
              }
            />
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 justify-center flex-wrap">
        {state === "idle" && (
          <Button variant="primary" size="lg" onClick={handleStart}>
            Iniciar
          </Button>
        )}
        {state === "countdown-prep" && (
          <Button variant="danger" size="lg" onClick={reset}>
            Cancelar
          </Button>
        )}
        {state === "running" && (
          <>
            {/* Manual advance button for custom segments */}
            {isSegmentMode && currentSeg?.advance === "manual" && (
              <Button variant="primary" size="lg" onClick={nextSegment}>
                Siguiente
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={pause}>
              Pausar
            </Button>
            <Button variant="danger" size="lg" onClick={reset}>
              Reiniciar
            </Button>
          </>
        )}
        {state === "paused" && (
          <>
            <Button variant="primary" size="lg" onClick={resume}>
              Reanudar
            </Button>
            <Button variant="danger" size="lg" onClick={reset}>
              Reiniciar
            </Button>
          </>
        )}
        {state === "complete" && (
          <Button variant="primary" size="lg" onClick={reset}>
            Reiniciar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── SegmentDisplay ───

function SegmentDisplay({
  mode,
  state,
  currentSeg,
  phaseRemaining,
  phaseElapsed,
  elapsed,
  idlePreviewSeconds,
  idlePreviewRounds,
}: {
  mode: "interval" | "tabata" | "emom" | "custom";
  state: TimerState;
  currentSeg: TimerSegment | null;
  phaseRemaining: number;
  phaseElapsed: number;
  elapsed: number;
  idlePreviewSeconds: number;
  idlePreviewRounds: number;
}) {
  if (state === "idle") {
    const phaseLabel = mode === "tabata" ? "TABATA"
      : mode === "emom" ? "EMOM"
      : mode === "interval" ? "Trabajo"
      : "Trabajo";

    return (
      <>
        <p className={[
          "text-lg font-heading font-black uppercase tracking-[0.1em]",
          mode === "tabata" ? "text-brand-red" : "text-white",
        ].join(" ")}>
          {phaseLabel}
        </p>
        <TimerDisplay seconds={idlePreviewSeconds} large />
        <div className="flex items-center gap-4">
          <span className="text-sm font-heading font-bold text-gray-400">
            {idlePreviewRounds} rondas
          </span>
        </div>
      </>
    );
  }

  if (state === "complete") {
    return (
      <p className="text-lg font-heading font-black uppercase tracking-[0.1em] text-brand-red">
        Completado!
      </p>
    );
  }

  if (!currentSeg) return null;

  const isDown = currentSeg.direction === "down";
  const displaySeconds = isDown ? phaseRemaining : phaseElapsed;
  const isRest = currentSeg.kind === "rest";
  const phaseLabel = currentSeg.label;

  return (
    <>
      <p className={[
        "text-lg font-heading font-black uppercase tracking-[0.1em]",
        isRest ? "text-gray-400" : "text-white",
      ].join(" ")}>
        {phaseLabel}
        {!isDown && currentSeg.advance === "manual" && (
          <span className="text-xs font-heading font-bold text-gray-500 normal-case tracking-normal ml-2">
            (libre)
          </span>
        )}
      </p>
      <TimerDisplay
        seconds={displaySeconds}
        large
        accent={isRest && state === "running"}
      />
      <div className="flex items-center gap-4">
        <span className="text-sm font-heading font-bold text-gray-400">
          Ronda {currentSeg.round} / {currentSeg.totalRounds}
        </span>
        <span className="text-xs font-heading text-gray-600">
          Total: {formatTime(elapsed)}
        </span>
      </div>
    </>
  );
}

// ─── CustomConfigPanel ───

function CustomConfigPanel({
  config,
  editingRound,
  setEditingRound,
  updateCustomRounds,
  updateCustomBaseWork,
  updateCustomBaseRest,
  setRoundOverride,
  revertRoundOverride,
  resolvedRound,
}: {
  config: CustomConfig;
  editingRound: number | null;
  setEditingRound: (r: number | null) => void;
  updateCustomRounds: (n: number) => void;
  updateCustomBaseWork: (patch: Partial<CustomRoundConfig["work"]>) => void;
  updateCustomBaseRest: (patch: Partial<CustomRoundConfig["rest"]>) => void;
  setRoundOverride: (round: number, patch: Partial<CustomRoundConfig>) => void;
  revertRoundOverride: (round: number) => void;
  resolvedRound: (round: number) => CustomRoundConfig;
}) {
  // Validation: auto advance requires duration
  const baseWorkAutoNoDuration =
    config.base.work.advance === "auto" && config.base.work.durationSeconds === null;

  return (
    <div className="flex flex-col gap-5">
      {/* Rounds count */}
      <div className="flex items-center justify-center gap-4">
        <TimeInput
          label="Rondas"
          value={config.rounds}
          onChange={updateCustomRounds}
          max={50}
        />
      </div>

      {/* Base round config */}
      <div className="border border-edge bg-elev p-4 flex flex-col gap-3">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1">
          Ronda base
        </p>

        {/* Work config */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Trabajo</p>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Direction toggle */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Dirección</span>
              <div className="flex gap-1">
                <button
                  onClick={() => updateCustomBaseWork({ direction: "down" })}
                  className={[
                    "px-2 py-1 text-xs font-heading font-bold uppercase border transition-colors",
                    config.base.work.direction === "down"
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                  ].join(" ")}
                >
                  Abajo
                </button>
                <button
                  onClick={() => updateCustomBaseWork({ direction: "up" })}
                  className={[
                    "px-2 py-1 text-xs font-heading font-bold uppercase border transition-colors",
                    config.base.work.direction === "up"
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                  ].join(" ")}
                >
                  Arriba
                </button>
              </div>
            </div>

            {/* Duration (only when direction down, or when auto) */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                Duración (s)
              </span>
              <input
                type="number"
                min={0}
                max={3600}
                value={config.base.work.durationSeconds ?? ""}
                placeholder={config.base.work.advance === "manual" ? "libre" : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateCustomBaseWork({
                    durationSeconds: raw === "" ? null : Math.max(0, parseInt(raw) || 0),
                  });
                }}
                className="w-20 bg-panel border border-edge text-white text-2xl font-heading font-black text-center px-2 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              />
            </div>

            {/* Advance toggle */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Avance</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (config.base.work.durationSeconds === null) return; // auto requires duration
                    updateCustomBaseWork({ advance: "auto" });
                  }}
                  className={[
                    "px-2 py-1 text-xs font-heading font-bold uppercase border transition-colors",
                    config.base.work.advance === "auto"
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                    config.base.work.durationSeconds === null ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  Auto
                </button>
                <button
                  onClick={() => updateCustomBaseWork({ advance: "manual" })}
                  className={[
                    "px-2 py-1 text-xs font-heading font-bold uppercase border transition-colors cursor-pointer",
                    config.base.work.advance === "manual"
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                  ].join(" ")}
                >
                  Manual
                </button>
              </div>
            </div>
          </div>
          {baseWorkAutoNoDuration && (
            <p className="text-xs text-brand-red font-heading font-bold">
              El avance automático requiere una duración definida.
            </p>
          )}
        </div>

        {/* Rest config */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Descanso</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.base.rest.enabled}
                onChange={(e) => updateCustomBaseRest({ enabled: e.target.checked })}
                className="accent-brand-red"
              />
              <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400">
                Habilitado
              </span>
            </label>
            {config.base.rest.enabled && (
              <TimeInput
                label="Duración (s)"
                value={config.base.rest.durationSeconds}
                onChange={(v) => updateCustomBaseRest({ durationSeconds: v })}
                max={300}
              />
            )}
          </div>
        </div>
      </div>

      {/* Round overrides list */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Rondas individuales
        </p>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {Array.from({ length: config.rounds }, (_, i) => i + 1).map((r) => {
            const hasOverride = r in config.overrides;
            const isEditing = editingRound === r;
            const resolved = resolvedRound(r);
            const overrideAutoNoDuration =
              resolved.work.advance === "auto" && resolved.work.durationSeconds === null;

            return (
              <div key={r} className={[
                "border p-2 flex flex-col gap-2",
                hasOverride ? "border-brand-red/40 bg-brand-red/5" : "border-edge bg-panel",
              ].join(" ")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold text-gray-400 w-16">
                      Ronda {r}
                    </span>
                    {hasOverride && (
                      <span className="text-[10px] font-heading font-bold text-brand-red uppercase tracking-wider">
                        override
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingRound(isEditing ? null : r)}
                      className="text-[10px] font-heading font-bold uppercase tracking-wider text-gray-500 hover:text-white border border-edge px-2 py-0.5 transition-colors"
                    >
                      {isEditing ? "Cerrar" : "Editar"}
                    </button>
                    {hasOverride && (
                      <button
                        onClick={() => revertRoundOverride(r)}
                        className="text-[10px] font-heading font-bold uppercase tracking-wider text-brand-red hover:text-white border border-brand-red/30 px-2 py-0.5 transition-colors"
                      >
                        Revertir
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {!isEditing && (
                  <p className="text-[10px] font-heading text-gray-600">
                    {resolved.work.direction === "down" ? "Baja" : "Sube"}{" "}
                    {resolved.work.durationSeconds !== null ? `${resolved.work.durationSeconds}s` : "libre"}{" "}
                    · {resolved.work.advance === "auto" ? "auto" : "manual"}{" "}
                    {resolved.rest.enabled ? `· Descanso ${resolved.rest.durationSeconds}s` : "· Sin descanso"}
                  </p>
                )}

                {/* Inline editor */}
                {isEditing && (
                  <RoundEditor
                    roundConfig={resolved}
                    onChange={(patch) => setRoundOverride(r, patch)}
                    overrideAutoNoDuration={overrideAutoNoDuration}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── RoundEditor ───

function RoundEditor({
  roundConfig,
  onChange,
  overrideAutoNoDuration,
}: {
  roundConfig: CustomRoundConfig;
  onChange: (patch: Partial<CustomRoundConfig>) => void;
  overrideAutoNoDuration: boolean;
}) {
  function patchWork(patch: Partial<CustomRoundConfig["work"]>) {
    onChange({ work: { ...roundConfig.work, ...patch } });
  }
  function patchRest(patch: Partial<CustomRoundConfig["rest"]>) {
    onChange({ rest: { ...roundConfig.rest, ...patch } });
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Work */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Trabajo</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Dirección</span>
            <div className="flex gap-1">
              {(["down", "up"] as CountDirection[]).map((d) => (
                <button
                  key={d}
                  onClick={() => patchWork({ direction: d })}
                  className={[
                    "px-2 py-0.5 text-[10px] font-heading font-bold uppercase border transition-colors cursor-pointer",
                    roundConfig.work.direction === d
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                  ].join(" ")}
                >
                  {d === "down" ? "Abajo" : "Arriba"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Duración (s)</span>
            <input
              type="number"
              min={0}
              max={3600}
              value={roundConfig.work.durationSeconds ?? ""}
              placeholder={roundConfig.work.advance === "manual" ? "libre" : ""}
              onChange={(e) => {
                const raw = e.target.value;
                patchWork({ durationSeconds: raw === "" ? null : Math.max(0, parseInt(raw) || 0) });
              }}
              className="w-16 bg-panel border border-edge text-white text-lg font-heading font-black text-center px-1 py-1 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Avance</span>
            <div className="flex gap-1">
              {(["auto", "manual"] as Advance[]).map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    if (a === "auto" && roundConfig.work.durationSeconds === null) return;
                    patchWork({ advance: a });
                  }}
                  className={[
                    "px-2 py-0.5 text-[10px] font-heading font-bold uppercase border transition-colors",
                    roundConfig.work.advance === a
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-500 bg-panel hover:border-gray-500",
                    a === "auto" && roundConfig.work.durationSeconds === null
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer",
                  ].join(" ")}
                >
                  {a === "auto" ? "Auto" : "Manual"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {overrideAutoNoDuration && (
          <p className="text-[10px] text-brand-red font-heading font-bold">
            El avance automático requiere duración.
          </p>
        )}
      </div>

      {/* Rest */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Descanso</p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={roundConfig.rest.enabled}
              onChange={(e) => patchRest({ enabled: e.target.checked })}
              className="accent-brand-red"
            />
            <span className="text-[10px] font-heading font-bold uppercase tracking-[0.1em] text-gray-400">
              Habilitado
            </span>
          </label>
          {roundConfig.rest.enabled && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Duración (s)</span>
              <input
                type="number"
                min={0}
                max={300}
                value={roundConfig.rest.durationSeconds}
                onChange={(e) => patchRest({ durationSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-16 bg-panel border border-edge text-white text-lg font-heading font-black text-center px-1 py-1 focus:outline-none focus:border-brand-red transition-colors duration-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function ModeCard({ label, description, accent, onClick }: {
  label: string;
  description: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "border p-5 text-left transition-all duration-200 cursor-pointer group",
        accent
          ? "border-brand-red/30 bg-brand-red/5 hover:border-brand-red hover:bg-brand-red/10"
          : "border-edge bg-elev hover:border-gray-500",
      ].join(" ")}
    >
      <p className={[
        "text-sm font-heading font-black uppercase tracking-[0.1em] mb-1 transition-colors duration-200",
        accent ? "text-brand-red" : "text-white group-hover:text-brand-red",
      ].join(" ")}>
        {label}
      </p>
      <p className="text-xs text-gray-500 font-body">
        {description}
      </p>
    </button>
  );
}

function TimeInput({ label, value, onChange, max }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
        {label}
      </label>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))}
        className="w-20 bg-panel border border-edge text-white text-2xl font-heading font-black text-center px-2 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
      />
    </div>
  );
}

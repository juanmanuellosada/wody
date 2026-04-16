"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TimerDisplay, formatTime } from "./TimerDisplay";
import { beepTick, beepPhaseChange, beepGo, beepComplete, initAudio } from "./sounds";

type TimerMode = "stopwatch" | "countdown" | "interval" | "tabata" | "amrap" | "fortime";
type TimerState = "idle" | "countdown-prep" | "running" | "paused" | "complete";

const TICK_MS = 50;
const PREP_SECONDS = 10;

// Modes that get a "Preparate!" countdown before starting
const PREP_MODES = new Set<TimerMode>(["tabata", "amrap", "fortime", "interval"]);

interface IntervalConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

export function TimersClient() {
  const [mode, setMode] = useState<TimerMode | null>(null);
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);

  // Prep countdown
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);

  // Interval timer state
  const [intervalConfig, setIntervalConfig] = useState<IntervalConfig>({ workSeconds: 20, restSeconds: 10, rounds: 8 });
  const [currentRound, setCurrentRound] = useState(1);
  const [isWork, setIsWork] = useState(true);
  const [phaseRemaining, setPhaseRemaining] = useState(0);

  // Countdown / AMRAP config
  const [countdownMinutes, setCountdownMinutes] = useState(12);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // FOR TIME config
  const [timeCapMinutes, setTimeCapMinutes] = useState(10);
  const [timeCapEnabled, setTimeCapEnabled] = useState(true);

  // Custom interval config
  const [customWork, setCustomWork] = useState(40);
  const [customRest, setCustomRest] = useState(20);
  const [customRounds, setCustomRounds] = useState(8);

  // Tabata config
  const [tabataWork, setTabataWork] = useState(20);
  const [tabataRest, setTabataRest] = useState(10);
  const [tabataRounds, setTabataRounds] = useState(8);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundSecRef = useRef(-1);
  const pendingStartRef = useRef<(() => void) | null>(null);

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
    setCurrentRound(1);
    setIsWork(true);
    setPhaseRemaining(0);
    setPrepRemaining(PREP_SECONDS);
    pendingStartRef.current = null;
  }

  function selectMode(m: TimerMode) {
    reset();
    setMode(m);
    if (m === "tabata") {
      setIntervalConfig({ workSeconds: tabataWork, restSeconds: tabataRest, rounds: tabataRounds });
    }
  }

  function goBack() {
    reset();
    setMode(null);
  }

  // ─── Sound helper: play tick/beep at exact second boundaries ───
  function triggerSoundAtSecond(sec: number, soundFn: () => void) {
    if (sec !== lastSoundSecRef.current && sec >= 0) {
      lastSoundSecRef.current = sec;
      soundFn();
    }
  }

  // ─── Prep Countdown (10s "Preparate!") ───
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

      // Tick at 3, 2, 1
      if (leftInt <= 3 && leftInt > 0) {
        triggerSoundAtSecond(leftInt, beepTick);
      }

      if (left <= 0) {
        clearTimer();
        lastSoundSecRef.current = -1;
        // Start the actual timer
        const fn = pendingStartRef.current;
        pendingStartRef.current = null;
        if (fn) fn();
      }
    }, TICK_MS);
  }

  // ─── Stopwatch (count up) ───
  function startStopwatch() {
    initAudio();
    setState("running");
    beepGo();
    const start = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, TICK_MS);
  }

  // ─── FOR TIME (count up + optional time cap) ───
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

  // ─── AMRAP (countdown with prep) ───
  function startAmrap() {
    initAudio();
    startPrep(_startCountdown);
  }

  // ─── Interval / TABATA ───
  function _startInterval(cfg: IntervalConfig) {
    setIntervalConfig(cfg);
    setCurrentRound(1);
    setIsWork(true);
    setPhaseRemaining(cfg.workSeconds);
    setState("running");
    beepGo();

    let round = 1;
    let work = true;
    let phaseDuration = cfg.workSeconds;
    const start = Date.now();
    let phaseStart = Date.now();
    lastSoundSecRef.current = -1;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const passedInPhase = (now - phaseStart) / 1000;
      const left = Math.max(0, phaseDuration - passedInPhase);
      const leftInt = Math.ceil(left);
      setPhaseRemaining(leftInt);

      // Tick last 3
      if (leftInt <= 3 && leftInt > 0) triggerSoundAtSecond(leftInt, beepTick);

      if (left <= 0) {
        lastSoundSecRef.current = -1;
        if (work) {
          work = false;
          phaseDuration = cfg.restSeconds;
          phaseStart = now;
          setIsWork(false);
          setPhaseRemaining(cfg.restSeconds);
          beepPhaseChange();
        } else {
          round++;
          if (round > cfg.rounds) {
            clearTimer();
            setState("complete");
            setCurrentRound(cfg.rounds);
            beepComplete();
            return;
          }
          work = true;
          phaseDuration = cfg.workSeconds;
          phaseStart = now;
          setCurrentRound(round);
          setIsWork(true);
          setPhaseRemaining(cfg.workSeconds);
          beepGo();
        }
      }

      setElapsed(Math.floor((now - start) / 1000));
    }, TICK_MS);
  }

  function startTabata() {
    initAudio();
    const cfg = { workSeconds: tabataWork, restSeconds: tabataRest, rounds: tabataRounds };
    startPrep(() => _startInterval(cfg));
  }

  function startCustomInterval() {
    initAudio();
    const cfg = { workSeconds: customWork, restSeconds: customRest, rounds: customRounds };
    startPrep(() => _startInterval(cfg));
  }

  function pause() {
    clearTimer();
    setState("paused");
  }

  function resume() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown") {
      initAudio();
      startCountdownResume();
    }
    else if (mode === "amrap") {
      initAudio();
      startCountdownResume();
    }
    else if (mode === "fortime") {
      // Resume FOR TIME from elapsed
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
    }
  }

  function handleStart() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown") startCountdownDirect();
    else if (mode === "amrap") startAmrap();
    else if (mode === "fortime") startForTime();
    else if (mode === "tabata") startTabata();
    else if (mode === "interval") startCustomInterval();
  }

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
      </div>
    );
  }

  // ─── Timer view ───
  const modeLabel = mode === "stopwatch" ? "Cronómetro"
    : mode === "countdown" ? "Temporizador"
    : mode === "interval" ? "Intervalos"
    : mode === "tabata" ? "TABATA"
    : mode === "amrap" ? "AMRAP"
    : "FOR TIME";

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
        <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-5 flex flex-col gap-4">
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

          {(mode === "tabata" || mode === "interval") && (
            <>
              <p className={[
                "text-lg font-heading font-black uppercase tracking-[0.1em]",
                state === "complete" ? "text-brand-red" : isWork ? "text-green-400" : "text-yellow-400",
              ].join(" ")}>
                {state === "complete" ? "Completado!" : state === "idle" ? "Listo?" : isWork ? "Trabajo" : "Descanso"}
              </p>
              <TimerDisplay
                seconds={state === "idle" ? (mode === "tabata" ? tabataWork : customWork) : phaseRemaining}
                large
                accent={!isWork && state === "running"}
              />
              <div className="flex items-center gap-4">
                <span className="text-sm font-heading font-bold text-gray-400">
                  Ronda {currentRound} / {intervalConfig.rounds}
                </span>
                <span className="text-xs font-heading text-gray-600">
                  Total: {formatTime(elapsed)}
                </span>
              </div>
            </>
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
          : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-gray-500",
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
        className="w-20 bg-[#0A0A0A] border border-[#2A2A2A] text-white text-2xl font-heading font-black text-center px-2 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
      />
    </div>
  );
}

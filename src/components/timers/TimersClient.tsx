"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TimerDisplay, formatTime } from "./TimerDisplay";
import { beepTick, beepPhaseChange, beepGo, beepComplete, initAudio } from "./sounds";

type TimerMode = "stopwatch" | "countdown" | "interval" | "tabata" | "amrap" | "fortime";

type TimerState = "idle" | "running" | "paused" | "complete";

interface IntervalConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

const PRESETS: Record<string, { label: string; description: string; mode: TimerMode; config?: Partial<IntervalConfig & { totalSeconds: number; timeCap: number }> }> = {
  tabata: {
    label: "TABATA",
    description: "20s trabajo / 10s descanso × 8 rondas",
    mode: "tabata",
    config: { workSeconds: 20, restSeconds: 10, rounds: 8 },
  },
  amrap: {
    label: "AMRAP",
    description: "Cuenta regresiva — tantas rondas como puedas",
    mode: "amrap",
    config: { totalSeconds: 720 },
  },
  fortime: {
    label: "FOR TIME",
    description: "Cronómetro progresivo con time cap opcional",
    mode: "fortime",
    config: { timeCap: 600 },
  },
};

export function TimersClient() {
  const [mode, setMode] = useState<TimerMode | null>(null);
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
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
  }

  function selectMode(m: TimerMode) {
    reset();
    setMode(m);
    if (m === "tabata") {
      setIntervalConfig({ workSeconds: 20, restSeconds: 10, rounds: 8 });
    }
  }

  function goBack() {
    reset();
    setMode(null);
  }

  // ─── Stopwatch (count up) ───
  function startStopwatch() {
    initAudio();
    setState("running");
    beepGo();
    const start = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      const now = Math.floor((Date.now() - start) / 1000);
      setElapsed(now);
    }, 100);
  }

  // ─── FOR TIME (count up + optional time cap) ───
  function startForTime() {
    initAudio();
    setState("running");
    beepGo();
    const capSecs = timeCapEnabled ? timeCapMinutes * 60 : Infinity;
    const start = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      const now = Math.floor((Date.now() - start) / 1000);
      setElapsed(now);
      if (timeCapEnabled) {
        setRemaining(Math.max(0, capSecs - now));
      }
      if (now >= capSecs) {
        clearTimer();
        setState("complete");
        beepComplete();
      }
      // Tick at last 3 seconds
      if (capSecs - now <= 3 && capSecs - now > 0 && capSecs - now !== lastTickRef.current) {
        lastTickRef.current = capSecs - now;
        beepTick();
      }
    }, 100);
  }

  // ─── Countdown ───
  function startCountdown() {
    initAudio();
    const total = countdownMinutes * 60 + countdownSeconds;
    if (total <= 0) return;
    const resumeFrom = state === "paused" ? remaining : total;
    setRemaining(resumeFrom);
    setState("running");
    beepGo();
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const passed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, resumeFrom - passed);
      setRemaining(left);
      setElapsed(total - left);
      // Tick at last 3
      if (left <= 3 && left > 0 && left !== lastTickRef.current) {
        lastTickRef.current = left;
        beepTick();
      }
      if (left <= 0) {
        clearTimer();
        setState("complete");
        beepComplete();
      }
    }, 100);
  }

  // ─── AMRAP (countdown) ───
  function startAmrap() {
    startCountdown();
  }

  // ─── Interval / TABATA ───
  function startInterval(config?: IntervalConfig) {
    initAudio();
    const cfg = config ?? intervalConfig;
    setIntervalConfig(cfg);
    setCurrentRound(1);
    setIsWork(true);
    setPhaseRemaining(cfg.workSeconds);
    setState("running");
    beepGo();

    let round = 1;
    let work = true;
    let phase = cfg.workSeconds;
    const start = Date.now();
    let lastPhaseStart = start;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const passedInPhase = Math.floor((now - lastPhaseStart) / 1000);
      const left = Math.max(0, phase - passedInPhase);
      setPhaseRemaining(left);

      // Tick last 3
      if (left <= 3 && left > 0 && left !== lastTickRef.current) {
        lastTickRef.current = left;
        beepTick();
      }

      if (left <= 0) {
        if (work) {
          // Switch to rest
          work = false;
          phase = cfg.restSeconds;
          lastPhaseStart = now;
          setIsWork(false);
          setPhaseRemaining(cfg.restSeconds);
          beepPhaseChange();
        } else {
          // Rest done — next round or complete
          round++;
          if (round > cfg.rounds) {
            clearTimer();
            setState("complete");
            setCurrentRound(cfg.rounds);
            beepComplete();
            return;
          }
          work = true;
          phase = cfg.workSeconds;
          lastPhaseStart = now;
          setCurrentRound(round);
          setIsWork(true);
          setPhaseRemaining(cfg.workSeconds);
          beepGo();
        }
      }

      // Total elapsed
      setElapsed(Math.floor((now - start) / 1000));
    }, 100);
  }

  function pause() {
    clearTimer();
    setState("paused");
  }

  function resume() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown" || mode === "amrap") startCountdown();
    else if (mode === "fortime") startForTime();
    // Interval resume not supported for simplicity — reset instead
  }

  function handleStart() {
    if (mode === "stopwatch") startStopwatch();
    else if (mode === "countdown") startCountdown();
    else if (mode === "amrap") startCountdown();
    else if (mode === "fortime") startForTime();
    else if (mode === "tabata") startInterval({ workSeconds: 20, restSeconds: 10, rounds: 8 });
    else if (mode === "interval") startInterval({ workSeconds: customWork, restSeconds: customRest, rounds: customRounds });
  }

  // ─── Mode selector ───
  if (!mode) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Cronómetros
        </h1>

        {/* Basic timers */}
        <section>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
            Básicos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ModeCard
              label="Cronómetro"
              description="Cuenta progresiva simple"
              onClick={() => selectMode("stopwatch")}
            />
            <ModeCard
              label="Temporizador"
              description="Cuenta regresiva configurable"
              onClick={() => selectMode("countdown")}
            />
            <ModeCard
              label="Intervalos"
              description="Trabajo / descanso personalizable"
              onClick={() => selectMode("interval")}
            />
          </div>
        </section>

        {/* Presets */}
        <section>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
            Presets de entrenamiento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <ModeCard
                key={key}
                label={preset.label}
                description={preset.description}
                accent
                onClick={() => selectMode(preset.mode)}
              />
            ))}
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="text-xs text-gray-600 hover:text-[#E31414] uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer"
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
                  className="accent-[#E31414]"
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
            <p className="text-sm text-gray-400 font-body text-center">
              20s trabajo — 10s descanso — 8 rondas — Total: 4:00
            </p>
          )}
        </div>
      )}

      {/* Display */}
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
              state === "complete" ? "text-[#E31414]" : isWork ? "text-green-400" : "text-yellow-400",
            ].join(" ")}>
              {state === "complete" ? "Completado!" : state === "idle" ? "Listo?" : isWork ? "Trabajo" : "Descanso"}
            </p>
            <TimerDisplay
              seconds={state === "idle" ? (mode === "tabata" ? 20 : customWork) : phaseRemaining}
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

      {/* Controls */}
      <div className="flex gap-3 justify-center flex-wrap">
        {state === "idle" && (
          <Button variant="primary" size="lg" onClick={handleStart}>
            Iniciar
          </Button>
        )}
        {state === "running" && (
          <Button variant="secondary" size="lg" onClick={pause}>
            Pausar
          </Button>
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
        {state === "running" && (
          <Button variant="danger" size="lg" onClick={reset}>
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
          ? "border-[#E31414]/30 bg-[#E31414]/5 hover:border-[#E31414] hover:bg-[#E31414]/10"
          : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-gray-500",
      ].join(" ")}
    >
      <p className={[
        "text-sm font-heading font-black uppercase tracking-[0.1em] mb-1 transition-colors duration-200",
        accent ? "text-[#E31414]" : "text-white group-hover:text-[#E31414]",
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
        className="w-20 bg-[#0A0A0A] border border-[#2A2A2A] text-white text-2xl font-heading font-black text-center px-2 py-2 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
      />
    </div>
  );
}

"use client";

interface TimerDisplayProps {
  seconds: number;
  label?: string;
  sublabel?: string;
  accent?: boolean;
  large?: boolean;
}

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(Math.abs(totalSeconds) / 60);
  const secs = Math.abs(totalSeconds) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TimerDisplay({ seconds, label, sublabel, accent, large }: TimerDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className={[
          "font-heading font-bold uppercase tracking-[0.15em]",
          accent ? "text-[#E31414]" : "text-gray-400",
          large ? "text-sm" : "text-xs",
        ].join(" ")}>
          {label}
        </p>
      )}
      <p className={[
        "font-heading font-black tabular-nums",
        accent ? "text-[#E31414]" : "text-white",
        large ? "text-7xl sm:text-9xl" : "text-5xl sm:text-7xl",
      ].join(" ")}>
        {formatTime(seconds)}
      </p>
      {sublabel && (
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
          {sublabel}
        </p>
      )}
    </div>
  );
}

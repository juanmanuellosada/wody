"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  words: string[];
  className?: string;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  betweenMs?: number;
  initialDelayMs?: number;
};

export function RotatingTypewriter({
  words,
  className = "text-brand-red font-semibold",
  typeMs = 80,
  deleteMs = 40,
  holdMs = 1800,
  betweenMs = 300,
  initialDelayMs = 1500,
}: Props) {
  const [text, setText] = useState(words[0] ?? "");

  const idxRef = useRef(0);
  const nRef = useRef(words[0]?.length ?? 0);
  const deletingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function tick() {
      const word = words[idxRef.current];
      if (!deletingRef.current) {
        nRef.current++;
        setText(word.slice(0, nRef.current));
        if (nRef.current === word.length) {
          deletingRef.current = true;
          timerRef.current = setTimeout(tick, holdMs);
        } else {
          timerRef.current = setTimeout(tick, typeMs);
        }
      } else {
        nRef.current--;
        setText(word.slice(0, nRef.current));
        if (nRef.current === 0) {
          deletingRef.current = false;
          idxRef.current = (idxRef.current + 1) % words.length;
          timerRef.current = setTimeout(tick, betweenMs);
        } else {
          timerRef.current = setTimeout(tick, deleteMs);
        }
      }
    }

    nRef.current = words[0].length;
    deletingRef.current = true;
    timerRef.current = setTimeout(tick, initialDelayMs);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [words, typeMs, deleteMs, holdMs, betweenMs, initialDelayMs]);

  if (words.length < 2) {
    return <span className={className}>{words[0]}</span>;
  }

  return (
    <>
      <span className={className}>{text}</span>
      <span aria-hidden="true" className="wody-caret-blink" style={{ marginLeft: 2 }}>
        |
      </span>
    </>
  );
}

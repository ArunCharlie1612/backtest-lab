"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { TIMEFRAME_SECONDS } from "@/lib/domain/types";

/**
 * Countdown to the active candle's close, shown only in live mode. Uses a
 * one-time server-time offset so the timer doesn't drift with the client clock.
 */
export function CandleTimer() {
  const mode = useReplayStore((s) => s.mode);
  const timeframe = useReplayStore((s) => s.timeframe);
  const [remaining, setRemaining] = useState<number | null>(null);
  const offsetRef = useRef(0); // serverNowMs - clientNowMs

  useEffect(() => {
    let cancelled = false;
    fetch("/api/time")
      .then((r) => r.json())
      .then((d: { now: number }) => {
        if (!cancelled) offsetRef.current = d.now - Date.now();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "live") {
      setRemaining(null);
      return;
    }
    const tfSec = TIMEFRAME_SECONDS[timeframe];
    const tick = () => {
      const bar = useReplayStore.getState().currentBar();
      if (!bar) {
        setRemaining(null);
        return;
      }
      const serverNowSec = (Date.now() + offsetRef.current) / 1000;
      setRemaining(Math.max(0, bar.time + tfSec - serverNowSec));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [mode, timeframe]);

  if (mode !== "live" || remaining == null) return null;

  return (
    <div className="pointer-events-none absolute right-16 top-3 z-10 flex items-center gap-1 rounded bg-panel/90 px-2 py-1 font-mono text-xs text-slate-200 ring-1 ring-border">
      <Clock size={12} className="text-accent" />
      {formatRemaining(remaining)}
    </div>
  );
}

function formatRemaining(sec: number): string {
  const s = Math.ceil(sec);
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }
  return `${s}s`;
}

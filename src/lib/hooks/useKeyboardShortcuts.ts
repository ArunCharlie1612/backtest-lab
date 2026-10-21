"use client";

import { useEffect } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";

/**
 * Global replay keyboard shortcuts:
 *   Space       play / pause
 *   → / ←       step forward / back 1 bar
 *   Shift+→/←   step 10 bars
 *   ↑ / ↓       increase / decrease speed
 * Ignored while typing in form fields.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const s = useReplayStore.getState();
      switch (e.key) {
        case " ":
          e.preventDefault();
          s.status === "playing" ? s.pause() : s.play();
          break;
        case "ArrowRight":
          e.preventDefault();
          s.stepForward(e.shiftKey ? 10 : 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          s.stepBackward(e.shiftKey ? 10 : 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          s.setSpeed(nextSpeed(s.speed, 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          s.setSpeed(nextSpeed(s.speed, -1));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10];
function nextSpeed(current: number, dir: 1 | -1): number {
  const i = SPEEDS.indexOf(current);
  const base = i === -1 ? SPEEDS.indexOf(1) : i;
  const next = Math.min(SPEEDS.length - 1, Math.max(0, base + dir));
  return SPEEDS[next]!;
}

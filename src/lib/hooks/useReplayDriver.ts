"use client";

import { useEffect, useRef } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";

/**
 * Drives the replay clock. While status === "playing" it advances the cursor one
 * base bar at a time at an interval derived from `speed`, and feeds each newly
 * revealed bar into the order-matching engine. Base cadence is 1000ms at 1x.
 */
export function useReplayDriver(): void {
  const status = useReplayStore((s) => s.status);
  const speed = useReplayStore((s) => s.speed);
  const lastFedCursor = useRef<number>(-1);

  // Feed every newly revealed base bar into the trading engine exactly once.
  useEffect(() => {
    const unsub = useReplayStore.subscribe(
      (s) => s.cursor,
      (cursor) => {
        const state = useReplayStore.getState();
        // In live mode the live feed owns bar delivery to the engine.
        if (state.mode === "live") {
          lastFedCursor.current = cursor;
          return;
        }
        const { baseSeries } = state;
        const onBar = useTradingStore.getState().onBar;
        // Replay rewind: reset the fed marker so we don't double-process.
        if (cursor < lastFedCursor.current) {
          lastFedCursor.current = cursor;
          return;
        }
        for (let i = lastFedCursor.current + 1; i <= cursor; i++) {
          const bar = baseSeries[i];
          if (bar) onBar(bar);
        }
        lastFedCursor.current = cursor;
      },
      { fireImmediately: true },
    );
    return unsub;
  }, []);

  // Play loop.
  useEffect(() => {
    if (status !== "playing") return;
    const intervalMs = Math.max(16, 1000 / speed);
    const timer = setInterval(() => {
      const state = useReplayStore.getState();
      if (state.mode === "live") return; // live feed advances bars itself
      if (state.cursor >= state.baseSeries.length - 1) {
        state.pause();
        return;
      }
      state.stepForward(1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [status, speed]);
}

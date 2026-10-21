import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Candle, Timeframe } from "../domain/types";
import { aggregate, indexAtOrBefore } from "../data/aggregation";

export type ReplayStatus = "idle" | "playing" | "paused" | "finished";
export type MarketMode = "replay" | "live";

/**
 * Deterministic replay state machine.
 *
 * The full 1-minute base series is held privately; `cursor` is the index of the
 * last REVEALED base bar. Future candles are never exposed to chart/engine
 * consumers until the clock steps forward past them. All derived timeframes are
 * recomputed from the revealed slice so the client can never "see the future".
 */
export interface ReplayState {
  symbol: string;
  baseSeries: Candle[];
  /** Index of the last revealed base bar (−1 = nothing revealed yet). */
  cursor: number;
  status: ReplayStatus;
  /** Replay vs live-streaming mode. */
  mode: MarketMode;
  /** Replay speed multiplier (0.1x – 10x). */
  speed: number;
  /** Active chart timeframe. */
  timeframe: Timeframe;
  /** Monotonic tick to let subscribers know a step happened. */
  tick: number;

  // --- lifecycle ---
  load: (symbol: string, baseSeries: Candle[], warmupBars?: number) => void;
  reset: () => void;

  // --- mode ---
  setMode: (mode: MarketMode) => void;
  /**
   * Ingest a live 1-minute bar. Updates the forming bar in place, or appends a
   * new bar when `closed` is true / the bucket advances. Keeps the cursor at the
   * head so the full series stays revealed in live mode.
   */
  liveTick: (bar: Candle, closed: boolean) => void;

  // --- transport controls ---
  play: () => void;
  pause: () => void;
  stepForward: (bars?: number) => void;
  stepBackward: (bars?: number) => void;
  jumpToTime: (timeSec: number) => void;
  setSpeed: (speed: number) => void;
  setTimeframe: (tf: Timeframe) => void;

  // --- selectors (derived, future-safe) ---
  visibleBase: () => Candle[];
  visibleSeries: () => Candle[];
  currentBar: () => Candle | null;
  currentTime: () => number | null;
  currentPrice: () => number | null;
  progress: () => number;
}

const clampSpeed = (s: number): number => Math.min(10, Math.max(0.1, s));

export const useReplayStore = create<ReplayState>()(
  subscribeWithSelector((set, get) => ({
    symbol: "",
    baseSeries: [],
    cursor: -1,
    status: "idle",
    mode: "replay",
    speed: 1,
    timeframe: "15m",
    tick: 0,

    load: (symbol, baseSeries, warmupBars = 200) => {
      const sorted = [...baseSeries].sort((a, b) => a.time - b.time);
      set({
        symbol,
        baseSeries: sorted,
        cursor: Math.min(warmupBars, sorted.length - 1),
        status: "paused",
        tick: get().tick + 1,
      });
    },

    reset: () =>
      set({
        symbol: "",
        baseSeries: [],
        cursor: -1,
        status: "idle",
        tick: get().tick + 1,
      }),

    play: () => {
      if (get().cursor >= get().baseSeries.length - 1) return;
      set({ status: "playing" });
    },

    pause: () => set({ status: "paused" }),

    stepForward: (bars = 1) => {
      const { cursor, baseSeries } = get();
      const next = Math.min(baseSeries.length - 1, cursor + bars);
      const finished = next >= baseSeries.length - 1;
      set({
        cursor: next,
        status: finished ? "finished" : get().status === "playing" ? "playing" : "paused",
        tick: get().tick + 1,
      });
    },

    stepBackward: (bars = 1) => {
      const { cursor } = get();
      const prev = Math.max(0, cursor - bars);
      set({ cursor: prev, status: "paused", tick: get().tick + 1 });
    },

    jumpToTime: (timeSec) => {
      const { baseSeries } = get();
      const idx = indexAtOrBefore(baseSeries, timeSec);
      set({
        cursor: Math.max(0, idx),
        status: "paused",
        tick: get().tick + 1,
      });
    },

    setSpeed: (speed) => set({ speed: clampSpeed(speed) }),

    setTimeframe: (tf) => set({ timeframe: tf, tick: get().tick + 1 }),

    setMode: (mode) => {
      // Entering live reveals the whole series; leaving pauses the clock.
      const { baseSeries } = get();
      set({
        mode,
        status: mode === "live" ? "playing" : "paused",
        cursor: mode === "live" ? baseSeries.length - 1 : get().cursor,
        tick: get().tick + 1,
      });
    },

    liveTick: (bar, closed) => {
      const { baseSeries } = get();
      const last = baseSeries[baseSeries.length - 1];
      let next: Candle[];
      if (last && last.time === bar.time) {
        next = baseSeries.slice(0, -1);
        next.push(bar);
      } else if (!last || bar.time > last.time) {
        next = [...baseSeries, bar];
      } else {
        return; // stale/out-of-order tick
      }
      set({ baseSeries: next, cursor: next.length - 1, tick: get().tick + 1 });
      void closed;
    },

    // --- derived selectors ---
    visibleBase: () => {
      const { baseSeries, cursor } = get();
      return cursor < 0 ? [] : baseSeries.slice(0, cursor + 1);
    },

    visibleSeries: () => {
      const { timeframe } = get();
      return aggregate(get().visibleBase(), timeframe);
    },

    currentBar: () => {
      const { baseSeries, cursor } = get();
      return cursor >= 0 ? (baseSeries[cursor] ?? null) : null;
    },

    currentTime: () => get().currentBar()?.time ?? null,

    currentPrice: () => get().currentBar()?.close ?? null,

    progress: () => {
      const { cursor, baseSeries } = get();
      if (baseSeries.length <= 1) return 0;
      return cursor / (baseSeries.length - 1);
    },
  })),
);

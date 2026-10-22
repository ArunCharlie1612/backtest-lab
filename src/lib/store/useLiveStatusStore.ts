import { create } from "zustand";

interface LiveStatusStore {
  /** Measured feed latency in ms (now − exchange event time). 0 = unknown. */
  latencyMs: number;
  /** Timestamp of the last received tick, for staleness checks. */
  lastTickAt: number;
  setLatency: (ms: number) => void;
}

export const useLiveStatusStore = create<LiveStatusStore>((set) => ({
  latencyMs: 0,
  lastTickAt: 0,
  setLatency: (ms) => set({ latencyMs: Math.max(0, Math.round(ms)), lastTickAt: Date.now() }),
}));

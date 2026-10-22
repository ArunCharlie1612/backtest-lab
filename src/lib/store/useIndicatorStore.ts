import { create } from "zustand";

export interface IndicatorSettings {
  sma: { enabled: boolean; period: number; color: string };
  ema: { enabled: boolean; period: number; color: string };
  bollinger: { enabled: boolean; period: number; mult: number; color: string };
  vwap: { enabled: boolean; color: string };
  rsi: { enabled: boolean; period: number };
}

interface IndicatorStore extends IndicatorSettings {
  toggle: (key: keyof IndicatorSettings) => void;
  setPeriod: (key: "sma" | "ema" | "bollinger" | "rsi", period: number) => void;
  setMult: (mult: number) => void;
}

export const useIndicatorStore = create<IndicatorStore>((set, get) => ({
  sma: { enabled: false, period: 20, color: "#f59e0b" },
  ema: { enabled: false, period: 50, color: "#22d3ee" },
  bollinger: { enabled: false, period: 20, mult: 2, color: "#a78bfa" },
  vwap: { enabled: false, color: "#e879f9" },
  rsi: { enabled: false, period: 14 },

  toggle: (key) =>
    set({ [key]: { ...get()[key], enabled: !get()[key].enabled } } as Partial<IndicatorStore>),

  setPeriod: (key, period) =>
    set({ [key]: { ...get()[key], period: Math.max(1, Math.round(period)) } } as Partial<IndicatorStore>),

  setMult: (mult) =>
    set({ bollinger: { ...get().bollinger, mult: Math.max(0.1, mult) } }),
}));

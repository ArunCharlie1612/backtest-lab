"use client";

import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import { Chart } from "@/components/Chart";
import { ReplayControls } from "@/components/ReplayControls";
import { DrawingToolbar } from "@/components/DrawingToolbar";
import { OrderPanel } from "@/components/OrderPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CsvImport } from "@/components/CsvImport";
import { MetricsPanel } from "@/components/MetricsPanel";
import { EquityCurve } from "@/components/EquityCurve";
import { TradeJournal } from "@/components/TradeJournal";
import { useReplayDriver } from "@/lib/hooks/useReplayDriver";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useLocalPersistence } from "@/lib/hooks/useLocalPersistence";
import { useTradeSnapshots } from "@/lib/hooks/useTradeSnapshots";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { generateSampleSeries } from "@/lib/data/sampleData";
import { INSTRUMENTS } from "@/lib/domain/instruments";
import type { Candle } from "@/lib/domain/types";

const SYMBOLS = Object.keys(INSTRUMENTS);

const START_PRICE: Record<string, number> = {
  EURUSD: 1.1,
  GBPUSD: 1.27,
  USDJPY: 150,
  XAUUSD: 2050,
  US100: 18000,
  BTCUSD: 65000,
  ETHUSD: 3400,
  SOLUSD: 180,
  BNBUSD: 600,
  XRPUSD: 0.6,
};

export default function Home() {
  useReplayDriver();
  useKeyboardShortcuts();
  useLocalPersistence();
  useTradeSnapshots();

  const load = useReplayStore((s) => s.load);
  const setTimeframe = useReplayStore((s) => s.setTimeframe);
  const setActiveSymbol = useTradingStore((s) => s.setActiveSymbol);
  const closeAll = useTradingStore((s) => s.closeAll);
  const positionsCount = useTradingStore((s) => s.positions.length);

  const [symbol, setSymbol] = useState("BTCUSD");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [barsCount, setBarsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const warmupFor = (len: number) => Math.min(300, Math.max(20, Math.floor(len / 4)));
    setLoading(true);
    useTradingStore.getState().clearWorkingState();

    void (async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { candles?: Candle[]; interval?: string };
        const candles = data.candles ?? [];
        if (cancelled) return;
        if (candles.length < 50) throw new Error("insufficient live data");
        load(symbol, candles, warmupFor(candles.length));
        setTimeframe(data.interval === "1d" ? "1D" : "15m");
        setSource("live");
        setBarsCount(candles.length);
      } catch {
        if (cancelled) return;
        const series = generateSampleSeries({
          symbol,
          startPrice: START_PRICE[symbol] ?? 1,
          volatility: symbol === "BTCUSD" ? 0.01 : 0.0008,
          bars: 4000,
          seed: 7,
        });
        load(symbol, series, 300);
        setSource("demo");
        setBarsCount(series.length);
      } finally {
        if (!cancelled) {
          setActiveSymbol(symbol);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, load, setActiveSymbol, setTimeframe]);

  const onCloseAll = () => {
    const price = useReplayStore.getState().currentPrice() ?? 0;
    const time = useReplayStore.getState().currentTime() ?? 0;
    closeAll(price, time);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-panel px-4 py-2">
        <h1 className="text-sm font-bold tracking-wide text-slate-100">
          Backtest Lab<span className="text-accent"> ▸</span> Bar Replay
        </h1>
        <select className="select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-slate-400 hover:text-down disabled:opacity-40"
          onClick={onCloseAll}
          disabled={positionsCount === 0}
        >
          <XCircle size={13} /> Close all ({positionsCount})
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              loading
                ? "bg-panelAlt text-slate-400"
                : source === "live"
                  ? "bg-up/20 text-up"
                  : "bg-panelAlt text-slate-400"
            }`}
            title={source === "live" ? "Latest market data (Binance / Yahoo)" : "Synthetic demo data"}
          >
            {loading ? "Loading…" : source === "live" ? `● Live · ${barsCount} bars` : "● Demo data"}
          </span>
          <span className="hidden text-[11px] text-slate-500 md:block">
            Space play/pause · ←/→ step · Shift+←/→ ×10 · ↑/↓ speed · Esc cancel draw
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DrawingToolbar />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Chart />
          </div>
          <ReplayControls />
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-bg p-3">
          <div className="flex flex-col gap-3">
            <OrderPanel />
            <SettingsPanel />
            <CsvImport />
          </div>
        </aside>

        <aside className="w-96 shrink-0 overflow-y-auto border-l border-border bg-bg p-3">
          <div className="flex flex-col gap-3">
            <MetricsPanel />
            <EquityCurve />
            <TradeJournal />
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { XCircle, CalendarDays, Radio, PanelLeftClose, PanelRightClose } from "lucide-react";
import { Chart } from "@/components/Chart";
import { ReplayControls } from "@/components/ReplayControls";
import { CandleTimer } from "@/components/CandleTimer";
import { ChartLegend } from "@/components/ChartLegend";
import { RsiPane } from "@/components/RsiPane";
import { SymbolPicker } from "@/components/SymbolPicker";
import { IndicatorMenu } from "@/components/IndicatorMenu";
import { DrawingToolbar } from "@/components/DrawingToolbar";
import { OrderPanel } from "@/components/OrderPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CsvImport } from "@/components/CsvImport";
import { MetricsPanel } from "@/components/MetricsPanel";
import { EquityCurve } from "@/components/EquityCurve";
import { TradeJournal } from "@/components/TradeJournal";
import { CalendarView } from "@/components/CalendarView";
import { useReplayDriver } from "@/lib/hooks/useReplayDriver";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useLocalPersistence } from "@/lib/hooks/useLocalPersistence";
import { useTradeSnapshots } from "@/lib/hooks/useTradeSnapshots";
import { useLiveFeed } from "@/lib/hooks/useLiveFeed";
import { useMarketConfig } from "@/lib/hooks/useMarketConfig";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { generateSampleSeries } from "@/lib/data/sampleData";
import { supportsLive, BINANCE_INTERVALS } from "@/lib/live/binanceSocket";
import type { Candle } from "@/lib/domain/types";


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
  useLiveFeed();
  const { keyedSymbols } = useMarketConfig();

  const load = useReplayStore((s) => s.load);
  const timeframe = useReplayStore((s) => s.timeframe);
  const mode = useReplayStore((s) => s.mode);
  const setMode = useReplayStore((s) => s.setMode);
  const setActiveSymbol = useTradingStore((s) => s.setActiveSymbol);
  const closeAll = useTradingStore((s) => s.closeAll);
  const positionsCount = useTradingStore((s) => s.positions.length);

  const [symbol, setSymbol] = useState("BTCUSD");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [barsCount, setBarsCount] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showOrders, setShowOrders] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const prevSymbol = useRef(symbol);

  const liveAvailable = supportsLive(symbol) || keyedSymbols.includes(symbol);

  // Fetch native-resolution data for the active symbol + timeframe. Deep
  // per-timeframe history (not just 1m), so higher timeframes show plenty of bars.
  useEffect(() => {
    let cancelled = false;
    const warmupFor = (len: number) => Math.min(300, Math.max(20, Math.floor(len / 4)));
    const symbolChanged = prevSymbol.current !== symbol;
    prevSymbol.current = symbol;
    const wasLive = useReplayStore.getState().mode === "live";

    setLoading(true);
    if (symbolChanged) {
      useReplayStore.getState().setMode("replay");
      useTradingStore.getState().clearWorkingState();
    }

    const interval = BINANCE_INTERVALS[timeframe] ?? "1m";

    void (async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { candles?: Candle[] };
        const candles = data.candles ?? [];
        if (cancelled) return;
        if (candles.length < 20) throw new Error("insufficient live data");
        load(symbol, candles, warmupFor(candles.length));
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
          // Resume live streaming after a timeframe refetch on the same symbol.
          if (wasLive && !symbolChanged && supportsLive(symbol)) {
            useReplayStore.getState().setMode("live");
          }
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, load, setActiveSymbol]);

  const onCloseAll = () => {
    const price = useReplayStore.getState().currentPrice() ?? 0;
    const time = useReplayStore.getState().currentTime() ?? 0;
    closeAll(price, time);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2">
        <h1 className="text-sm font-bold tracking-wide text-slate-100">
          Backtest Lab<span className="text-accent"> ▸</span> Bar Replay
        </h1>
        <SymbolPicker symbol={symbol} onChange={setSymbol} />
        <IndicatorMenu />

        {/* Replay / Live mode toggle */}
        <div className="flex items-center overflow-hidden rounded-md border border-border text-xs">
          <button
            className={`px-2.5 py-1 ${mode === "replay" ? "bg-accent text-white" : "text-slate-400 hover:bg-panelAlt"}`}
            onClick={() => setMode("replay")}
          >
            Replay
          </button>
          <button
            className={`flex items-center gap-1 px-2.5 py-1 ${
              mode === "live" ? "bg-down text-white" : "text-slate-400 hover:bg-panelAlt"
            } disabled:opacity-40`}
            disabled={!liveAvailable}
            title={liveAvailable ? "Stream live Binance ticks" : "Live streaming available for crypto symbols"}
            onClick={() => setMode("live")}
          >
            <Radio size={12} className={mode === "live" ? "animate-pulse" : ""} /> Live
          </button>
        </div>

        <button
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-slate-400 hover:text-accent"
          onClick={() => setShowCalendar(true)}
          title="Trading calendar"
        >
          <CalendarDays size={13} /> Calendar
        </button>

        <button
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-slate-400 hover:text-down disabled:opacity-40"
          onClick={onCloseAll}
          disabled={positionsCount === 0}
        >
          <XCircle size={13} /> Close all ({positionsCount})
        </button>
        <div className="ml-auto flex items-center gap-3">
          {mode === "live" ? (
            <span className="flex items-center gap-1 rounded bg-down/20 px-2 py-0.5 text-[10px] font-semibold text-down">
              <Radio size={11} className="animate-pulse" /> STREAMING
            </span>
          ) : (
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
          )}
          <span className="hidden text-[11px] text-slate-500 md:block">
            Space play/pause · ←/→ step · Shift+←/→ ×10 · ↑/↓ speed · Esc cancel draw
          </span>
          <button
            className={`rounded border border-border p-1 ${showOrders ? "text-accent" : "text-slate-500"} hover:text-accent`}
            onClick={() => setShowOrders((v) => !v)}
            title="Toggle order panel"
          >
            <PanelLeftClose size={14} />
          </button>
          <button
            className={`rounded border border-border p-1 ${showAnalytics ? "text-accent" : "text-slate-500"} hover:text-accent`}
            onClick={() => setShowAnalytics((v) => !v)}
            title="Toggle analytics panel"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DrawingToolbar />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Chart />
            <ChartLegend />
            <CandleTimer />
          </div>
          <RsiPane />
          <ReplayControls />
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-bg p-3" hidden={!showOrders}>
          <div className="flex flex-col gap-3">
            <OrderPanel />
            <SettingsPanel />
            <CsvImport />
          </div>
        </aside>

        <aside className="w-96 shrink-0 overflow-y-auto border-l border-border bg-bg p-3" hidden={!showAnalytics}>
          <div className="flex flex-col gap-3">
            <MetricsPanel />
            <EquityCurve />
            <TradeJournal />
          </div>
        </aside>
      </div>

      {showCalendar && <CalendarView onClose={() => setShowCalendar(false)} />}
    </div>
  );
}

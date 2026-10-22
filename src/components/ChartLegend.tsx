"use client";

import { useEffect, useState } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { getChart } from "@/lib/chart/registry";
import { getInstrument } from "@/lib/domain/instruments";

interface Ohlc {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** TradingView-style OHLC legend; follows the crosshair, else shows the last bar. */
export function ChartLegend() {
  const symbol = useReplayStore((s) => s.symbol);
  const tick = useReplayStore((s) => s.tick);
  const [bar, setBar] = useState<Ohlc | null>(null);

  // Update from the latest revealed bar on each tick.
  useEffect(() => {
    const data = useReplayStore.getState().visibleSeries();
    const last = data[data.length - 1];
    if (last) setBar({ open: last.open, high: last.high, low: last.low, close: last.close });
  }, [tick, symbol]);

  // Follow the crosshair when hovering.
  useEffect(() => {
    const chart = getChart().chart;
    const series = getChart().series;
    if (!chart || !series) return;
    const handler = (param: { seriesData: Map<unknown, unknown> }) => {
      const d = param.seriesData.get(series) as Ohlc | undefined;
      if (d && "open" in d) setBar(d);
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [symbol, tick]);

  if (!bar || !symbol) return null;
  const prec = safePrecision(symbol);
  const up = bar.close >= bar.open;
  const color = up ? "text-up" : "text-down";
  const chg = bar.close - bar.open;
  const chgPct = bar.open ? (chg / bar.open) * 100 : 0;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px]">
      <span className="font-semibold text-slate-200">{symbol}</span>
      <span className="text-slate-500">
        O <span className={color}>{bar.open.toFixed(prec)}</span>
      </span>
      <span className="text-slate-500">
        H <span className={color}>{bar.high.toFixed(prec)}</span>
      </span>
      <span className="text-slate-500">
        L <span className={color}>{bar.low.toFixed(prec)}</span>
      </span>
      <span className="text-slate-500">
        C <span className={color}>{bar.close.toFixed(prec)}</span>
      </span>
      <span className={color}>
        {chg >= 0 ? "+" : ""}
        {chg.toFixed(prec)} ({chgPct >= 0 ? "+" : ""}
        {chgPct.toFixed(2)}%)
      </span>
    </div>
  );
}

function safePrecision(symbol: string): number {
  try {
    return getInstrument(symbol).pricePrecision;
  } catch {
    return 2;
  }
}

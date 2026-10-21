"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { buildEquityCurve } from "@/lib/engine/metrics";

/** Equity + drawdown curve synchronized with closed-trade history. */
export function EquityCurve() {
  const trades = useTradingStore((s) => s.closedTrades);
  const startingEquity = useTradingStore((s) => s.startingEquity);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equityRef = useRef<ISeriesApi<"Area"> | null>(null);
  const ddRef = useRef<ISeriesApi<"Area"> | null>(null);

  const curve = useMemo(
    () => buildEquityCurve(trades, startingEquity),
    [trades, startingEquity],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#121722" },
        textColor: "#9aa7bd",
      },
      grid: { vertLines: { color: "#161c28" }, horzLines: { color: "#161c28" } },
      rightPriceScale: { borderColor: "#232c3d" },
      timeScale: { borderColor: "#232c3d", timeVisible: true },
      height: 180,
      autoSize: true,
    });
    const equity = chart.addAreaSeries({
      lineColor: "#3b82f6",
      topColor: "rgba(59,130,246,0.3)",
      bottomColor: "rgba(59,130,246,0.02)",
      lineWidth: 2,
    });
    const dd = chart.addAreaSeries({
      lineColor: "#ef5350",
      topColor: "rgba(239,83,80,0.0)",
      bottomColor: "rgba(239,83,80,0.25)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceScaleId: "left",
    });
    chartRef.current = chart;
    equityRef.current = equity;
    ddRef.current = dd;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const equity = equityRef.current;
    const dd = ddRef.current;
    if (!equity || !dd) return;
    equity.setData(curve.map((p) => ({ time: p.time as never, value: p.equity })));
    dd.setData(curve.map((p) => ({ time: p.time as never, value: -p.drawdown })));
    chartRef.current?.timeScale().fitContent();
  }, [curve]);

  return (
    <div className="card">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Equity curve
      </div>
      <div className="relative">
        {/* Container must always be mounted so the chart can attach on creation. */}
        <div ref={containerRef} className="h-[180px] w-full" />
        {curve.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">
            Close a trade to plot the equity curve.
          </div>
        )}
      </div>
    </div>
  );
}

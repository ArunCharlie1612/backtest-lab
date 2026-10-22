"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineStyle, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useIndicatorStore } from "@/lib/store/useIndicatorStore";
import { getChart } from "@/lib/chart/registry";
import { rsi } from "@/lib/indicators/indicators";

/**
 * RSI oscillator rendered in its own pane below the main chart, with its time
 * scale mirrored to the main chart so panning/zooming stays in sync. Shown only
 * when the RSI indicator is enabled.
 */
export function RsiPane() {
  const enabled = useIndicatorStore((s) => s.rsi.enabled);
  const period = useIndicatorStore((s) => s.rsi.period);
  const tick = useReplayStore((s) => s.tick);

  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = elRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "#0b0e14" }, textColor: "#9aa7bd" },
      grid: { vertLines: { color: "#161c28" }, horzLines: { color: "#161c28" } },
      rightPriceScale: { borderColor: "#232c3d" },
      timeScale: { borderColor: "#232c3d", timeVisible: true },
      height: 130,
      autoSize: true,
    });
    const series = chart.addLineSeries({ color: "#a78bfa", lineWidth: 1, priceLineVisible: false });
    series.createPriceLine({ price: 70, color: "#ef5350", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
    series.createPriceLine({ price: 30, color: "#26a69a", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
    chart.priceScale("right").applyOptions({ autoScale: false });
    series.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });

    chartRef.current = chart;
    seriesRef.current = series;

    // Mirror the main chart's visible range.
    const main = getChart().chart;
    let syncing = false;
    const mainTs = main?.timeScale();
    const rsiTs = chart.timeScale();
    const mirror = (fromMain: boolean) => {
      if (syncing || !mainTs) return;
      syncing = true;
      const range = (fromMain ? mainTs : rsiTs).getVisibleLogicalRange();
      if (range) (fromMain ? rsiTs : mainTs).setVisibleLogicalRange(range);
      syncing = false;
    };
    const onMain = () => mirror(true);
    const onRsi = () => mirror(false);
    mainTs?.subscribeVisibleLogicalRangeChange(onMain);
    rsiTs.subscribeVisibleLogicalRangeChange(onRsi);

    return () => {
      mainTs?.unsubscribeVisibleLogicalRangeChange(onMain);
      rsiTs.unsubscribeVisibleLogicalRangeChange(onRsi);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [enabled]);

  // Recompute RSI on data/tick/period changes.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !enabled) return;
    const data = useReplayStore.getState().visibleSeries();
    series.setData(rsi(data, period).map((p) => ({ time: p.time as never, value: p.value })));
  }, [tick, period, enabled]);

  if (!enabled) return null;

  return (
    <div className="border-t border-border bg-bg">
      <div className="px-3 pt-1 text-[10px] uppercase tracking-wide text-slate-500">RSI {period}</div>
      <div ref={elRef} className="h-[130px] w-full" />
    </div>
  );
}

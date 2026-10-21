"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { useDrawingStore, type DrawPoint } from "@/lib/store/useDrawingStore";
import { registerChart } from "@/lib/chart/registry";
import { renderDrawings, type RenderCtx } from "@/lib/chart/drawingRenderer";
import { getInstrument } from "@/lib/domain/instruments";
import { TIMEFRAME_SECONDS } from "@/lib/domain/types";

const SINGLE_POINT_TOOLS = new Set(["horizontal"]);

/**
 * Charting surface on Lightweight Charts with an interactive drawing overlay.
 * The overlay is an absolutely-positioned canvas sharing the chart's coordinate
 * system; anchors are stored in (time, price) space so they stay pinned when
 * the replay clock advances or the user scrolls/zooms.
 */
export function Chart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartElRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastTimeRef = useRef<number>(0);
  const draftRef = useRef<{ start: DrawPoint; end: DrawPoint } | null>(null);

  const tool = useDrawingStore((s) => s.tool);

  // --- coordinate helpers (chart space <-> pixels) ---
  const timeToX = (t: number): number | null => {
    const v = chartRef.current?.timeScale().timeToCoordinate(t as UTCTimestamp);
    return v == null ? null : v;
  };
  const priceToY = (p: number): number | null => {
    const v = seriesRef.current?.priceToCoordinate(p);
    return v == null ? null : v;
  };
  const xToTime = (x: number): number | null => {
    const v = chartRef.current?.timeScale().coordinateToTime(x);
    return typeof v === "number" ? v : null;
  };
  const yToPrice = (y: number): number | null => {
    const v = seriesRef.current?.coordinateToPrice(y);
    return v == null ? null : (v as number);
  };

  const renderOverlay = () => {
    const canvas = overlayRef.current;
    const el = chartElRef.current;
    if (!canvas || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { symbol, timeframe } = useReplayStore.getState();
    const spec = symbol ? safeSpec(symbol) : null;
    const rc: RenderCtx = {
      timeToX,
      priceToY,
      width: w,
      height: h,
      timeframeSec: TIMEFRAME_SECONDS[timeframe],
      spec,
    };

    const drawings = useDrawingStore.getState().drawings;
    const activeTool = useDrawingStore.getState().tool;
    const draft = draftRef.current
      ? {
          id: "draft",
          tool: activeTool,
          color: useDrawingStore.getState().color,
          points: SINGLE_POINT_TOOLS.has(activeTool)
            ? [draftRef.current.start]
            : [draftRef.current.start, draftRef.current.end],
        }
      : null;
    renderDrawings(ctx, drawings, draft, rc);
  };

  // Create chart once.
  useEffect(() => {
    const el = chartElRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e14" },
        textColor: "#9aa7bd",
      },
      grid: { vertLines: { color: "#161c28" }, horzLines: { color: "#161c28" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#232c3d" },
      timeScale: { borderColor: "#232c3d", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const series = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    registerChart(chart, series);

    const onRange = () => renderOverlay();
    chart.timeScale().subscribeVisibleTimeRangeChange(onRange);

    const ro = new ResizeObserver(() => renderOverlay());
    ro.observe(el);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      ro.disconnect();
      chart.remove();
      registerChart(null, null);
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render overlay whenever drawings change.
  useEffect(() => {
    const unsub = useDrawingStore.subscribe(() => renderOverlay());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full reload on symbol/timeframe change.
  const timeframe = useReplayStore((s) => s.timeframe);
  const symbol = useReplayStore((s) => s.symbol);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data = useReplayStore.getState().visibleSeries();
    series.setData(data.map(toBar));
    lastTimeRef.current = data.length ? data[data.length - 1]!.time : 0;
    chartRef.current?.timeScale().fitContent();
    renderOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, symbol]);

  // Incremental update on each replay tick.
  const tick = useReplayStore((s) => s.tick);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data = useReplayStore.getState().visibleSeries();
    const last = data[data.length - 1];
    if (!last) return;
    if (last.time >= lastTimeRef.current) {
      series.update(toBar(last));
      lastTimeRef.current = last.time;
    } else {
      series.setData(data.map(toBar));
      lastTimeRef.current = last.time;
    }
    renderOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Open-position price lines.
  const positions = useTradingStore((s) => s.positions);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    for (const p of positions) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: p.entryPrice,
          color: p.side === "long" ? "#26a69a" : "#ef5350",
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${p.side.toUpperCase()} ${p.lots}`,
        }),
      );
      if (p.stopLoss != null) {
        priceLinesRef.current.push(
          series.createPriceLine({ price: p.stopLoss, color: "#ef5350", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "SL" }),
        );
      }
      if (p.takeProfit != null) {
        priceLinesRef.current.push(
          series.createPriceLine({ price: p.takeProfit, color: "#26a69a", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "TP" }),
        );
      }
    }
  }, [positions]);

  // --- drawing pointer handlers ---
  const pointAt = (e: React.PointerEvent): DrawPoint | null => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = xToTime(x) ?? useReplayStore.getState().currentTime() ?? 0;
    const price = yToPrice(y);
    if (price == null) return null;
    return { time, price };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const p = pointAt(e);
    if (!p) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    draftRef.current = { start: p, end: p };
    renderOverlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "cursor" || !draftRef.current) return;
    const p = pointAt(e);
    if (!p) return;
    draftRef.current.end = p;
    renderOverlay();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (tool === "cursor" || !draftRef.current) return;
    overlayRef.current?.releasePointerCapture(e.pointerId);
    const { start, end } = draftRef.current;
    const store = useDrawingStore.getState();
    const points = SINGLE_POINT_TOOLS.has(tool) ? [start] : [start, end];
    store.addDrawing(tool, points);
    draftRef.current = null;
    store.setTool("cursor"); // return to cursor so chart stays interactive
    renderOverlay();
  };

  // Escape cancels an in-progress draft.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && draftRef.current) {
        draftRef.current = null;
        useDrawingStore.getState().setTool("cursor");
        renderOverlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div ref={chartElRef} className="h-full w-full" />
      <canvas
        ref={overlayRef}
        className="absolute inset-0"
        style={{
          zIndex: 3,
          pointerEvents: tool === "cursor" ? "none" : "auto",
          cursor: tool === "cursor" ? "default" : "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}

function safeSpec(symbol: string) {
  try {
    return getInstrument(symbol);
  } catch {
    return null;
  }
}

function toBar(c: { time: number; open: number; high: number; low: number; close: number }) {
  return { time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close };
}

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
import { useIndicatorStore } from "@/lib/store/useIndicatorStore";
import { registerChart } from "@/lib/chart/registry";
import { renderDrawings, type RenderCtx } from "@/lib/chart/drawingRenderer";
import { sma, ema, bollinger, vwap } from "@/lib/indicators/indicators";
import { getInstrument } from "@/lib/domain/instruments";
import { TIMEFRAME_SECONDS } from "@/lib/domain/types";

const SINGLE_POINT_TOOLS = new Set(["horizontal", "ray", "vertical", "text"]);

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
  const indSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const lastTimeRef = useRef<number>(0);
  const firstTimeRef = useRef<number>(0);
  const prevLenRef = useRef<number>(0);
  const followRef = useRef<boolean>(true);
  const draftRef = useRef<{ start: DrawPoint; end: DrawPoint } | null>(null);
  const brushRef = useRef<DrawPoint[] | null>(null);

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

    const dstore = useDrawingStore.getState();
    const drawings = dstore.hidden ? [] : dstore.drawings;
    const activeTool = dstore.tool;
    let draft = null;
    if (brushRef.current && brushRef.current.length > 0) {
      draft = { id: "draft", tool: "brush" as const, color: dstore.color, points: brushRef.current };
    } else if (draftRef.current) {
      draft = {
        id: "draft",
        tool: activeTool,
        color: dstore.color,
        points: SINGLE_POINT_TOOLS.has(activeTool)
          ? [draftRef.current.start]
          : [draftRef.current.start, draftRef.current.end],
      };
    }
    renderDrawings(ctx, drawings, draft, rc);
  };

  // Create/update/remove overlay indicator line series from the indicator store.
  const syncIndicators = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const data = useReplayStore.getState().visibleSeries();
    const map = indSeriesRef.current;

    const ensure = (id: string, color: string, width: 1 | 2 = 1): ISeriesApi<"Line"> => {
      let s = map.get(id);
      if (!s) {
        s = chart.addLineSeries({
          color,
          lineWidth: width,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        map.set(id, s);
      }
      return s;
    };
    const drop = (id: string) => {
      const s = map.get(id);
      if (s) {
        chart.removeSeries(s);
        map.delete(id);
      }
    };
    const toLine = (pts: { time: number; value: number }[]) =>
      pts.map((p) => ({ time: p.time as never, value: p.value }));

    const ind = useIndicatorStore.getState();

    if (ind.sma.enabled) ensure("sma", ind.sma.color).setData(toLine(sma(data, ind.sma.period)));
    else drop("sma");

    if (ind.ema.enabled) ensure("ema", ind.ema.color).setData(toLine(ema(data, ind.ema.period)));
    else drop("ema");

    if (ind.vwap.enabled) ensure("vwap", ind.vwap.color).setData(toLine(vwap(data)));
    else drop("vwap");

    if (ind.bollinger.enabled) {
      const bb = bollinger(data, ind.bollinger.period, ind.bollinger.mult);
      ensure("bb_mid", ind.bollinger.color).setData(toLine(bb.middle));
      ensure("bb_up", ind.bollinger.color).setData(toLine(bb.upper));
      ensure("bb_low", ind.bollinger.color).setData(toLine(bb.lower));
    } else {
      drop("bb_mid");
      drop("bb_up");
      drop("bb_low");
    }
  };

  // Keep indicators in sync when their settings change.
  useEffect(() => {
    const unsub = useIndicatorStore.subscribe(() => syncIndicators());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Follow real-time only while the user is at the right edge; dragging back
    // disables auto-scroll until they return to the latest bar.
    const onLogical = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) followRef.current = range.to >= prevLenRef.current - 2;
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogical);

    // In replay mode, clicking a bar cuts the series off at that candle.
    const onClick = (param: { time?: unknown }) => {
      if (useReplayStore.getState().mode !== "replay") return;
      const t = typeof param.time === "number" ? param.time : null;
      if (t != null) useReplayStore.getState().jumpToTime(t);
    };
    chart.subscribeClick(onClick);

    const ro = new ResizeObserver(() => renderOverlay());
    ro.observe(el);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogical);
      chart.unsubscribeClick(onClick);
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
    firstTimeRef.current = data.length ? data[0]!.time : 0;
    prevLenRef.current = data.length;
    if (useReplayStore.getState().mode === "live") {
      followRef.current = true;
      chartRef.current?.timeScale().scrollToRealTime();
    } else {
      chartRef.current?.timeScale().fitContent();
    }
    renderOverlay();
    syncIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, symbol]);

  // Incremental update on each replay tick; full redraw when the dataset changes.
  const tick = useReplayStore((s) => s.tick);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data = useReplayStore.getState().visibleSeries();
    const last = data[data.length - 1];
    const first = data[0];
    if (!last || !first) return;

    const datasetReplaced =
      first.time !== firstTimeRef.current || data.length < prevLenRef.current;
    if (datasetReplaced) {
      series.setData(data.map(toBar));
      chartRef.current?.timeScale().fitContent();
    } else if (last.time >= lastTimeRef.current) {
      series.update(toBar(last));
    } else {
      series.setData(data.map(toBar));
    }
    firstTimeRef.current = first.time;
    lastTimeRef.current = last.time;
    prevLenRef.current = data.length;
    // Keep the latest candle in view while live and following.
    if (useReplayStore.getState().mode === "live" && followRef.current) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
    renderOverlay();
    syncIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Snap to the live candle whenever live mode is (re-)entered.
  const mode = useReplayStore((s) => s.mode);
  useEffect(() => {
    if (mode === "live") {
      followRef.current = true;
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [mode]);

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
    let price = yToPrice(y);
    if (price == null) return null;
    // Magnet: snap to the nearest OHLC of the bar under the cursor.
    if (useDrawingStore.getState().magnet) {
      const data = useReplayStore.getState().visibleSeries();
      const bar = data.reduce<null | (typeof data)[number]>((best, b) => {
        if (!best) return b;
        return Math.abs(b.time - time) < Math.abs(best.time - time) ? b : best;
      }, null);
      if (bar) {
        const levels = [bar.open, bar.high, bar.low, bar.close];
        price = levels.reduce((a, b) => (Math.abs(b - price!) < Math.abs(a - price!) ? b : a));
      }
    }
    return { time, price };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const p = pointAt(e);
    if (!p) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    if (tool === "brush") {
      brushRef.current = [p];
    } else {
      draftRef.current = { start: p, end: p };
    }
    renderOverlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    const p = pointAt(e);
    if (!p) return;
    if (tool === "brush" && brushRef.current) {
      brushRef.current.push(p);
      renderOverlay();
      return;
    }
    if (!draftRef.current) return;
    draftRef.current.end = p;
    renderOverlay();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (tool === "cursor") return;
    overlayRef.current?.releasePointerCapture(e.pointerId);
    const store = useDrawingStore.getState();

    if (tool === "brush") {
      const path = brushRef.current;
      brushRef.current = null;
      if (path && path.length > 1) store.addDrawing("brush", path);
      store.setTool("cursor");
      renderOverlay();
      return;
    }

    if (!draftRef.current) return;
    const { start, end } = draftRef.current;
    draftRef.current = null;

    if (tool === "text") {
      const text = window.prompt("Text:")?.trim();
      if (text) store.addDrawing("text", [start], { text });
    } else {
      const points = SINGLE_POINT_TOOLS.has(tool) ? [start] : [start, end];
      store.addDrawing(tool, points);
    }
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

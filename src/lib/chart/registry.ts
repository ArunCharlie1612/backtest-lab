import type { IChartApi, ISeriesApi } from "lightweight-charts";

/**
 * Lightweight singleton that exposes the active chart + candlestick series so
 * non-chart modules (snapshot capture, drawing overlay) can share the same
 * coordinate system without prop-drilling through React.
 */
interface ChartRegistry {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
}

const registry: ChartRegistry = { chart: null, series: null };

export function registerChart(
  chart: IChartApi | null,
  series: ISeriesApi<"Candlestick"> | null,
): void {
  registry.chart = chart;
  registry.series = series;
}

export function getChart(): ChartRegistry {
  return registry;
}

/**
 * Capture a downscaled PNG snapshot of the current chart as a data URL.
 * Downscaling keeps per-trade snapshots small enough for local storage.
 */
export function takeSnapshot(maxWidth = 360): string | null {
  const chart = registry.chart;
  if (!chart) return null;
  const source = chart.takeScreenshot();
  const scale = Math.min(1, maxWidth / source.width);
  if (scale >= 1) return source.toDataURL("image/png");

  const target = document.createElement("canvas");
  target.width = Math.round(source.width * scale);
  target.height = Math.round(source.height * scale);
  const ctx = target.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target.toDataURL("image/png", 0.85);
}

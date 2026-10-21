import { type Candle, type Timeframe, TIMEFRAME_SECONDS } from "../domain/types";

/** Align an epoch-second timestamp down to the start of its timeframe bucket. */
export function bucketStart(timeSec: number, tf: Timeframe): number {
  const size = TIMEFRAME_SECONDS[tf];
  return Math.floor(timeSec / size) * size;
}

/**
 * Aggregate a base series (typically 1m) into a higher timeframe on the fly.
 * The input MUST be sorted ascending by time and belong to a single instrument.
 * Produces OHLCV bars with proper open=first, close=last, high=max, low=min.
 */
export function aggregate(base: readonly Candle[], target: Timeframe): Candle[] {
  if (target === "1m") return [...base];
  const out: Candle[] = [];
  let current: Candle | null = null;

  for (const c of base) {
    const bucket = bucketStart(c.time, target);
    if (!current || current.time !== bucket) {
      if (current) out.push(current);
      current = {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    } else {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
      current.volume = (current.volume ?? 0) + (c.volume ?? 0);
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Incrementally fold a single base bar into the last aggregated bar, returning
 * the updated aggregated series tail. Used by the replay loop so higher
 * timeframes update bar-by-bar without re-aggregating the full history.
 */
export function foldBar(
  aggregated: Candle[],
  baseBar: Candle,
  target: Timeframe,
): { bars: Candle[]; closedBar: Candle | null } {
  const bucket = bucketStart(baseBar.time, target);
  const last = aggregated[aggregated.length - 1];

  if (!last || last.time !== bucket) {
    const closed = last ?? null;
    aggregated.push({
      time: bucket,
      open: baseBar.open,
      high: baseBar.high,
      low: baseBar.low,
      close: baseBar.close,
      volume: baseBar.volume ?? 0,
    });
    return { bars: aggregated, closedBar: closed };
  }

  last.high = Math.max(last.high, baseBar.high);
  last.low = Math.min(last.low, baseBar.low);
  last.close = baseBar.close;
  last.volume = (last.volume ?? 0) + (baseBar.volume ?? 0);
  return { bars: aggregated, closedBar: null };
}

/** Binary-search the index of the last bar with time <= target (−1 if none). */
export function indexAtOrBefore(series: readonly Candle[], timeSec: number): number {
  let lo = 0;
  let hi = series.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const bar = series[mid]!;
    if (bar.time <= timeSec) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

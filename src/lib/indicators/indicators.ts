import type { Candle } from "@/lib/domain/types";

export interface LinePoint {
  time: number;
  value: number;
}

/** Simple Moving Average of closes. */
export function sma(candles: readonly Candle[], period: number): LinePoint[] {
  if (period <= 0) return [];
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i]!.close;
    if (i >= period) sum -= candles[i - period]!.close;
    if (i >= period - 1) out.push({ time: candles[i]!.time, value: sum / period });
  }
  return out;
}

/** Exponential Moving Average of closes. */
export function ema(candles: readonly Candle[], period: number): LinePoint[] {
  if (period <= 0 || candles.length === 0) return [];
  const k = 2 / (period + 1);
  const out: LinePoint[] = [];
  let prev = candles[0]!.close;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!.close;
    prev = i === 0 ? c : c * k + prev * (1 - k);
    if (i >= period - 1) out.push({ time: candles[i]!.time, value: prev });
  }
  return out;
}

export interface BollingerBands {
  upper: LinePoint[];
  middle: LinePoint[];
  lower: LinePoint[];
}

/** Bollinger Bands: SMA middle ± mult × standard deviation. */
export function bollinger(candles: readonly Candle[], period: number, mult: number): BollingerBands {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j]!.close;
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (candles[j]!.close - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    const t = candles[i]!.time;
    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + mult * sd });
    lower.push({ time: t, value: mean - mult * sd });
  }
  return { upper, middle, lower };
}

/**
 * Volume-Weighted Average Price, reset at each new UTC day so it tracks the
 * session like most platforms. Falls back to a typical-price average when
 * volume is missing.
 */
export function vwap(candles: readonly Candle[]): LinePoint[] {
  const out: LinePoint[] = [];
  let cumPV = 0;
  let cumV = 0;
  let day = -1;
  for (const c of candles) {
    const d = Math.floor(c.time / 86400);
    if (d !== day) {
      day = d;
      cumPV = 0;
      cumV = 0;
    }
    const typical = (c.high + c.low + c.close) / 3;
    const vol = c.volume && c.volume > 0 ? c.volume : 1;
    cumPV += typical * vol;
    cumV += vol;
    out.push({ time: c.time, value: cumV > 0 ? cumPV / cumV : typical });
  }
  return out;
}

/** Relative Strength Index (Wilder's smoothing), 0–100. */
export function rsi(candles: readonly Candle[], period: number): LinePoint[] {
  if (candles.length <= period) return [];
  const out: LinePoint[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i]!.close - candles[i - 1]!.close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out.push({ time: candles[period]!.time, value: rsiValue(avgGain, avgLoss) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i]!.close - candles[i - 1]!.close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push({ time: candles[i]!.time, value: rsiValue(avgGain, avgLoss) });
  }
  return out;
}

function rsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

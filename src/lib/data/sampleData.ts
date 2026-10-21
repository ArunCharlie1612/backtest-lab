import type { Candle } from "@/lib/domain/types";

/**
 * Deterministic synthetic 1-minute OHLCV generator for local demos/tests.
 * Produces a geometric-Brownian-ish walk with intrabar high/low wicks.
 * Replace with real historical data via the CSV parser / ingestion API.
 */
export function generateSampleSeries(options: {
  symbol?: string;
  startTime?: number;
  bars?: number;
  startPrice?: number;
  volatility?: number;
  seed?: number;
}): Candle[] {
  const {
    startTime = Math.floor(Date.UTC(2024, 0, 1, 0, 0, 0) / 1000),
    bars = 5000,
    startPrice = 1.1,
    volatility = 0.0006,
    seed = 42,
  } = options;

  const rng = mulberry32(seed);
  const out: Candle[] = [];
  let price = startPrice;

  for (let i = 0; i < bars; i++) {
    const drift = (rng() - 0.5) * volatility * price;
    const open = price;
    const close = Math.max(0.0001, open + drift);
    const wick = Math.abs(drift) + rng() * volatility * price;
    const high = Math.max(open, close) + wick * rng();
    const low = Math.min(open, close) - wick * rng();
    out.push({
      time: startTime + i * 60,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.floor(rng() * 1000) + 100,
    });
    price = close;
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** Small seedable PRNG so sample data is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

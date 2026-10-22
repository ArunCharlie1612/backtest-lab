import type { Candle } from "@/lib/domain/types";

/**
 * Keyed Forex/Metals provider (Twelve Data), proxied server-side so the API key
 * (process.env.FINANCIAL_DATA_API_KEY) is never exposed to the client. Supplies
 * both historical candles and a latest-price poll used by the live SSE stream.
 * Activates only when a key is configured; callers fall back otherwise.
 */

export const TWELVEDATA_SYMBOLS: Record<string, string> = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  XAUUSD: "XAU/USD",
};

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1D": "1day",
  // tolerate Binance-style inputs too
  "1min": "1min",
  "1d": "1day",
};

export function apiKey(): string | undefined {
  const k = process.env.FINANCIAL_DATA_API_KEY;
  return k && k.trim() ? k.trim() : undefined;
}

export function hasKeyedProvider(): boolean {
  return apiKey() !== undefined;
}

export function keyedSymbols(): string[] {
  return hasKeyedProvider() ? Object.keys(TWELVEDATA_SYMBOLS) : [];
}

export function supportsKeyed(symbol: string): boolean {
  return hasKeyedProvider() && symbol in TWELVEDATA_SYMBOLS;
}

interface TwelveSeriesResponse {
  status?: string;
  message?: string;
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
}

/** Fetch historical candles for a keyed FX/metal symbol at the given interval. */
export async function fetchTwelveDataCandles(
  symbol: string,
  interval: string,
  outputsize = 5000,
): Promise<{ candles: Candle[]; resolvedSymbol: string }> {
  const key = apiKey();
  const td = TWELVEDATA_SYMBOLS[symbol];
  if (!key || !td) throw new Error("Keyed provider unavailable for symbol");

  const tdInterval = INTERVAL_MAP[interval] ?? "1min";
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(td)}` +
    `&interval=${tdInterval}&outputsize=${outputsize}&format=JSON&apikey=${key}`;

  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Twelve Data ${res.status}`);
  const json = (await res.json()) as TwelveSeriesResponse;
  if (json.status === "error" || !json.values) {
    throw new Error(json.message || "Twelve Data error");
  }

  // Twelve Data returns newest-first; FX datetimes are UTC.
  const candles: Candle[] = json.values
    .map((v) => ({
      time: Math.floor(Date.parse(`${v.datetime.replace(" ", "T")}Z`) / 1000),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume ? Number(v.volume) : 0,
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);

  if (candles.length < 10) throw new Error("Twelve Data returned too few candles");
  return { candles, resolvedSymbol: td };
}

/** Latest price for a keyed symbol (used by the live SSE poller). */
export async function fetchTwelveDataPrice(symbol: string): Promise<number> {
  const key = apiKey();
  const td = TWELVEDATA_SYMBOLS[symbol];
  if (!key || !td) throw new Error("Keyed provider unavailable for symbol");
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(td)}&apikey=${key}`;
  const res = await timedFetch(url);
  if (!res.ok) throw new Error(`Twelve Data ${res.status}`);
  const json = (await res.json()) as { price?: string; status?: string; message?: string };
  const price = Number(json.price);
  if (!Number.isFinite(price)) throw new Error(json.message || "No price");
  return price;
}

async function timedFetch(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

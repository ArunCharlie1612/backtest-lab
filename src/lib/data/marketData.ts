import type { Candle } from "@/lib/domain/types";

/**
 * Keyless market-data providers (server-side, to avoid CORS):
 *   - Binance  : crypto, 1m intraday, very reliable, no key.
 *   - Yahoo    : FX / metals / indices, 1m intraday, via A3 cookie (plain
 *                requests are aggressively rate-limited with HTTP 429).
 * The client falls back to synthetic demo data if a provider is unavailable.
 */

export const YAHOO_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  XAUUSD: "GC=F",
  US100: "^NDX",
  BTCUSD: "BTC-USD",
};

const BINANCE_SYMBOLS: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  SOLUSD: "SOLUSDT",
  BNBUSD: "BNBUSDT",
  XRPUSD: "XRPUSDT",
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface CandleResult {
  candles: Candle[];
  source: "live";
  provider: "binance" | "yahoo";
  interval: "1m" | "1d";
  resolvedSymbol: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dispatch to the best provider for the instrument, with graceful failover. */
export async function fetchCandles(
  symbol: string,
  interval = "1m",
  range = "5d",
): Promise<CandleResult> {
  const binancePair = BINANCE_SYMBOLS[symbol];
  if (binancePair) {
    try {
      // Native-resolution klines give deep per-timeframe history.
      return await fetchBinance(binancePair, interval);
    } catch {
      /* fall through */
    }
  }
  // Yahoo stays on a 1m base; the client aggregates to the display timeframe.
  return fetchYahoo(symbol, "1m", range);
}

// --- Binance ------------------------------------------------------------------

/**
 * Fetch recent klines, paginating backwards so the chart holds deep history
 * ending at the latest closed bar. Binance caps each request at 1000 rows.
 */
async function fetchBinance(pair: string, interval: string, pages = 6): Promise<CandleResult> {
  const byTime = new Map<number, Candle>();
  let endTime = Date.now();

  for (let p = 0; p < pages; p++) {
    const url =
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}` +
      `&limit=1000&endTime=${endTime}`;
    const res = await timedFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const rows = (await res.json()) as unknown[][];
    if (rows.length === 0) break;

    for (const r of rows) {
      const openMs = Number(r[0]);
      byTime.set(Math.floor(openMs / 1000), {
        time: Math.floor(openMs / 1000),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      });
    }
    // Next page ends just before the earliest bar we just received.
    endTime = Number(rows[0]![0]) - 1;
    if (rows.length < 1000) break;
  }

  const candles = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  if (candles.length < 10) throw new Error("Binance too few candles");
  return { candles, source: "live", provider: "binance", interval: "1m", resolvedSymbol: pair };
}

// --- Yahoo (cookie-authenticated chart) --------------------------------------

let cookieCache: { cookie: string; ts: number } | null = null;

async function yahooCookie(): Promise<string> {
  if (cookieCache && Date.now() - cookieCache.ts < 30 * 60_000) return cookieCache.cookie;
  const seed = await timedFetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": BROWSER_UA },
  }).catch(() => null);
  const cookie = seed ? extractSetCookie(seed) : "";
  cookieCache = { cookie, ts: Date.now() };
  return cookie;
}

async function fetchYahoo(symbol: string, interval: string, range: string): Promise<CandleResult> {
  const ticker = YAHOO_SYMBOLS[symbol] ?? symbol;
  const cookie = await yahooCookie();
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  const backoff = [0, 500, 1200];
  let lastErr: Error | null = null;

  for (const host of hosts) {
    for (const wait of backoff) {
      if (wait) await sleep(wait);
      const url =
        `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?interval=${interval}&range=${range}&includePrePost=false`;
      try {
        const res = await timedFetch(url, {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            Cookie: cookie,
          },
        });
        if (res.status === 429) {
          lastErr = new Error("Yahoo 429");
          continue; // retry same host after backoff
        }
        if (!res.ok) throw new Error(`Yahoo ${res.status}`);
        const candles = parseYahoo(await res.json());
        if (candles.length < 10) throw new Error("Yahoo no data");
        return { candles, source: "live", provider: "yahoo", interval: "1m", resolvedSymbol: ticker };
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (!String(lastErr.message).includes("429")) break; // non-rate error: next host
      }
    }
  }
  throw lastErr ?? new Error("Yahoo failed");
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

function parseYahoo(json: YahooChartResponse): Candle[] {
  if (json.chart.error) throw new Error(json.chart.error.description || "Yahoo error");
  const result = json.chart.result?.[0];
  const ts = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!ts || !quote) return [];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i]!, open: o, high: h, low: l, close: c, volume: quote.volume?.[i] ?? 0 });
  }
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

// --- helpers ------------------------------------------------------------------

function extractSetCookie(res: Response): string {
  // Node/undici exposes multiple Set-Cookie via getSetCookie().
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() ?? [];
  if (list.length > 0) return list.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0]! : "";
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

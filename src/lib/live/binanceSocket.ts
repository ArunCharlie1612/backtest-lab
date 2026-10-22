"use client";

import type { Timeframe } from "@/lib/domain/types";

/** Crypto symbol → Binance lowercase stream pair. */
export const BINANCE_WS_PAIRS: Record<string, string> = {
  BTCUSD: "btcusdt",
  ETHUSD: "ethusdt",
  SOLUSD: "solusdt",
  BNBUSD: "bnbusdt",
  XRPUSD: "xrpusdt",
};

/** Chart timeframe → Binance kline interval. */
export const BINANCE_INTERVALS: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
};

export interface LiveBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True when this kline has closed. */
  closed: boolean;
  /** Exchange event time (ms) for latency measurement. */
  eventTime: number;
}

export function supportsLive(symbol: string): boolean {
  return symbol in BINANCE_WS_PAIRS;
}

/**
 * Open a Binance kline stream for a symbol at the given interval. Calls `onBar`
 * on every tick (forming + closed bars) and `onStatus` on connection changes.
 * Returns a disposer. Reconnection policy is left to the caller via `onStatus`.
 */
export function openBinanceKlineStream(
  symbol: string,
  interval: string,
  onBar: (bar: LiveBar) => void,
  onStatus?: (status: "open" | "closed" | "error") => void,
): () => void {
  const pair = BINANCE_WS_PAIRS[symbol];
  if (!pair) return () => {};

  const ws = new WebSocket(`wss://data-stream.binance.vision/ws/${pair}@kline_${interval}`);

  ws.onopen = () => onStatus?.("open");
  ws.onerror = () => onStatus?.("error");
  ws.onclose = () => onStatus?.("closed");
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { k?: Record<string, unknown>; E?: number };
      const k = msg.k;
      if (!k) return;
      onBar({
        time: Math.floor(Number(k.t) / 1000),
        open: Number(k.o),
        high: Number(k.h),
        low: Number(k.l),
        close: Number(k.c),
        volume: Number(k.v),
        closed: Boolean(k.x),
        eventTime: Number(msg.E) || Date.now(),
      });
    } catch {
      /* ignore malformed frames */
    }
  };

  return () => {
    try {
      ws.onclose = null;
      ws.close();
    } catch {
      /* already closed */
    }
  };
}

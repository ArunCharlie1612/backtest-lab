"use client";

/** Crypto symbol → Binance lowercase stream pair. */
export const BINANCE_WS_PAIRS: Record<string, string> = {
  BTCUSD: "btcusdt",
  ETHUSD: "ethusdt",
  SOLUSD: "solusdt",
  BNBUSD: "bnbusdt",
  XRPUSD: "xrpusdt",
};

export interface LiveBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True when this 1-minute kline has closed. */
  closed: boolean;
}

export function supportsLive(symbol: string): boolean {
  return symbol in BINANCE_WS_PAIRS;
}

/**
 * Open a Binance 1-minute kline stream for a symbol. Calls `onBar` on every
 * tick (forming + closed bars) and `onStatus` on connection changes. Returns a
 * disposer. The caller is responsible for reconnection policy via `onStatus`.
 */
export function openBinanceKlineStream(
  symbol: string,
  onBar: (bar: LiveBar) => void,
  onStatus?: (status: "open" | "closed" | "error") => void,
): () => void {
  const pair = BINANCE_WS_PAIRS[symbol];
  if (!pair) return () => {};

  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair}@kline_1m`);

  ws.onopen = () => onStatus?.("open");
  ws.onerror = () => onStatus?.("error");
  ws.onclose = () => onStatus?.("closed");
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { k?: Record<string, unknown> };
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

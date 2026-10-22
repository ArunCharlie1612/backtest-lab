"use client";

import { useEffect } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { useLiveStatusStore } from "@/lib/store/useLiveStatusStore";
import {
  BINANCE_INTERVALS,
  openBinanceKlineStream,
  supportsLive,
  type LiveBar,
} from "@/lib/live/binanceSocket";

interface SseBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closed?: boolean;
  error?: string;
}

/**
 * Live feed for the active symbol in live mode:
 *  - Crypto → Binance kline WebSocket at the active timeframe's interval.
 *  - Keyed FX/metals → server SSE proxy (/api/stream); the key stays server-side.
 * Forming ticks update the chart's last bar; closed bars feed the paper engine.
 * Re-subscribes on symbol/timeframe change and reconnects with backoff.
 */
export function useLiveFeed(): void {
  const mode = useReplayStore((s) => s.mode);
  const symbol = useReplayStore((s) => s.symbol);
  const timeframe = useReplayStore((s) => s.timeframe);

  useEffect(() => {
    if (mode !== "live") return;

    const feedBar = (
      bar: { time: number; open: number; high: number; low: number; close: number; volume?: number },
      closed: boolean,
    ) => {
      useReplayStore.getState().liveTick(bar, closed);
      if (closed) useTradingStore.getState().onBar(bar);
    };

    // Crypto via Binance WebSocket at the active timeframe's interval.
    if (supportsLive(symbol)) {
      const interval = BINANCE_INTERVALS[timeframe];
      let disposed = false;
      let dispose = () => {};
      let retry: ReturnType<typeof setTimeout> | undefined;
      let backoff = 1000;

      const handle = (b: LiveBar) => {
        if (b.closed) backoff = 1000;
        useLiveStatusStore.getState().setLatency(Date.now() - b.eventTime);
        feedBar({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }, b.closed);
      };
      const connect = () => {
        dispose = openBinanceKlineStream(symbol, interval, handle, (status) => {
          if (status === "closed" && !disposed) {
            retry = setTimeout(connect, backoff);
            backoff = Math.min(backoff * 2, 15000);
          }
        });
      };
      connect();
      return () => {
        disposed = true;
        if (retry) clearTimeout(retry);
        dispose();
      };
    }

    // Keyed FX/metals via server-sent events (API key hidden server-side).
    const es = new EventSource(
      `/api/stream?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
    );
    es.onmessage = (ev) => {
      try {
        const b = JSON.parse(ev.data) as SseBar;
        if (b.error) return;
        feedBar({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }, Boolean(b.closed));
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }, [mode, symbol, timeframe]);
}

"use client";

import { useEffect } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import {
  BINANCE_INTERVALS,
  openBinanceKlineStream,
  supportsLive,
  type LiveBar,
} from "@/lib/live/binanceSocket";

/**
 * Connects the Binance live kline stream when the store is in live mode, at the
 * active chart timeframe's interval so live bars share the historical series'
 * resolution. Forming ticks update the chart's last bar; closed bars are fed to
 * the paper-trading engine so pending orders and brackets resolve on live data.
 * Re-subscribes on symbol/timeframe change and auto-reconnects with backoff.
 */
export function useLiveFeed(): void {
  const mode = useReplayStore((s) => s.mode);
  const symbol = useReplayStore((s) => s.symbol);
  const timeframe = useReplayStore((s) => s.timeframe);

  useEffect(() => {
    if (mode !== "live" || !supportsLive(symbol)) return;
    const interval = BINANCE_INTERVALS[timeframe];

    let disposed = false;
    let dispose = () => {};
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;

    const handleBar = (b: LiveBar) => {
      const bar = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
      useReplayStore.getState().liveTick(bar, b.closed);
      if (b.closed) {
        backoff = 1000;
        useTradingStore.getState().onBar(bar);
      }
    };

    const connect = () => {
      dispose = openBinanceKlineStream(symbol, interval, handleBar, (status) => {
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
  }, [mode, symbol, timeframe]);
}

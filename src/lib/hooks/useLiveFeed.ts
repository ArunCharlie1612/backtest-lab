"use client";

import { useEffect } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { openBinanceKlineStream, supportsLive, type LiveBar } from "@/lib/live/binanceSocket";

/**
 * Connects the Binance live kline stream when the store is in live mode. Forming
 * ticks update the chart's last bar; closed bars are additionally fed to the
 * paper-trading engine so pending orders and brackets resolve on live data.
 * Auto-reconnects with backoff while live mode remains active.
 */
export function useLiveFeed(): void {
  const mode = useReplayStore((s) => s.mode);
  const symbol = useReplayStore((s) => s.symbol);

  useEffect(() => {
    if (mode !== "live" || !supportsLive(symbol)) return;

    let disposed = false;
    let dispose = () => {};
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;

    const handleBar = (b: LiveBar) => {
      const bar = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
      useReplayStore.getState().liveTick(bar, b.closed);
      if (b.closed) {
        backoff = 1000; // healthy stream
        useTradingStore.getState().onBar(bar);
      }
    };

    const connect = () => {
      dispose = openBinanceKlineStream(symbol, handleBar, (status) => {
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
  }, [mode, symbol]);
}

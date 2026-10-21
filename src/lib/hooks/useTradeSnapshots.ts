"use client";

import { useEffect, useRef } from "react";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { takeSnapshot } from "@/lib/chart/registry";

/**
 * Captures a downscaled chart snapshot the moment a trade closes and attaches it
 * to the trade's journal entry. Runs on the next animation frame so the closing
 * bar is already painted.
 */
export function useTradeSnapshots(): void {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = useTradingStore.subscribe((state) => {
      for (const trade of state.closedTrades) {
        if (seen.current.has(trade.id)) continue;
        seen.current.add(trade.id);
        if (trade.snapshot) continue;
        const id = trade.id;
        requestAnimationFrame(() => {
          const snapshot = takeSnapshot(360);
          if (snapshot) {
            useTradingStore.getState().updateTradeJournal(id, { snapshot });
          }
        });
      }
    });
    return unsub;
  }, []);
}

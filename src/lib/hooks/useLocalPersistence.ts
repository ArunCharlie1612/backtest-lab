"use client";

import { useEffect, useRef } from "react";
import { useTradingStore } from "@/lib/store/useTradingStore";

const STORAGE_KEY = "backtest-lab:v1";

interface Persisted {
  activeSymbol: string;
  startingEquity: number;
  costs: { spreadPips: number; slippagePips: number; commissionPerLot: number };
  closedTrades: unknown[];
}

/**
 * Local-first persistence: restores settings + closed trades on mount and saves
 * them (debounced) on change, so a single user's work survives page reloads
 * with no backend. The API/Postgres path remains available for multi-user use.
 */
export function useLocalPersistence(): void {
  const hydratedRef = useRef(false);

  // Restore once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<Persisted>;
        // activeSymbol is driven by the header selector, not restored here.
        useTradingStore.getState().hydrate({
          startingEquity: data.startingEquity,
          costs: data.costs,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          closedTrades: data.closedTrades as any,
        });
      }
    } catch {
      // Corrupt or unavailable storage — start fresh.
    }
    hydratedRef.current = true;
  }, []);

  // Persist on change (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useTradingStore.subscribe((state) => {
      if (!hydratedRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload: Persisted = {
          activeSymbol: state.activeSymbol,
          startingEquity: state.startingEquity,
          costs: state.costs,
          closedTrades: state.closedTrades,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // Quota exceeded — drop snapshots to stay under the limit.
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                ...payload,
                closedTrades: state.closedTrades.map((t) => ({ ...t, snapshot: undefined })),
              }),
            );
          } catch {
            /* give up silently */
          }
        }
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}

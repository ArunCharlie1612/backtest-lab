"use client";

import { useEffect, useState } from "react";

export interface MarketConfig {
  keyedProvider: boolean;
  keyedSymbols: string[];
}

let cache: MarketConfig | null = null;
let inflight: Promise<MarketConfig> | null = null;

async function load(): Promise<MarketConfig> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/api/market-config")
      .then((r) => r.json())
      .then((d: MarketConfig) => {
        cache = d;
        return d;
      })
      .catch(() => ({ keyedProvider: false, keyedSymbols: [] }));
  }
  return inflight;
}

/** Fetches (and caches) which keyed live providers the server has configured. */
export function useMarketConfig(): MarketConfig {
  const [config, setConfig] = useState<MarketConfig>(cache ?? { keyedProvider: false, keyedSymbols: [] });
  useEffect(() => {
    let active = true;
    void load().then((c) => active && setConfig(c));
    return () => {
      active = false;
    };
  }, []);
  return config;
}

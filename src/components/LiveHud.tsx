"use client";

import { Radio, Square } from "lucide-react";
import { useLiveStatusStore } from "@/lib/store/useLiveStatusStore";
import type { MarketMode } from "@/lib/store/useReplayStore";

/** Live/Replay status HUD with feed latency. */
export function LiveHud({
  mode,
  loading,
  source,
  barsCount,
}: {
  mode: MarketMode;
  loading: boolean;
  source: "live" | "demo";
  barsCount: number;
}) {
  const latency = useLiveStatusStore((s) => s.latencyMs);

  if (mode === "live") {
    return (
      <span className="flex items-center gap-1.5 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        <Radio size={11} className="animate-pulse" />
        LIVE
        {latency > 0 && <span className="text-emerald-300/70">{latency}ms</span>}
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
      title={source === "live" ? `Replay over ${barsCount} bars` : "Synthetic demo data"}
    >
      <Square size={9} className="fill-amber-400" />
      {loading ? "LOADING…" : "REPLAY"}
    </span>
  );
}

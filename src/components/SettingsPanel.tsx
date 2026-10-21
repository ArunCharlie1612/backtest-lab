"use client";

import { RotateCcw } from "lucide-react";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { useDrawingStore } from "@/lib/store/useDrawingStore";

/** Account equity + simulation cost settings, and session reset. */
export function SettingsPanel() {
  const startingEquity = useTradingStore((s) => s.startingEquity);
  const costs = useTradingStore((s) => s.costs);
  const leverage = useTradingStore((s) => s.leverage);
  const setStartingEquity = useTradingStore((s) => s.setStartingEquity);
  const setLeverage = useTradingStore((s) => s.setLeverage);
  const setCosts = useTradingStore((s) => s.setCosts);
  const resetSession = useTradingStore((s) => s.resetSession);
  const clearDrawings = useDrawingStore((s) => s.clear);

  const reset = () => {
    if (confirm("Reset this session? Open positions and closed trades will be cleared.")) {
      resetSession();
      clearDrawings();
    }
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Account & costs
        </span>
        <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-down" onClick={reset}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <label className="label">Starting equity ($)</label>
      <input
        className="input mb-2"
        type="number"
        value={startingEquity}
        onChange={(e) => setStartingEquity(Number(e.target.value))}
      />

      <label className="label">Leverage (1:N)</label>
      <input
        className="input mb-2"
        type="number"
        step="1"
        value={leverage}
        onChange={(e) => setLeverage(Number(e.target.value))}
      />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Spread (pips)</label>
          <input
            className="input"
            type="number"
            step="0.1"
            value={costs.spreadPips}
            onChange={(e) => setCosts({ spreadPips: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Slippage</label>
          <input
            className="input"
            type="number"
            step="0.1"
            value={costs.slippagePips}
            onChange={(e) => setCosts({ slippagePips: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Comm/lot</label>
          <input
            className="input"
            type="number"
            step="0.5"
            value={costs.commissionPerLot}
            onChange={(e) => setCosts({ commissionPerLot: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

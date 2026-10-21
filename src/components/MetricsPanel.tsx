"use client";

import { useMemo } from "react";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { computeMetrics } from "@/lib/engine/metrics";

const fmt = (n: number, suffix = "") =>
  Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}` : "∞";

/** Performance report derived live from closed trades. */
export function MetricsPanel() {
  const trades = useTradingStore((s) => s.closedTrades);
  const startingEquity = useTradingStore((s) => s.startingEquity);

  const m = useMemo(
    () => computeMetrics(trades, startingEquity),
    [trades, startingEquity],
  );

  const stats: Array<[string, string, string?]> = [
    ["Net P&L", fmt(m.netProfit, " $"), m.netProfit >= 0 ? "text-up" : "text-down"],
    ["Win rate", fmt(m.winRate, "%")],
    ["Profit factor", fmt(m.profitFactor)],
    ["Expectancy", fmt(m.expectancy, " $")],
    ["Avg R", fmt(m.averageR, "R")],
    ["Trades", String(m.totalTrades)],
    ["Max DD", fmt(m.maxDrawdown, " $"), "text-down"],
    ["Max DD %", fmt(m.maxDrawdownPct, "%"), "text-down"],
    ["Sharpe", fmt(m.sharpe)],
    ["Win streak", String(m.maxWinStreak), "text-up"],
    ["Loss streak", String(m.maxLossStreak), "text-down"],
    ["Commission", fmt(m.totalCommission, " $")],
  ];

  return (
    <div className="card">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Performance
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value, cls]) => (
          <div key={label} className="rounded-md bg-panelAlt p-2">
            <div className="text-[10px] uppercase text-slate-500">{label}</div>
            <div className={`text-sm font-semibold ${cls ?? "text-slate-200"}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

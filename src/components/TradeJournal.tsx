"use client";

import { Fragment, useState } from "react";
import { Download } from "lucide-react";
import { useTradingStore } from "@/lib/store/useTradingStore";
import type { ClosedTrade } from "@/lib/domain/types";

const SETUP_TAGS = [
  "Liquidity Sweep",
  "Order Block",
  "FVG",
  "Session Breakout",
  "Trend Continuation",
  "Reversal",
];
const SESSION_TAGS = ["Asia", "London", "New York"];

/** Closed-trade log with tagging and review notes. */
export function TradeJournal() {
  const trades = useTradingStore((s) => s.closedTrades);
  const updateJournal = useTradingStore((s) => s.updateTradeJournal);
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleTag = (trade: ClosedTrade, tag: string) => {
    const has = trade.tags.includes(tag);
    updateJournal(trade.id, {
      tags: has ? trade.tags.filter((t) => t !== tag) : [...trade.tags, tag],
    });
  };

  const exportCsv = () => {
    const header = [
      "symbol", "side", "lots", "entryPrice", "exitPrice", "entryTime", "exitTime",
      "durationSec", "grossPnl", "commission", "slippage", "netPnl", "rMultiple",
      "exitReason", "tags", "notes",
    ];
    const rows = trades.map((t) =>
      [
        t.symbol, t.side, t.lots, t.entryPrice, t.exitPrice, t.entryTime, t.exitTime,
        t.durationSec, t.grossPnl, t.commission, t.slippage, t.netPnl, t.rMultiple ?? "",
        t.exitReason, `"${t.tags.join("|")}"`, `"${(t.notes ?? "").replace(/"/g, "\"\"")}"`,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Trade journal ({trades.length})
        </span>
        <button
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent disabled:opacity-40"
          onClick={exportCsv}
          disabled={trades.length === 0}
        >
          <Download size={12} /> CSV
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel text-slate-500">
            <tr className="text-left">
              <th className="py-1">Side</th>
              <th>Lots</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>R</th>
              <th className="text-right">Net P&L</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {trades
              .slice()
              .reverse()
              .map((t) => (
                <Fragment key={t.id}>
                  <tr
                    className="cursor-pointer border-t border-border hover:bg-panelAlt"
                    onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  >
                    <td className={`py-1 ${t.side === "long" ? "text-up" : "text-down"}`}>
                      {t.side}
                    </td>
                    <td>{t.lots}</td>
                    <td>{t.entryPrice}</td>
                    <td>{t.exitPrice}</td>
                    <td>{t.rMultiple != null ? `${t.rMultiple}R` : "—"}</td>
                    <td className={`text-right ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>
                      {t.netPnl >= 0 ? "+" : ""}
                      {t.netPnl.toFixed(2)}
                    </td>
                    <td className="text-slate-500">{t.exitReason.replace("_", " ")}</td>
                  </tr>
                  {openId === t.id && (
                    <tr className="border-t border-border bg-panelAlt">
                      <td colSpan={7} className="p-2">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {[...SETUP_TAGS, ...SESSION_TAGS].map((tag) => (
                            <button
                              key={tag}
                              className={`rounded px-2 py-0.5 text-[10px] ${
                                t.tags.includes(tag)
                                  ? "bg-accent text-white"
                                  : "bg-border text-slate-400"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTag(t, tag);
                              }}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="input h-16 resize-none"
                          placeholder="Trade review notes…"
                          value={t.notes ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateJournal(t.id, { notes: e.target.value })}
                        />
                        {t.snapshot && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.snapshot}
                            alt="Trade chart snapshot"
                            className="mt-2 w-full rounded border border-border"
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
        {trades.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-600">
            No closed trades yet.
          </div>
        )}
      </div>
    </div>
  );
}

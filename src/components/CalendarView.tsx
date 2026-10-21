"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { getInstrument } from "@/lib/domain/instruments";
import {
  buildMonthGrid,
  monthStats,
  summarizeByDay,
  type DaySummary,
} from "@/lib/analytics/calendar";
import type { ClosedTrade } from "@/lib/domain/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Full-screen trading calendar with daily P&L grid and day drill-down. */
export function CalendarView({ onClose }: { onClose: () => void }) {
  const trades = useTradingStore((s) => s.closedTrades);
  const summaries = useMemo(() => summarizeByDay(trades), [trades]);

  const initial = useMemo(() => {
    const last = trades.length ? new Date(trades[trades.length - 1]!.exitTime * 1000) : new Date();
    return { year: last.getUTCFullYear(), month: last.getUTCMonth() };
  }, [trades]);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null);

  const grid = useMemo(() => buildMonthGrid(year, month, summaries), [year, month, summaries]);
  const stats = useMemo(() => monthStats(year, month, summaries), [year, month, summaries]);

  const prev = () => {
    const m = month - 1;
    if (m < 0) { setMonth(11); setYear(year - 1); } else setMonth(m);
  };
  const next = () => {
    const m = month + 1;
    if (m > 11) { setMonth(0); setYear(year + 1); } else setMonth(m);
  };

  const dayTrades: ClosedTrade[] = selectedDay
    ? trades.filter((t) => selectedDay.tradeIds.includes(t.id))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button className="btn" onClick={prev} title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-semibold text-slate-100">
            {MONTHS[month]} {year}
          </div>
          <button className="btn" onClick={next} title="Next month">
            <ChevronRight size={16} />
          </button>

          <div className="ml-4 flex items-center gap-4 text-xs">
            <span className={stats.netPnl >= 0 ? "text-up" : "text-down"}>
              Net {stats.netPnl >= 0 ? "+" : ""}${stats.netPnl.toFixed(2)}
            </span>
            <span className="text-slate-400">{stats.trades} trades</span>
            <span className="text-up">{stats.winningDays} green</span>
            <span className="text-down">{stats.losingDays} red</span>
          </div>

          <button className="btn ml-auto" onClick={onClose} title="Close calendar">
            <X size={16} />
          </button>
        </div>

        {/* grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              const s = cell.summary;
              const pnl = s?.netPnl ?? 0;
              const tone = !s
                ? "bg-panelAlt"
                : pnl > 0
                  ? "bg-up/15 border-up/40"
                  : pnl < 0
                    ? "bg-down/15 border-down/40"
                    : "bg-panelAlt";
              return (
                <button
                  key={cell.key}
                  disabled={!s}
                  onClick={() => s && setSelectedDay(s)}
                  className={`flex min-h-[70px] flex-col rounded border border-border p-1 text-left transition-colors ${tone} ${
                    cell.inMonth ? "" : "opacity-40"
                  } ${s ? "hover:brightness-125" : "cursor-default"}`}
                >
                  <span className="text-[10px] text-slate-400">{cell.date.getUTCDate()}</span>
                  {s && (
                    <span className="mt-auto">
                      <span className={`block text-xs font-semibold ${pnl >= 0 ? "text-up" : "text-down"}`}>
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(0)}
                      </span>
                      <span className="block text-[9px] text-slate-500">
                        {s.trades}t · {s.winRate}%
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* day drill-down */}
        {selectedDay && (
          <div className="border-t border-border bg-bg p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">
                {selectedDay.date} · {selectedDay.trades} trades ·{" "}
                <span className={selectedDay.netPnl >= 0 ? "text-up" : "text-down"}>
                  {selectedDay.netPnl >= 0 ? "+" : ""}${selectedDay.netPnl.toFixed(2)}
                </span>
              </span>
              <button className="text-xs text-slate-500 hover:text-slate-200" onClick={() => setSelectedDay(null)}>
                Close
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr className="text-left">
                    <th className="py-1">Symbol</th>
                    <th>Side</th>
                    <th>Lots</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th className="text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {dayTrades.map((t) => {
                    const prec = safePrecision(t.symbol);
                    return (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-1">{t.symbol}</td>
                        <td className={t.side === "long" ? "text-up" : "text-down"}>{t.side}</td>
                        <td>{t.lots}</td>
                        <td>{t.entryPrice.toFixed(prec)}</td>
                        <td>{t.exitPrice.toFixed(prec)}</td>
                        <td className={`text-right ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>
                          {t.netPnl >= 0 ? "+" : ""}
                          {t.netPnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function safePrecision(symbol: string): number {
  try {
    return getInstrument(symbol).pricePrecision;
  } catch {
    return 2;
  }
}

import type { ClosedTrade } from "../domain/types";

export interface DaySummary {
  /** YYYY-MM-DD in UTC. */
  date: string;
  netPnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  tradeIds: string[];
}

export interface MonthStats {
  netPnl: number;
  trades: number;
  winningDays: number;
  losingDays: number;
}

function utcDateKey(timeSec: number): string {
  const d = new Date(timeSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Aggregate closed trades into per-day summaries keyed by UTC date. */
export function summarizeByDay(trades: readonly ClosedTrade[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const t of trades) {
    const key = utcDateKey(t.exitTime);
    const cur =
      map.get(key) ??
      { date: key, netPnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0, tradeIds: [] };
    cur.netPnl = round2(cur.netPnl + t.netPnl);
    cur.trades += 1;
    if (t.netPnl > 0) cur.wins += 1;
    else if (t.netPnl < 0) cur.losses += 1;
    cur.tradeIds.push(t.id);
    cur.winRate = cur.trades ? Math.round((cur.wins / cur.trades) * 100) : 0;
    map.set(key, cur);
  }
  return map;
}

export interface CalendarCell {
  date: Date;
  inMonth: boolean;
  key: string;
  summary?: DaySummary;
}

/**
 * Build a 6×7 month grid (weeks start Monday) for the given year/month (0-based),
 * attaching each day's summary. Days are UTC-aligned to match trade keys.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  summaries: Map<string, DaySummary>,
): CalendarCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  // Monday = 0 … Sunday = 6
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - offset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = utcDateKey(Math.floor(d.getTime() / 1000));
    cells.push({
      date: d,
      inMonth: d.getUTCMonth() === month,
      key,
      summary: summaries.get(key),
    });
  }
  return cells;
}

export function monthStats(
  year: number,
  month: number,
  summaries: Map<string, DaySummary>,
): MonthStats {
  let netPnl = 0;
  let trades = 0;
  let winningDays = 0;
  let losingDays = 0;
  for (const [key, s] of summaries) {
    const [y, m] = key.split("-").map(Number);
    if (y === year && m === month + 1) {
      netPnl += s.netPnl;
      trades += s.trades;
      if (s.netPnl > 0) winningDays += 1;
      else if (s.netPnl < 0) losingDays += 1;
    }
  }
  return { netPnl: round2(netPnl), trades, winningDays, losingDays };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

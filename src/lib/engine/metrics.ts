import type { ClosedTrade } from "../domain/types";

export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  averageR: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpe: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalCommission: number;
}

/** Build a running equity curve from closed trades (chronological). */
export function buildEquityCurve(
  trades: readonly ClosedTrade[],
  startingEquity: number,
): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  const points: EquityPoint[] = [];
  let equity = startingEquity;
  let peak = startingEquity;

  for (const t of sorted) {
    equity += t.netPnl;
    peak = Math.max(peak, equity);
    const drawdown = peak - equity;
    points.push({
      time: t.exitTime,
      equity: round2(equity),
      drawdown: round2(drawdown),
      drawdownPct: peak > 0 ? round2((drawdown / peak) * 100) : 0,
    });
  }
  return points;
}

/** Compute the full performance report for a set of closed trades. */
export function computeMetrics(
  trades: readonly ClosedTrade[],
  startingEquity: number,
): PerformanceMetrics {
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);

  const grossProfit = sum(wins.map((t) => t.netPnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.netPnl)));
  const netProfit = grossProfit - grossLoss;

  const rValues = trades
    .map((t) => t.rMultiple)
    .filter((r): r is number => r != null);

  const curve = buildEquityCurve(trades, startingEquity);
  const maxDrawdown = curve.reduce((m, p) => Math.max(m, p.drawdown), 0);
  const maxDrawdownPct = curve.reduce((m, p) => Math.max(m, p.drawdownPct), 0);

  const { maxWin, maxLoss } = streaks(trades);

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? round2((wins.length / trades.length) * 100) : 0,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    netProfit: round2(netProfit),
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0,
    averageWin: wins.length ? round2(grossProfit / wins.length) : 0,
    averageLoss: losses.length ? round2(grossLoss / losses.length) : 0,
    expectancy: trades.length ? round2(netProfit / trades.length) : 0,
    averageR: rValues.length ? round2(sum(rValues) / rValues.length) : 0,
    maxDrawdown: round2(maxDrawdown),
    maxDrawdownPct: round2(maxDrawdownPct),
    sharpe: sharpeRatio(trades.map((t) => t.netPnl)),
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
    totalCommission: round2(sum(trades.map((t) => t.commission))),
  };
}

/** Non-annualized Sharpe of per-trade returns (mean / stddev). */
function sharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = sum(returns) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? round2(mean / std) : 0;
}

function streaks(trades: readonly ClosedTrade[]): { maxWin: number; maxLoss: number } {
  let maxWin = 0;
  let maxLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of trades) {
    if (t.netPnl > 0) {
      curWin += 1;
      curLoss = 0;
      maxWin = Math.max(maxWin, curWin);
    } else if (t.netPnl < 0) {
      curLoss += 1;
      curWin = 0;
      maxLoss = Math.max(maxLoss, curLoss);
    }
  }
  return { maxWin, maxLoss };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

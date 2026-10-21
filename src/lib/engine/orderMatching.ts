import type {
  Candle,
  ClosedTrade,
  InstrumentSpec,
  OrderRequest,
  OrderSide,
  Position,
  SimulationCosts,
  TradeExitReason,
} from "../domain/types";
import { grossPnl, priceToPips } from "../domain/valuation";

let seq = 0;
const nextId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Apply adverse slippage + half-spread to a fill price for a given side. */
export function applyFillCosts(
  spec: InstrumentSpec,
  side: OrderSide,
  rawPrice: number,
  costs: SimulationCosts,
): number {
  const halfSpread = (costs.spreadPips / 2) * spec.pip;
  const slip = costs.slippagePips * spec.pip;
  // Buyers pay up (ask), sellers receive down (bid); slippage is always adverse.
  const adjust = halfSpread + slip;
  return side === "long" ? rawPrice + adjust : rawPrice - adjust;
}

export interface MatchResult {
  positions: Position[];
  orders: OrderRequest[];
  closed: ClosedTrade[];
}

/**
 * Process one replayed bar against open orders and positions.
 *
 * Fill rules (conservative, bar-based):
 *  - Market orders fill at the bar OPEN (plus costs).
 *  - BUY limit fills if bar low <= limit; SELL limit fills if bar high >= limit.
 *  - BUY stop fills if bar high >= stop; SELL stop fills if bar low <= stop.
 *  - SL/TP are evaluated against bar high/low. When both could trigger in the
 *    same bar we assume the WORSE outcome (stop-loss first) — the standard
 *    pessimistic backtest convention to avoid overstating results.
 *
 * This function is pure: it returns new arrays and never mutates its inputs.
 */
export function processBar(
  spec: InstrumentSpec,
  bar: Candle,
  openOrders: readonly OrderRequest[],
  openPositions: readonly Position[],
  costs: SimulationCosts,
): MatchResult {
  const orders: OrderRequest[] = openOrders.map((o) => ({ ...o }));
  let positions: Position[] = openPositions.map((p) => ({ ...p }));
  const closed: ClosedTrade[] = [];

  // 1) Resolve pending entry orders against this bar.
  for (const order of orders) {
    if (order.status !== "pending") continue;
    const fill = resolveEntryFill(spec, order, bar, costs);
    if (fill == null) continue;
    order.status = "filled";
    positions.push({
      id: nextId("pos"),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      lots: order.lots,
      entryPrice: fill,
      entryTime: bar.time,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      entryCommission: spec.commissionPerLot * order.lots,
    });
  }

  // 2) Evaluate protective exits (SL/TP) against this bar.
  const survivors: Position[] = [];
  for (const pos of positions) {
    const exit = resolveProtectiveExit(spec, pos, bar);
    if (!exit) {
      survivors.push(pos);
      continue;
    }
    closed.push(buildClosedTrade(spec, pos, exit.price, bar.time, exit.reason, costs));
  }
  positions = survivors;

  return { positions, orders: orders.filter((o) => o.status === "pending"), closed };
}

function resolveEntryFill(
  spec: InstrumentSpec,
  order: OrderRequest,
  bar: Candle,
  costs: SimulationCosts,
): number | null {
  if (order.type === "market") {
    return applyFillCosts(spec, order.side, bar.open, costs);
  }
  const level = order.limitPrice;
  if (level == null) return null;

  if (order.type === "limit") {
    const triggered = order.side === "long" ? bar.low <= level : bar.high >= level;
    return triggered ? applyFillCosts(spec, order.side, level, costs) : null;
  }
  // stop entry
  const triggered = order.side === "long" ? bar.high >= level : bar.low <= level;
  return triggered ? applyFillCosts(spec, order.side, level, costs) : null;
}

function resolveProtectiveExit(
  spec: InstrumentSpec,
  pos: Position,
  bar: Candle,
): { price: number; reason: TradeExitReason } | null {
  const { stopLoss, takeProfit, side, entryPrice } = pos;

  // Ignore levels placed on the wrong side of entry (a long's SL must sit below
  // entry and its TP above; mirror for shorts) so they can't mis-fire/mislabel.
  const validStop =
    stopLoss != null && (side === "long" ? stopLoss < entryPrice : stopLoss > entryPrice);
  const validTp =
    takeProfit != null && (side === "long" ? takeProfit > entryPrice : takeProfit < entryPrice);

  const hitStop =
    validStop && (side === "long" ? bar.low <= stopLoss! : bar.high >= stopLoss!);
  const hitTp =
    validTp && (side === "long" ? bar.high >= takeProfit! : bar.low <= takeProfit!);

  // Pessimistic: if both can trigger in the same bar, take the stop-loss.
  if (hitStop) return { price: stopLoss!, reason: "stop_loss" };
  if (hitTp) return { price: takeProfit!, reason: "take_profit" };
  return null;
}

/** Close a position at an explicit price (manual close from the UI). */
export function closePositionAt(
  spec: InstrumentSpec,
  pos: Position,
  rawPrice: number,
  time: number,
  costs: SimulationCosts,
  reason: TradeExitReason = "manual",
): ClosedTrade {
  const exitPrice = applyFillCosts(spec, pos.side === "long" ? "short" : "long", rawPrice, costs);
  return buildClosedTrade(spec, pos, exitPrice, time, reason, costs);
}

function buildClosedTrade(
  spec: InstrumentSpec,
  pos: Position,
  exitPrice: number,
  exitTime: number,
  reason: TradeExitReason,
  costs: SimulationCosts,
): ClosedTrade {
  const gross = grossPnl(spec, pos.side, pos.entryPrice, exitPrice, pos.lots);
  const commission = pos.entryCommission + spec.commissionPerLot * pos.lots;
  const slippagePips = costs.slippagePips;
  const slippageCash = slippagePips * spec.pip * spec.contractSize * pos.lots;
  const net = gross - commission;

  let rMultiple: number | undefined;
  if (pos.stopLoss != null) {
    const riskPrice = Math.abs(pos.entryPrice - pos.stopLoss);
    const rewardPrice = Math.abs(exitPrice - pos.entryPrice);
    const sign = net >= 0 ? 1 : -1;
    rMultiple = riskPrice > 0 ? sign * (rewardPrice / riskPrice) : undefined;
  }

  return {
    id: nextId("trade"),
    symbol: pos.symbol,
    side: pos.side,
    lots: pos.lots,
    entryPrice: pos.entryPrice,
    exitPrice,
    entryTime: pos.entryTime,
    exitTime,
    durationSec: Math.max(0, exitTime - pos.entryTime),
    grossPnl: round2(gross),
    commission: round2(commission),
    slippage: round2(slippageCash),
    netPnl: round2(net),
    rMultiple: rMultiple != null ? round2(rMultiple) : undefined,
    exitReason: reason,
    tags: [],
  };
}

/** Floating (unrealized) P&L for a position at the current price. */
export function floatingPnl(spec: InstrumentSpec, pos: Position, price: number): number {
  return round2(grossPnl(spec, pos.side, pos.entryPrice, price, pos.lots) - pos.entryCommission);
}

/** Distance of current price from entry, expressed in pips (signed by profit). */
export function positionPips(spec: InstrumentSpec, pos: Position, price: number): number {
  const delta = pos.side === "long" ? price - pos.entryPrice : pos.entryPrice - price;
  return round2(Math.sign(delta) * priceToPips(spec, delta));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

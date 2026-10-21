import type { InstrumentSpec, OrderSide } from "./types";

/**
 * Value (in quote currency) of a one-pip move for a given lot size.
 *   pipValue = pip * contractSize * lots
 * For USDJPY-style instruments the result is in JPY; convert upstream if the
 * account currency differs. We keep valuation in the instrument quote currency
 * and leave FX conversion to a dedicated layer to avoid hidden rate inference.
 */
export function pipValue(spec: InstrumentSpec, lots: number): number {
  return spec.pip * spec.contractSize * lots;
}

/** Number of pips between two prices (always positive). */
export function priceToPips(spec: InstrumentSpec, priceDelta: number): number {
  return Math.abs(priceDelta) / spec.pip;
}

/** Signed directional price difference for a side (profit-positive). */
export function directionalDelta(side: OrderSide, entry: number, exit: number): number {
  return side === "long" ? exit - entry : entry - exit;
}

/**
 * Gross P&L in quote currency for closing `lots` of a position.
 *   gross = directionalDelta * contractSize * lots
 */
export function grossPnl(
  spec: InstrumentSpec,
  side: OrderSide,
  entry: number,
  exit: number,
  lots: number,
): number {
  return directionalDelta(side, entry, exit) * spec.contractSize * lots;
}

/** Round-turn commission (entry + exit) for a lot size. */
export function roundTurnCommission(spec: InstrumentSpec, lots: number): number {
  return spec.commissionPerLot * lots * 2;
}

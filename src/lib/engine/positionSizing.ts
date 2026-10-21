import type { InstrumentSpec, OrderSide } from "../domain/types";

export interface SizingByRiskPercent {
  mode: "risk_percent";
  equity: number;
  /** e.g. 1 means 1% of equity. */
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
}

export interface SizingByFixedCash {
  mode: "fixed_cash";
  /** Absolute cash amount to risk, in quote currency. */
  riskCash: number;
  entryPrice: number;
  stopPrice: number;
}

export type SizingInput = SizingByRiskPercent | SizingByFixedCash;

export interface SizingResult {
  lots: number;
  riskCash: number;
  stopDistancePrice: number;
  stopDistancePips: number;
  /** Cash P&L per pip at the computed size. */
  pipValuePerLot: number;
}

const MIN_LOT = 0.01;

/**
 * Position-size calculator. Converts a desired cash risk and a stop distance
 * into a lot size, rounded down to the broker lot step.
 *
 *   riskCash = stopDistancePrice * contractSize * lots
 *   lots     = riskCash / (stopDistancePrice * contractSize)
 */
export function calculatePositionSize(
  spec: InstrumentSpec,
  side: OrderSide,
  input: SizingInput,
  lotStep = MIN_LOT,
): SizingResult {
  const stopDistancePrice = Math.abs(input.entryPrice - input.stopPrice);
  if (stopDistancePrice <= 0) {
    throw new Error("Stop price must differ from entry price");
  }

  // Guard stop direction: a long's stop must sit below entry, a short's above.
  const validDirection =
    side === "long"
      ? input.stopPrice < input.entryPrice
      : input.stopPrice > input.entryPrice;
  if (!validDirection) {
    throw new Error(`Stop price is on the wrong side for a ${side} position`);
  }

  const riskCash =
    input.mode === "risk_percent"
      ? (input.equity * input.riskPercent) / 100
      : input.riskCash;

  const perLotRisk = stopDistancePrice * spec.contractSize;
  const rawLots = riskCash / perLotRisk;
  const lots = Math.max(0, Math.floor(rawLots / lotStep) * lotStep);

  return {
    lots: roundLots(lots),
    riskCash: roundLots(lots) * perLotRisk,
    stopDistancePrice,
    stopDistancePips: stopDistancePrice / spec.pip,
    pipValuePerLot: spec.pip * spec.contractSize,
  };
}

function roundLots(lots: number): number {
  return Math.round(lots * 100) / 100;
}

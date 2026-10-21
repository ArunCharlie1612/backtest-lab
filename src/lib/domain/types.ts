// Core domain types for the backtesting / replay engine.
// All times are UNIX epoch SECONDS in UTC to match Lightweight Charts.

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1D": 86400,
};

export interface Candle {
  /** UNIX epoch seconds, UTC, aligned to the timeframe bucket start. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type AssetClass = "forex" | "metal" | "index" | "crypto" | "futures";

/**
 * Instrument contract specification. Drives pip/tick valuation, spread and
 * commission modeling. `pip` is the price increment used for pip math;
 * `contractSize` is units per 1.0 lot (e.g. 100,000 for FX majors).
 */
export interface InstrumentSpec {
  symbol: string;
  assetClass: AssetClass;
  /** Smallest price increment represented as a "pip" for this instrument. */
  pip: number;
  /** Decimal places for price display. */
  pricePrecision: number;
  /** Base units controlled by 1.0 lot. */
  contractSize: number;
  /** Currency the P&L is denominated in. */
  quoteCurrency: string;
  /** Default spread in pips when using fixed-spread simulation. */
  defaultSpreadPips: number;
  /** Commission per 1.0 lot per side, in quote currency. */
  commissionPerLot: number;
}

export type OrderSide = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type OrderStatus = "pending" | "filled" | "cancelled" | "rejected";

export interface OrderRequest {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  /** Lots. Resolved by the position sizing calculator when omitted upstream. */
  lots: number;
  /** Required for limit/stop orders; ignored for market. */
  limitPrice?: number;
  /** Optional protective bracket levels (absolute prices). */
  stopLoss?: number;
  takeProfit?: number;
  /** Replay clock time the order was submitted. */
  createdAt: number;
  status: OrderStatus;
}

export interface Position {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  lots: number;
  entryPrice: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
  /** Commission paid on entry (quote currency). */
  entryCommission: number;
}

export type TradeExitReason = "stop_loss" | "take_profit" | "manual" | "liquidation";

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: OrderSide;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  /** Duration in seconds. */
  durationSec: number;
  grossPnl: number;
  commission: number;
  slippage: number;
  /** Net realized P&L after costs, quote currency. */
  netPnl: number;
  /** Realized R-multiple vs initial risk (undefined if no stop set). */
  rMultiple?: number;
  exitReason: TradeExitReason;
  tags: string[];
  notes?: string;
  /** Auto-captured chart snapshot (downscaled data URL) at trade close. */
  snapshot?: string;
}

export interface SimulationCosts {
  /** Fixed spread in pips applied at fill (half-spread each side). */
  spreadPips: number;
  /** Random/fixed slippage in pips applied adversely at fill. */
  slippagePips: number;
  commissionPerLot: number;
}

import { create } from "zustand";
import type {
  ClosedTrade,
  OrderRequest,
  OrderSide,
  OrderType,
  Position,
  SimulationCosts,
} from "../domain/types";
import { getInstrument } from "../domain/instruments";
import {
  closePositionAt,
  floatingPnl,
  processBar,
} from "../engine/orderMatching";
import type { Candle } from "../domain/types";

let orderSeq = 0;
const newOrderId = (): string => `ord_${Date.now().toString(36)}_${(orderSeq++).toString(36)}`;

export interface SubmitOrderInput {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  lots: number;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  atTime: number;
}

export interface TradingState {
  activeSymbol: string;
  startingEquity: number;
  /** Account leverage (e.g. 100 = 1% margin requirement). */
  leverage: number;
  costs: SimulationCosts;
  orders: OrderRequest[];
  positions: Position[];
  closedTrades: ClosedTrade[];

  setActiveSymbol: (symbol: string) => void;
  setStartingEquity: (equity: number) => void;
  setLeverage: (leverage: number) => void;
  setCosts: (costs: Partial<SimulationCosts>) => void;
  submitOrder: (input: SubmitOrderInput) => void;
  cancelOrder: (id: string) => void;
  /** Feed a freshly revealed base bar through the matching engine. */
  onBar: (bar: Candle) => void;
  closePosition: (positionId: string, price: number, time: number) => void;
  closeAll: (price: number, time: number) => void;
  updateTradeJournal: (
    tradeId: string,
    patch: Partial<Pick<ClosedTrade, "tags" | "notes" | "snapshot">>,
  ) => void;
  /** Clear positions, orders and closed trades (keeps settings). */
  resetSession: () => void;
  /** Flatten open positions/orders without touching journal (symbol switch). */
  clearWorkingState: () => void;
  /** Replace persisted state on hydration from local storage. */
  hydrate: (state: Partial<Pick<TradingState, "activeSymbol" | "startingEquity" | "costs" | "closedTrades">>) => void;

  // derived
  realizedPnl: () => number;
  floatingPnlTotal: (price: number) => number;
  equity: (price: number) => number;
  marginUsed: (price: number) => number;
  freeMargin: (price: number) => number;
  marginLevel: (price: number) => number;
}

const DEFAULT_COSTS: SimulationCosts = {
  spreadPips: 0.5,
  slippagePips: 0.1,
  commissionPerLot: 7,
};

export const useTradingStore = create<TradingState>((set, get) => ({
  activeSymbol: "EURUSD",
  startingEquity: 10_000,
  leverage: 100,
  costs: DEFAULT_COSTS,
  orders: [],
  positions: [],
  closedTrades: [],

  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),

  setStartingEquity: (equity) => set({ startingEquity: Math.max(0, equity) }),

  setLeverage: (leverage) => set({ leverage: Math.max(1, Math.round(leverage)) }),

  setCosts: (costs) => set({ costs: { ...get().costs, ...costs } }),

  submitOrder: (input) => {
    const order: OrderRequest = {
      id: newOrderId(),
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      lots: input.lots,
      limitPrice: input.limitPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      createdAt: input.atTime,
      status: "pending",
    };
    set({ orders: [...get().orders, order] });
  },

  cancelOrder: (id) =>
    set({ orders: get().orders.filter((o) => o.id !== id) }),

  onBar: (bar) => {
    const { activeSymbol, orders, positions, costs } = get();
    const spec = getInstrument(activeSymbol);
    const result = processBar(spec, bar, orders, positions, costs);
    set({
      orders: result.orders,
      positions: result.positions,
      closedTrades: [...get().closedTrades, ...result.closed],
    });
  },

  closePosition: (positionId, price, time) => {
    const pos = get().positions.find((p) => p.id === positionId);
    if (!pos) return;
    const spec = getInstrument(pos.symbol);
    const closed = closePositionAt(spec, pos, price, time, get().costs, "manual");
    set({
      positions: get().positions.filter((p) => p.id !== positionId),
      closedTrades: [...get().closedTrades, closed],
    });
  },

  closeAll: (price, time) => {
    const { positions, costs } = get();
    const closedNow: ClosedTrade[] = positions.map((pos) =>
      closePositionAt(getInstrument(pos.symbol), pos, price, time, costs, "manual"),
    );
    set({ positions: [], closedTrades: [...get().closedTrades, ...closedNow] });
  },

  updateTradeJournal: (tradeId, patch) =>
    set({
      closedTrades: get().closedTrades.map((t) =>
        t.id === tradeId ? { ...t, ...patch } : t,
      ),
    }),

  resetSession: () => set({ orders: [], positions: [], closedTrades: [] }),

  clearWorkingState: () => set({ orders: [], positions: [] }),

  hydrate: (state) => set({ ...state }),

  realizedPnl: () => get().closedTrades.reduce((a, t) => a + t.netPnl, 0),

  floatingPnlTotal: (price) =>
    get().positions.reduce(
      (a, p) => a + floatingPnl(getInstrument(p.symbol), p, price),
      0,
    ),

  equity: (price) =>
    get().startingEquity + get().realizedPnl() + get().floatingPnlTotal(price),

  marginUsed: (price) => {
    const lev = Math.max(1, get().leverage);
    const used = get().positions.reduce((a, p) => {
      const spec = getInstrument(p.symbol);
      const notional = (price || p.entryPrice) * spec.contractSize * p.lots;
      return a + notional / lev;
    }, 0);
    return Math.round(used * 100) / 100;
  },

  freeMargin: (price) => Math.round((get().equity(price) - get().marginUsed(price)) * 100) / 100,

  marginLevel: (price) => {
    const used = get().marginUsed(price);
    return used > 0 ? Math.round((get().equity(price) / used) * 10000) / 100 : 0;
  },
}));

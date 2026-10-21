"use client";

import { useMemo, useState } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { getInstrument } from "@/lib/domain/instruments";
import { calculatePositionSize } from "@/lib/engine/positionSizing";
import { floatingPnl, positionPips } from "@/lib/engine/orderMatching";
import type { OrderSide, OrderType, Position } from "@/lib/domain/types";

/** Order ticket with risk-based position sizing and live open positions. */
export function OrderPanel() {
  const symbol = useReplayStore((s) => s.symbol);
  const price = useReplayStore((s) => s.currentPrice()) ?? 0;
  const time = useReplayStore((s) => s.currentTime()) ?? 0;
  const tick = useReplayStore((s) => s.tick);
  void tick;

  const positions = useTradingStore((s) => s.positions);
  const orders = useTradingStore((s) => s.orders);
  const submitOrder = useTradingStore((s) => s.submitOrder);
  const cancelOrder = useTradingStore((s) => s.cancelOrder);
  const closePosition = useTradingStore((s) => s.closePosition);
  const updateBrackets = useTradingStore((s) => s.updatePositionBrackets);
  const startingEquity = useTradingStore((s) => s.startingEquity);
  const equity = useTradingStore((s) => s.equity(price));
  const marginUsed = useTradingStore((s) => s.marginUsed(price));
  const freeMargin = useTradingStore((s) => s.freeMargin(price));
  const marginLevel = useTradingStore((s) => s.marginLevel(price));

  const [side, setSide] = useState<OrderSide>("long");
  const [type, setType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [sizeMode, setSizeMode] = useState<"lots" | "risk">("lots");
  const [lots, setLots] = useState("0.1");
  const [riskPercent, setRiskPercent] = useState("1");
  const [showBrackets, setShowBrackets] = useState(false);

  const spec = symbol ? getInstrument(symbol) : null;

  const { sizing, sizingError } = useMemo(() => {
    if (!spec || !price) return { sizing: null, sizingError: null };
    const entry = type === "market" ? price : Number(limitPrice) || price;
    const stop = Number(stopLoss);
    if (!stop || stop === entry) return { sizing: null, sizingError: null };
    try {
      return {
        sizing: calculatePositionSize(spec, side, {
          mode: "risk_percent",
          equity,
          riskPercent: Number(riskPercent) || 0,
          entryPrice: entry,
          stopPrice: stop,
        }),
        sizingError: null,
      };
    } catch {
      const msg =
        side === "long"
          ? "Stop loss must be BELOW entry for a long."
          : "Stop loss must be ABOVE entry for a short.";
      return { sizing: null, sizingError: msg };
    }
  }, [spec, price, type, limitPrice, stopLoss, side, riskPercent, equity]);

  const finalLots = sizeMode === "lots" ? Math.max(0, Number(lots) || 0) : sizing?.lots ?? 0;

  const submit = () => {
    if (!spec || finalLots <= 0) return;
    submitOrder({
      symbol,
      side,
      type,
      lots: finalLots,
      limitPrice: type === "market" ? undefined : Number(limitPrice) || undefined,
      stopLoss: Number(stopLoss) || undefined,
      takeProfit: Number(takeProfit) || undefined,
      atTime: time,
      atPrice: price,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">{symbol || "—"}</span>
          <span className="font-mono text-sm text-slate-300">
            {spec ? price.toFixed(spec.pricePrecision) : "—"}
          </span>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            className={`btn ${side === "long" ? "!border-up !text-up" : ""}`}
            onClick={() => setSide("long")}
          >
            Buy / Long
          </button>
          <button
            className={`btn ${side === "short" ? "!border-down !text-down" : ""}`}
            onClick={() => setSide("short")}
          >
            Sell / Short
          </button>
        </div>

        <label className="label">Order type</label>
        <select className="input mb-2" value={type} onChange={(e) => setType(e.target.value as OrderType)}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>

        {type !== "market" && (
          <>
            <label className="label">Trigger price</label>
            <input className="input mb-2" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="e.g. 1.10250" />
          </>
        )}

        {/* Sizing: quick lots by default; risk% is opt-in and needs a stop. */}
        <div className="mb-1 flex items-center gap-1 text-[10px]">
          <button
            className={`rounded px-2 py-0.5 ${sizeMode === "lots" ? "bg-accent text-white" : "bg-panelAlt text-slate-400"}`}
            onClick={() => setSizeMode("lots")}
          >
            Lots
          </button>
          <button
            className={`rounded px-2 py-0.5 ${sizeMode === "risk" ? "bg-accent text-white" : "bg-panelAlt text-slate-400"}`}
            onClick={() => { setSizeMode("risk"); setShowBrackets(true); }}
          >
            Risk %
          </button>
        </div>

        {sizeMode === "lots" ? (
          <input className="input" type="number" step="0.01" value={lots} onChange={(e) => setLots(e.target.value)} placeholder="lots" />
        ) : (
          <input className="input" type="number" step="0.1" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="risk % of equity" />
        )}

        {/* SL/TP are OPTIONAL — hidden under a toggle, settable after entry too. */}
        <button
          className="mt-2 text-[11px] text-slate-500 hover:text-slate-300"
          onClick={() => setShowBrackets((v) => !v)}
        >
          {showBrackets ? "− Hide" : "+ Add"} stop loss / take profit (optional)
        </button>

        {showBrackets && (
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="label">Stop loss</label>
              <input className="input" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className="label">Take profit</label>
              <input className="input" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="optional" />
            </div>
          </div>
        )}

        <div className="mt-2 rounded-md bg-panelAlt p-2 text-xs text-slate-400">
          {sizeMode === "lots" ? (
            <div className="flex justify-between">
              <span>Size: <span className="text-slate-200">{finalLots} lots</span></span>
              <span>~${(price * (spec?.contractSize ?? 1) * finalLots).toLocaleString(undefined, { maximumFractionDigits: 0 })} notional</span>
            </div>
          ) : sizing ? (
            <div className="flex justify-between">
              <span>Size: <span className="text-slate-200">{sizing.lots} lots</span></span>
              <span>Risk: <span className="text-slate-200">${sizing.riskCash.toFixed(2)}</span></span>
              <span>{sizing.stopDistancePips.toFixed(1)} pips</span>
            </div>
          ) : sizingError ? (
            <span className="text-down">{sizingError}</span>
          ) : (
            <span>Enter a stop loss to size by risk.</span>
          )}
        </div>

        <button className="btn btn-accent mt-2 w-full" onClick={submit} disabled={finalLots <= 0}>
          Place {side} order
        </button>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>Equity</span>
          <span className="text-slate-200">${equity.toFixed(2)}</span>
        </div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>Starting</span>
          <span>${startingEquity.toFixed(2)}</span>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded bg-panelAlt p-1.5">
            <div className="text-slate-500">Margin</div>
            <div className="text-slate-200">${marginUsed.toFixed(2)}</div>
          </div>
          <div className="rounded bg-panelAlt p-1.5">
            <div className="text-slate-500">Free</div>
            <div className="text-slate-200">${freeMargin.toFixed(2)}</div>
          </div>
          <div className="rounded bg-panelAlt p-1.5">
            <div className="text-slate-500">Level</div>
            <div className={marginLevel > 0 && marginLevel < 100 ? "text-down" : "text-slate-200"}>
              {marginLevel > 0 ? `${marginLevel.toFixed(0)}%` : "—"}
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-400">Open positions ({positions.length})</div>
        <div className="mt-1 flex flex-col gap-1">
          {positions.map((p) => (
            <PositionRow
              key={p.id}
              position={p}
              price={price}
              time={time}
              onClose={() => closePosition(p.id, price, time)}
              onSetBrackets={(sl, tp) => updateBrackets(p.id, { stopLoss: sl, takeProfit: tp })}
            />
          ))}
          {positions.length === 0 && <div className="text-xs text-slate-600">No open positions.</div>}
        </div>

        {orders.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-400">Pending orders ({orders.length})</div>
            <div className="mt-1 flex flex-col gap-1">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded bg-panelAlt px-2 py-1 text-xs">
                  <span className={o.side === "long" ? "text-up" : "text-down"}>
                    {o.type} {o.side} {o.lots}
                  </span>
                  <span className="text-slate-400">
                    @ {o.limitPrice != null ? o.limitPrice.toFixed(spec?.pricePrecision ?? 2) : "mkt"}
                  </span>
                  <button className="text-slate-500 hover:text-down" onClick={() => cancelOrder(o.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Open-position row with floating P&L and an inline SL/TP editor. */
function PositionRow({
  position,
  price,
  time,
  onClose,
  onSetBrackets,
}: {
  position: Position;
  price: number;
  time: number;
  onClose: () => void;
  onSetBrackets: (sl: number | null, tp: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sl, setSl] = useState(position.stopLoss != null ? String(position.stopLoss) : "");
  const [tp, setTp] = useState(position.takeProfit != null ? String(position.takeProfit) : "");

  const spec = getInstrument(position.symbol);
  const fpl = floatingPnl(spec, position, price);
  const pips = positionPips(spec, position, price);
  void time;

  const apply = () => {
    onSetBrackets(sl.trim() === "" ? null : Number(sl), tp.trim() === "" ? null : Number(tp));
    setOpen(false);
  };

  return (
    <div className="rounded bg-panelAlt text-xs">
      <div className="flex items-center justify-between px-2 py-1">
        <button className={`flex-1 text-left ${position.side === "long" ? "text-up" : "text-down"}`} onClick={() => setOpen((v) => !v)}>
          {position.side} {position.lots}
          {(position.stopLoss != null || position.takeProfit != null) && (
            <span className="ml-1 text-[9px] text-slate-500">
              {position.stopLoss != null ? "SL" : ""}{position.takeProfit != null ? "/TP" : ""}
            </span>
          )}
        </button>
        <span className="mx-2 text-slate-400">{position.entryPrice.toFixed(spec.pricePrecision)}</span>
        <span className={fpl >= 0 ? "text-up" : "text-down"}>
          {fpl >= 0 ? "+" : ""}
          {fpl.toFixed(2)} ({pips}p)
        </span>
        <button className="ml-2 text-slate-500 hover:text-down" onClick={onClose}>
          ✕
        </button>
      </div>
      {open && (
        <div className="flex items-end gap-2 border-t border-border px-2 py-1.5">
          <div className="flex-1">
            <label className="label">Stop loss</label>
            <input className="input" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="price" />
          </div>
          <div className="flex-1">
            <label className="label">Take profit</label>
            <input className="input" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="price" />
          </div>
          <button className="btn btn-accent" onClick={apply}>
            Set
          </button>
        </div>
      )}
    </div>
  );
}

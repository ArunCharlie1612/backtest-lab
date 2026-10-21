"use client";

import { useMemo, useState } from "react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { getInstrument } from "@/lib/domain/instruments";
import { calculatePositionSize } from "@/lib/engine/positionSizing";
import { floatingPnl, positionPips } from "@/lib/engine/orderMatching";
import type { OrderSide, OrderType } from "@/lib/domain/types";

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
  const [riskPercent, setRiskPercent] = useState("1");

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

  const submit = () => {
    if (!spec || !sizing || sizing.lots <= 0) return;
    submitOrder({
      symbol,
      side,
      type,
      lots: sizing.lots,
      limitPrice: type === "market" ? undefined : Number(limitPrice) || undefined,
      stopLoss: Number(stopLoss) || undefined,
      takeProfit: Number(takeProfit) || undefined,
      atTime: time,
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Stop loss</label>
            <input className="input" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="price" />
          </div>
          <div>
            <label className="label">Take profit</label>
            <input className="input" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="price" />
          </div>
        </div>

        <label className="label mt-2">Risk % of equity</label>
        <input className="input" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />

        <div className="mt-2 rounded-md bg-panelAlt p-2 text-xs text-slate-400">
          {sizing ? (
            <div className="flex justify-between">
              <span>Size: <span className="text-slate-200">{sizing.lots} lots</span></span>
              <span>Risk: <span className="text-slate-200">${sizing.riskCash.toFixed(2)}</span></span>
              <span>{sizing.stopDistancePips.toFixed(1)} pips</span>
            </div>
          ) : sizingError ? (
            <span className="text-down">{sizingError}</span>
          ) : (
            <span>Enter a stop loss to size the position.</span>
          )}
        </div>

        <button className="btn btn-accent mt-2 w-full" onClick={submit} disabled={!sizing}>
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
          {positions.map((p) => {
            const s = getInstrument(p.symbol);
            const fpl = floatingPnl(s, p, price);
            const pips = positionPips(s, p, price);
            return (
              <div key={p.id} className="flex items-center justify-between rounded bg-panelAlt px-2 py-1 text-xs">
                <span className={p.side === "long" ? "text-up" : "text-down"}>
                  {p.side} {p.lots}
                </span>
                <span className="text-slate-400">{p.entryPrice.toFixed(s.pricePrecision)}</span>
                <span className={fpl >= 0 ? "text-up" : "text-down"}>
                  {fpl >= 0 ? "+" : ""}
                  {fpl.toFixed(2)} ({pips}p)
                </span>
                <button className="text-slate-500 hover:text-down" onClick={() => closePosition(p.id, price, time)}>
                  ✕
                </button>
              </div>
            );
          })}
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

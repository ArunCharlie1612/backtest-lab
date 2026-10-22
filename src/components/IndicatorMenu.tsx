"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";
import { useIndicatorStore } from "@/lib/store/useIndicatorStore";

/** Dropdown to toggle indicators and tune their periods. */
export function IndicatorMenu() {
  const [open, setOpen] = useState(false);
  const s = useIndicatorStore();

  const activeCount = [s.sma, s.ema, s.bollinger, s.vwap, s.rsi].filter((i) => i.enabled).length;

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs ${
          activeCount ? "text-accent" : "text-slate-400"
        } hover:text-accent`}
        onClick={() => setOpen((v) => !v)}
        title="Indicators"
      >
        <LineChart size={13} /> Indicators{activeCount ? ` (${activeCount})` : ""}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-40 w-64 rounded-lg border border-border bg-panel p-2 shadow-xl">
            <Row
              label="SMA"
              enabled={s.sma.enabled}
              onToggle={() => s.toggle("sma")}
              period={s.sma.period}
              onPeriod={(v) => s.setPeriod("sma", v)}
              color={s.sma.color}
            />
            <Row
              label="EMA"
              enabled={s.ema.enabled}
              onToggle={() => s.toggle("ema")}
              period={s.ema.period}
              onPeriod={(v) => s.setPeriod("ema", v)}
              color={s.ema.color}
            />
            <Row
              label="Bollinger"
              enabled={s.bollinger.enabled}
              onToggle={() => s.toggle("bollinger")}
              period={s.bollinger.period}
              onPeriod={(v) => s.setPeriod("bollinger", v)}
              color={s.bollinger.color}
              extra={
                <input
                  className="w-10 rounded border border-border bg-panelAlt px-1 py-0.5 text-[10px] text-slate-200"
                  type="number"
                  step="0.1"
                  value={s.bollinger.mult}
                  onChange={(e) => s.setMult(Number(e.target.value))}
                  title="Std-dev multiplier"
                />
              }
            />
            <Row
              label="VWAP"
              enabled={s.vwap.enabled}
              onToggle={() => s.toggle("vwap")}
              color={s.vwap.color}
            />
            <Row
              label="RSI"
              enabled={s.rsi.enabled}
              onToggle={() => s.toggle("rsi")}
              period={s.rsi.period}
              onPeriod={(v) => s.setPeriod("rsi", v)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  enabled,
  onToggle,
  period,
  onPeriod,
  color,
  extra,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  period?: number;
  onPeriod?: (v: number) => void;
  color?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded px-1 py-1 hover:bg-panelAlt">
      <button
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          enabled ? "border-accent bg-accent text-white" : "border-border"
        }`}
        onClick={onToggle}
      >
        {enabled && "✓"}
      </button>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      <span className="flex-1 text-xs text-slate-200">{label}</span>
      {extra}
      {period != null && onPeriod && (
        <input
          className="w-12 rounded border border-border bg-panelAlt px-1 py-0.5 text-[10px] text-slate-200"
          type="number"
          value={period}
          onChange={(e) => onPeriod(Number(e.target.value))}
          title="Period"
        />
      )}
    </div>
  );
}

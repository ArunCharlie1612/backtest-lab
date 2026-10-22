"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { INSTRUMENTS } from "@/lib/domain/instruments";
import type { AssetClass } from "@/lib/domain/types";

const CLASS_LABEL: Record<AssetClass, string> = {
  crypto: "Crypto",
  forex: "Forex",
  metal: "Metals",
  index: "Indices",
  futures: "Futures",
};

/** Searchable, categorized symbol selector (TradingView-style). */
export function SymbolPicker({
  symbol,
  onChange,
}: {
  symbol: string;
  onChange: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byClass = new Map<AssetClass, string[]>();
    for (const [sym, spec] of Object.entries(INSTRUMENTS)) {
      if (q && !sym.toLowerCase().includes(q) && !spec.assetClass.includes(q)) continue;
      const list = byClass.get(spec.assetClass) ?? [];
      list.push(sym);
      byClass.set(spec.assetClass, list);
    }
    return byClass;
  }, [query]);

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 rounded-md border border-border bg-panelAlt px-2.5 py-1 text-sm font-semibold text-slate-100 hover:border-accent"
        onClick={() => setOpen((v) => !v)}
      >
        {symbol}
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-40 w-72 rounded-lg border border-border bg-panel shadow-xl">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search size={14} className="text-slate-500" />
              <input
                autoFocus
                className="w-full bg-transparent text-sm text-slate-100 outline-none"
                placeholder="Search symbol…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {[...groups.entries()].map(([cls, syms]) => (
                <div key={cls} className="mb-1">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {CLASS_LABEL[cls]}
                  </div>
                  {syms.map((s) => (
                    <button
                      key={s}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-panelAlt ${
                        s === symbol ? "text-accent" : "text-slate-200"
                      }`}
                      onClick={() => pick(s)}
                    >
                      <span className="font-medium">{s}</span>
                      <span className="text-[10px] text-slate-500">{CLASS_LABEL[cls]}</span>
                    </button>
                  ))}
                </div>
              ))}
              {groups.size === 0 && (
                <div className="px-2 py-4 text-center text-xs text-slate-600">No matches.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

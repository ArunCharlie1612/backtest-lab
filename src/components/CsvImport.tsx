"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseOhlcvCsv } from "@/lib/data/csvParser";
import { useReplayStore } from "@/lib/store/useReplayStore";
import { useTradingStore } from "@/lib/store/useTradingStore";
import { useDrawingStore } from "@/lib/store/useDrawingStore";
import { INSTRUMENTS } from "@/lib/domain/instruments";

const SYMBOLS = Object.keys(INSTRUMENTS);

/**
 * Import historical 1-minute OHLCV from a CSV file and load it into the replay
 * engine. The chosen instrument supplies pip/commission conventions.
 */
export function CsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [symbol, setSymbol] = useState("EURUSD");
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File) => {
    try {
      setStatus("Parsing…");
      const text = await file.text();
      const series = parseOhlcvCsv(text);
      if (series.length < 10) {
        setStatus("Need at least 10 valid rows.");
        return;
      }
      useReplayStore.getState().load(symbol, series, Math.min(300, Math.floor(series.length / 4)));
      useTradingStore.getState().setActiveSymbol(symbol);
      useTradingStore.getState().resetSession();
      useDrawingStore.getState().clear();
      setStatus(`Loaded ${series.length.toLocaleString()} bars`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to parse CSV");
    }
  };

  return (
    <div className="card">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Import data
      </div>
      <div className="flex gap-2">
        <select className="select flex-1" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => inputRef.current?.click()} title="Upload OHLCV CSV">
          <Upload size={14} />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <p className="mt-1 text-[10px] text-slate-500">
        Columns: time, open, high, low, close[, volume]. 1m base recommended.
      </p>
      {status && <p className="mt-1 text-[11px] text-accent">{status}</p>}
    </div>
  );
}

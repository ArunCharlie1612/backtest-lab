"use client";

import {
  MousePointer2,
  TrendingUp,
  Minus,
  Spline,
  Square,
  Ruler,
  ArrowUpRight,
  ArrowDownRight,
  Undo2,
  Trash2,
} from "lucide-react";
import { useDrawingStore, type DrawTool } from "@/lib/store/useDrawingStore";

const TOOLS: Array<{ tool: DrawTool; icon: React.ReactNode; title: string }> = [
  { tool: "cursor", icon: <MousePointer2 size={16} />, title: "Cursor" },
  { tool: "trendline", icon: <TrendingUp size={16} />, title: "Trend line" },
  { tool: "horizontal", icon: <Minus size={16} />, title: "Horizontal / liquidity level" },
  { tool: "fib", icon: <Spline size={16} />, title: "Fibonacci retracement" },
  { tool: "rect", icon: <Square size={16} />, title: "Rectangle / FVG / order block" },
  { tool: "measure", icon: <Ruler size={16} />, title: "Measure" },
  { tool: "long", icon: <ArrowUpRight size={16} />, title: "Long position" },
  { tool: "short", icon: <ArrowDownRight size={16} />, title: "Short position" },
];

/** Vertical drawing toolbar sitting on the left edge of the chart. */
export function DrawingToolbar() {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);
  const undo = useDrawingStore((s) => s.undo);
  const clear = useDrawingStore((s) => s.clear);

  return (
    <div className="flex flex-col gap-1 border-r border-border bg-panel p-1">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          title={t.title}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            tool === t.tool ? "bg-accent text-white" : "text-slate-400 hover:bg-panelAlt"
          }`}
          onClick={() => setTool(t.tool)}
        >
          {t.icon}
        </button>
      ))}
      <div className="my-1 h-px bg-border" />
      <button
        title="Undo last drawing"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-panelAlt"
        onClick={undo}
      >
        <Undo2 size={16} />
      </button>
      <button
        title="Clear all drawings"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-panelAlt hover:text-down"
        onClick={clear}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

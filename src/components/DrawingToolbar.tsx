"use client";

import {
  MousePointer2,
  TrendingUp,
  MoveUpRight,
  Minus,
  ArrowRight,
  MoveVertical,
  Spline,
  Square,
  Pencil,
  Type,
  Ruler,
  ArrowUpRight,
  ArrowDownRight,
  Magnet,
  Eye,
  EyeOff,
  Undo2,
  Trash2,
} from "lucide-react";
import { useDrawingStore, type DrawTool } from "@/lib/store/useDrawingStore";

const TOOLS: Array<{ tool: DrawTool; icon: React.ReactNode; title: string }> = [
  { tool: "cursor", icon: <MousePointer2 size={16} />, title: "Cursor" },
  { tool: "trendline", icon: <TrendingUp size={16} />, title: "Trend line" },
  { tool: "arrow", icon: <MoveUpRight size={16} />, title: "Arrow" },
  { tool: "horizontal", icon: <Minus size={16} />, title: "Horizontal line" },
  { tool: "ray", icon: <ArrowRight size={16} />, title: "Horizontal ray" },
  { tool: "vertical", icon: <MoveVertical size={16} />, title: "Vertical line" },
  { tool: "fib", icon: <Spline size={16} />, title: "Fibonacci retracement" },
  { tool: "rect", icon: <Square size={16} />, title: "Rectangle / FVG / order block" },
  { tool: "brush", icon: <Pencil size={16} />, title: "Brush (freehand)" },
  { tool: "text", icon: <Type size={16} />, title: "Text" },
  { tool: "measure", icon: <Ruler size={16} />, title: "Measure" },
  { tool: "long", icon: <ArrowUpRight size={16} />, title: "Long position" },
  { tool: "short", icon: <ArrowDownRight size={16} />, title: "Short position" },
];

/** Vertical drawing toolbar (TradingView-style) on the left edge of the chart. */
export function DrawingToolbar() {
  const tool = useDrawingStore((s) => s.tool);
  const magnet = useDrawingStore((s) => s.magnet);
  const hidden = useDrawingStore((s) => s.hidden);
  const setTool = useDrawingStore((s) => s.setTool);
  const toggleMagnet = useDrawingStore((s) => s.toggleMagnet);
  const toggleHidden = useDrawingStore((s) => s.toggleHidden);
  const undo = useDrawingStore((s) => s.undo);
  const clear = useDrawingStore((s) => s.clear);

  const iconBtn = (active: boolean) =>
    `flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors ${
      active ? "bg-accent text-white" : "text-slate-400 hover:bg-panelAlt"
    }`;

  return (
    <div className="flex flex-col gap-1 overflow-y-auto border-r border-border bg-panel p-1">
      {TOOLS.map((t) => (
        <button key={t.tool} title={t.title} className={iconBtn(tool === t.tool)} onClick={() => setTool(t.tool)}>
          {t.icon}
        </button>
      ))}

      <div className="my-1 h-px bg-border" />

      <button title="Magnet: snap to OHLC" className={iconBtn(magnet)} onClick={toggleMagnet}>
        <Magnet size={16} />
      </button>
      <button title={hidden ? "Show drawings" : "Hide drawings"} className={iconBtn(false)} onClick={toggleHidden}>
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button title="Undo last drawing" className={iconBtn(false)} onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button
        title="Remove all drawings"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-panelAlt hover:text-down"
        onClick={clear}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

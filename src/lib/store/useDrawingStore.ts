import { create } from "zustand";

export type DrawTool =
  | "cursor"
  | "trendline"
  | "ray"
  | "horizontal"
  | "vertical"
  | "arrow"
  | "fib"
  | "rect"
  | "brush"
  | "text"
  | "measure"
  | "long"
  | "short";

/** A drawing anchor stored in chart space (time + price) so it stays pinned. */
export interface DrawPoint {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  tool: DrawTool;
  points: DrawPoint[];
  color: string;
  text?: string;
}

interface DrawingState {
  tool: DrawTool;
  color: string;
  drawings: Drawing[];
  /** Snap pointer to the nearest OHLC of the bar under the cursor. */
  magnet: boolean;
  /** Hide all committed drawings without deleting them. */
  hidden: boolean;
  setTool: (tool: DrawTool) => void;
  setColor: (color: string) => void;
  toggleMagnet: () => void;
  toggleHidden: () => void;
  addDrawing: (tool: DrawTool, points: DrawPoint[], opts?: { color?: string; text?: string }) => void;
  undo: () => void;
  clear: () => void;
}

let seq = 0;

export const useDrawingStore = create<DrawingState>((set, get) => ({
  tool: "cursor",
  color: "#eab308",
  drawings: [],
  magnet: false,
  hidden: false,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  toggleMagnet: () => set({ magnet: !get().magnet }),
  toggleHidden: () => set({ hidden: !get().hidden }),
  addDrawing: (tool, points, opts) =>
    set({
      drawings: [
        ...get().drawings,
        { id: `dr_${seq++}`, tool, points, color: opts?.color ?? get().color, text: opts?.text },
      ],
    }),
  undo: () => set({ drawings: get().drawings.slice(0, -1) }),
  clear: () => set({ drawings: [] }),
}));

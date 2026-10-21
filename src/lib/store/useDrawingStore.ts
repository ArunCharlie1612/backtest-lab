import { create } from "zustand";

export type DrawTool =
  | "cursor"
  | "trendline"
  | "horizontal"
  | "fib"
  | "rect"
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
}

interface DrawingState {
  tool: DrawTool;
  color: string;
  drawings: Drawing[];
  setTool: (tool: DrawTool) => void;
  setColor: (color: string) => void;
  addDrawing: (tool: DrawTool, points: DrawPoint[], color?: string) => void;
  undo: () => void;
  clear: () => void;
}

let seq = 0;

export const useDrawingStore = create<DrawingState>((set, get) => ({
  tool: "cursor",
  color: "#eab308",
  drawings: [],
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  addDrawing: (tool, points, color) =>
    set({
      drawings: [
        ...get().drawings,
        { id: `dr_${seq++}`, tool, points, color: color ?? get().color },
      ],
    }),
  undo: () => set({ drawings: get().drawings.slice(0, -1) }),
  clear: () => set({ drawings: [] }),
}));

import type { Drawing } from "@/lib/store/useDrawingStore";
import type { InstrumentSpec } from "@/lib/domain/types";

export interface RenderCtx {
  timeToX: (time: number) => number | null;
  priceToY: (price: number) => number | null;
  width: number;
  height: number;
  timeframeSec: number;
  spec: InstrumentSpec | null;
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1];
const RR_MULTIPLE = 2; // default reward:risk for the position tool

export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: Drawing[],
  draft: Drawing | null,
  c: RenderCtx,
): void {
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = "11px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  for (const d of drawings) renderOne(ctx, d, c, false);
  if (draft) renderOne(ctx, draft, c, true);
}

function renderOne(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx, draft: boolean): void {
  ctx.save();
  ctx.globalAlpha = draft ? 0.7 : 1;
  switch (d.tool) {
    case "horizontal":
      drawHorizontal(ctx, d, c);
      break;
    case "ray":
      drawRay(ctx, d, c);
      break;
    case "vertical":
      drawVertical(ctx, d, c);
      break;
    case "trendline":
      drawTrendline(ctx, d, c);
      break;
    case "arrow":
      drawTrendline(ctx, d, c, true);
      break;
    case "brush":
      drawBrush(ctx, d, c);
      break;
    case "text":
      drawText(ctx, d, c);
      break;
    case "fib":
      drawFib(ctx, d, c);
      break;
    case "rect":
      drawRect(ctx, d, c);
      break;
    case "measure":
      drawMeasure(ctx, d, c);
      break;
    case "long":
    case "short":
      drawPosition(ctx, d, c);
      break;
  }
  ctx.restore();
}

function px(c: RenderCtx, time: number, fallback: number): number {
  return c.timeToX(time) ?? fallback;
}
function py(c: RenderCtx, price: number): number {
  return c.priceToY(price) ?? 0;
}

function drawHorizontal(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const p = d.points[0];
  if (!p) return;
  const y = py(c, p.price);
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  line(ctx, 0, y, c.width, y);
  label(ctx, c.width - 70, y, p.price.toFixed(c.spec?.pricePrecision ?? 2), d.color);
}

function drawTrendline(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx, arrow = false): void {
  const [a, b] = d.points;
  if (!a || !b) return;
  const x0 = px(c, a.time, 0);
  const x1 = px(c, b.time, c.width);
  const y0 = py(c, a.price);
  const y1 = py(c, b.price);
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  line(ctx, x0, y0, x1, y1);
  if (arrow) drawArrowHead(ctx, x0, y0, x1, y1, d.color);
}

function drawRay(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  // Horizontal ray: from the anchor's time/price extending to the right edge.
  const p = d.points[0];
  if (!p) return;
  const y = py(c, p.price);
  const x0 = px(c, p.time, 0);
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  line(ctx, x0, y, c.width, y);
  label(ctx, x0 + 2, y, p.price.toFixed(c.spec?.pricePrecision ?? 2), d.color);
}

function drawVertical(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const p = d.points[0];
  if (!p) return;
  const x = px(c, p.time, c.width / 2);
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  line(ctx, x, 0, x, c.height);
  ctx.setLineDash([]);
}

function drawBrush(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  if (d.points.length < 2) return;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  ctx.beginPath();
  d.points.forEach((p, i) => {
    const x = px(c, p.time, 0);
    const y = py(c, p.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const p = d.points[0];
  if (!p || !d.text) return;
  const x = px(c, p.time, 10);
  const y = py(c, p.price);
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(d.text).width + 10;
  ctx.fillStyle = "rgba(18,23,34,0.9)";
  ctx.fillRect(x, y - 10, w, 20);
  ctx.fillStyle = d.color;
  ctx.fillText(d.text, x + 5, y);
  ctx.font = "11px ui-monospace, monospace";
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const size = 9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - size * Math.cos(angle - Math.PI / 6), y1 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x1 - size * Math.cos(angle + Math.PI / 6), y1 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawFib(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const [a, b] = d.points;
  if (!a || !b) return;
  const hi = Math.max(a.price, b.price);
  const lo = Math.min(a.price, b.price);
  const xL = Math.min(px(c, a.time, 0), px(c, b.time, c.width));
  const xR = Math.max(px(c, a.time, 0), px(c, b.time, c.width));
  ctx.setLineDash([]);
  for (let i = 0; i < FIB_LEVELS.length; i++) {
    const r = FIB_LEVELS[i]!;
    const price = hi - (hi - lo) * r;
    const y = py(c, price);
    ctx.strokeStyle = d.color;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    line(ctx, xL, y, xR, y);
    const next = FIB_LEVELS[i + 1];
    if (next != null) {
      const y2 = py(c, hi - (hi - lo) * next);
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = d.color;
      ctx.fillRect(xL, Math.min(y, y2), xR - xL, Math.abs(y2 - y));
      ctx.globalAlpha = 0.9;
    }
    label(ctx, xL + 2, y, `${(r * 100).toFixed(1)}%  ${price.toFixed(c.spec?.pricePrecision ?? 2)}`, d.color);
  }
}

function drawRect(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const [a, b] = d.points;
  if (!a || !b) return;
  const x0 = px(c, a.time, 0);
  const x1 = px(c, b.time, c.width);
  const y0 = py(c, a.price);
  const y1 = py(c, b.price);
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  ctx.setLineDash([]);
  ctx.fillStyle = d.color;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(x, y, Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, Math.abs(x1 - x0), Math.abs(y1 - y0));
}

function drawMeasure(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const [a, b] = d.points;
  if (!a || !b) return;
  const x0 = px(c, a.time, 0);
  const x1 = px(c, b.time, c.width);
  const y0 = py(c, a.price);
  const y1 = py(c, b.price);
  const up = b.price >= a.price;
  const color = up ? "#26a69a" : "#ef5350";
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));

  const delta = b.price - a.price;
  const pips = c.spec ? Math.abs(delta) / c.spec.pip : 0;
  const bars = Math.round(Math.abs(b.time - a.time) / c.timeframeSec);
  const pct = a.price !== 0 ? (delta / a.price) * 100 : 0;
  const text = `${delta >= 0 ? "+" : ""}${delta.toFixed(c.spec?.pricePrecision ?? 2)}  ${pips.toFixed(1)} pips  ${bars} bars  ${pct.toFixed(2)}%`;
  label(ctx, Math.min(x0, x1) + 4, Math.min(y0, y1) + 10, text, color);
}

function drawPosition(ctx: CanvasRenderingContext2D, d: Drawing, c: RenderCtx): void {
  const [entry, stop] = d.points;
  if (!entry || !stop) return;
  const isLong = d.tool === "long";
  const risk = Math.abs(entry.price - stop.price);
  const target = isLong ? entry.price + RR_MULTIPLE * risk : entry.price - RR_MULTIPLE * risk;

  const xL = Math.min(px(c, entry.time, 0), px(c, stop.time, c.width));
  const xR = Math.max(px(c, entry.time, 0), px(c, stop.time, c.width));
  const w = Math.max(40, xR - xL);

  const yEntry = py(c, entry.price);
  const yStop = py(c, stop.price);
  const yTarget = py(c, target);

  // reward zone (green) and risk zone (red)
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#26a69a";
  ctx.fillRect(xL, Math.min(yEntry, yTarget), w, Math.abs(yTarget - yEntry));
  ctx.fillStyle = "#ef5350";
  ctx.fillRect(xL, Math.min(yEntry, yStop), w, Math.abs(yStop - yEntry));

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  for (const [yy, col, text] of [
    [yEntry, "#cbd5e1", `Entry ${entry.price.toFixed(c.spec?.pricePrecision ?? 2)}`],
    [yStop, "#ef5350", `SL ${stop.price.toFixed(c.spec?.pricePrecision ?? 2)}`],
    [yTarget, "#26a69a", `TP ${target.toFixed(c.spec?.pricePrecision ?? 2)}`],
  ] as Array<[number, string, string]>) {
    ctx.strokeStyle = col;
    line(ctx, xL, yy, xL + w, yy);
    label(ctx, xL + 2, yy, text, col);
  }
  const pips = c.spec ? risk / c.spec.pip : 0;
  label(ctx, xL + 2, Math.min(yEntry, yTarget) - 8, `RR 1:${RR_MULTIPLE}  risk ${pips.toFixed(1)} pips`, "#94a3b8");
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = "rgba(11,14,20,0.75)";
  ctx.fillRect(x - 2, y - 7, w, 14);
  ctx.fillStyle = color;
  ctx.fillText(text, x + 1, y);
  ctx.globalAlpha = prevAlpha;
}

export { RR_MULTIPLE };

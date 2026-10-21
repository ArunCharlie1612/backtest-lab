import type { Candle } from "../domain/types";

/**
 * Parse CSV historical OHLCV into Candle[]. Accepts a header row and is tolerant
 * of common column names. Time may be an ISO string or epoch seconds/millis.
 *
 * Expected columns (case-insensitive, any order):
 *   time|date|timestamp, open, high, low, close, volume?
 */
export function parseOhlcvCsv(text: string): Candle[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]): number => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const tIdx = idx(["time", "date", "timestamp", "datetime"]);
  const oIdx = idx(["open", "o"]);
  const hIdx = idx(["high", "h"]);
  const lIdx = idx(["low", "l"]);
  const cIdx = idx(["close", "c"]);
  const vIdx = idx(["volume", "vol", "v"]);

  if ([tIdx, oIdx, hIdx, lIdx, cIdx].some((i) => i === -1)) {
    throw new Error("CSV missing one of required columns: time, open, high, low, close");
  }

  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const time = parseTime(cols[tIdx]!);
    const candle: Candle = {
      time,
      open: Number(cols[oIdx]),
      high: Number(cols[hIdx]),
      low: Number(cols[lIdx]),
      close: Number(cols[cIdx]),
      volume: vIdx !== -1 ? Number(cols[vIdx]) : undefined,
    };
    if (Number.isFinite(candle.open) && Number.isFinite(candle.close)) {
      out.push(candle);
    }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** Normalize a timestamp cell to epoch SECONDS. */
export function parseTime(raw: string): number {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    // Heuristic: 13-digit values are millis.
    return trimmed.length >= 13 ? Math.floor(n / 1000) : n;
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    throw new Error(`Unparseable time value: ${raw}`);
  }
  return Math.floor(ms / 1000);
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

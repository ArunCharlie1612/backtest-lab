import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/data/marketData";

/**
 * GET /api/candles?symbol=EURUSD&interval=1m&range=5d
 * Returns the latest real OHLCV candles for the instrument.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") ?? "1m";
  const range = searchParams.get("range") ?? "5d";
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const { candles, source, provider, resolvedSymbol } = await fetchCandles(symbol, interval, range);
    return NextResponse.json(
      { symbol, resolvedSymbol, interval, source, provider, count: candles.length, candles },
      { headers: { "Cache-Control": "public, max-age=120" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch candles" },
      { status: 502 },
    );
  }
}

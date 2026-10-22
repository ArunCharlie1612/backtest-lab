import { NextResponse } from "next/server";
import { hasKeyedProvider, keyedSymbols } from "@/lib/data/marketDataProxy";

/**
 * GET /api/market-config — advertises which live providers are available so the
 * client can enable live mode for keyed FX/metals without knowing the key.
 */
export async function GET() {
  return NextResponse.json({
    keyedProvider: hasKeyedProvider(),
    keyedSymbols: keyedSymbols(),
  });
}

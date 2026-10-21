import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeMetrics } from "@/lib/engine/metrics";
import type { ClosedTrade } from "@/lib/domain/types";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/:id/metrics
 * Returns the computed performance report for a session's closed trades.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { trades: true, account: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const trades: ClosedTrade[] = session.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as ClosedTrade["side"],
    lots: t.lots,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    durationSec: t.durationSec,
    grossPnl: t.grossPnl,
    commission: t.commission,
    slippage: t.slippage,
    netPnl: t.netPnl,
    rMultiple: t.rMultiple ?? undefined,
    exitReason: t.exitReason as ClosedTrade["exitReason"],
    tags: [],
    notes: t.notes ?? undefined,
  }));

  const metrics = computeMetrics(trades, session.account.startingEquity);
  return NextResponse.json({ metrics });
}

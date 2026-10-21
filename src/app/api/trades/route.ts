import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createTradeSchema } from "@/lib/api/schemas";

/**
 * GET /api/trades?sessionId=...   List trades for a session (newest first).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const trades = await prisma.trade.findMany({
    where: { sessionId },
    include: { tags: true },
    orderBy: { exitTime: "desc" },
  });
  return NextResponse.json({ trades });
}

/**
 * POST /api/trades   Persist a closed trade (trade logging).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trade payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { tagIds, ...data } = parsed.data;
  const trade = await prisma.trade.create({
    data: {
      ...data,
      rMultiple: data.rMultiple ?? null,
      notes: data.notes ?? null,
      snapshotUrl: data.snapshotUrl ?? null,
      tags: tagIds?.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
    },
    include: { tags: true },
  });

  return NextResponse.json({ trade }, { status: 201 });
}

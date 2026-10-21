import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateTradeSchema } from "@/lib/api/schemas";

interface Params {
  params: Promise<{ id: string }>;
}

/** GET /api/trades/:id */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { tags: true },
  });
  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }
  return NextResponse.json({ trade });
}

/** PATCH /api/trades/:id   Update journal notes, snapshot, or tags. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { tagIds, ...rest } = parsed.data;
  const trade = await prisma.trade.update({
    where: { id },
    data: {
      ...rest,
      tags: tagIds ? { set: tagIds.map((tid) => ({ id: tid })) } : undefined,
    },
    include: { tags: true },
  });
  return NextResponse.json({ trade });
}

/** DELETE /api/trades/:id */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.trade.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

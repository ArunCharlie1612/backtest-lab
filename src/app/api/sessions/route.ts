import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionSchema } from "@/lib/api/schemas";

/** GET /api/sessions?userId=...   List a user's sessions with trade counts. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId },
    include: { _count: { select: { trades: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sessions });
}

/** POST /api/sessions   Create a replay session. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid session payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const session = await prisma.session.create({ data: parsed.data });
  return NextResponse.json({ session }, { status: 201 });
}

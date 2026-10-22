import { NextResponse } from "next/server";

/** GET /api/time — server epoch millis, used to correct client-clock drift. */
export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

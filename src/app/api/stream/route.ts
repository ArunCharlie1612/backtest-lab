import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/domain/types";
import { fetchTwelveDataPrice, supportsKeyed } from "@/lib/data/marketDataProxy";

export const dynamic = "force-dynamic";

/**
 * GET /api/stream?symbol=GBPUSD&timeframe=1m — Server-Sent Events proxy that
 * polls the keyed provider's latest price and streams forming-bar updates. The
 * API key stays server-side. Falls back to 503 when no keyed provider is set so
 * the client can use another feed.
 *
 * Each event payload: { time, open, high, low, close, closed } (epoch seconds).
 * The server aggregates ticks into the active timeframe bucket and marks a bar
 * closed when the bucket advances.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "";
  const timeframe = (searchParams.get("timeframe") ?? "1m") as Timeframe;

  if (!supportsKeyed(symbol)) {
    return new Response(JSON.stringify({ error: "No keyed provider for symbol" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tfSec = TIMEFRAME_SECONDS[timeframe] ?? 60;
  const encoder = new TextEncoder();
  // Free-tier rate limits favour a conservative poll cadence.
  const pollMs = 4000;

  const stream = new ReadableStream({
    async start(controller) {
      let bucketStart = 0;
      let bar: { time: number; open: number; high: number; low: number; close: number } | null = null;
      let active = true;

      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const poll = async () => {
        if (!active) return;
        try {
          const price = await fetchTwelveDataPrice(symbol);
          const nowSec = Math.floor(Date.now() / 1000);
          const thisBucket = Math.floor(nowSec / tfSec) * tfSec;

          if (!bar || thisBucket !== bucketStart) {
            if (bar) send({ ...bar, closed: true });
            bucketStart = thisBucket;
            bar = { time: thisBucket, open: price, high: price, low: price, close: price };
          } else {
            bar.high = Math.max(bar.high, price);
            bar.low = Math.min(bar.low, price);
            bar.close = price;
          }
          send({ ...bar, closed: false });
        } catch {
          send({ error: "poll_failed" });
        }
      };

      await poll();
      const interval = setInterval(poll, pollMs);

      // Stop when the client disconnects.
      request.signal.addEventListener("abort", () => {
        active = false;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

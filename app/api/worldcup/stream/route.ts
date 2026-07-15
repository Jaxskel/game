import { MatchEngine, TICK_MS } from "@/lib/worldcup/engine";
import { LiveEngine } from "@/lib/worldcup/liveEngine";
import type { StreamMessage } from "@/lib/worldcup/types";

export const dynamic = "force-dynamic";
// On serverless hosts (e.g. Vercel) a streaming response ends when the
// function hits its duration cap; keep segments long and let EventSource
// reconnect — each reconnect re-syncs from a fresh snapshot.
export const maxDuration = 300;

type Client = { send: (msg: StreamMessage) => void; close: () => void };
type Engine = MatchEngine | LiveEngine;

/** One live match shared by every connected viewer. Prefers the real feed;
    falls back to the simulation only if the feed never comes up. */
class Hub {
  private engine: Engine;
  private clients = new Set<Client>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;

  constructor() {
    this.engine =
      process.env.WORLDCUP_MODE === "sim"
        ? Hub.freshSim(1)
        : new LiveEngine(process.env.ESPN_EVENT_ID);
  }

  /** Constructor-time events ship inside snapshots, so clear the pending
      buffer before the first tick or they'd be broadcast twice. */
  private static freshSim(simId: number): MatchEngine {
    const engine = new MatchEngine(Date.now() & 0xffffffff, simId);
    engine.drainEvents();
    return engine;
  }

  debugInfo(): Record<string, unknown> {
    const base = {
      clients: this.clients.size,
      ticking: Boolean(this.timer),
    };
    if (this.engine instanceof LiveEngine) return { ...base, ...this.engine.debugInfo() };
    return { ...base, mode: "sim", state: this.engine.state() };
  }

  add(client: Client) {
    this.clients.add(client);
    client.send(this.engine.snapshot());
    if (!this.timer) {
      this.lastTick = Date.now();
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  remove(client: Client) {
    this.clients.delete(client);
    if (this.clients.size === 0 && this.timer) {
      // Pause when nobody is watching (the real feed re-polls on resume).
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min(now - this.lastTick, 1000);
    this.lastTick = now;
    this.engine.advance(dt);

    if (this.engine instanceof LiveEngine) {
      if (this.engine.feedDead()) {
        // Real feed never came up — switch everyone to the simulation.
        this.engine = Hub.freshSim(1);
        this.broadcast(this.engine.snapshot());
        return;
      }
      if (this.engine.consumeResync()) {
        // First real data arrived (history backfilled) — resync everyone.
        this.engine.drainEvents();
        while (this.engine.drainHistoryPoint()) {
          // included in the snapshot below
        }
        this.broadcast(this.engine.snapshot());
        return;
      }
    } else if (this.engine.isFinished()) {
      this.engine = Hub.freshSim(this.engine.simId + 1);
      this.broadcast(this.engine.snapshot());
      return;
    }

    this.broadcast({
      kind: "tick",
      state: this.engine.state(),
      newEvents: this.engine.drainEvents(),
      historyPoint: this.engine.drainHistoryPoint(),
      serverTime: now,
    });
  }

  private broadcast(msg: StreamMessage) {
    for (const c of this.clients) {
      try {
        c.send(msg);
      } catch {
        this.remove(c);
        try {
          c.close();
        } catch {
          /* already closed */
        }
      }
    }
  }
}

const globalStore = globalThis as unknown as { __wcHub?: Hub };
function hub(): Hub {
  globalStore.__wcHub ??= new Hub();
  return globalStore.__wcHub;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.has("ping")) {
    // Tiny endpoint the client uses to measure round-trip latency.
    return Response.json({ t: Date.now() }, { headers: { "cache-control": "no-store" } });
  }
  if (url.searchParams.has("debug")) {
    // Upstream-feed health, for remote diagnosis.
    return Response.json(hub().debugInfo(), { headers: { "cache-control": "no-store" } });
  }

  const encoder = new TextEncoder();
  let client: Client | null = null;

  const stream = new ReadableStream({
    start(controller) {
      client = {
        send(msg) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        },
        close() {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      };
      hub().add(client);
      req.signal.addEventListener("abort", () => {
        if (client) {
          hub().remove(client);
          client.close();
        }
      });
    },
    cancel() {
      if (client) hub().remove(client);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

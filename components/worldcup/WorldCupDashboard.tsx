"use client";

import { useCallback, useEffect, useState } from "react";
import { MATCH_INFO, TEAMS } from "@/lib/worldcup/data";
import { MatchEngine, TICK_MS } from "@/lib/worldcup/engine";
import type {
  HistoryPoint,
  MatchEvent,
  MatchState,
  StreamMessage,
} from "@/lib/worldcup/types";
import EventFeed from "./EventFeed";
import MarketPanel from "./MarketPanel";
import Pitch from "./Pitch";
import ProbChart from "./ProbChart";
import StatTiles from "./StatTiles";

const MAX_FEED = 80;
type Connection = "connecting" | "live" | "local";

export default function WorldCupDashboard() {
  const [state, setState] = useState<MatchState | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [rtt, setRtt] = useState<number | null>(null);

  const applyMessage = useCallback((msg: StreamMessage) => {
    if (msg.kind === "snapshot") {
      setState(msg.state);
      setHistory(msg.history);
      setEvents([...msg.events].reverse().slice(0, MAX_FEED));
    } else {
      setState(msg.state);
      if (msg.historyPoint) {
        const point = msg.historyPoint;
        setHistory((h) => [...h, point]);
      }
      if (msg.newEvents.length) {
        setEvents((ev) => {
          // Guard against replays (reconnects, dev double-mount).
          const seenId = ev[0]?.id ?? 0;
          const fresh = msg.newEvents.filter((e) => e.id > seenId);
          return fresh.length ? [...fresh.reverse(), ...ev].slice(0, MAX_FEED) : ev;
        });
      }
    }
  }, []);

  // Live connection: SSE first, local simulation as a fallback.
  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let localTimer: ReturnType<typeof setInterval> | null = null;
    let errorCount = 0;

    const startLocal = () => {
      if (closed || localTimer) return;
      setConnection("local");
      let engine = new MatchEngine(Date.now() & 0xffffffff, 1);
      applyMessage(engine.snapshot());
      engine.drainEvents(); // already delivered via the snapshot
      let last = Date.now();
      localTimer = setInterval(() => {
        const now = Date.now();
        engine.advance(Math.min(now - last, 1000));
        last = now;
        if (engine.isFinished()) {
          engine = new MatchEngine(now & 0xffffffff, engine.simId + 1);
          applyMessage(engine.snapshot());
          engine.drainEvents();
          return;
        }
        applyMessage({
          kind: "tick",
          state: engine.state(),
          newEvents: engine.drainEvents(),
          historyPoint: engine.drainHistoryPoint(),
          serverTime: now,
        });
      }, TICK_MS);
    };

    if (typeof EventSource === "undefined") {
      startLocal();
      return () => {
        closed = true;
        if (localTimer) clearInterval(localTimer);
      };
    }

    es = new EventSource("/api/worldcup/stream");
    es.onopen = () => {
      errorCount = 0;
      setConnection("live");
    };
    es.onmessage = (e) => {
      try {
        applyMessage(JSON.parse(e.data) as StreamMessage);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      errorCount += 1;
      // EventSource retries on its own; only bail out if it keeps failing.
      if (errorCount >= 4) {
        es?.close();
        startLocal();
      }
    };

    return () => {
      closed = true;
      es?.close();
      if (localTimer) clearInterval(localTimer);
    };
  }, [applyMessage]);

  // Round-trip latency probe for the connection badge.
  useEffect(() => {
    if (connection !== "live") return;
    let stop = false;
    const probe = async () => {
      const t0 = performance.now();
      try {
        await fetch("/api/worldcup/stream?ping=1", { cache: "no-store" });
        if (!stop) setRtt(Math.max(1, Math.round(performance.now() - t0)));
      } catch {
        /* badge just keeps the last reading */
      }
    };
    probe();
    const timer = setInterval(probe, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [connection]);

  return (
    <div className="wc-root min-h-screen">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
        <Header state={state} connection={connection} rtt={rtt} />

        {state ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <ProbChart history={history} state={state} />
              <Pitch state={state} />
            </div>
            <div className="flex flex-col gap-4">
              <MarketPanel state={state} />
              <StatTiles state={state} />
              <EventFeed events={events} />
            </div>
          </div>
        ) : (
          <div className="wc-card mt-4 flex h-64 items-center justify-center text-sm" style={{ color: "var(--wc-muted)" }}>
            Connecting to the live feed…
          </div>
        )}

        <p className="mt-6 text-center text-xs" style={{ color: "var(--wc-muted)" }}>
          Demo dashboard with a simulated live feed — not affiliated with Polymarket or FIFA; no real
          orders are placed.
        </p>
      </div>
    </div>
  );
}

function Header({
  state,
  connection,
  rtt,
}: {
  state: MatchState | null;
  connection: Connection;
  rtt: number | null;
}) {
  return (
    <header className="wc-card px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "var(--wc-muted)" }}>
        <span>
          {MATCH_INFO.competition} · {MATCH_INFO.round} · {MATCH_INFO.venue} · {MATCH_INFO.date}
        </span>
        <span className="flex items-center gap-3">
          {state && state.phase !== "ft" && (
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--wc-bad)" }}>
              <span className="wc-live-dot inline-block h-2 w-2 rounded-full" style={{ background: "var(--wc-bad)" }} />
              LIVE
            </span>
          )}
          <span
            className="rounded-full border px-2 py-0.5"
            style={{ borderColor: "var(--wc-border)" }}
            title={
              connection === "live"
                ? "Streaming over server-sent events"
                : connection === "local"
                  ? "Server stream unavailable — running the simulation locally"
                  : "Connecting"
            }
          >
            {connection === "live"
              ? `⚡ live stream${rtt !== null ? ` · ${rtt} ms` : ""}`
              : connection === "local"
                ? "⚙ local sim"
                : "… connecting"}
          </span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 sm:gap-8">
        <TeamName id="ENG" align="right" />
        <div className="text-center">
          <div className="wc-num text-3xl font-bold tracking-wide sm:text-4xl">
            {state ? `${state.score[0]} – ${state.score[1]}` : "– : –"}
          </div>
          <div className="wc-num mt-0.5 text-xs font-semibold" style={{ color: "var(--wc-text-2)" }}>
            {!state
              ? ""
              : state.phase === "ht"
                ? "Half-time"
                : state.phase === "ft"
                  ? "Full-time"
                  : state.clock}
          </div>
        </div>
        <TeamName id="ARG" align="left" />
      </div>
    </header>
  );
}

function TeamName({ id, align }: { id: "ENG" | "ARG"; align: "left" | "right" }) {
  const team = TEAMS[id];
  const color = id === "ENG" ? "var(--wc-eng)" : "var(--wc-arg)";
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      <span className="text-2xl" aria-hidden>
        {team.flag}
      </span>
      <div>
        <div className="text-sm font-bold sm:text-lg">{team.name}</div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--wc-muted)", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {team.short}
        </div>
      </div>
    </div>
  );
}

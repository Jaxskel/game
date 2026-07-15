import { fetchRealMatch, fetchScoreboardEventId, KNOWN_EVENT_ID, scoreTimeline } from "./espn";
import type { RealMatch } from "./espn";
import { fetchPolymarketProbs, findPolymarketMatch } from "./polymarket";
import type { PolymarketMatch } from "./polymarket";
import { liveProbs } from "./prob";
import type {
  BallState,
  HistoryPoint,
  MatchEvent,
  MatchState,
  Probs,
  Snapshot,
  TeamId,
} from "./types";

const POLL_MS = 10_000;
const PRICE_POLL_MS = 15_000;
/** Give up on the real feed only if it has NEVER produced data. */
const MAX_STARTUP_FAILURES = 4;
const BASE_LAMBDA: Record<TeamId, number> = { ENG: 1.25, ARG: 1.4 };

/**
 * Match engine driven by the real upstream feeds (ESPN commentary/stats,
 * Polymarket prices) instead of a simulation. Exposes the same surface as
 * MatchEngine so the SSE hub can use either interchangeably.
 */
export class LiveEngine {
  readonly simId = 1;

  private eventId: string;
  private match: RealMatch | null = null;
  private poly: PolymarketMatch | null = null;
  private polyProbs: Probs | null = null;

  private probs: Probs = { eng: 33.3, draw: 33.4, arg: 33.3 };
  private history: HistoryPoint[] = [];
  private events: MatchEvent[] = [];
  private pendingEvents: MatchEvent[] = [];
  private pendingHistory: HistoryPoint[] = [];
  private nextEventId = 1;
  private lastMaxSeq = -Infinity;

  private ball: BallState = { x: 50, y: 50 };
  private ballTarget: BallState = { x: 50, y: 50 };

  private sincePoll = POLL_MS; // poll immediately on first advance
  private sincePricePoll = PRICE_POLL_MS;
  private pollInFlight = false;
  private startupFailures = 0;
  private everHadData = false;
  private resyncNeeded = false;
  private lastError = "";
  private pollCount = 0;

  constructor(eventIdOverride?: string) {
    this.eventId = eventIdOverride || KNOWN_EVENT_ID;
    void this.init(Boolean(eventIdOverride));
  }

  /** True when the real feed never came up and the hub should fall back. */
  feedDead(): boolean {
    return !this.everHadData && this.startupFailures >= MAX_STARTUP_FAILURES;
  }

  /** One-shot flag: history was rewritten, clients need a fresh snapshot. */
  consumeResync(): boolean {
    const flag = this.resyncNeeded;
    this.resyncNeeded = false;
    return flag;
  }

  isFinished(): boolean {
    return false; // a real match result stays on screen; never auto-restart
  }

  advance(dtMs: number): void {
    this.moveBall(dtMs);
    this.sincePoll += dtMs;
    this.sincePricePoll += dtMs;
    if (this.sincePoll >= POLL_MS && !this.pollInFlight) {
      this.sincePoll = 0;
      void this.poll();
    }
  }

  drainEvents(): MatchEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  drainHistoryPoint(): HistoryPoint | undefined {
    return this.pendingHistory.shift();
  }

  state(): MatchState {
    const m = this.match;
    const teams = m?.teams;
    const side = (t: TeamId) => {
      const s = teams?.[t];
      return {
        possession: s?.possession ?? 50,
        shots: s?.shots ?? 0,
        shotsOnTarget: s?.shotsOnTarget ?? 0,
        xg: s ? s.shotsOnTarget * 0.33 + Math.max(0, s.shots - s.shotsOnTarget) * 0.06 : 0,
        corners: s?.corners ?? 0,
        fouls: s?.fouls ?? 0,
        yellows: s?.yellows ?? 0,
        reds: s?.reds ?? 0,
        offsides: s?.offsides ?? 0,
        saves: s?.saves ?? 0,
      };
    };
    return {
      simId: this.simId,
      mode: "real",
      oddsSource: this.polyProbs ? "polymarket" : "model",
      statusDetail: m?.statusDetail,
      phase: m?.phase ?? "pre",
      minute: m?.minute ?? 0,
      clock: m?.clock ?? "KO soon",
      score: [teams?.ENG.score ?? 0, teams?.ARG.score ?? 0],
      possession: (teams?.ENG.possession ?? 50) >= (teams?.ARG.possession ?? 50) ? "ENG" : "ARG",
      ball: { ...this.ball },
      stats: { ENG: side("ENG"), ARG: side("ARG") },
      probs: { ...this.probs },
      volume: Math.round(this.poly?.volume ?? 0),
      lastEventId: this.nextEventId - 1,
    };
  }

  snapshot(): Snapshot {
    return {
      kind: "snapshot",
      state: this.state(),
      history: [...this.history],
      events: this.events.slice(-60),
      serverTime: Date.now(),
    };
  }

  debugInfo(): Record<string, unknown> {
    return {
      mode: "real",
      eventId: this.eventId,
      pollCount: this.pollCount,
      everHadData: this.everHadData,
      startupFailures: this.startupFailures,
      feedDead: this.feedDead(),
      lastError: this.lastError || null,
      phase: this.match?.phase ?? null,
      clock: this.match?.clock ?? null,
      score: this.match ? [this.match.teams.ENG.score, this.match.teams.ARG.score] : null,
      eventCount: this.events.length,
      historyPoints: this.history.length,
      lastEventTexts: this.events.slice(-3).map((e) => e.text),
      polymarket: this.poly
        ? { title: this.poly.eventTitle, tokens: Object.keys(this.poly.tokens), live: Boolean(this.polyProbs) }
        : null,
      probs: this.probs,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async init(pinnedEvent: boolean) {
    if (!pinnedEvent) {
      try {
        const found = await fetchScoreboardEventId();
        if (found) this.eventId = found;
      } catch {
        // scoreboard down — keep the known event id
      }
    }
    this.poly = await findPolymarketMatch();
  }

  private async poll() {
    this.pollInFlight = true;
    try {
      const fresh = await fetchRealMatch(this.eventId);
      const first = !this.everHadData;
      this.everHadData = true;
      this.pollCount += 1;
      this.lastError = "";
      this.ingest(fresh, first);

      if (this.sincePricePoll >= PRICE_POLL_MS) {
        this.sincePricePoll = 0;
        if (this.poly) {
          this.polyProbs = await fetchPolymarketProbs(this.poly.tokens);
        }
      }
      this.updateProbs(fresh);
      this.pushHistoryPoint(fresh);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      if (!this.everHadData) this.startupFailures += 1;
    } finally {
      this.pollInFlight = false;
    }
  }

  private ingest(fresh: RealMatch, first: boolean) {
    const newOnes = fresh.events.filter((e) => e.seq > this.lastMaxSeq);
    if (newOnes.length) {
      this.lastMaxSeq = newOnes[newOnes.length - 1].seq;
      for (const e of newOnes) {
        const ev: MatchEvent = {
          id: this.nextEventId++,
          minute: e.minute,
          clock: e.clock || `${e.minute}'`,
          type: e.type,
          team: e.team,
          text: e.text,
        };
        this.events.push(ev);
        if (!first) this.pendingEvents.push(ev); // first batch ships in the snapshot
      }
    }
    if (first) {
      this.backfillHistory(fresh);
      this.resyncNeeded = true;
    }
    this.match = fresh;
    this.retargetBall(fresh);
  }

  /** Reconstruct the chart from kick-off using the real goal/red timeline. */
  private backfillHistory(fresh: RealMatch) {
    const timeline = scoreTimeline(fresh.events);
    const upto = Math.max(1, Math.min(this.chartX(fresh), 90));
    const points: HistoryPoint[] = [];
    for (let m = 0; m <= upto; m += 1) {
      let ge = 0;
      let ga = 0;
      let redsE = 0;
      let redsA = 0;
      for (const item of timeline) {
        if (item.minute > m) break;
        if (item.kind === "goal") {
          if (item.team === "ENG") ge += 1;
          else ga += 1;
        } else if (item.team === "ENG") redsE += 1;
        else redsA += 1;
      }
      const p = liveProbs({
        goalsEng: ge,
        goalsArg: ga,
        minute: m,
        lambdaEng: BASE_LAMBDA.ENG * (1 - 0.28 * redsE),
        lambdaArg: BASE_LAMBDA.ARG * (1 - 0.28 * redsA),
      });
      points.push({ m, e: p.eng, d: p.draw, a: p.arg, ge, ga });
    }
    this.history = points;
  }

  private updateProbs(fresh: RealMatch) {
    const [ge, ga] = [fresh.teams.ENG.score, fresh.teams.ARG.score];
    if (fresh.phase === "ft") {
      // The 90-minute market resolves on the final score.
      this.probs =
        ge > ga ? { eng: 100, draw: 0, arg: 0 }
        : ga > ge ? { eng: 0, draw: 0, arg: 100 }
        : { eng: 0, draw: 100, arg: 0 };
      return;
    }
    if (this.polyProbs) {
      this.probs = { ...this.polyProbs };
      return;
    }
    this.probs = liveProbs({
      goalsEng: ge,
      goalsArg: ga,
      minute: Math.min(fresh.minute, 90),
      lambdaEng: BASE_LAMBDA.ENG * (1 - 0.28 * fresh.teams.ENG.reds),
      lambdaArg: BASE_LAMBDA.ARG * (1 - 0.28 * fresh.teams.ARG.reds),
    });
  }

  /** Monotonic 0..90 chart position for the real clock. */
  private chartX(fresh: RealMatch): number {
    if (fresh.phase === "pre") return 0;
    if (fresh.phase === "ht") return 45;
    if (fresh.phase === "ft") return 90;
    if (fresh.phase === "first") return Math.min(fresh.minute, 45);
    return Math.min(Math.max(fresh.minute, 45), 90);
  }

  private pushHistoryPoint(fresh: RealMatch) {
    const lastX = this.history[this.history.length - 1]?.m ?? 0;
    const m = Math.max(this.chartX(fresh), lastX);
    const point: HistoryPoint = {
      m,
      e: this.probs.eng,
      d: this.probs.draw,
      a: this.probs.arg,
      ge: fresh.teams.ENG.score,
      ga: fresh.teams.ARG.score,
    };
    this.history.push(point);
    this.pendingHistory.push(point);
  }

  /** Ambient ball animation — illustrative only; real feeds carry no ball tracking. */
  private retargetBall(fresh: RealMatch) {
    if (fresh.phase === "pre" || fresh.phase === "ht" || fresh.phase === "ft") {
      this.ballTarget = { x: 50, y: 50 };
      return;
    }
    const latest = fresh.events[fresh.events.length - 1];
    const attacker: TeamId =
      latest?.team ?? ((fresh.teams.ENG.possession >= fresh.teams.ARG.possession) ? "ENG" : "ARG");
    const base = attacker === "ENG" ? 65 : 35;
    this.ballTarget = {
      x: Math.min(96, Math.max(4, base + (Math.random() - 0.5) * 50)),
      y: 10 + Math.random() * 80,
    };
  }

  private moveBall(dtMs: number) {
    const step = (16 * dtMs) / 1000;
    const dx = this.ballTarget.x - this.ball.x;
    const dy = this.ballTarget.y - this.ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < Math.max(step, 2)) {
      this.ballTarget = {
        x: Math.min(96, Math.max(4, this.ball.x + (Math.random() - 0.5) * 40)),
        y: 10 + Math.random() * 80,
      };
      return;
    }
    this.ball.x += (dx / dist) * step;
    this.ball.y += (dy / dist) * step;
  }
}

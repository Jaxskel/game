import { MATCH_INFO, TEAMS, otherTeam } from "./data";
import { liveProbs } from "./prob";
import type {
  BallState,
  HistoryPoint,
  MatchEvent,
  MatchState,
  Phase,
  Probs,
  Snapshot,
  TeamId,
  TeamStats,
} from "./types";

/** One match minute plays out over this many real milliseconds. */
export const MATCH_MINUTE_MS = 2000;
/** Broadcast/tick cadence in real milliseconds. */
export const TICK_MS = 200;
/** Chart samples one point per this many match minutes. */
const HISTORY_STEP_MIN = 0.5;
const HT_HOLD_MS = 8000;
const FT_HOLD_MS = 12000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyStats(): TeamStats {
  return {
    possession: 50,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    offsides: 0,
    saves: 0,
  };
}

/** Per-match-minute base rates for stochastic events, per team. */
const RATES = {
  shot: 0.14,
  offside: 0.045,
  foul: 0.13,
  corner: 0.06,
};
const YELLOW_PER_FOUL = 0.16;
const RED_PER_FOUL = 0.012;

export class MatchEngine {
  readonly simId: number;
  private rand: () => number;

  private phase: Phase = "pre";
  private minute = 0; // fractional match minute
  private holdMs = 2500; // pre-kickoff hold
  private stoppage1: number;
  private stoppage2: number;

  private score: Record<TeamId, number> = { ENG: 0, ARG: 0 };
  private stats: Record<TeamId, TeamStats> = { ENG: emptyStats(), ARG: emptyStats() };
  private possession: TeamId;
  private possessionMs: Record<TeamId, number> = { ENG: 1, ARG: 1 };
  /** Momentum multiplier on each side's scoring rate, drifts 0.7..1.4. */
  private momentum: Record<TeamId, number> = { ENG: 1, ARG: 1 };
  private menOff: Record<TeamId, number> = { ENG: 0, ARG: 0 };
  private subsMade: Record<TeamId, number> = { ENG: 0, ARG: 0 };

  private ball: BallState = { x: 50, y: 50 };
  private ballTarget: BallState = { x: 50, y: 50 };

  private probs: Probs;
  private probNoise = 0;
  private volume: number;

  private events: MatchEvent[] = [];
  private pendingEvents: MatchEvent[] = [];
  private nextEventId = 1;
  private history: HistoryPoint[] = [];
  private nextHistoryAt = 0;

  constructor(seed: number, simId = 1) {
    this.simId = simId;
    this.rand = mulberry32(seed);
    this.possession = this.rand() < 0.5 ? "ENG" : "ARG";
    this.stoppage1 = 1 + Math.floor(this.rand() * 3); // 1..3
    this.stoppage2 = 3 + Math.floor(this.rand() * 4); // 3..6
    this.volume = 38_000_000 + this.rand() * 4_000_000;
    this.probs = this.computeProbs();
    this.pushHistory();
    this.addEvent("info", undefined, undefined,
      `${MATCH_INFO.round} · ${MATCH_INFO.venue}. Teams are out — ${TEAMS.ENG.name} in red, ${TEAMS.ARG.name} in sky blue.`);
  }

  /** True once the FT hold has elapsed and a fresh sim should replace this one. */
  isFinished(): boolean {
    return this.phase === "ft" && this.holdMs <= 0;
  }

  /** Advance the simulation by dtMs of real time. */
  advance(dtMs: number): void {
    if (this.phase === "pre" || this.phase === "ht" || this.phase === "ft") {
      this.holdMs -= dtMs;
      if (this.holdMs <= 0) {
        if (this.phase === "pre") this.kickoff();
        else if (this.phase === "ht") this.startSecondHalf();
        // "ft" stays held; the hub swaps in a new engine via isFinished().
      }
      this.decayNoise(dtMs);
      return;
    }

    const dMin = dtMs / MATCH_MINUTE_MS;
    this.minute += dMin;
    this.possessionMs[this.possession] += dtMs;
    this.volume += dtMs * (20 + this.rand() * 60); // ~$20-80k/s traded

    this.driftMomentum(dMin);
    this.maybeSwitchPossession(dMin);
    this.moveBall(dtMs);
    this.rollEvents(dMin);
    this.decayNoise(dtMs);

    // Half / full-time boundaries.
    if (this.phase === "first" && this.minute >= 45 + this.stoppage1) {
      this.phase = "ht";
      this.holdMs = HT_HOLD_MS;
      this.minute = 45;
      this.addEvent("half_time", undefined, undefined,
        `HALF-TIME — ${this.scoreLine()}.`);
    } else if (this.phase === "second" && this.minute >= 90 + this.stoppage2) {
      this.phase = "ft";
      this.holdMs = FT_HOLD_MS;
      this.minute = 90;
      this.settleMarket();
    }

    if (this.phase !== "ft") {
      // settleMarket() already pinned the resolved 100/0/0 prices.
      this.probs = this.computeProbs();
      if (this.minute >= this.nextHistoryAt) this.pushHistory();
    }
  }

  /** Events generated since the last drain; clears the buffer. */
  drainEvents(): MatchEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  /** History point sampled since last drain, if any. */
  drainHistoryPoint(): HistoryPoint | undefined {
    if (this.lastDrainedHistory === this.history.length) return undefined;
    this.lastDrainedHistory = this.history.length;
    return this.history[this.history.length - 1];
  }
  private lastDrainedHistory = 1;

  /**
   * Monotonic chart position 0..90: stoppage time is compressed into its
   * half so the probability tape never runs backwards at 45+3' → 46'.
   */
  private chartX(): number {
    if (this.phase === "pre") return 0;
    if (this.phase === "ht") return 45;
    if (this.phase === "ft") return 90;
    if (this.phase === "first") {
      return Math.min(45, (this.minute / (45 + this.stoppage1)) * 45);
    }
    return Math.min(90, 45 + ((this.minute - 45) / (45 + this.stoppage2)) * 45);
  }

  state(): MatchState {
    const posTotal = this.possessionMs.ENG + this.possessionMs.ARG;
    const engPos = Math.round((this.possessionMs.ENG / posTotal) * 100);
    this.stats.ENG.possession = engPos;
    this.stats.ARG.possession = 100 - engPos;
    return {
      simId: this.simId,
      mode: "sim",
      oddsSource: "model",
      phase: this.phase,
      minute: this.minute,
      clock: this.clockLabel(),
      score: [this.score.ENG, this.score.ARG],
      possession: this.possession,
      ball: { ...this.ball },
      stats: {
        ENG: { ...this.stats.ENG },
        ARG: { ...this.stats.ARG },
      },
      probs: { ...this.probs },
      volume: Math.round(this.volume),
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

  // ── internals ────────────────────────────────────────────────────────────

  private kickoff() {
    this.phase = "first";
    this.minute = 0;
    this.ball = { x: 50, y: 50 };
    this.addEvent("kickoff", this.possession, undefined,
      `KICK-OFF — ${TEAMS[this.possession].name} get us under way in Atlanta.`);
  }

  private startSecondHalf() {
    this.phase = "second";
    this.minute = 45;
    this.possession = otherTeam(this.possession);
    this.ball = { x: 50, y: 50 };
    this.ballTarget = { x: 50, y: 50 };
    this.addEvent("second_half", undefined, undefined,
      `SECOND HALF — back under way. ${this.scoreLine()}.`);
  }

  private settleMarket() {
    const [e, a] = [this.score.ENG, this.score.ARG];
    const outcome = e > a ? "England" : a > e ? "Argentina" : "Draw";
    this.probs =
      e > a ? { eng: 100, draw: 0, arg: 0 }
      : a > e ? { eng: 0, draw: 0, arg: 100 }
      : { eng: 0, draw: 100, arg: 0 };
    this.history.push({
      m: 90, e: this.probs.eng, d: this.probs.draw, a: this.probs.arg,
      ge: e, ga: a,
    });
    this.addEvent("full_time", undefined, undefined,
      `FULL-TIME — ${this.scoreLine()}. Market resolves ${outcome.toUpperCase()}.` +
      (e === a ? " (Extra time ahead — 90-minute market settles as a draw.)" : ""));
  }

  private clockLabel(): string {
    if (this.phase === "pre") return "KO soon";
    if (this.phase === "ht") return "HT";
    if (this.phase === "ft") return "FT";
    const base = this.phase === "first" ? 45 : 90;
    const m = Math.floor(this.minute);
    if (m >= base) return `${base}+${Math.max(1, m - base + 1)}'`;
    return `${m + 1}'`;
  }

  private scoreLine(): string {
    return `England ${this.score.ENG}–${this.score.ARG} Argentina`;
  }

  private computeProbs(): Probs {
    const lambdaFor = (t: TeamId) =>
      TEAMS[t].baseLambda * this.momentum[t] * (1 - 0.28 * this.menOff[t]);
    const p = liveProbs({
      goalsEng: this.score.ENG,
      goalsArg: this.score.ARG,
      minute: this.phase === "pre" ? 0 : Math.min(this.minute, 90),
      lambdaEng: lambdaFor("ENG"),
      lambdaArg: lambdaFor("ARG"),
    });
    // Small market jitter so the tape breathes between events; renormalized.
    const j = this.probNoise;
    let eng = Math.max(0.5, p.eng * (1 + j));
    let arg = Math.max(0.5, p.arg * (1 - j));
    let draw = Math.max(0.5, p.draw);
    const total = eng + arg + draw;
    eng = (eng / total) * 100;
    arg = (arg / total) * 100;
    draw = (draw / total) * 100;
    return { eng, draw, arg };
  }

  private decayNoise(dtMs: number) {
    this.probNoise *= Math.pow(0.5, dtMs / 4000);
    if (this.rand() < dtMs / 2500) {
      this.probNoise += (this.rand() - 0.5) * 0.05;
    }
  }

  private driftMomentum(dMin: number) {
    for (const t of ["ENG", "ARG"] as TeamId[]) {
      const drift = (this.rand() - 0.5) * 0.12 * dMin;
      const pull = (1 - this.momentum[t]) * 0.04 * dMin;
      this.momentum[t] = Math.min(1.4, Math.max(0.7, this.momentum[t] + drift + pull));
    }
  }

  private maybeSwitchPossession(dMin: number) {
    // Possession flips roughly every 0.8 match minutes, tilted by momentum.
    const holder = this.possession;
    const rival = otherTeam(holder);
    const flipRate = 1.25 * (this.momentum[rival] / this.momentum[holder]);
    if (this.rand() < flipRate * dMin) {
      this.possession = rival;
      this.retargetBall();
    }
  }

  private retargetBall() {
    const attackingRight = this.possession === "ENG";
    const bias = 18 + this.rand() * 55; // distance up-field of the new target
    const x = attackingRight
      ? Math.min(97, this.ball.x + bias * this.rand())
      : Math.max(3, this.ball.x - bias * this.rand());
    this.ballTarget = { x, y: 8 + this.rand() * 84 };
  }

  private moveBall(dtMs: number) {
    const speed = 22 + this.rand() * 30; // pitch units / second
    const step = (speed * dtMs) / 1000;
    const dx = this.ballTarget.x - this.ball.x;
    const dy = this.ballTarget.y - this.ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < Math.max(step, 3)) {
      this.retargetBall();
    } else {
      this.ball.x += (dx / dist) * step + (this.rand() - 0.5) * 0.6;
      this.ball.y += (dy / dist) * step + (this.rand() - 0.5) * 0.6;
    }
    this.ball.x = Math.min(99, Math.max(1, this.ball.x));
    this.ball.y = Math.min(99, Math.max(1, this.ball.y));
  }

  private rollEvents(dMin: number) {
    for (const t of ["ENG", "ARG"] as TeamId[]) {
      const atk = this.momentum[t] * (this.possession === t ? 1.5 : 0.5) * (1 - 0.25 * this.menOff[t]);
      if (this.rand() < RATES.shot * atk * dMin) this.shot(t);
      if (this.rand() < RATES.offside * atk * dMin) this.offside(t);
      if (this.rand() < RATES.foul * dMin) this.foul(t);
      if (this.rand() < RATES.corner * atk * dMin) this.corner(t);
    }
    this.maybeSub();
  }

  private pick(names: { name: string; weight: number }[]): string {
    const total = names.reduce((s, n) => s + n.weight, 0);
    let r = this.rand() * total;
    for (const n of names) {
      r -= n.weight;
      if (r <= 0) return n.name;
    }
    return names[names.length - 1].name;
  }

  private pickPlayer(t: TeamId): string {
    const roster = TEAMS[t].players;
    return roster[Math.floor(this.rand() * roster.length)];
  }

  private shot(t: TeamId) {
    const team = TEAMS[t];
    const shooter = this.pick(team.scorers);
    const xg = 0.04 + Math.pow(this.rand(), 2) * 0.45;
    this.stats[t].shots += 1;
    this.stats[t].xg += xg;
    this.momentum[t] = Math.min(1.4, this.momentum[t] + 0.05);
    this.ball = { x: t === "ENG" ? 88 + this.rand() * 8 : 4 + this.rand() * 8, y: 35 + this.rand() * 30 };

    if (this.rand() < xg) {
      // Goal — with a small chance VAR chalks it off for offside.
      if (this.rand() < 0.09) {
        this.stats[t].shotsOnTarget += 1;
        this.addEvent("var", t, shooter,
          `VAR CHECK — possible offside in the build-up as ${shooter} scores for ${team.name}…`);
        this.stats[t].offsides += 1;
        this.addEvent("disallowed", t, shooter,
          `NO GOAL — OFFSIDE. ${team.name}: ${shooter}'s finish is ruled out by VAR. Still ${this.scoreLine()}.`);
        return;
      }
      this.score[t] += 1;
      this.stats[t].shotsOnTarget += 1;
      this.probNoise = 0;
      this.momentum[t] = Math.min(1.4, this.momentum[t] + 0.15);
      this.ball = { x: 50, y: 50 };
      this.ballTarget = { x: 50, y: 50 };
      this.possession = otherTeam(t);
      this.addEvent("goal", t, shooter,
        `GOAL! ${team.name}: ${shooter} scores! ${this.scoreLine()}.`,
        [this.score.ENG, this.score.ARG]);
      return;
    }

    const roll = this.rand();
    if (roll < 0.38) {
      this.stats[t].shotsOnTarget += 1;
      const gk = TEAMS[otherTeam(t)].keeper;
      this.stats[otherTeam(t)].saves += 1;
      this.addEvent("save", t, shooter,
        `SAVE — ${team.name}: ${shooter}'s effort on target, ${gk} keeps it out.`);
    } else if (roll < 0.68) {
      this.addEvent("shot_off_target", t, shooter,
        `CHANCE — ${team.name}: ${shooter} shoots wide of ${TEAMS[otherTeam(t)].keeper}'s goal.`);
    } else {
      this.addEvent("shot_blocked", t, shooter,
        `BLOCK — ${team.name}: ${shooter}'s strike is blocked in the box.`);
      if (this.rand() < 0.5) this.corner(t, true);
    }
  }

  private offside(t: TeamId) {
    const player = this.pick(TEAMS[t].scorers);
    this.stats[t].offsides += 1;
    this.addEvent("offside", t, player,
      `OFFSIDE — ${TEAMS[t].name}: ${player} is flagged offside.`);
    this.possession = otherTeam(t);
  }

  private foul(t: TeamId) {
    const player = this.pickPlayer(t);
    this.stats[t].fouls += 1;
    const r = this.rand();
    if (r < RED_PER_FOUL) {
      this.stats[t].reds += 1;
      this.menOff[t] += 1;
      this.addEvent("red", t, player,
        `RED CARD — ${TEAMS[t].name}: ${player} is sent off! Down to ${11 - this.menOff[t]} men.`);
    } else if (r < RED_PER_FOUL + YELLOW_PER_FOUL) {
      this.stats[t].yellows += 1;
      this.addEvent("yellow", t, player,
        `YELLOW CARD — ${TEAMS[t].name}: ${player} is booked for the foul.`);
    } else if (this.rand() < 0.3) {
      this.addEvent("foul", t, player,
        `FOUL — ${TEAMS[t].name}: ${player} concedes a free kick.`);
    }
    this.possession = otherTeam(t);
  }

  private corner(t: TeamId, silentChance = false) {
    this.stats[t].corners += 1;
    this.ball = { x: t === "ENG" ? 98 : 2, y: this.rand() < 0.5 ? 2 : 98 };
    if (!silentChance || this.rand() < 0.6) {
      this.addEvent("corner", t, undefined,
        `CORNER — ${TEAMS[t].name} win a corner.`);
    }
    this.possession = t;
  }

  private maybeSub() {
    for (const t of ["ENG", "ARG"] as TeamId[]) {
      const windows = [58, 72, 84];
      const due = windows[this.subsMade[t]];
      if (due !== undefined && this.minute >= due + this.rand() * 4 && this.phase === "second") {
        const on = TEAMS[t].bench[this.subsMade[t] % TEAMS[t].bench.length];
        const off = this.pickPlayer(t);
        this.subsMade[t] += 1;
        this.addEvent("sub", t, on,
          `SUBSTITUTION — ${TEAMS[t].name}: ${on} replaces ${off}.`);
      }
    }
  }

  private pushHistory() {
    this.history.push({
      m: this.chartX(),
      e: this.probs.eng,
      d: this.probs.draw,
      a: this.probs.arg,
      ge: this.score.ENG,
      ga: this.score.ARG,
    });
    this.nextHistoryAt = this.minute + HISTORY_STEP_MIN;
  }

  private addEvent(
    type: MatchEvent["type"],
    team: TeamId | undefined,
    player: string | undefined,
    text: string,
    score?: [number, number],
  ) {
    const ev: MatchEvent = {
      id: this.nextEventId++,
      minute: this.minute,
      clock: this.clockLabel(),
      type,
      team,
      player,
      text,
      score,
    };
    this.events.push(ev);
    this.pendingEvents.push(ev);
    // Probability tape reacts a touch to dangerous moments.
    if (type === "save" || type === "corner") {
      const dir = team === "ENG" ? 1 : -1;
      this.probNoise += dir * 0.02;
    }
  }
}

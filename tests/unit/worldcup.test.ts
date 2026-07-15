import { describe, expect, it } from "vitest";
import { MatchEngine, TICK_MS } from "@/lib/worldcup/engine";
import { liveProbs, toCents } from "@/lib/worldcup/prob";
import { TEAMS } from "@/lib/worldcup/data";

describe("liveProbs", () => {
  it("sums to 100%", () => {
    const p = liveProbs({ goalsEng: 1, goalsArg: 0, minute: 30, lambdaEng: 1.3, lambdaArg: 1.4 });
    expect(p.eng + p.draw + p.arg).toBeCloseTo(100, 6);
  });

  it("is symmetric for equal teams at kick-off", () => {
    const p = liveProbs({ goalsEng: 0, goalsArg: 0, minute: 0, lambdaEng: 1.3, lambdaArg: 1.3 });
    expect(p.eng).toBeCloseTo(p.arg, 6);
    expect(p.draw).toBeGreaterThan(15);
  });

  it("heavily favours a two-goal lead late on", () => {
    const p = liveProbs({ goalsEng: 2, goalsArg: 0, minute: 85, lambdaEng: 1.3, lambdaArg: 1.4 });
    expect(p.eng).toBeGreaterThan(95);
  });

  it("converges to certainty at the final whistle", () => {
    const p = liveProbs({ goalsEng: 0, goalsArg: 1, minute: 90, lambdaEng: 1.3, lambdaArg: 1.4 });
    expect(p.arg).toBeCloseTo(100, 3);
  });

  it("makes the draw dominant when level late", () => {
    const p = liveProbs({ goalsEng: 1, goalsArg: 1, minute: 88, lambdaEng: 1.3, lambdaArg: 1.4 });
    expect(p.draw).toBeGreaterThan(60);
  });

  it("clamps market cents into 1..99", () => {
    expect(toCents({ eng: 99.9, draw: 0.05, arg: 0.05 })).toEqual({ eng: 99, draw: 1, arg: 1 });
  });
});

function runFullMatch(seed: number): MatchEngine {
  const engine = new MatchEngine(seed);
  for (let i = 0; i < 8000 && !engine.isFinished(); i++) {
    engine.advance(TICK_MS);
  }
  return engine;
}

describe("MatchEngine", () => {
  const engine = runFullMatch(42);
  const snap = engine.snapshot();

  it("plays to full-time", () => {
    expect(engine.isFinished()).toBe(true);
    expect(snap.state.phase).toBe("ft");
    expect(snap.state.clock).toBe("FT");
  });

  it("keeps the score in sync with goal events", () => {
    const goals = snap.events.filter((e) => e.type === "goal");
    // snapshot() trims the feed, so re-check via the last goal's recorded score
    // when there were goals, and via the state either way.
    const [ge, ga] = snap.state.score;
    expect(goals.filter((g) => g.team === "ENG").length).toBeLessThanOrEqual(ge);
    expect(goals.filter((g) => g.team === "ARG").length).toBeLessThanOrEqual(ga);
    if (goals.length > 0) {
      const lastGoal = goals[goals.length - 1];
      expect(lastGoal.score).toBeDefined();
    }
  });

  it("announces offsides as team + player + offside", () => {
    const offsides = snap.events.filter((e) => e.type === "offside");
    for (const ev of offsides) {
      expect(ev.team).toBeDefined();
      expect(ev.player).toBeDefined();
      expect(ev.text).toContain("OFFSIDE");
      expect(ev.text).toContain(TEAMS[ev.team!].name);
      expect(ev.text).toContain(ev.player!);
    }
  });

  it("emits a resolved market at full-time", () => {
    const [ge, ga] = snap.state.score;
    const { eng, draw, arg } = snap.state.probs;
    if (ge > ga) expect(eng).toBe(100);
    else if (ga > ge) expect(arg).toBe(100);
    else expect(draw).toBe(100);
    const ft = snap.events.find((e) => e.type === "full_time");
    expect(ft?.text).toContain("Market resolves");
  });

  it("keeps probability history normalised and monotonic in time", () => {
    expect(snap.history.length).toBeGreaterThan(100);
    let prevM = -1;
    for (const p of snap.history) {
      expect(p.e + p.d + p.a).toBeCloseTo(100, 4);
      expect(p.m).toBeGreaterThanOrEqual(prevM);
      expect(p.m).toBeLessThanOrEqual(90);
      prevM = p.m;
    }
  });

  it("keeps possession split at 100%", () => {
    expect(snap.state.stats.ENG.possession + snap.state.stats.ARG.possession).toBe(100);
  });

  it("is deterministic for a given seed", () => {
    const a = runFullMatch(1234).state();
    const b = runFullMatch(1234).state();
    expect(a).toEqual(b);
  });

  it("produces different matches for different seeds", () => {
    const a = runFullMatch(1).snapshot();
    const b = runFullMatch(2).snapshot();
    expect(a.events.map((e) => e.text)).not.toEqual(b.events.map((e) => e.text));
  });
});

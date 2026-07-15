import { describe, expect, it } from "vitest";
import {
  classifyCommentary,
  parseClockMinute,
  pickEventFromScoreboard,
  scoreTimeline,
  transformSummary,
} from "@/lib/worldcup/espn";

/** Synthetic payload in ESPN's summary shape (mirrors their public soccer API). */
const SUMMARY_FIXTURE = {
  header: {
    competitions: [
      {
        date: "2026-07-15T19:00Z",
        status: {
          displayClock: "63'",
          period: 2,
          type: { state: "in", completed: false, detail: "Second Half", shortDetail: "63'" },
        },
        competitors: [
          { homeAway: "home", score: "1", team: { abbreviation: "ENG", displayName: "England" } },
          { homeAway: "away", score: "2", team: { abbreviation: "ARG", displayName: "Argentina" } },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      {
        team: { abbreviation: "ENG" },
        statistics: [
          { name: "possessionPct", displayValue: "42.0" },
          { name: "totalShots", displayValue: "9" },
          { name: "shotsOnTarget", displayValue: "4" },
          { name: "wonCorners", displayValue: "3" },
          { name: "offsides", displayValue: "2" },
          { name: "foulsCommitted", displayValue: "7" },
          { name: "saves", displayValue: "5" },
        ],
      },
      {
        team: { abbreviation: "ARG" },
        statistics: [
          { name: "possessionPct", displayValue: "58.0" },
          { name: "totalShots", displayValue: "13" },
          { name: "shotsOnTarget", displayValue: "7" },
          { name: "wonCorners", displayValue: "5" },
          { name: "offsides", displayValue: "1" },
          { name: "foulsCommitted", displayValue: "9" },
          { name: "saves", displayValue: "3" },
        ],
      },
    ],
  },
  commentary: [
    { sequence: 100, time: { displayValue: "1'" }, text: "First Half begins." },
    { sequence: 250, time: { displayValue: "23'" }, text: "Goal! England 1, Argentina 0. Harry Kane (England) right footed shot from the centre of the box." },
    { sequence: 300, time: { displayValue: "34'" }, text: "Offside, England. Jude Bellingham tries a through ball, but Harry Kane is caught offside." },
    { sequence: 410, time: { displayValue: "45'+2'" }, text: "Goal! England 1, Argentina 1. Lionel Messi (Argentina) converts the penalty with a right footed shot." },
    { sequence: 520, time: { displayValue: "58'" }, text: "Declan Rice (England) is shown the yellow card for a bad foul." },
    { sequence: 600, time: { displayValue: "61'" }, text: "Goal! England 1, Argentina 2. Julián Álvarez (Argentina) left footed shot from outside the box." },
  ],
};

describe("parseClockMinute", () => {
  it("parses plain and stoppage clocks", () => {
    expect(parseClockMinute("63'")).toBe(63);
    expect(parseClockMinute("45'+2'")).toBe(47);
    expect(parseClockMinute("HT")).toBe(45);
    expect(parseClockMinute(undefined)).toBe(0);
  });
});

describe("classifyCommentary", () => {
  it("recognises the key event types", () => {
    expect(classifyCommentary("Goal! England 1, Argentina 0. Harry Kane scores.")).toBe("goal");
    expect(classifyCommentary("Offside, Argentina. Lionel Messi is caught offside.")).toBe("offside");
    expect(classifyCommentary("Declan Rice is shown the yellow card.")).toBe("yellow");
    expect(classifyCommentary("Second yellow! Red card for Romero.")).toBe("red");
    expect(classifyCommentary("Corner, England. Conceded by Otamendi.")).toBe("corner");
    expect(classifyCommentary("Attempt saved. Bukayo Saka's shot is saved.")).toBe("save");
    expect(classifyCommentary("Substitution, England. Ollie Watkins replaces Harry Kane.")).toBe("sub");
  });
});

describe("transformSummary", () => {
  const match = transformSummary(SUMMARY_FIXTURE, "760515");

  it("reads score, clock and phase", () => {
    expect(match.teams.ENG.score).toBe(1);
    expect(match.teams.ARG.score).toBe(2);
    expect(match.phase).toBe("second");
    expect(match.minute).toBe(63);
    expect(match.clock).toBe("63'");
  });

  it("reads and normalises the box-score stats", () => {
    expect(match.teams.ENG.possession + match.teams.ARG.possession).toBe(100);
    expect(match.teams.ARG.shots).toBe(13);
    expect(match.teams.ENG.offsides).toBe(2);
    expect(match.teams.ENG.saves).toBe(5);
  });

  it("turns commentary into typed events with team attribution", () => {
    const offside = match.events.find((e) => e.type === "offside");
    expect(offside?.team).toBe("ENG");
    expect(offside?.text).toContain("England");
    expect(offside?.text).toContain("Kane is caught offside");
    const yellow = match.events.find((e) => e.type === "yellow");
    expect(yellow?.team).toBe("ENG");
    expect(match.events.filter((e) => e.type === "goal")).toHaveLength(3);
  });

  it("counts cards from commentary when the box score lacks them", () => {
    expect(match.teams.ENG.yellows).toBe(1);
    expect(match.teams.ARG.yellows).toBe(0);
  });

  it("builds a sorted goal timeline for chart backfill", () => {
    const timeline = scoreTimeline(match.events);
    expect(timeline.map((t) => [t.minute, t.team])).toEqual([
      [23, "ENG"],
      [47, "ARG"],
      [61, "ARG"],
    ]);
  });

  it("degrades to defaults instead of throwing on junk payloads", () => {
    const junk = transformSummary({ nothing: true }, "x");
    expect(junk.phase).toBe("pre");
    expect(junk.teams.ENG.score).toBe(0);
    expect(junk.events).toEqual([]);
    expect(transformSummary(null, "x").teams.ARG.possession).toBe(50);
  });
});

describe("pickEventFromScoreboard", () => {
  it("finds the England v Argentina event", () => {
    const scoreboard = {
      events: [
        {
          id: "111",
          status: { type: { state: "post" } },
          competitions: [{ competitors: [{ team: { abbreviation: "FRA" } }, { team: { abbreviation: "ESP" } }] }],
        },
        {
          id: "760515",
          status: { type: { state: "in" } },
          competitions: [{ competitors: [{ team: { abbreviation: "ENG" } }, { team: { abbreviation: "ARG" } }] }],
        },
      ],
    };
    expect(pickEventFromScoreboard(scoreboard)).toBe("760515");
  });

  it("falls back to any live event, then undefined", () => {
    const liveOnly = {
      events: [
        {
          id: "222",
          status: { type: { state: "in" } },
          competitions: [{ competitors: [{ team: { abbreviation: "FRA" } }, { team: { abbreviation: "ESP" } }] }],
        },
      ],
    };
    expect(pickEventFromScoreboard(liveOnly)).toBe("222");
    expect(pickEventFromScoreboard({ events: [] })).toBeUndefined();
    expect(pickEventFromScoreboard(null)).toBeUndefined();
  });
});

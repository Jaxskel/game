import type { EventType, Phase, TeamId } from "./types";

/**
 * ESPN's public (unauthenticated) soccer JSON feed for the FIFA World Cup.
 * Docs are unofficial; every read below is defensive — any missing field
 * degrades to a sane default instead of throwing.
 */
const LEAGUE = "fifa.world";
const SCOREBOARD_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard`;
const SUMMARY_URL = (eventId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/summary?event=${eventId}`;
/** England v Argentina, 2026-07-15 semi-final (from espn.com match page). */
export const KNOWN_EVENT_ID = "760515";

const FETCH_TIMEOUT_MS = 8000;

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RealTeamSide {
  score: number;
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  offsides: number;
  fouls: number;
  saves: number;
  yellows: number;
  reds: number;
}

export interface RealEvent {
  /** Upstream ordering key (commentary sequence). */
  seq: number;
  clock: string;
  minute: number;
  type: EventType;
  team?: TeamId;
  text: string;
}

export interface RealMatch {
  eventId: string;
  phase: Phase;
  statusDetail: string;
  clock: string;
  minute: number;
  completed: boolean;
  teams: Record<TeamId, RealTeamSide>;
  events: RealEvent[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** "45'+2'" | "63'" | "HT" → minutes played (63, 47, …). */
export function parseClockMinute(display: string | undefined, period = 0): number {
  if (!display) return 0;
  const parts = display.match(/\d+/g);
  if (!parts || parts.length === 0) {
    return display.toUpperCase().includes("HT") ? 45 : 0;
  }
  return parts.reduce((s, p) => s + parseInt(p, 10), 0) || (period >= 2 ? 45 : 0);
}

function abbrevToTeam(abbrev: string | undefined): TeamId | undefined {
  const a = (abbrev ?? "").toUpperCase();
  if (a === "ENG" || a.startsWith("ENGLAND")) return "ENG";
  if (a === "ARG" || a.startsWith("ARGENTINA")) return "ARG";
  return undefined;
}

/** Find the England–Argentina (or any live) World Cup event id on the scoreboard. */
export function pickEventFromScoreboard(scoreboard: any): string | undefined {
  const events: any[] = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  const hasEngArg = (ev: any) => {
    const comps = ev?.competitions?.[0]?.competitors ?? [];
    const ids = comps.map((c: any) => abbrevToTeam(c?.team?.abbreviation ?? c?.team?.displayName));
    return ids.includes("ENG") && ids.includes("ARG");
  };
  const engArg = events.find(hasEngArg);
  if (engArg?.id) return String(engArg.id);
  const live = events.find((ev) => ev?.status?.type?.state === "in");
  if (live?.id) return String(live.id);
  return undefined;
}

const STAT_KEYS: Record<string, keyof RealTeamSide> = {
  possessionpct: "possession",
  totalshots: "shots",
  shotsontarget: "shotsOnTarget",
  woncorners: "corners",
  offsides: "offsides",
  foulscommitted: "fouls",
  saves: "saves",
  yellowcards: "yellows",
  redcards: "reds",
};

function emptySide(): RealTeamSide {
  return {
    score: 0,
    possession: 50,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    offsides: 0,
    fouls: 0,
    saves: 0,
    yellows: 0,
    reds: 0,
  };
}

/** Keyword classification of a live-commentary line. */
export function classifyCommentary(text: string): EventType {
  const t = text.toLowerCase();
  if (t.includes("own goal")) return "goal";
  if (/\bgoal!|scores|converts the penalty/.test(t) && !t.includes("no goal")) return "goal";
  if (t.includes("disallowed") || t.includes("no goal") || t.includes("ruled out")) return "disallowed";
  if (t.includes("offside")) return "offside";
  if (t.includes("video review") || t.includes("var")) return "var";
  if (t.includes("red card") || t.includes("second yellow")) return "red";
  if (t.includes("yellow card") || t.includes("booked") || t.includes("booking")) return "yellow";
  if (t.includes("corner")) return "corner";
  if (t.includes("attempt saved") || t.includes("save")) return "save";
  if (t.includes("attempt missed") || t.includes("misses") || t.includes("shot") || t.includes("hits the bar") || t.includes("post")) return "shot_off_target";
  if (t.includes("attempt blocked") || t.includes("blocked")) return "shot_blocked";
  if (t.includes("substitution") || t.includes("replaces")) return "sub";
  if (t.includes("foul") || t.includes("free kick")) return "foul";
  if (t.includes("half-time") || t.includes("halftime") || t.includes("first half ends")) return "half_time";
  if (t.includes("second half begins") || t.includes("second half kicks")) return "second_half";
  if (t.includes("full-time") || t.includes("match ends") || t.includes("second half ends")) return "full_time";
  if (t.includes("kicks off") || t.includes("kick-off") || t.includes("first half begins")) return "kickoff";
  return "info";
}

function teamInText(text: string): TeamId | undefined {
  // Goal/card lines carry the acting player's team in parentheses:
  // "Goal! England 1, Argentina 1. Lionel Messi (Argentina) converts…"
  if (text.includes("(England)")) return "ENG";
  if (text.includes("(Argentina)")) return "ARG";
  const eng = text.includes("England");
  const arg = text.includes("Argentina");
  if (eng && !arg) return "ENG";
  if (arg && !eng) return "ARG";
  // "Offside, England. …" — the attributed team is the one named first.
  if (eng && arg) return text.indexOf("England") < text.indexOf("Argentina") ? "ENG" : "ARG";
  return undefined;
}

/** Transform an ESPN summary payload into our RealMatch. Pure; never throws on shape drift. */
export function transformSummary(summary: any, eventId: string): RealMatch {
  const comp = summary?.header?.competitions?.[0] ?? {};
  const statusType = comp?.status?.type ?? {};
  const stateStr: string = statusType?.state ?? "pre";
  const completed: boolean = Boolean(statusType?.completed);
  const period: number = num(comp?.status?.period, 0);
  const displayClock: string = comp?.status?.displayClock ?? "";
  const statusDetail: string = statusType?.shortDetail ?? statusType?.detail ?? "";

  const teams: Record<TeamId, RealTeamSide> = { ENG: emptySide(), ARG: emptySide() };

  for (const c of comp?.competitors ?? []) {
    const id = abbrevToTeam(c?.team?.abbreviation ?? c?.team?.displayName);
    if (!id) continue;
    teams[id].score = num(c?.score, 0);
  }

  for (const t of summary?.boxscore?.teams ?? []) {
    const id = abbrevToTeam(t?.team?.abbreviation ?? t?.team?.displayName);
    if (!id) continue;
    for (const stat of t?.statistics ?? []) {
      const key = STAT_KEYS[String(stat?.name ?? "").toLowerCase()];
      if (key) teams[id][key] = num(stat?.displayValue ?? stat?.value, teams[id][key]);
    }
  }
  // Normalise possession to a 0..100 pair.
  const posSum = teams.ENG.possession + teams.ARG.possession;
  if (posSum > 0) {
    teams.ENG.possession = Math.round((teams.ENG.possession / posSum) * 100);
    teams.ARG.possession = 100 - teams.ENG.possession;
  }

  // Live commentary → typed events (ascending by sequence).
  const rawCommentary: any[] = Array.isArray(summary?.commentary) ? summary.commentary : [];
  const events: RealEvent[] = rawCommentary
    .map((c: any, i: number) => {
      const text: string = String(c?.text ?? "").trim();
      const clock: string = c?.time?.displayValue ?? "";
      return {
        seq: num(c?.sequence, i + 1),
        clock,
        minute: parseClockMinute(clock),
        type: classifyCommentary(text),
        team: teamInText(text),
        text,
      };
    })
    .filter((e) => e.text.length > 0)
    .sort((a, b) => a.seq - b.seq);

  // Cards frequently only exist in commentary — reconcile if boxscore had none.
  for (const id of ["ENG", "ARG"] as TeamId[]) {
    if (teams[id].yellows === 0)
      teams[id].yellows = events.filter((e) => e.type === "yellow" && e.team === id).length;
    if (teams[id].reds === 0)
      teams[id].reds = events.filter((e) => e.type === "red" && e.team === id).length;
  }

  const phase: Phase =
    stateStr === "pre" ? "pre"
    : stateStr === "post" ? "ft"
    : statusDetail.toUpperCase().includes("HT") || statusDetail.toLowerCase().includes("half-time") ? "ht"
    : period >= 2 ? "second"
    : "first";

  const minute =
    phase === "ft" ? 90
    : phase === "ht" ? 45
    : Math.min(parseClockMinute(displayClock, period), 120);

  return {
    eventId,
    phase,
    statusDetail,
    clock: phase === "ft" ? "FT" : phase === "ht" ? "HT" : displayClock || `${minute}'`,
    minute,
    completed,
    teams,
    events,
  };
}

/** Goal/red-card timeline used to reconstruct the pre-connect chart history. */
export function scoreTimeline(events: RealEvent[]): { minute: number; team: TeamId; kind: "goal" | "red" }[] {
  return events
    .filter((e): e is RealEvent & { team: TeamId } => Boolean(e.team) && (e.type === "goal" || e.type === "red"))
    .map((e) => ({ minute: e.minute, team: e.team, kind: e.type === "goal" ? ("goal" as const) : ("red" as const) }))
    .sort((a, b) => a.minute - b.minute);
}

export async function fetchScoreboardEventId(): Promise<string | undefined> {
  const scoreboard = await fetchJson(SCOREBOARD_URL);
  return pickEventFromScoreboard(scoreboard);
}

export async function fetchRealMatch(eventId: string): Promise<RealMatch> {
  const summary = await fetchJson(SUMMARY_URL(eventId));
  return transformSummary(summary, eventId);
}

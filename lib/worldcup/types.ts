export type TeamId = "ENG" | "ARG";

export type EventType =
  | "kickoff"
  | "goal"
  | "disallowed"
  | "shot_on_target"
  | "shot_off_target"
  | "shot_blocked"
  | "big_chance"
  | "save"
  | "corner"
  | "foul"
  | "yellow"
  | "red"
  | "offside"
  | "sub"
  | "var"
  | "half_time"
  | "second_half"
  | "full_time"
  | "info";

export interface MatchEvent {
  id: number;
  /** Match minute the event happened (e.g. 47 during first-half stoppage). */
  minute: number;
  /** Display clock, e.g. "45+2'". */
  clock: string;
  type: EventType;
  team?: TeamId;
  player?: string;
  /** Full commentary line, e.g. "OFFSIDE — England: Kane is flagged offside." */
  text: string;
  /** Score after the event, for goal rows. */
  score?: [number, number];
}

export interface TeamStats {
  possession: number; // percent 0..100
  shots: number;
  shotsOnTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  offsides: number;
  saves: number;
}

export type Phase = "pre" | "first" | "ht" | "second" | "ft";

export interface BallState {
  /** Pitch coords: x 0..100 (England attack toward 100), y 0..100. */
  x: number;
  y: number;
}

export interface Probs {
  /** Percentages, sum to ~100. */
  eng: number;
  draw: number;
  arg: number;
}

export interface HistoryPoint {
  /** Match minute, fractional. */
  m: number;
  e: number;
  d: number;
  a: number;
  /** Score at that moment. */
  ge: number;
  ga: number;
}

export interface MatchState {
  simId: number;
  /** "real" = live upstream feed; "sim" = simulated fallback. */
  mode: "real" | "sim";
  /** Where the market prices come from. */
  oddsSource: "polymarket" | "model";
  /** Human status line from the real feed, e.g. "FT" or "2nd Half". */
  statusDetail?: string;
  phase: Phase;
  /** Fractional match minute (45–50 during 1H stoppage etc.). */
  minute: number;
  clock: string;
  score: [number, number];
  possession: TeamId;
  ball: BallState;
  stats: Record<TeamId, TeamStats>;
  probs: Probs;
  /** Simulated cumulative market volume in USD. */
  volume: number;
  lastEventId: number;
}

export interface Snapshot {
  kind: "snapshot";
  state: MatchState;
  history: HistoryPoint[];
  events: MatchEvent[];
  serverTime: number;
}

export interface TickMessage {
  kind: "tick";
  state: MatchState;
  newEvents: MatchEvent[];
  /** Present only on ticks that sampled a chart point. */
  historyPoint?: HistoryPoint;
  serverTime: number;
}

export type StreamMessage = Snapshot | TickMessage;

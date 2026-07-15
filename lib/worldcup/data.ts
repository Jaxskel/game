import type { TeamId } from "./types";

export const MATCH_INFO = {
  competition: "FIFA World Cup 2026",
  round: "Semi-final",
  venue: "Mercedes-Benz Stadium, Atlanta",
  date: "Wed 15 July 2026",
  marketQuestion: "England vs. Argentina — full-time result (90 mins)",
} as const;

export interface TeamInfo {
  id: TeamId;
  name: string;
  short: string;
  flag: string;
  /** Expected goals over 90' used by the live Poisson model. */
  baseLambda: number;
  /** Attackers weighted by goal threat (Golden-Boot form). */
  scorers: { name: string; weight: number }[];
  /** Broader squad for fouls, offsides, subs, saves. */
  players: string[];
  keeper: string;
  bench: string[];
}

export const TEAMS: Record<TeamId, TeamInfo> = {
  ENG: {
    id: "ENG",
    name: "England",
    short: "ENG",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    baseLambda: 1.25,
    scorers: [
      { name: "Kane", weight: 30 },
      { name: "Bellingham", weight: 26 },
      { name: "Saka", weight: 16 },
      { name: "Foden", weight: 12 },
      { name: "Palmer", weight: 10 },
      { name: "Rice", weight: 6 },
    ],
    players: [
      "Walker",
      "Stones",
      "Guéhi",
      "Shaw",
      "Rice",
      "Bellingham",
      "Foden",
      "Saka",
      "Kane",
      "Palmer",
    ],
    keeper: "Pickford",
    bench: ["Watkins", "Gordon", "Mainoo", "Trippier", "Konsa"],
  },
  ARG: {
    id: "ARG",
    name: "Argentina",
    short: "ARG",
    flag: "🇦🇷",
    baseLambda: 1.4,
    scorers: [
      { name: "Messi", weight: 34 },
      { name: "J. Álvarez", weight: 20 },
      { name: "L. Martínez", weight: 18 },
      { name: "Mac Allister", weight: 12 },
      { name: "E. Fernández", weight: 8 },
      { name: "De Paul", weight: 8 },
    ],
    players: [
      "Molina",
      "Romero",
      "Otamendi",
      "Tagliafico",
      "De Paul",
      "E. Fernández",
      "Mac Allister",
      "Messi",
      "J. Álvarez",
      "L. Martínez",
    ],
    keeper: "E. Martínez",
    bench: ["Garnacho", "Paredes", "Lo Celso", "Pezzella", "Nico González"],
  },
};

export const TEAM_IDS: TeamId[] = ["ENG", "ARG"];

export function otherTeam(t: TeamId): TeamId {
  return t === "ENG" ? "ARG" : "ENG";
}

import type { Probs } from "./types";

/**
 * Best-effort connection to Polymarket's public read APIs for the real
 * England v Argentina match market. Everything here is optional garnish:
 * any failure returns null and the caller falls back to model odds.
 */
const SEARCH_URL = "https://gamma-api.polymarket.com/public-search?q=";
const HISTORY_URL = "https://clob.polymarket.com/prices-history";
const FETCH_TIMEOUT_MS = 8000;

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PolymarketMatch {
  eventTitle: string;
  /** Yes-outcome CLOB token id per outcome, for live prices + history. */
  tokens: { eng?: string; draw?: string; arg?: string };
  /** Latest known probabilities in %, from market prices. */
  probs: Probs | null;
  /** Total traded volume in USD reported by the event, if any. */
  volume: number;
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

function parseMaybeJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Yes-price (0..1) and yes-token of a binary market object. */
function yesOf(market: any): { price: number | null; token: string | null } {
  const outcomes = parseMaybeJsonArray(market?.outcomes).map((o) => o.toLowerCase());
  const prices = parseMaybeJsonArray(market?.outcomePrices).map(parseFloat);
  const tokens = parseMaybeJsonArray(market?.clobTokenIds);
  const yesIdx = Math.max(outcomes.indexOf("yes"), 0);
  const price = Number.isFinite(prices[yesIdx]) ? prices[yesIdx] : null;
  const token = tokens[yesIdx] ?? null;
  return { price, token };
}

function classifyOutcome(market: any): "eng" | "draw" | "arg" | null {
  const label = `${market?.groupItemTitle ?? ""} ${market?.question ?? ""}`.toLowerCase();
  const eng = label.includes("england");
  const arg = label.includes("argentina");
  if (label.includes("draw") && !eng && !arg) return "draw";
  if (eng && !arg) return "eng";
  if (arg && !eng) return "arg";
  if (label.includes("draw")) return "draw";
  return null;
}

/** Find the England v Argentina match market and read current prices. */
export async function findPolymarketMatch(): Promise<PolymarketMatch | null> {
  try {
    const data = await fetchJson(SEARCH_URL + encodeURIComponent("England Argentina"));
    const pools: any[] = [
      ...(Array.isArray(data?.events) ? data.events : []),
      ...(Array.isArray(data?.data?.events) ? data.data.events : []),
    ];
    const event = pools.find((ev) => {
      const title = String(ev?.title ?? "").toLowerCase();
      return title.includes("england") && title.includes("argentina");
    });
    if (!event) return null;

    const tokens: PolymarketMatch["tokens"] = {};
    const pcts: Partial<Record<"eng" | "draw" | "arg", number>> = {};
    for (const market of event?.markets ?? []) {
      const slot = classifyOutcome(market);
      if (!slot) continue;
      const { price, token } = yesOf(market);
      if (token && !tokens[slot]) tokens[slot] = token;
      if (price !== null && pcts[slot] === undefined) pcts[slot] = price * 100;
    }

    const probs = normalise(pcts);
    if (!probs && !tokens.eng && !tokens.arg && !tokens.draw) return null;
    const volume = parseFloat(event?.volume ?? event?.volumeNum ?? "0");
    return {
      eventTitle: String(event.title ?? ""),
      tokens,
      probs,
      volume: Number.isFinite(volume) ? volume : 0,
    };
  } catch {
    return null;
  }
}

/** Refresh live prices via each outcome's price history tail. */
export async function fetchPolymarketProbs(tokens: PolymarketMatch["tokens"]): Promise<Probs | null> {
  try {
    const read = async (token?: string): Promise<number | undefined> => {
      if (!token) return undefined;
      const data = await fetchJson(`${HISTORY_URL}?market=${token}&interval=1d&fidelity=1`);
      const history: any[] = Array.isArray(data?.history) ? data.history : [];
      const last = history[history.length - 1];
      const p = parseFloat(last?.p);
      return Number.isFinite(p) ? p * 100 : undefined;
    };
    const [eng, draw, arg] = await Promise.all([read(tokens.eng), read(tokens.draw), read(tokens.arg)]);
    return normalise({ eng, draw, arg });
  } catch {
    return null;
  }
}

/** Chart backfill: per-outcome price history in % keyed by unix seconds. */
export async function fetchPolymarketHistory(
  tokens: PolymarketMatch["tokens"],
): Promise<{ t: number; eng?: number; draw?: number; arg?: number }[] | null> {
  try {
    const read = async (token?: string): Promise<Map<number, number>> => {
      const map = new Map<number, number>();
      if (!token) return map;
      const data = await fetchJson(`${HISTORY_URL}?market=${token}&interval=1d&fidelity=2`);
      for (const point of Array.isArray(data?.history) ? data.history : []) {
        const t = Number(point?.t);
        const p = parseFloat(point?.p);
        if (Number.isFinite(t) && Number.isFinite(p)) map.set(t, p * 100);
      }
      return map;
    };
    const [eng, draw, arg] = await Promise.all([read(tokens.eng), read(tokens.draw), read(tokens.arg)]);
    const times = [...new Set([...eng.keys(), ...draw.keys(), ...arg.keys()])].sort((a, b) => a - b);
    if (times.length === 0) return null;
    return times.map((t) => ({ t, eng: eng.get(t), draw: draw.get(t), arg: arg.get(t) }));
  } catch {
    return null;
  }
}

function normalise(p: Partial<Record<"eng" | "draw" | "arg", number>>): Probs | null {
  const { eng, draw, arg } = p;
  if (eng === undefined && draw === undefined && arg === undefined) return null;
  const e = eng ?? 0;
  const d = draw ?? 0;
  const a = arg ?? 0;
  const total = e + d + a;
  if (!(total > 0)) return null;
  return { eng: (e / total) * 100, draw: (d / total) * 100, arg: (a / total) * 100 };
}

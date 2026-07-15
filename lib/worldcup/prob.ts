import type { Probs } from "./types";

const MAX_GOALS = 10;

function poissonPmfRow(lambda: number): number[] {
  const row: number[] = new Array(MAX_GOALS + 1);
  let p = Math.exp(-lambda);
  row[0] = p;
  for (let k = 1; k <= MAX_GOALS; k++) {
    p = (p * lambda) / k;
    row[k] = p;
  }
  return row;
}

export interface LiveProbInput {
  goalsEng: number;
  goalsArg: number;
  /** Current match minute (fractional). Clamped to [0, duration]. */
  minute: number;
  /** Expected goals over a full match at current strength. */
  lambdaEng: number;
  lambdaArg: number;
  /** Regulation length, default 90. */
  duration?: number;
}

/**
 * Live 1X2 probabilities via independent Poisson goal counts for the
 * remainder of the match, conditioned on the current score and clock.
 * Returns percentages that sum to 100.
 */
export function liveProbs({
  goalsEng,
  goalsArg,
  minute,
  lambdaEng,
  lambdaArg,
  duration = 90,
}: LiveProbInput): Probs {
  const remaining = Math.min(Math.max(duration - minute, 0), duration) / duration;
  const engRow = poissonPmfRow(Math.max(lambdaEng, 0) * remaining);
  const argRow = poissonPmfRow(Math.max(lambdaArg, 0) * remaining);

  let eng = 0;
  let draw = 0;
  let arg = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = engRow[i] * argRow[j];
      const diff = goalsEng + i - (goalsArg + j);
      if (diff > 0) eng += p;
      else if (diff < 0) arg += p;
      else draw += p;
    }
  }
  const total = eng + draw + arg;
  return {
    eng: (eng / total) * 100,
    draw: (draw / total) * 100,
    arg: (arg / total) * 100,
  };
}

/** Round probabilities (in %) to whole cents the way a market displays them. */
export function toCents(probs: Probs): { eng: number; draw: number; arg: number } {
  return {
    eng: Math.min(99, Math.max(1, Math.round(probs.eng))),
    draw: Math.min(99, Math.max(1, Math.round(probs.draw))),
    arg: Math.min(99, Math.max(1, Math.round(probs.arg))),
  };
}

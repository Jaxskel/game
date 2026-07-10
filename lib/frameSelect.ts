/**
 * Choose which sampled video frames are distinct, settled book pages.
 *
 * Input: one small grayscale "signature" per sampled frame (in time order).
 * We keep a frame when it is (a) STABLE — similar to the previous sample, so
 * it's a page being held still, not a mid-turn blur — and (b) CHANGED —
 * sufficiently different from the last kept page, so we don't keep the same
 * page twice. Pure and deterministic for unit testing.
 */

export function meanAbsDiff(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

export interface SelectOptions {
  /** Min difference from the last kept page to count as a new page (0–255). */
  changeThreshold?: number;
  /** Max difference from the previous sample to count as "settled" (0–255). */
  stableThreshold?: number;
  /** Hard cap on kept frames (evenly subsampled if exceeded). */
  maxFrames?: number;
}

export function selectKeyFrames(
  signatures: number[][],
  opts: SelectOptions = {},
): number[] {
  const changeThreshold = opts.changeThreshold ?? 12;
  const stableThreshold = opts.stableThreshold ?? 6;
  const maxFrames = opts.maxFrames ?? 40;

  const kept: number[] = [];
  let lastKept: number[] | null = null;

  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    const prevDiff = i > 0 ? meanAbsDiff(sig, signatures[i - 1]) : 0;
    const stable = prevDiff <= stableThreshold;
    const changed =
      lastKept === null || meanAbsDiff(sig, lastKept) >= changeThreshold;
    if (stable && changed) {
      kept.push(i);
      lastKept = sig;
    }
  }

  if (kept.length <= maxFrames) return kept;
  // Evenly subsample to the cap, always keeping first and last.
  const out: number[] = [];
  const stepF = (kept.length - 1) / (maxFrames - 1);
  for (let k = 0; k < maxFrames; k++) out.push(kept[Math.round(k * stepF)]);
  return [...new Set(out)];
}

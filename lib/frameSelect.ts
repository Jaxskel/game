/**
 * Choose which sampled video frames are distinct, in-focus book pages.
 *
 * Two selectors:
 *  - selectKeyFrames: original "stable + changed" picker (kept for reference).
 *  - selectPageFrames: sharpness-aware picker — splits the timeline into page
 *    clusters at big frame-to-frame jumps (page turns) and keeps the SHARPEST
 *    frame of each cluster. This lets the user flip at a steady pace instead of
 *    freezing on every page, and tolerates motion blur.
 * Pure and deterministic for unit testing.
 */

export function meanAbsDiff(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** Edge energy of a WxH grayscale signature — higher = sharper/in-focus. */
export function edgeEnergy(sig: number[], w: number, h: number): number {
  let e = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) {
        e += Math.abs(sig[i] - sig[i + 1]);
        n++;
      }
      if (y + 1 < h) {
        e += Math.abs(sig[i] - sig[i + w]);
        n++;
      }
    }
  }
  return n ? e / n : 0;
}

export interface SelectOptions {
  changeThreshold?: number;
  stableThreshold?: number;
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
  const out: number[] = [];
  const stepF = (kept.length - 1) / (maxFrames - 1);
  for (let k = 0; k < maxFrames; k++) out.push(kept[Math.round(k * stepF)]);
  return [...new Set(out)];
}

export interface PageFrame {
  sig: number[];
  sharp: number;
}

export interface PageSelectOptions {
  /** Frame-to-frame difference (0–255) that marks a page turn. */
  boundaryThreshold?: number;
  /** Drop page clusters whose sharpest frame is below this fraction of the
   * sharpest frame overall (filters blurry mid-turn transition clusters). */
  sharpFloorRatio?: number;
  maxFrames?: number;
}

/**
 * Split frames into page clusters at big jumps, keep the sharpest frame of
 * each, and drop clusters too blurry to be a real held page.
 */
export function selectPageFrames(
  frames: PageFrame[],
  opts: PageSelectOptions = {},
): number[] {
  const boundaryThreshold = opts.boundaryThreshold ?? 16;
  const sharpFloorRatio = opts.sharpFloorRatio ?? 0.35;
  const maxFrames = opts.maxFrames ?? 80;
  if (frames.length === 0) return [];

  const clusters: { idx: number; sharp: number }[] = [];
  let best: { idx: number; sharp: number } | null = null;
  for (let i = 0; i < frames.length; i++) {
    const jump = i > 0 ? meanAbsDiff(frames[i].sig, frames[i - 1].sig) : 0;
    if (i > 0 && jump >= boundaryThreshold) {
      if (best) clusters.push(best);
      best = null;
    }
    if (!best || frames[i].sharp > best.sharp) {
      best = { idx: i, sharp: frames[i].sharp };
    }
  }
  if (best) clusters.push(best);

  const maxSharp = Math.max(...clusters.map((c) => c.sharp), 1);
  const floor = maxSharp * sharpFloorRatio;
  let kept = clusters.filter((c) => c.sharp >= floor).map((c) => c.idx);

  if (kept.length > maxFrames) {
    const out: number[] = [];
    const stepF = (kept.length - 1) / (maxFrames - 1);
    for (let k = 0; k < maxFrames; k++) out.push(kept[Math.round(k * stepF)]);
    kept = [...new Set(out)];
  }
  return kept.sort((a, b) => a - b);
}

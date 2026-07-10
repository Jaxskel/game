import { describe, expect, it } from "vitest";
import { meanAbsDiff, selectKeyFrames } from "@/lib/frameSelect";

// Build a signature that's uniformly `v`.
const sig = (v: number, n = 16) => Array.from({ length: n }, () => v);

describe("meanAbsDiff", () => {
  it("is 0 for identical, magnitude for different", () => {
    expect(meanAbsDiff(sig(100), sig(100))).toBe(0);
    expect(meanAbsDiff(sig(100), sig(130))).toBe(30);
  });
});

describe("selectKeyFrames", () => {
  it("keeps one settled frame per distinct page, skipping duplicates", () => {
    // page A held for 3 samples, blurry turn, page B held for 3 samples.
    const frames = [
      sig(50), sig(50), sig(50), // page A (stable, new → keep first: idx 0)
      sig(120), // mid-turn (unstable vs prev → skip)
      sig(200), // first B frame is still unstable vs the 120 turn → skip
      sig(200), sig(200), // page B now settled, changed → keep first: idx 5
    ];
    const kept = selectKeyFrames(frames, { changeThreshold: 20, stableThreshold: 6 });
    expect(kept).toEqual([0, 5]);
  });

  it("does not keep the same page twice", () => {
    const frames = [sig(80), sig(80), sig(80), sig(80)];
    const kept = selectKeyFrames(frames, { changeThreshold: 20, stableThreshold: 6 });
    expect(kept).toEqual([0]);
  });

  it("skips frames that never settle", () => {
    const frames = [sig(10), sig(90), sig(20), sig(100)]; // always jumping
    const kept = selectKeyFrames(frames, { changeThreshold: 20, stableThreshold: 6 });
    expect(kept).toEqual([0]); // only the first (prevDiff=0) is 'stable'
  });

  it("caps output to maxFrames while keeping first and last", () => {
    // 10 distinct stable pages (each repeated twice so it settles).
    const frames: number[][] = [];
    for (let i = 0; i < 10; i++) {
      frames.push(sig(i * 25), sig(i * 25));
    }
    const kept = selectKeyFrames(frames, {
      changeThreshold: 20,
      stableThreshold: 6,
      maxFrames: 4,
    });
    expect(kept.length).toBeLessThanOrEqual(4);
    expect(kept[0]).toBe(0);
  });
});

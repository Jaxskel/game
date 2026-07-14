import { describe, expect, it } from "vitest";
import {
  edgeEnergy,
  meanAbsDiff,
  selectKeyFrames,
  selectPageFrames,
} from "@/lib/frameSelect";

const sig = (v: number, n = 16) => Array.from({ length: n }, () => v);

describe("meanAbsDiff", () => {
  it("is 0 for identical, magnitude for different", () => {
    expect(meanAbsDiff(sig(100), sig(100))).toBe(0);
    expect(meanAbsDiff(sig(100), sig(130))).toBe(30);
  });
});

describe("edgeEnergy", () => {
  it("is 0 for a flat image, high for a checkerboard", () => {
    const flat = Array.from({ length: 16 }, () => 128);
    expect(edgeEnergy(flat, 4, 4)).toBe(0);
    const checker: number[] = [];
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) checker.push((x + y) % 2 ? 255 : 0);
    expect(edgeEnergy(checker, 4, 4)).toBeGreaterThan(100);
  });
});

describe("selectKeyFrames (legacy)", () => {
  it("keeps one settled frame per distinct page", () => {
    const frames = [sig(50), sig(50), sig(120), sig(200), sig(200), sig(200)];
    const kept = selectKeyFrames(frames, { changeThreshold: 20, stableThreshold: 6 });
    expect(kept[0]).toBe(0);
    expect(kept.length).toBe(2);
  });
});

describe("selectPageFrames (sharpness-aware)", () => {
  it("keeps the sharpest frame of each page cluster", () => {
    const frames = [
      { sig: sig(50), sharp: 10 },
      { sig: sig(50), sharp: 40 }, // sharpest of page A
      { sig: sig(50), sharp: 15 },
      { sig: sig(200), sharp: 50 }, // sharpest of page B (jump here)
      { sig: sig(200), sharp: 20 },
      { sig: sig(200), sharp: 12 },
    ];
    const kept = selectPageFrames(frames, { boundaryThreshold: 20, sharpFloorRatio: 0.1 });
    expect(kept).toEqual([1, 3]);
  });

  it("lets fast flips work — one sharp frame per page is enough", () => {
    const frames = [
      { sig: sig(20), sharp: 30 },
      { sig: sig(90), sharp: 32 },
      { sig: sig(160), sharp: 28 },
      { sig: sig(230), sharp: 35 },
    ];
    const kept = selectPageFrames(frames, { boundaryThreshold: 40, sharpFloorRatio: 0.1 });
    expect(kept).toEqual([0, 1, 2, 3]);
  });

  it("drops blurry mid-turn transition clusters below the sharpness floor", () => {
    const frames = [
      { sig: sig(30), sharp: 40 }, // real page
      { sig: sig(120), sharp: 3 }, // blurry transition (jump in, low sharp)
      { sig: sig(210), sharp: 38 }, // real page (jump in)
    ];
    const kept = selectPageFrames(frames, { boundaryThreshold: 30, sharpFloorRatio: 0.35 });
    expect(kept).toEqual([0, 2]);
  });

  it("returns empty for no frames", () => {
    expect(selectPageFrames([])).toEqual([]);
  });
});

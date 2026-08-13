import { describe, expect, it } from "vitest";

import { solveFourBar } from "./four-bar";
import { solveGearedFiveBar } from "./geared-five-bar";
import {
  CAT_TARGET_CURVE,
  alignClosedCurves,
  applySimilarity,
  fitFourBarToSketch,
  fitGearedFiveBarToSketch,
  fitMechanismFamiliesToSketch,
  resampleClosedCurve,
  sampleCandidateMechanism,
} from "./sketch-linkage";

describe("sketch to four-bar synthesis", () => {
  it("resamples a closed outline without duplicating its first point", () => {
    const sampled = resampleClosedCurve([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ], 8);
    expect(sampled).toHaveLength(8);
    expect(sampled[0]).toEqual({ x: 0, y: 0 });
    expect(sampled[4]).toEqual({ x: 10, y: 10 });
    expect(sampled[7]).not.toEqual(sampled[0]);
  });

  it("recovers translation, rotation and scale while matching closed curves", () => {
    const source = resampleClosedCurve(CAT_TARGET_CURVE, 32);
    const expected = { scale: 1.7, rotation: 0.42, translation: { x: 80, y: -30 } };
    const target = source.map((point) => applySimilarity(point, expected));
    const fit = alignClosedCurves(source, target);
    expect(fit.rmse).toBeLessThan(1e-8);
  });

  it("returns deterministic full-cycle four-bar candidates for the cat outline", () => {
    const candidates = fitFourBarToSketch(CAT_TARGET_CURVE, { iterations: 240, seed: 7 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].normalizedRmse).toBeLessThan(0.22);
    for (const candidate of candidates) {
      expect(candidate.family).toBe("four-bar");
      if (candidate.family !== "four-bar") throw new Error("unexpected mechanism family");
      for (let angle = 0; angle < 360; angle += 15) {
        expect(solveFourBar(candidate.parameters, angle, candidate.assemblyMode)).not.toBeNull();
      }
    }
  });

  it("returns deterministic full-cycle geared five-bar candidates", () => {
    const candidates = fitGearedFiveBarToSketch(CAT_TARGET_CURVE, { iterations: 300, seed: 11 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].family).toBe("geared-five-bar");
    expect(candidates[0].normalizedRmse).toBeLessThan(0.22);
    for (const candidate of candidates) {
      for (let angle = 0; angle < 360; angle += 15) {
        expect(solveGearedFiveBar(candidate.parameters, angle, candidate.assemblyMode)).not.toBeNull();
      }
    }
  });

  it("keeps at least one candidate from every requested mechanism family", () => {
    const candidates = fitMechanismFamiliesToSketch(CAT_TARGET_CURVE, { iterations: 600, seed: 19 });
    expect(new Set(candidates.map((candidate) => candidate.family))).toEqual(new Set(["four-bar", "geared-five-bar"]));
  });

  it("advances both pitch gears when the geared five-bar animation angle changes", () => {
    const candidate = fitGearedFiveBarToSketch(CAT_TARGET_CURVE, { iterations: 300, seed: 11 })[0];
    const start = sampleCandidateMechanism(candidate, 0);
    const advanced = sampleCandidateMechanism(candidate, 30);
    expect(start?.gears).toHaveLength(2);
    expect(advanced?.gears).toHaveLength(2);
    expect(advanced?.gears.map((gear) => gear.rotation)).not.toEqual(start?.gears.map((gear) => gear.rotation));
  });
});

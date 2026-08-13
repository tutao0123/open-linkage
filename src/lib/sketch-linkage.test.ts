import { describe, expect, it } from "vitest";

import { solveFourBar } from "./four-bar";
import {
  CAT_TARGET_CURVE,
  alignClosedCurves,
  applySimilarity,
  fitFourBarToSketch,
  resampleClosedCurve,
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
      for (let angle = 0; angle < 360; angle += 15) {
        expect(solveFourBar(candidate.parameters, angle, candidate.assemblyMode)).not.toBeNull();
      }
    }
  });
});

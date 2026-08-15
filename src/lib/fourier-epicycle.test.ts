import { describe, expect, it } from "vitest";

import { CAT_TARGET_CURVE } from "./sketch-linkage";
import {
  fitFourierEpicycle,
  sampleFourierEpicycleTrajectory,
  solveFourierEpicycle,
} from "./fourier-epicycle";

describe("Fourier epicycle drawing", () => {
  it("closes continuously over one input-shaft revolution", () => {
    const parameters = fitFourierEpicycle(CAT_TARGET_CURVE, { termCount: 18 });
    const start = solveFourierEpicycle(parameters, 0).point;
    const end = solveFourierEpicycle(parameters, 360).point;
    expect(end.x).toBeCloseTo(start.x, 9);
    expect(end.y).toBeCloseTo(start.y, 9);
  });

  it("improves the sampled curve as rotating terms are added", () => {
    const errors = [4, 8, 12, 18].map((termCount) =>
      fitFourierEpicycle(CAT_TARGET_CURVE, { termCount }).normalizedRmse);
    for (let index = 1; index < errors.length; index += 1) {
      expect(errors[index]).toBeLessThanOrEqual(errors[index - 1] + 1e-12);
    }
    expect(errors.at(-1)).toBeLessThan(0.04);
  });

  it("returns a serializable animated rotor chain", () => {
    const parameters = fitFourierEpicycle(CAT_TARGET_CURVE, { sampleCount: 96, termCount: 14 });
    const trajectory = sampleFourierEpicycleTrajectory(parameters, 181);
    const geometry = solveFourierEpicycle(parameters, 127.5);
    const json = JSON.stringify({ parameters, trajectory, geometry });
    expect(JSON.parse(json).parameters.terms).toHaveLength(14);
    expect(trajectory).toHaveLength(181);
    expect(geometry.joints).toHaveLength(15);
    expect(json).not.toMatch(/null/);
    for (const point of [...trajectory, ...geometry.joints, geometry.point]) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});


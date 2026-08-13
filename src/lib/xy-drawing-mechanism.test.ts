import { describe, expect, it } from "vitest";
import { CAT_TARGET_CURVE } from "./sketch-linkage";
import {
  createXYDrawingMechanismGeometry,
  fitXYDrawingMechanism,
  sampleXYDrawingTrajectory,
  solveXYDrawingMechanism,
} from "./xy-drawing-mechanism";

describe("gear-synchronized X-Y drawing mechanism", () => {
  it("closes continuously over one input-shaft revolution", () => {
    const mechanism = fitXYDrawingMechanism(CAT_TARGET_CURVE, {
      harmonicCount: 8,
      inputShaftPhaseDegrees: 23,
    });
    const start = solveXYDrawingMechanism(mechanism, 0).point;
    const end = solveXYDrawingMechanism(mechanism, 360).point;
    expect(end.x).toBeCloseTo(start.x, 9);
    expect(end.y).toBeCloseTo(start.y, 9);
  });

  it("does not worsen the discrete least-squares fit when harmonics are added", () => {
    const errors = [2, 4, 6, 8, 10].map((harmonicCount) =>
      fitXYDrawingMechanism(CAT_TARGET_CURVE, { harmonicCount }).normalizedRmse);
    for (let index = 1; index < errors.length; index += 1) {
      expect(errors[index]).toBeLessThanOrEqual(errors[index - 1] + 1e-12);
    }
    // The current geared five-bar demo is about 5.3%; the harmonic drive is clearly better.
    expect(errors.at(-1)).toBeLessThan(0.04);
  });

  it("returns serializable finite parameters, trajectory, and animation geometry", () => {
    const mechanism = fitXYDrawingMechanism(CAT_TARGET_CURVE, { harmonicCount: 7, sampleCount: 96 });
    const trajectory = sampleXYDrawingTrajectory(mechanism, 181);
    const geometry = createXYDrawingMechanismGeometry(mechanism, 127.5);
    const values: unknown[] = [mechanism, trajectory, geometry];
    const json = JSON.stringify(values);
    expect(JSON.parse(json)).toHaveLength(3);
    expect(json).not.toMatch(/null/);
    expect(trajectory).toHaveLength(181);
    expect(geometry.harmonicDrives).toHaveLength(14);
    expect(geometry.harmonicDrives.map((drive) => drive.gearRatio)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
      1, 2, 3, 4, 5, 6, 7,
    ]);
    for (const point of [...trajectory, geometry.xSlider, geometry.ySlider, geometry.point]) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

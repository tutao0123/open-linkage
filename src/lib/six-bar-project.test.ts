import { describe, expect, it } from "vitest";
import { parseSixBarProject } from "./six-bar-project";
import type { SixBarParameters } from "./six-bar";

const parameters: SixBarParameters = {
  groundPivot: 260,
  rearPivotX: 120,
  rearPivotY: -100,
  crank: 55,
  firstCoupler: 220,
  firstRocker: 145,
  secondCoupler: 250,
  secondRocker: 190,
  footRatio: 1.35,
  footOffset: -28,
};

describe("parseSixBarProject", () => {
  it("migrates v2 mechanism settings and drops incompatible closed-path data", () => {
    const parsed = parseSixBarProject({
      version: 2,
      mechanismType: "six-bar-leg",
      parameters,
      inputAngle: 42,
      speed: 18,
      priority: "accuracy",
      targetPath: [{ x: 1, y: 2 }],
      candidates: [{ id: "legacy" }],
    });

    expect(parsed?.migrated).toBe(true);
    expect(parsed?.project).toMatchObject({
      version: 3,
      parameters,
      inputAngle: 42,
      speed: 18,
      priority: "accuracy",
      targetPath: [],
      candidates: [],
    });
  });

  it("keeps valid v3 open-path projects", () => {
    const parsed = parseSixBarProject({
      version: 3,
      mechanismType: "six-bar-leg",
      parameters,
      inputAngle: 35,
      speed: 14,
      priority: "balanced",
      targetPath: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      candidates: [],
    });

    expect(parsed?.migrated).toBe(false);
    expect(parsed?.project.targetPath).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  });
});

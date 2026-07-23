import { describe, expect, it } from "vitest";
import { sampleSixBarLeg, solveSixBarLeg, type SixBarParameters } from "./six-bar";
import { sampleSixBarWorkPath, synthesizeSixBarLeg } from "./six-bar-synthesis";

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

describe("sampleSixBarWorkPath", () => {
  it("includes the start and end angles of an open work segment", () => {
    const phase = 35;
    const workAngleSpan = 180;
    const path = sampleSixBarWorkPath(parameters, phase, 1, workAngleSpan, 9);

    expect(path).toHaveLength(9);
    expect(path[0]).toEqual(solveSixBarLeg(parameters, phase)?.footPoint);
    expect(path[8]).toEqual(solveSixBarLeg(parameters, phase + workAngleSpan)?.footPoint);
  });

  it("respects reverse work direction", () => {
    const phase = 220;
    const workAngleSpan = 120;
    const path = sampleSixBarWorkPath(parameters, phase, -1, workAngleSpan, 5);

    expect(path[0]).toEqual(solveSixBarLeg(parameters, phase)?.footPoint);
    expect(path[4]).toEqual(solveSixBarLeg(parameters, phase - workAngleSpan)?.footPoint);
  });

  it("searches a bounded work span while reporting independent full-cycle validity", async () => {
    const target = sampleSixBarWorkPath(parameters, 45, 1, 180, 24);
    const [candidate] = await synthesizeSixBarLeg(target, parameters, "balanced", undefined, 1);

    expect(candidate).toBeDefined();
    expect(candidate.workAngleSpan).toBeGreaterThanOrEqual(60);
    expect(candidate.workAngleSpan).toBeLessThanOrEqual(300);
    expect(candidate.generatedPath).toHaveLength(56);

    const fullCycle = sampleSixBarLeg(candidate.parameters, 120);
    const fullCycleValidRatio = fullCycle.filter((sample) => sample !== null).length / fullCycle.length;
    expect(candidate.validRatio).toBeCloseTo(fullCycleValidRatio, 10);
  }, 20_000);
});

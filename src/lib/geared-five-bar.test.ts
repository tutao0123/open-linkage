import { describe, expect, it } from "vitest";

import {
  gearedFiveBarPitchRadii,
  solveGearedFiveBar,
  type GearedFiveBarParameters,
} from "./geared-five-bar";

const FULL_CYCLE_PARAMETERS: GearedFiveBarParameters = {
  ground: 100,
  leftInput: 25,
  leftCoupler: 80,
  rightCoupler: 80,
  rightInput: 25,
  gearRatio: -1,
  gearPhase: 0,
  couplerPointRatio: 0.55,
  couplerPointOffset: 18,
};

describe("geared five-bar kinematics", () => {
  it("solves a gear-synchronized full input cycle", () => {
    for (let angle = 0; angle < 360; angle += 5) {
      const position = solveGearedFiveBar(FULL_CYCLE_PARAMETERS, angle, "open");
      expect(position).not.toBeNull();
      expect(position?.rightInputAngle).toBeCloseTo(-angle);
    }
  });

  it("rejects a disconnected central dyad", () => {
    expect(solveGearedFiveBar({
      ...FULL_CYCLE_PARAMETERS,
      leftCoupler: 5,
      rightCoupler: 5,
    }, 90, "open")).toBeNull();
  });

  it("derives directly meshing pitch radii from the external gear ratio", () => {
    expect(gearedFiveBarPitchRadii({ ground: 120, gearRatio: -2 })).toEqual({ left: 80, right: 40 });
  });
});

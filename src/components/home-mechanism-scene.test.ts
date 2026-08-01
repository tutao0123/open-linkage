import { describe, expect, it } from "vitest";

import {
  HOME_MECHANISM_FRAME_COUNT,
  createHomeMechanismScene,
} from "./home-mechanism-scene";

const scene = createHomeMechanismScene();

describe("home mechanism scene", () => {
  it("strips the smooth reference into exactly 48 finite solver frames", () => {
    expect(scene.source).toMatchObject({ preset: "smooth", topology: "jansen" });
    expect(scene.frames).toHaveLength(HOME_MECHANISM_FRAME_COUNT);
    expect(scene.solver.frameSamples).toBe(HOME_MECHANISM_FRAME_COUNT);
    expect(scene.solver.status).toBe("ready");

    for (const frame of scene.frames) {
      expect(frame.joints).toHaveLength(scene.topology.jointIds.length);
      expect([
        frame.phase,
        frame.constraintError,
        frame.singularityMargin,
        ...frame.tracer,
        ...frame.joints.flat(),
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it("contains compact topology, four-leg deployment, and the solved foot path", () => {
    expect(scene.topology.jointIds.length).toBeGreaterThan(0);
    expect(scene.topology.fixedJoints.length).toBeGreaterThan(0);
    expect(scene.topology.bars.length).toBeGreaterThan(0);
    expect(scene.topology.bars.every((bar) => (
      bar.a >= 0
      && bar.a < scene.topology.jointIds.length
      && bar.b >= 0
      && bar.b < scene.topology.jointIds.length
    ))).toBe(true);
    expect(scene.topology.bars.filter((bar) => bar.role === "driver")).toHaveLength(1);
    expect(scene.topology.bars.filter((bar) => bar.role === "adjustment")).toHaveLength(1);
    expect(scene.legs).toHaveLength(4);
    expect(new Set(scene.legs.map((leg) => leg.phaseOffset)).size).toBe(4);
    expect(scene.footPath).toHaveLength(HOME_MECHANISM_FRAME_COUNT);
    expect(scene.footPath.flat().every(Number.isFinite)).toBe(true);
    expect(scene.metrics.stepLength).toBeGreaterThan(0);
    expect(scene.metrics.liftHeight).toBeGreaterThan(0);
  });

  it("is fully JSON serializable without changing its data", () => {
    const serialized = JSON.stringify(scene);
    expect(serialized.length).toBeGreaterThan(0);
    expect(JSON.parse(serialized)).toEqual(scene);
  });
});

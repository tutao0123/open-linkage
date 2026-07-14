import { describe, expect, it } from "vitest";

import {
  analyzeVariableLegProject,
  cloneVariableLegProject,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  getVariableLegTemplate,
  isVariableLegProject,
  materializeVariableLegMode,
  measureGaitClearance,
  migrateVariableLegProject,
  sampleVariableLeg,
} from "./variable-leg";
import { synthesizeVariableLeg } from "./variable-leg-synthesis";

describe("variable geometry walking leg", () => {
  it("measures swing clearance from the stance plane", () => {
    const project = createDefaultVariableLegProject();
    const obstacle = project.modes.find((mode) => mode.id === "obstacle")!;
    expect(measureGaitClearance(obstacle.targetPath, obstacle.stanceStart, obstacle.stanceEnd)).toBeCloseTo(130, -1);
  });

  it.each(["klann", "jansen"] as const)("samples a complete %s cycle", (topology) => {
    const template = getVariableLegTemplate(topology);
    const adjustment = createDefaultAdjustment(topology, "moving-pivot");
    const samples = sampleVariableLeg(template, adjustment, 0, 36, 400);
    expect(samples).toHaveLength(36);
    expect(samples.filter((sample) => sample.tracer !== null).length).toBeGreaterThanOrEqual(34);
    expect(Math.max(...samples.map((sample) => sample.error))).toBeLessThan(2);
  });

  it("keeps a moving pivot locked throughout the cycle", () => {
    const project = createDefaultVariableLegProject();
    const value = 18;
    const samples = sampleVariableLeg(project.baseProject, project.adjustment, value, 24, 90);
    const targetId = project.adjustment.targetId;
    const positions = samples.map((sample) => sample.project.joints.find((joint) => joint.id === targetId)!);
    expect(new Set(positions.map((joint) => `${joint.x.toFixed(6)}:${joint.y.toFixed(6)}`)).size).toBe(1);
  });

  it("keeps a telescopic bar at its locked effective length", () => {
    const template = getVariableLegTemplate("jansen");
    const adjustment = createDefaultAdjustment("jansen", "telescopic-bar");
    const lockedLength = adjustment.kind === "telescopic-bar" ? adjustment.baseLength * 1.05 : 0;
    const materialized = materializeVariableLegMode(template, adjustment, lockedLength);
    const bar = materialized.bars.find((item) => item.id === adjustment.targetId)!;
    expect(bar.length).toBeCloseTo(lockedLength, 6);
    expect(bar.type).toBe("telescopic");
  });

  it("round-trips the versioned project format", () => {
    const source = createDefaultVariableLegProject();
    const parsed = JSON.parse(JSON.stringify(source)) as unknown;
    expect(isVariableLegProject(parsed)).toBe(true);
    const cloned = cloneVariableLegProject(parsed as typeof source);
    expect(cloned.modes.map((mode) => mode.name)).toEqual(["巡航", "高速", "越障"]);
    expect(cloned.adjustment).toEqual(source.adjustment);
    expect(cloned.deployment).toEqual(source.deployment);
  });

  it("migrates a version 1 project to the default two-leg deployment", () => {
    const source = createDefaultVariableLegProject();
    const legacy = { ...source, version: 1, deployment: undefined };
    const migrated = migrateVariableLegProject(JSON.parse(JSON.stringify(legacy)) as unknown);
    expect(migrated?.version).toBe(2);
    expect(migrated?.deployment.legCount).toBe(2);
    expect(migrated?.deployment.preset).toBe("alternating");
  });

  it("produces deterministic project metrics", () => {
    const project = createDefaultVariableLegProject();
    const first = analyzeVariableLegProject(project, 24, 70);
    const second = analyzeVariableLegProject(project, 24, 70);
    expect(first.score).toBeCloseTo(second.score, 8);
    expect(first.metrics.map((metric) => metric.validRatio)).toEqual(second.metrics.map((metric) => metric.validRatio));
  });

  it("improves the three-mode baseline reproducibly", async () => {
    const project = createDefaultVariableLegProject();
    const baseline = analyzeVariableLegProject(project, 36, 60).score;
    const first = await synthesizeVariableLeg(project);
    const second = await synthesizeVariableLeg(project);
    expect(first).toHaveLength(5);
    expect(first[0].score).toBeGreaterThan(baseline);
    const obstacleIndex = first[0].modes.findIndex((mode) => mode.id === "obstacle");
    const obstacleMode = first[0].modes[obstacleIndex];
    const obstacleTargetClearance = measureGaitClearance(obstacleMode.targetPath, obstacleMode.stanceStart, obstacleMode.stanceEnd);
    const otherClearances = first[0].metrics.filter((_, index) => index !== obstacleIndex).map((metric) => metric.liftHeight);
    expect(first[0].metrics[obstacleIndex].liftHeight).toBeGreaterThan(Math.max(...otherClearances));
    expect(first[0].metrics[obstacleIndex].liftHeight).toBeGreaterThanOrEqual(obstacleTargetClearance * 0.9);
    expect(first[0].metrics.every((metric) => metric.validRatio >= 0.99)).toBe(true);
    expect(first.map((candidate) => [candidate.topology, candidate.adjustment.kind, candidate.adjustment.targetId, candidate.score]))
      .toEqual(second.map((candidate) => [candidate.topology, candidate.adjustment.kind, candidate.adjustment.targetId, candidate.score]));
  }, 60_000);
});

import { describe, expect, it } from "vitest";

import {
  analyzeVariableLegBarSamples,
  analyzeVariableLegProject,
  applyVariableLegDesignerReturn,
  applyVariableLegRecommendedRange,
  buildVariableLegFeasibleIntervals,
  cloneVariableLegProject,
  createVariableLegDesignerTransfer,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  getVariableLegTemplate,
  isVariableLegProject,
  materializeVariableLegMode,
  measureGaitClearance,
  migrateVariableLegProject,
  restoreVariableLegStandardModes,
  scanVariableLegAdjustmentFeasibility,
  sampleVariableLeg,
  validateVariableLegDesignerProject,
  type VariableLegAdjustmentFeasibility,
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

  it("allows any non-driver bar to be the locked telescopic target", () => {
    const project = createDefaultVariableLegProject();
    const bar = project.baseProject.bars.find((item) => item.id !== project.baseProject.driverId)!;
    const adjustment = {
      kind: "telescopic-bar" as const,
      targetId: bar.id,
      baseLength: bar.length,
      minimum: bar.length - 20,
      maximum: bar.length + 20,
    };
    const materialized = materializeVariableLegMode(project.baseProject, adjustment, bar.length + 12);
    expect(materialized.bars.find((item) => item.id === bar.id)?.length).toBeCloseTo(bar.length + 12);
  });

  it("unwraps bar angles across plus and minus 180 degrees", () => {
    const project = createDefaultVariableLegProject();
    const bar = project.baseProject.bars.find((item) => item.id !== project.baseProject.driverId)!;
    const makeSample = (angle: number, phase: number) => {
      const state = structuredClone(project.baseProject);
      const first = state.joints.find((joint) => joint.id === bar.a)!;
      const second = state.joints.find((joint) => joint.id === bar.b)!;
      second.x = first.x + bar.length * Math.cos(angle * Math.PI / 180);
      second.y = first.y + bar.length * Math.sin(angle * Math.PI / 180);
      return { phase, project: state, tracer: { x: 0, y: 0 }, error: 0, singularityMargin: 20 };
    };
    const metrics = analyzeVariableLegBarSamples(
      project.baseProject,
      project.adjustment,
      [makeSample(179, 0), makeSample(-179, Math.PI)],
      bar.id,
    );
    expect(metrics?.angleRangeDegrees).toBeCloseTo(2, 5);
  });

  it("builds a recommended feasible interval containing the active lock", () => {
    const result = buildVariableLegFeasibleIntervals([
      { value: 0, feasible: false, failedModeIds: ["cruise"] },
      { value: 1, feasible: true, failedModeIds: [] },
      { value: 2, feasible: true, failedModeIds: [] },
      { value: 3, feasible: false, failedModeIds: ["obstacle"] },
      { value: 4, feasible: true, failedModeIds: [] },
    ], 1.5);
    expect(result.intervals).toEqual([{ minimum: 1, maximum: 2 }, { minimum: 4, maximum: 4 }]);
    expect(result.recommendedInterval).toEqual({ minimum: 1, maximum: 2 });
  });

  it("scans every mode and clamps lock values to the recommended range", () => {
    const project = createDefaultVariableLegProject();
    const scan = scanVariableLegAdjustmentFeasibility(project, 3, 12, 30);
    expect(scan.samples).toHaveLength(3);
    expect(scan.samples.every((sample) => Array.isArray(sample.failedModeIds))).toBe(true);
    const feasibility: VariableLegAdjustmentFeasibility = {
      minimum: -45,
      maximum: 45,
      samples: [],
      intervals: [{ minimum: -10, maximum: 10 }],
      recommendedInterval: { minimum: -10, maximum: 10 },
    };
    const applied = applyVariableLegRecommendedRange(project, feasibility);
    expect(applied.project.modes.every((mode) => mode.adjustmentValue >= -10 && mode.adjustmentValue <= 10)).toBe(true);
    expect(applied.clampedModeIds).toEqual(expect.arrayContaining(["sprint", "obstacle"]));
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

  it("restores missing standard modes without replacing the existing obstacle mode", () => {
    const source = createDefaultVariableLegProject();
    const obstacle = source.modes.find((mode) => mode.id === "obstacle")!;
    obstacle.name = "我的越障";
    source.modes = [obstacle];
    source.activeModeId = obstacle.id;
    const restored = restoreVariableLegStandardModes(source);
    expect(restored.modes.map((mode) => mode.id)).toEqual(["cruise", "sprint", "obstacle"]);
    expect(restored.modes.find((mode) => mode.id === "obstacle")?.name).toBe("我的越障");
    expect(restored.activeModeId).toBe("obstacle");
    expect(restored.deployment).toEqual(source.deployment);
  });

  it("round-trips designer edits and shifts a telescopic range by the base length delta", () => {
    const source = createDefaultVariableLegProject();
    const target = source.baseProject.bars.find((bar) => bar.id !== source.baseProject.driverId)!;
    source.adjustment = {
      kind: "telescopic-bar",
      targetId: target.id,
      baseLength: target.length,
      minimum: target.length - 20,
      maximum: target.length + 20,
    };
    source.modes = source.modes.map((mode) => ({ ...mode, adjustmentValue: target.length }));
    const transfer = createVariableLegDesignerTransfer(source);
    transfer.direction = "to-variable-leg";
    transfer.editableProject.bars.find((bar) => bar.id === target.id)!.length += 15;
    const returned = applyVariableLegDesignerReturn(transfer);
    expect(returned.validation.valid).toBe(true);
    expect(returned.project.adjustment.minimum).toBeCloseTo(target.length - 5);
    expect(returned.project.modes[0].adjustmentValue).toBeCloseTo(target.length + 15);
    expect(returned.project.deployment).toEqual(source.deployment);
    expect(returned.project.candidates).toEqual([]);
  });

  it("rejects a designer return when required topology was deleted", () => {
    const source = createDefaultVariableLegProject();
    const edited = structuredClone(source.baseProject);
    edited.bars.pop();
    const validation = validateVariableLegDesignerProject(source.baseProject, edited);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.join(" ")).toContain("杆件");
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
    expect(first.every((candidate) => candidate.topology === project.topology)).toBe(true);
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

  it("refines only the current topology and adjustment target", async () => {
    const project = createDefaultVariableLegProject();
    const candidates = await synthesizeVariableLeg(project, undefined, () => false, "current-target");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].topology).toBe(project.topology);
    expect(candidates[0].adjustment.kind).toBe(project.adjustment.kind);
    expect(candidates[0].adjustment.targetId).toBe(project.adjustment.targetId);
  }, 30_000);
});

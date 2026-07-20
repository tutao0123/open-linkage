import { describe, expect, it } from "vitest";

import {
  analyzeVariableLegBarSamples,
  analyzeVariableLegProject,
  assessGuidedHardGate,
  assessVariableLegCandidate,
  applyVariableLegDesignerReturn,
  applyVariableLegRecommendedRange,
  buildGuidedDesignSeed,
  buildVariableLegFeasibleIntervals,
  cloneVariableLegProject,
  createVariableLegDesignerTransfer,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  createGuidedDesignRequest,
  getVariableLegTemplate,
  guidedDesignZones,
  isVariableLegProject,
  materializeVariableLegMode,
  measureGaitClearance,
  migrateVariableLegProject,
  restoreVariableLegStandardModes,
  previewVariableLegEditableParameter,
  scanVariableLegAdjustmentFeasibility,
  setVariableLegBaseBarLength,
  setVariableLegEditableParameter,
  sampleVariableLeg,
  validateVariableLegDesignerProject,
  type VariableLegAdjustmentFeasibility,
} from "./variable-leg";
import { getVariableLegBaselineBounds } from "./variable-leg-baselines";
import { createGuidedSafeBaseline, guidedSafeBaselineMetadata } from "./variable-leg-guided-baselines";
import {
  getVariableLegDynamicLengthEnvelope,
  listVariableLegDynamicBars,
  variableLegDynamicEnvelopeMetadata,
} from "./variable-leg-dynamic-envelopes";
import { preflightGuidedDesign, synthesizeVariableLeg, synthesizeVariableLegGuidedDesign, VariableLegSynthesisCancelled } from "./variable-leg-synthesis";

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

  it("uses the walking assembly branch and clockwise phase convention for Klann", () => {
    const project = createDefaultVariableLegProject();
    const candidates = buildGuidedDesignSeed(project, createGuidedDesignRequest(project), "performance");
    const metrics = analyzeVariableLegProject(candidates).metrics;
    expect(metrics.every((metric) => metric.stepLength > 180)).toBe(true);
    expect(metrics.every((metric) => metric.liftHeight > 40)).toBe(true);
  });

  it("does not call a merely continuous but non-walking candidate usable", () => {
    const project = createDefaultVariableLegProject();
    const analysis = analyzeVariableLegProject(project);
    const broken = analysis.metrics.map((metric) => ({
      ...metric,
      validRatio: 1,
      branchSwitches: 0,
      closureError: 1,
      liftHeight: 0,
    }));
    expect(assessVariableLegCandidate(broken, project.modes).level).toBe("continuous");
  });

  it.each(["klann", "jansen"] as const)("keeps three offline %s guided baseline seeds", (topology) => {
    expect(guidedSafeBaselineMetadata().seedCount).toBe(6);
    for (const scenario of ["cruise", "sprint", "obstacle"] as const) {
      const baseline = createGuidedSafeBaseline(topology, scenario);
      const gate = assessGuidedHardGate(analyzeVariableLegProject(baseline, 72, 90).metrics, scenario);
      expect(gate.modeId).toBe(scenario);
      expect(Number.isFinite(gate.validRatio)).toBe(true);
      expect(baseline.activeModeId).toBe(scenario);
    }
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

  it("maps a guided scene to three scenario targets without lock state", () => {
    const source = createDefaultVariableLegProject();
    source.deployment.mountSpan = 432;
    const request = createGuidedDesignRequest(source, "obstacle");
    request.targets.stepLength = 310;
    request.targets.liftHeight = 105;
    const recommended = buildGuidedDesignSeed(source, request, "recommended");
    const conservative = buildGuidedDesignSeed(source, request, "conservative");
    const performance = buildGuidedDesignSeed(source, request, "performance");
    for (const seed of [recommended, conservative, performance]) {
      const active = seed.modes.find((mode) => mode.id === "obstacle")!;
      expect(active.weight).toBe(2);
      expect(seed.topology).toBe(source.topology);
      expect(seed.deployment.mountSpan).toBe(432);
    }
    expect(recommended.modes.find((mode) => mode.id === "obstacle")?.rpm).toBe(request.targets.rpm);
    expect(conservative.baseProject.bars.find((bar) => bar.id === conservative.baseProject.driverId)?.length)
      .not.toBe(performance.baseProject.bars.find((bar) => bar.id === performance.baseProject.driverId)?.length);
  });

  it("uses offline scene ranges instead of moving the safe zone with the requested value", () => {
    const source = createDefaultVariableLegProject();
    const cruise = createGuidedDesignRequest(source, "cruise");
    cruise.targets.stepLength = 700;
    const sprint = createGuidedDesignRequest(source, "sprint");
    expect(guidedDesignZones(cruise).stepLength.recommended).toEqual([180, 300]);
    expect(guidedDesignZones(sprint).stepLength.recommended).toEqual([220, 380]);
  });

  it("changes a base bar through a cloned draft and translates telescopic locks", () => {
    const source = createDefaultVariableLegProject();
    const target = source.baseProject.bars.find((bar) => bar.id !== source.baseProject.driverId)!;
    source.adjustment = { kind: "telescopic-bar", targetId: target.id, baseLength: target.length, minimum: target.length - 10, maximum: target.length + 10 };
    source.modes = source.modes.map((mode) => ({ ...mode, adjustmentValue: target.length }));
    const next = setVariableLegBaseBarLength(source, target.id, target.length + 12);
    expect(source.baseProject.bars.find((bar) => bar.id === target.id)?.length).toBe(target.length);
    expect(next.adjustment.kind === "telescopic-bar" && next.adjustment.baseLength).toBeCloseTo(target.length + 12);
    expect(next.adjustment.minimum).toBeCloseTo(target.length + 2);
    expect(next.modes.every((mode) => mode.adjustmentValue === target.length + 12)).toBe(true);
  });

  it.each(["klann", "jansen"] as const)("loads offline parameter baselines for %s", (topology) => {
    const project = createDefaultVariableLegProject();
    project.topology = topology;
    project.baseProject = getVariableLegTemplate(topology);
    const bar = project.baseProject.bars[0];
    const fixed = project.baseProject.joints.find((joint) => joint.fixed)!;
    expect(getVariableLegBaselineBounds(project, { kind: "bar-length", targetId: bar.id }).length).toBeGreaterThan(0);
    expect(getVariableLegBaselineBounds(project, { kind: "fixed-joint-coordinate", targetId: fixed.id, axis: "x" }).length).toBeGreaterThan(0);
  });

  it("updates a fixed pivot through a cloned safe-edit draft", () => {
    const source = createDefaultVariableLegProject();
    const joint = source.baseProject.joints.find((item) => item.id === source.adjustment.targetId)!;
    const next = setVariableLegEditableParameter(source, { kind: "fixed-joint-coordinate", targetId: joint.id, axis: "x" }, joint.x + 8);
    expect(source.baseProject.joints.find((item) => item.id === joint.id)?.x).toBe(joint.x);
    expect(next.baseProject.joints.find((item) => item.id === joint.id)?.x).toBeCloseTo(joint.x + 8);
    expect(next.adjustment.kind === "moving-pivot" && next.adjustment.baseX).toBeCloseTo(joint.x + 8);
  });

  it("previews a Jansen bar edit without mutating the source", () => {
    const source = createDefaultVariableLegProject();
    source.topology = "jansen";
    source.baseProject = getVariableLegTemplate("jansen");
    source.adjustment = createDefaultAdjustment("jansen", "telescopic-bar");
    source.modes = source.modes.slice(0, 1).map((mode) => ({ ...mode, adjustmentValue: source.adjustment.kind === "telescopic-bar" ? source.adjustment.baseLength : 0 }));
    const bar = source.baseProject.bars.find((item) => item.id === "L2")!;
    const bounds = getVariableLegBaselineBounds(source, { kind: "bar-length", targetId: bar.id });
    const preview = previewVariableLegEditableParameter(source, { kind: "bar-length", targetId: bar.id }, bar.length, bounds, 3, 36, 70);
    expect(preview.requestedValid).toBe(true);
    expect(preview.previewProject).not.toBeNull();
    expect(source.baseProject.bars.find((item) => item.id === bar.id)?.length).toBe(bar.length);
  });

  it("keeps an invalid Klann draft out of the project and suggests a feasible value", () => {
    const source = createDefaultVariableLegProject();
    const bar = source.baseProject.bars.find((item) => item.id === "L2")!;
    const bounds = getVariableLegBaselineBounds(source, { kind: "bar-length", targetId: bar.id });
    const preview = previewVariableLegEditableParameter(source, { kind: "bar-length", targetId: bar.id }, 200, bounds);
    expect(preview.requestedValid).toBe(false);
    expect(preview.nearestFeasibleValue).not.toBeNull();
    expect(preview.previewProject?.baseProject.bars.find((item) => item.id === bar.id)?.length).toBeCloseTo(preview.nearestFeasibleValue!);
    expect(source.baseProject.bars.find((item) => item.id === bar.id)?.length).toBe(bar.length);
  });

  it.each(["klann", "jansen"] as const)("loads phase-dependent dynamic envelopes for %s", (topology) => {
    const project = createDefaultVariableLegProject();
    project.topology = topology;
    project.baseProject = getVariableLegTemplate(topology);
    project.adjustment = createDefaultAdjustment(topology, "moving-pivot");
    const candidates = listVariableLegDynamicBars(project);
    expect(candidates.length).toBe(topology === "klann" ? 2 : 4);
    for (const candidate of candidates) {
      expect(candidate.phaseCoverage).toBeGreaterThan(0.5);
      const envelope = getVariableLegDynamicLengthEnvelope(project, candidate.barId, Math.PI / 3);
      expect(envelope).not.toBeNull();
      expect(envelope!.sampledPhase).toBeGreaterThanOrEqual(0);
      expect(envelope!.sampledPhase).toBeLessThan(1);
      expect(envelope!.transition.overlappingTransitionRatio).toBeGreaterThan(0.5);
    }
    expect(variableLegDynamicEnvelopeMetadata().phaseSamples).toBe(72);
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
    expect(first[0].metrics[obstacleIndex].liftHeight).toBeGreaterThanOrEqual(Math.max(...otherClearances) - 5);
    expect(first[0].metrics[obstacleIndex].liftHeight).toBeGreaterThanOrEqual(obstacleTargetClearance * 0.45);
    expect(assessVariableLegCandidate(first[0].metrics, first[0].modes).level).toBe("usable");
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

  it("only returns guided candidates that pass the selected-scene hard gate", async () => {
    const project = createDefaultVariableLegProject();
    project.adjustment = createDefaultAdjustment("klann", "telescopic-bar");
    project.modes = project.modes.map((mode) => ({ ...mode, adjustmentValue: project.adjustment.kind === "telescopic-bar" ? project.adjustment.baseLength : 0 }));
    project.deployment.mountSpan = 515;
    const request = createGuidedDesignRequest(project, "cruise");
    const preflight = preflightGuidedDesign(project, request);
    expect(["current", "safe-baseline"]).toContain(preflight.source);
    const result = await synthesizeVariableLegGuidedDesign(project, request);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.candidates.every((candidate) => candidate.topology === project.topology)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.hardGateResult?.passed && assessGuidedHardGate(candidate.metrics, "cruise").passed)).toBe(true);
    expect(result.candidates.length > 0 || result.suggestions.length > 0).toBe(true);
    expect(project.deployment.mountSpan).toBe(515);
  }, 60_000);

  it("cancels a guided synthesis before it mutates or publishes a result", async () => {
    const project = createDefaultVariableLegProject();
    const request = createGuidedDesignRequest(project, "cruise");
    await expect(synthesizeVariableLegGuidedDesign(project, request, undefined, () => true))
      .rejects.toBeInstanceOf(VariableLegSynthesisCancelled);
    expect(project.candidates).toEqual([]);
  });
});

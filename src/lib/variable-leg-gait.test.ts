import { describe, expect, it } from "vitest";

import { analyzeVariableLegMode, createDefaultVariableLegProject } from "./variable-leg";
import {
  analyzeVariableLegGait,
  appendVariableLegFootprints,
  changeVariableLegCount,
  changeVariableLegPhase,
  changeVariableLegPreset,
  createVariableLegDeployment,
  detectVariableLegTouchdowns,
  variableLegSampleIndex,
  type VariableLegCount,
  type VariableLegFootprint,
} from "./variable-leg-gait";

describe("variable leg gait deployment", () => {
  it.each([2, 4, 6, 8] as const)("creates a deterministic %i-leg deployment", (legCount) => {
    const deployment = createVariableLegDeployment(legCount);
    expect(deployment.legs).toHaveLength(legCount);
    expect(new Set(deployment.legs.map((leg) => leg.id)).size).toBe(legCount);
    expect(deployment.legs.every((leg) => leg.phaseOffset >= 0 && leg.phaseOffset < 1)).toBe(true);
  });

  it.each([4, 6, 8] as const)("spaces the %i-leg wave preset evenly", (legCount) => {
    const deployment = changeVariableLegPreset(createVariableLegDeployment(legCount), "wave");
    const phases = deployment.legs.map((leg) => leg.phaseOffset).sort((a, b) => a - b);
    expect(phases).toEqual(Array.from({ length: legCount }, (_, index) => index / legCount));
  });

  it.each([2, 4, 6, 8] as const)("builds two alternating groups for %i legs", (legCount) => {
    const deployment = changeVariableLegPreset(createVariableLegDeployment(legCount), "alternating");
    expect(new Set(deployment.legs.map((leg) => leg.phaseOffset))).toEqual(new Set([0, 0.5]));
  });

  it("marks a preset as custom after manual phase editing", () => {
    const deployment = createVariableLegDeployment(4);
    const changed = changeVariableLegPhase(deployment, deployment.legs[0].id, 0.33);
    expect(changed.preset).toBe("custom");
    expect(changed.legs[0].phaseOffset).toBeCloseTo(0.33, 8);
  });

  it("changes leg count without mutating the source deployment", () => {
    const source = createVariableLegDeployment(2);
    const changed = changeVariableLegCount(source, 8);
    expect(source.legs).toHaveLength(2);
    expect(changed.legs).toHaveLength(8);
  });

  it("shifts one shared sample cycle by each leg phase", () => {
    expect(variableLegSampleIndex(0, 0, 72)).toBe(0);
    expect(variableLegSampleIndex(0, 0.5, 72)).toBe(36);
    expect(variableLegSampleIndex(Math.PI, 0.5, 72)).toBe(0);
  });

  it.each([2, 4, 6, 8] as VariableLegCount[])("keeps the default %i-leg gait supported", (legCount) => {
    const project = createDefaultVariableLegProject();
    const mode = project.modes[0];
    const metrics = analyzeVariableLegMode(project.baseProject, project.adjustment, mode, 72, 90);
    const gait = analyzeVariableLegGait(createVariableLegDeployment(legCount), mode, metrics);
    expect(gait.minimumSupport).toBeGreaterThanOrEqual(1);
    expect(gait.supportCoverage).toBe(1);
    expect(gait.smoothnessScore).toBeGreaterThan(50);
  });

  it("detects each touchdown once across a wrapped phase interval", () => {
    const project = createDefaultVariableLegProject();
    const mode = project.modes[0];
    const metrics = analyzeVariableLegMode(project.baseProject, project.adjustment, mode, 72, 90);
    const deployment = createVariableLegDeployment(2);
    const touchdown = deployment.legs
      .map((leg) => ((mode.stanceStart - metrics.targetPhaseOffset - leg.phaseOffset) % 1 + 1) % 1)
      .sort((a, b) => a - b)[0];
    const before = ((touchdown - 0.01 + 1) % 1) * Math.PI * 2;
    const after = ((touchdown + 0.01) % 1) * Math.PI * 2;
    expect(detectVariableLegTouchdowns(before, after, deployment, mode, metrics)).toHaveLength(1);
    expect(detectVariableLegTouchdowns(after, after + 0.01, deployment, mode, metrics)).toHaveLength(0);
  });

  it("keeps only the latest 80 footprints", () => {
    const footprint = (sequence: number): VariableLegFootprint => ({
      id: `footprint-${sequence}`,
      legId: "left-0",
      label: "左",
      side: "left",
      sequence,
      worldX: sequence,
      worldY: 0,
    });
    const result = appendVariableLegFootprints(
      Array.from({ length: 79 }, (_, index) => footprint(index)),
      [footprint(79), footprint(80)],
    );
    expect(result).toHaveLength(80);
    expect(result[0].sequence).toBe(1);
    expect(result.at(-1)?.sequence).toBe(80);
  });
});

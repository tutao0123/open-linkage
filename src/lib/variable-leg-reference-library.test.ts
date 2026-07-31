import { describe, expect, it } from "vitest";

import referenceData from "../data/variable-leg-reference-library.json";
import {
  VARIABLE_LEG_SOLVER_PROFILES,
  analyzeVariableLegProject,
  isVariableLegProject,
} from "./variable-leg";
import {
  VARIABLE_LEG_REFERENCE_LIBRARY_METADATA,
  createVariableLegReferenceProject,
  listVariableLegReferencePresets,
  matchVariableLegReference,
  variableLegReferenceLibraryMetadata,
  type ReferencePresetId,
} from "./variable-leg-reference-library";

describe("variable-leg reference library", () => {
  it("publishes three verified, beginner-facing presets", () => {
    const presets = listVariableLegReferencePresets();
    expect(presets.map((preset) => preset.id)).toEqual(["smooth", "quick", "high-step"]);
    expect(presets.every((preset) => preset.label && preset.description)).toBe(true);
    expect(presets.every((preset) => preset.topology === "jansen")).toBe(true);
    expect(presets.every((preset) => preset.adjustmentTarget === "L8")).toBe(true);
    expect(presets.every((preset) => preset.hardPassed && preset.strictPassed)).toBe(true);
    expect(presets.every((preset) => (
      preset.stepLength > 0
      && preset.liftHeight > 0
      && preset.rpm > 0
      && preset.metrics.stepLength === preset.stepLength
    ))).toBe(true);
  });

  it.each(["smooth", "quick", "high-step"] as const)(
    "creates a deeply cloned, runtime-passing %s project",
    (presetId) => {
      const first = createVariableLegReferenceProject(presetId);
      const second = createVariableLegReferenceProject(presetId);
      expect(isVariableLegProject(first)).toBe(true);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.baseProject).not.toBe(second.baseProject);
      expect(first.modes[0].targetPath).not.toBe(second.modes[0].targetPath);

      first.baseProject.joints[0].x += 99;
      first.modes[0].targetPath[0].x += 99;
      first.requirements[0].constraints.stepLength.target += 99;
      expect(createVariableLegReferenceProject(presetId)).toEqual(second);

      const analysis = analyzeVariableLegProject(
        second,
        VARIABLE_LEG_SOLVER_PROFILES.runtime.phaseSamples,
        VARIABLE_LEG_SOLVER_PROFILES.runtime.iterations,
      );
      expect(analysis.evaluation.hardPassed).toBe(true);
      expect(analysis.evaluation.issues).toEqual([]);
      expect(
        analysis.evaluation.conditions.find((condition) => condition.modeId === second.activeModeId)
          ?.hardPassed,
      ).toBe(true);
    },
    20_000,
  );

  it.each(["smooth", "quick", "high-step"] as const)(
    "keeps the complete %s reference family safe when supporting modes are enabled",
    (presetId) => {
      const project = createVariableLegReferenceProject(presetId);
      project.requirements = project.requirements.map((requirement) => ({
        ...requirement,
        enabled: true,
      }));

      for (const profile of [
        VARIABLE_LEG_SOLVER_PROFILES.runtime,
        VARIABLE_LEG_SOLVER_PROFILES.strict,
      ]) {
        const analysis = analyzeVariableLegProject(
          project,
          profile.phaseSamples,
          profile.iterations,
        );
        expect(analysis.evaluation.hardPassed).toBe(true);
        expect(analysis.evaluation.conditions.every((condition) => (
          condition.safety.every((item) => item.passed)
        ))).toBe(true);
      }
    },
    20_000,
  );

  it("stores complete publication evidence and actual paths", () => {
    expect(referenceData.metadata.runtimeProfile).toEqual({ phaseSamples: 72, iterations: 90 });
    expect(referenceData.metadata.strictProfile).toEqual({ phaseSamples: 144, iterations: 200 });
    for (const preset of referenceData.presets) {
      expect(preset.project.mechanismType).toBe("variable-geometry-leg");
      expect(preset.actualPath).toHaveLength(72);
      expect(preset.metrics.path).toEqual(preset.actualPath);
      expect(preset.solverVersion).toBe(referenceData.metadata.solverVersion);
      expect(preset.metricVersion).toBe(referenceData.metadata.metricVersion);
      expect(preset.evidence.runtime.hardPassed).toBe(true);
      expect(preset.evidence.runtime.hardGatePassed).toBe(true);
      expect(preset.evidence.runtime.issues).toEqual([]);
      expect(preset.evidence.strict.hardPassed).toBe(true);
      expect(preset.evidence.strict.hardGatePassed).toBe(true);
      expect(preset.evidence.strict.issues).toEqual([]);
      expect(preset.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("matches exact preset metrics deterministically", () => {
    for (const preset of listVariableLegReferencePresets()) {
      const match = matchVariableLegReference({
        stepLength: preset.stepLength,
        liftHeight: preset.liftHeight,
        rpm: preset.rpm,
        topology: preset.topology,
      });
      expect(match.presetId).toBe(preset.id);
      expect(match.distance).toBeCloseTo(0, 12);
      expect(match.metadata.confidence).toBe("exact");
      expect(match.metadata.topologyFallback).toBe(false);
      expect(match.project.activeModeId).toBe(preset.modeId);
    }
  });

  it("falls back explicitly when the requested topology has no published reference", () => {
    const match = matchVariableLegReference({
      stepLength: 205,
      liftHeight: 70,
      rpm: 14,
      topology: "klann",
    });
    expect(match.presetId).toBe("smooth");
    expect(match.project.topology).toBe("jansen");
    expect(match.metadata.topologyFallback).toBe(true);
  });

  it("returns independent metadata snapshots and rejects non-finite matching inputs", () => {
    const first = variableLegReferenceLibraryMetadata();
    const second = variableLegReferenceLibraryMetadata();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.runtimeProfile).not.toBe(second.runtimeProfile);
    expect(first.defaultPresetId).toBe("smooth");
    expect(VARIABLE_LEG_REFERENCE_LIBRARY_METADATA.presetCount).toBe(3);

    expect(() => matchVariableLegReference({
      stepLength: Number.NaN,
      liftHeight: 60,
      rpm: 14,
    })).toThrow(/stepLength/);
  });

  it("uses the default smooth preset and validates unknown runtime ids", () => {
    expect(createVariableLegReferenceProject().activeModeId).toBe("cruise");
    expect(() => createVariableLegReferenceProject("missing" as ReferencePresetId))
      .toThrow(/Unknown variable-leg reference preset/);
  });
});

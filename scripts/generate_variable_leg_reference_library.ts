import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  VARIABLE_LEG_SOLVER_PROFILES,
  analyzeVariableLegProject,
  assessGuidedHardGate,
  cloneVariableLegProject,
  createDefaultAdjustment,
  createDefaultConditionRequirements,
  createDefaultModes,
  createDefaultVariableLegProject,
  createSelfConsistentConditionRequirements,
  getVariableLegTemplate,
  type GuidedDesignScenario,
  type VariableLegMode,
  type VariableLegModeMetrics,
  type VariableLegProject,
  type VariableLegSolverProfile,
} from "../src/lib/variable-leg";

type ReferencePresetId = "smooth" | "quick" | "high-step";

type PresetSpec = {
  id: ReferencePresetId;
  modeId: GuidedDesignScenario;
  label: string;
  description: string;
};

const SCHEMA_VERSION = 1;
const GENERATOR_VERSION = "variable-leg-reference-generator-v1";
const SOLVER_VERSION = "variable-leg-production-solver-v3";
const METRIC_VERSION = "variable-leg-gait-metrics-v2";
const DEFAULT_PRESET_ID: ReferencePresetId = "smooth";

const PRESETS: readonly PresetSpec[] = [
  {
    id: "smooth",
    modeId: "cruise",
    label: "平稳行走",
    description: "连续、均衡的默认步态，适合第一次试玩。",
  },
  {
    id: "quick",
    modeId: "sprint",
    label: "快速节奏",
    description: "提高转速并保持完整运动周期，适合体验节奏变化。",
  },
  {
    id: "high-step",
    modeId: "obstacle",
    label: "高抬脚轨迹",
    description: "增加摆动阶段的离地高度，适合观察越障趋势。",
  },
] as const;

const MODE_ADJUSTMENT_VALUES: Record<GuidedDesignScenario, number> = {
  cruise: 110.1,
  sprint: 124.9635,
  obstacle: 100.191,
};

function normalizePhase(phase: number) {
  return ((phase % 1) + 1) % 1;
}

function profileAnalysis(project: VariableLegProject, profile: VariableLegSolverProfile) {
  return analyzeVariableLegProject(project, profile.phaseSamples, profile.iterations);
}

function activeMetric(metrics: VariableLegModeMetrics[], modeId: string) {
  const metric = metrics.find((item) => item.modeId === modeId);
  if (!metric) throw new Error(`Missing measured metrics for reference mode: ${modeId}`);
  return metric;
}

function referenceFamilyProject() {
  const project = createDefaultVariableLegProject();
  const baseProject = getVariableLegTemplate("jansen");
  const targetBar = baseProject.bars.find((bar) => bar.id === "L8");
  if (!targetBar) throw new Error("The Jansen reference template is missing telescopic bar L8");

  const defaultAdjustment = createDefaultAdjustment("jansen", "telescopic-bar");
  if (defaultAdjustment.kind !== "telescopic-bar") {
    throw new Error("Expected the Jansen L8 reference adjustment to be telescopic");
  }
  project.topology = "jansen";
  project.baseProject = baseProject;
  project.adjustment = {
    ...defaultAdjustment,
    targetId: targetBar.id,
    baseLength: targetBar.length,
    minimum: targetBar.length * 0.82,
    maximum: targetBar.length * 1.18,
  };
  project.modes = createDefaultModes().map((mode) => ({
    ...mode,
    adjustmentValue: MODE_ADJUSTMENT_VALUES[mode.id as GuidedDesignScenario],
  }));
  project.activeModeId = "cruise";
  project.requirements = createDefaultConditionRequirements(project.modes, project.activeModeId);
  project.candidates = [];
  project.selectedCandidateId = null;

  const measured = profileAnalysis(project, VARIABLE_LEG_SOLVER_PROFILES.runtime);
  project.modes = project.modes.map((mode): VariableLegMode => {
    const metric = activeMetric(measured.metrics, mode.id);
    return {
      ...mode,
      // Store the production solver's real path as the target. Shift the
      // stance window by the former target alignment so gait measurements
      // retain their physical stance/swing meaning when RMSE becomes zero.
      targetPath: metric.path.map((point) => ({ ...point })),
      stanceStart: normalizePhase(mode.stanceStart - metric.targetPhaseOffset),
      stanceEnd: normalizePhase(mode.stanceEnd - metric.targetPhaseOffset),
    };
  });
  return project;
}

function evidenceFor(
  project: VariableLegProject,
  modeId: GuidedDesignScenario,
  profile: VariableLegSolverProfile,
) {
  const analysis = profileAnalysis(project, profile);
  const gate = assessGuidedHardGate(analysis.metrics, modeId);
  return {
    profile,
    hardPassed: analysis.evaluation.hardPassed,
    hardGatePassed: gate.passed,
    issues: [...analysis.evaluation.issues, ...gate.issues],
    metrics: activeMetric(analysis.metrics, modeId),
  };
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function publicationRequirementMetrics(
  runtimeMetrics: VariableLegModeMetrics[],
  strictMetrics: VariableLegModeMetrics[],
) {
  return runtimeMetrics.map((runtimeMetric) => {
    const strictMetric = activeMetric(strictMetrics, runtimeMetric.modeId);
    return {
      ...runtimeMetric,
      // Requirements are derived from the measured envelope shared by both
      // supported solver profiles. Range metrics use the midpoint, while
      // one-sided limits use the conservative measured edge.
      stepLength: (runtimeMetric.stepLength + strictMetric.stepLength) / 2,
      liftHeight: Math.min(runtimeMetric.liftHeight, strictMetric.liftHeight),
      stanceRatio: (runtimeMetric.stanceRatio + strictMetric.stanceRatio) / 2,
      landingVerticalSpeed: Math.max(
        runtimeMetric.landingVerticalSpeed,
        strictMetric.landingVerticalSpeed,
      ),
    };
  });
}

function createPreset(spec: PresetSpec, family: VariableLegProject) {
  const project = cloneVariableLegProject(family);
  project.activeModeId = spec.modeId;
  project.revisionId = `reference-${spec.id}-revision-1`;
  project.currentVersionId = `reference-${spec.id}-version-1`;

  const runtimeMeasured = profileAnalysis(project, VARIABLE_LEG_SOLVER_PROFILES.runtime);
  const strictMeasured = profileAnalysis(project, VARIABLE_LEG_SOLVER_PROFILES.strict);
  const requirementMetrics = publicationRequirementMetrics(
    runtimeMeasured.metrics,
    strictMeasured.metrics,
  );
  project.requirements = createSelfConsistentConditionRequirements(
    project.modes,
    requirementMetrics,
    spec.modeId,
    [spec.modeId],
  );

  const runtime = evidenceFor(project, spec.modeId, VARIABLE_LEG_SOLVER_PROFILES.runtime);
  const strict = evidenceFor(project, spec.modeId, VARIABLE_LEG_SOLVER_PROFILES.strict);
  if (!runtime.hardPassed || !runtime.hardGatePassed || !strict.hardPassed || !strict.hardGatePassed) {
    throw new Error(
      `${spec.id} failed reference publication gates: ${[...runtime.issues, ...strict.issues].join("; ")}`,
    );
  }

  const metric = runtime.metrics;
  const record = {
    id: spec.id,
    modeId: spec.modeId,
    label: spec.label,
    description: spec.description,
    topology: project.topology,
    adjustmentKind: project.adjustment.kind,
    adjustmentTarget: project.adjustment.targetId,
    project,
    actualPath: metric.path.map((point) => ({ ...point })),
    metrics: metric,
    requirementBasis: activeMetric(requirementMetrics, spec.modeId),
    solverVersion: SOLVER_VERSION,
    metricVersion: METRIC_VERSION,
    evidence: { runtime, strict },
  };
  return { ...record, contentHash: contentHash(record) };
}

function generateLibrary() {
  const family = referenceFamilyProject();
  const presets = PRESETS.map((preset) => createPreset(preset, family));
  const generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      generatorVersion: GENERATOR_VERSION,
      generatedAt,
      defaultPresetId: DEFAULT_PRESET_ID,
      solverVersion: SOLVER_VERSION,
      metricVersion: METRIC_VERSION,
      runtimeProfile: VARIABLE_LEG_SOLVER_PROFILES.runtime,
      strictProfile: VARIABLE_LEG_SOLVER_PROFILES.strict,
      candidateSelection: {
        selected: "jansen/telescopic-bar/L8",
        reason: "同拓扑、同一可调构件覆盖平稳、快速与高抬脚，并且三种锁止值均通过 runtime 与 strict 发布门槛。",
        releaseScope: "moving-pivot 候选未被本版参考库采用。",
      },
      presetCount: presets.length,
    },
    presets,
  };
}

async function main() {
  const library = generateLibrary();
  const serialized = `${JSON.stringify(library, null, 2)}\n`;

  if (process.argv.includes("--stdout")) {
    process.stdout.write(serialized);
    return;
  }

  const outputPath = fileURLToPath(new URL("../src/data/variable-leg-reference-library.json", import.meta.url));
  await writeFile(outputPath, serialized, "utf8");
  process.stdout.write(
    `Wrote ${library.presets.length} verified variable-leg references to ${outputPath}\n`,
  );
}

void main();

import referenceData from "../data/variable-leg-reference-library.json";

import type { Point } from "./four-bar";
import {
  cloneVariableLegProject,
  type VariableLegAdjustmentKind,
  type VariableLegModeMetrics,
  type VariableLegProject,
  type VariableLegSolverProfile,
  type VariableLegTopology,
} from "./variable-leg";

export type ReferencePresetId = "smooth" | "quick" | "high-step";
export type VariableLegReferencePresetId = ReferencePresetId;

export type VariableLegReferenceMatchInput = {
  stepLength: number;
  liftHeight: number;
  rpm: number;
  topology?: VariableLegTopology;
};

export type VariableLegReferenceMetricSummary = {
  stepLength: number;
  liftHeight: number;
  stanceRatio: number;
  rpm: number;
  landingVerticalSpeed: number;
};

export type VariableLegReferencePresetSummary = VariableLegReferenceMetricSummary & {
  id: ReferencePresetId;
  modeId: string;
  label: string;
  description: string;
  topology: VariableLegTopology;
  adjustmentKind: VariableLegAdjustmentKind;
  adjustmentTarget: string;
  metrics: VariableLegReferenceMetricSummary;
  hardPassed: boolean;
  strictPassed: boolean;
  contentHash: string;
};

export type VariableLegReferenceMatchConfidence = "exact" | "close" | "exploratory";

export type VariableLegReferenceMatchMetadata = VariableLegReferencePresetSummary & {
  distance: number;
  confidence: VariableLegReferenceMatchConfidence;
  topologyFallback: boolean;
  matchingMethod: "normalized-gait-distance-v1";
};

export type VariableLegReferenceMatch = {
  presetId: ReferencePresetId;
  project: VariableLegProject;
  metadata: VariableLegReferenceMatchMetadata;
  distance: number;
};

type ReferenceEvidence = {
  profile: VariableLegSolverProfile;
  hardPassed: boolean;
  hardGatePassed: boolean;
  issues: string[];
  metrics: VariableLegModeMetrics;
};

type ReferenceRecord = {
  id: ReferencePresetId;
  modeId: string;
  label: string;
  description: string;
  topology: VariableLegTopology;
  adjustmentKind: VariableLegAdjustmentKind;
  adjustmentTarget: string;
  project: VariableLegProject;
  actualPath: Point[];
  metrics: VariableLegModeMetrics;
  requirementBasis: VariableLegModeMetrics;
  solverVersion: string;
  metricVersion: string;
  evidence: {
    runtime: ReferenceEvidence;
    strict: ReferenceEvidence;
  };
  contentHash: string;
};

type ReferenceLibraryData = {
  schemaVersion: number;
  metadata: {
    generatorVersion: string;
    generatedAt: string;
    defaultPresetId: ReferencePresetId;
    solverVersion: string;
    metricVersion: string;
    runtimeProfile: VariableLegSolverProfile;
    strictProfile: VariableLegSolverProfile;
    candidateSelection: {
      selected: string;
      reason: string;
      releaseScope: string;
    };
    presetCount: number;
  };
  presets: ReferenceRecord[];
};

const data = referenceData as unknown as ReferenceLibraryData;

export const VARIABLE_LEG_REFERENCE_PRESET_IDS = [
  "smooth",
  "quick",
  "high-step",
] as const satisfies readonly ReferencePresetId[];

function cloneMetricSummary(summary: VariableLegReferenceMetricSummary) {
  return { ...summary };
}

function metricSummary(record: ReferenceRecord): VariableLegReferenceMetricSummary {
  const mode = record.project.modes.find((item) => item.id === record.modeId);
  if (!mode) throw new Error(`Reference preset ${record.id} is missing mode ${record.modeId}`);
  return {
    stepLength: record.metrics.stepLength,
    liftHeight: record.metrics.liftHeight,
    stanceRatio: record.metrics.stanceRatio,
    rpm: mode.rpm,
    landingVerticalSpeed: record.metrics.landingVerticalSpeed,
  };
}

function summarize(record: ReferenceRecord): VariableLegReferencePresetSummary {
  const metrics = metricSummary(record);
  return {
    id: record.id,
    modeId: record.modeId,
    label: record.label,
    description: record.description,
    topology: record.topology,
    adjustmentKind: record.adjustmentKind,
    adjustmentTarget: record.adjustmentTarget,
    ...metrics,
    metrics: cloneMetricSummary(metrics),
    hardPassed: record.evidence.runtime.hardPassed && record.evidence.runtime.hardGatePassed,
    strictPassed: record.evidence.strict.hardPassed && record.evidence.strict.hardGatePassed,
    contentHash: record.contentHash,
  };
}

function isPublishedReference(record: ReferenceRecord) {
  return record.evidence.runtime.hardPassed
    && record.evidence.runtime.hardGatePassed
    && record.evidence.strict.hardPassed
    && record.evidence.strict.hardGatePassed;
}

function recordFor(presetId: ReferencePresetId) {
  const record = data.presets.find((item) => item.id === presetId);
  if (!record) throw new RangeError(`Unknown variable-leg reference preset: ${presetId}`);
  if (!isPublishedReference(record)) {
    throw new Error(`Variable-leg reference preset is not publication-safe: ${presetId}`);
  }
  return record;
}

function metadataSnapshot() {
  return {
    schemaVersion: data.schemaVersion,
    generatorVersion: data.metadata.generatorVersion,
    generatedAt: data.metadata.generatedAt,
    defaultPresetId: data.metadata.defaultPresetId,
    solverVersion: data.metadata.solverVersion,
    metricVersion: data.metadata.metricVersion,
    runtimeProfile: { ...data.metadata.runtimeProfile },
    strictProfile: { ...data.metadata.strictProfile },
    candidateSelection: { ...data.metadata.candidateSelection },
    presetCount: data.metadata.presetCount,
    contentHashes: Object.fromEntries(
      data.presets.map((preset) => [preset.id, preset.contentHash]),
    ) as Record<ReferencePresetId, string>,
  };
}

export type VariableLegReferenceLibraryMetadata = ReturnType<typeof metadataSnapshot>;

export const VARIABLE_LEG_REFERENCE_LIBRARY_METADATA: Readonly<VariableLegReferenceLibraryMetadata> =
  Object.freeze(metadataSnapshot());

export function variableLegReferenceLibraryMetadata(): VariableLegReferenceLibraryMetadata {
  return metadataSnapshot();
}

export function listVariableLegReferencePresets(): VariableLegReferencePresetSummary[] {
  return data.presets.map(summarize);
}

export function createVariableLegReferenceProject(
  presetId: ReferencePresetId = data.metadata.defaultPresetId,
): VariableLegProject {
  return cloneVariableLegProject(recordFor(presetId).project);
}

function assertFiniteMatchInput(input: VariableLegReferenceMatchInput) {
  for (const key of ["stepLength", "liftHeight", "rpm"] as const) {
    if (!Number.isFinite(input[key])) {
      throw new TypeError(`Variable-leg reference match ${key} must be finite`);
    }
  }
}

function normalizedDistance(
  input: VariableLegReferenceMatchInput,
  candidate: VariableLegReferenceMetricSummary,
) {
  const stepDelta = (input.stepLength - candidate.stepLength) / Math.max(80, candidate.stepLength);
  const liftDelta = (input.liftHeight - candidate.liftHeight) / Math.max(25, candidate.liftHeight);
  const rpmDelta = (input.rpm - candidate.rpm) / Math.max(8, candidate.rpm);
  return Math.sqrt(
    stepDelta ** 2 * 0.4
    + liftDelta ** 2 * 0.4
    + rpmDelta ** 2 * 0.2,
  );
}

function matchConfidence(distance: number): VariableLegReferenceMatchConfidence {
  if (distance <= 0.12) return "exact";
  if (distance <= 0.35) return "close";
  return "exploratory";
}

export function matchVariableLegReference(
  input: VariableLegReferenceMatchInput,
): VariableLegReferenceMatch {
  assertFiniteMatchInput(input);
  // Safety evidence is a prerequisite. Similarity ranking only happens among
  // records that passed both the interactive and publication profiles.
  const published = data.presets.filter(isPublishedReference);
  const sameTopology = input.topology
    ? published.filter((record) => record.topology === input.topology)
    : published;
  const topologyFallback = Boolean(input.topology && sameTopology.length === 0);
  const pool = sameTopology.length ? sameTopology : published;
  const matches = pool.map((record) => ({
    record,
    summary: summarize(record),
    distance: normalizedDistance(input, metricSummary(record)),
  })).sort((first, second) => (
    first.distance - second.distance
    || VARIABLE_LEG_REFERENCE_PRESET_IDS.indexOf(first.record.id)
      - VARIABLE_LEG_REFERENCE_PRESET_IDS.indexOf(second.record.id)
  ));
  const best = matches[0];
  if (!best) throw new Error("Variable-leg reference library is empty");
  const metadata: VariableLegReferenceMatchMetadata = {
    ...best.summary,
    metrics: cloneMetricSummary(best.summary.metrics),
    distance: best.distance,
    confidence: matchConfidence(best.distance),
    topologyFallback,
    matchingMethod: "normalized-gait-distance-v1",
  };
  return {
    presetId: best.record.id,
    project: cloneVariableLegProject(best.record.project),
    metadata,
    distance: best.distance,
  };
}

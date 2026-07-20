import dynamicEnvelopeData from "../data/variable-leg-dynamic-envelopes.json";

import type { VariableLegFeasibleInterval, VariableLegProject } from "./variable-leg";

type NormalizedInterval = VariableLegFeasibleInterval & { minimumSingularityMargin: number };
type DynamicPhase = {
  phase: number;
  intervals: NormalizedInterval[];
  recommended: number | null;
  minimumSingularityMargin: number | null;
};
type TransitionSummary = {
  phaseCoverage: number;
  overlappingTransitionRatio: number;
  maxRecommendedSpeed: number;
  maxRecommendedAcceleration: number;
};
type DynamicMode = {
  id?: string;
  name?: string;
  rpm?: number;
  phases: DynamicPhase[];
  transition: TransitionSummary;
};
type DynamicBar = {
  barId: string;
  label: string;
  baseline: number;
  ratioRange: VariableLegFeasibleInterval;
  modes: Record<string, DynamicMode>;
  common: DynamicMode & { conservativeRpm: number };
};

const data = dynamicEnvelopeData as unknown as {
  version: number;
  generatedAt: string;
  solver: { phaseSamples: number; lengthSamples: number; iterations: number };
  topologies: Record<string, { bars: Record<string, DynamicBar> }>;
};

function circularDistance(first: number, second: number) {
  const direct = Math.abs(first - second);
  return Math.min(direct, 1 - direct);
}

export type VariableLegDynamicLengthEnvelope = {
  barId: string;
  modeId: string;
  sampledPhase: number;
  intervals: Array<VariableLegFeasibleInterval & { minimumSingularityMargin: number }>;
  recommendedLength: number | null;
  minimumSingularityMargin: number | null;
  transition: TransitionSummary;
  conservativeRpm: number | null;
};

export function getVariableLegDynamicLengthEnvelope(
  project: VariableLegProject,
  barId: string,
  phaseRadians: number,
  modeId: string = "common",
): VariableLegDynamicLengthEnvelope | null {
  const barData = data.topologies[project.topology]?.bars[barId];
  const currentBar = project.baseProject.bars.find((bar) => bar.id === barId);
  const mode = modeId === "common" ? barData?.common : barData?.modes[modeId];
  if (!barData || !currentBar || !mode?.phases.length) return null;
  const normalizedPhase = ((phaseRadians / (Math.PI * 2)) % 1 + 1) % 1;
  const nearest = mode.phases.reduce((best, phase) => (
    circularDistance(phase.phase, normalizedPhase) < circularDistance(best.phase, normalizedPhase) ? phase : best
  ));
  return {
    barId,
    modeId,
    sampledPhase: nearest.phase,
    intervals: nearest.intervals.map((interval) => ({
      minimum: currentBar.length * interval.minimum,
      maximum: currentBar.length * interval.maximum,
      minimumSingularityMargin: interval.minimumSingularityMargin,
    })),
    recommendedLength: nearest.recommended === null ? null : currentBar.length * nearest.recommended,
    minimumSingularityMargin: nearest.minimumSingularityMargin,
    transition: {
      ...mode.transition,
      maxRecommendedSpeed: mode.transition.maxRecommendedSpeed * currentBar.length / barData.baseline,
      maxRecommendedAcceleration: mode.transition.maxRecommendedAcceleration * currentBar.length / barData.baseline,
    },
    conservativeRpm: modeId === "common" ? barData.common.conservativeRpm : mode.rpm ?? null,
  };
}

export function listVariableLegDynamicBars(project: VariableLegProject) {
  return Object.values(data.topologies[project.topology]?.bars ?? {}).map((bar) => ({
    barId: bar.barId,
    label: bar.label,
    phaseCoverage: bar.common.transition.phaseCoverage,
    overlappingTransitionRatio: bar.common.transition.overlappingTransitionRatio,
  }));
}

export function variableLegDynamicEnvelopeMetadata() {
  return { version: data.version, generatedAt: data.generatedAt, ...data.solver };
}

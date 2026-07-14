import type { VariableLegMode, VariableLegModeMetrics } from "./variable-leg";

export type VariableLegCount = 2 | 4 | 6 | 8;
export type VariableLegSide = "left" | "right";
export type VariableLegGaitPreset = "wave" | "alternating" | "synchronous" | "custom";

export type VariableLegDeploymentLeg = {
  id: string;
  label: string;
  side: VariableLegSide;
  station: number;
  phaseOffset: number;
};

export type VariableLegDeployment = {
  legCount: VariableLegCount;
  preset: VariableLegGaitPreset;
  mountSpan: number;
  showFootprints: boolean;
  legs: VariableLegDeploymentLeg[];
};

export type VariableLegGaitMetrics = {
  minimumSupport: number;
  maximumSupport: number;
  supportCoverage: number;
  touchdownUniformity: number;
  supportUniformity: number;
  stanceSlip: number;
  maximumTouchdownCluster: number;
  smoothnessScore: number;
  touchdownPhases: number[];
};

export type VariableLegFootprint = {
  id: string;
  legId: string;
  label: string;
  side: VariableLegSide;
  sequence: number;
  worldX: number;
  worldY: number;
};

const LEG_COUNTS = [2, 4, 6, 8] as const;

export function normalizeCycle(value: number) {
  return ((value % 1) + 1) % 1;
}

export function isVariableLegCount(value: unknown): value is VariableLegCount {
  return typeof value === "number" && LEG_COUNTS.includes(value as VariableLegCount);
}

function stationLabel(station: number, stationCount: number) {
  if (stationCount === 1) return "";
  if (stationCount === 2) return station === 0 ? "前" : "后";
  if (stationCount === 3) return ["前", "中", "后"][station];
  return ["前", "中前", "中后", "后"][station];
}

function createLegs(legCount: VariableLegCount): VariableLegDeploymentLeg[] {
  const stationCount = legCount / 2;
  return Array.from({ length: stationCount }, (_, station) => (["left", "right"] as const).map((side) => ({
    id: `${side}-${station}`,
    label: `${side === "left" ? "左" : "右"}${stationLabel(station, stationCount)}`,
    side,
    station,
    phaseOffset: 0,
  }))).flat();
}

function waveOrder(legs: VariableLegDeploymentLeg[]) {
  const left = legs.filter((leg) => leg.side === "left").sort((a, b) => a.station - b.station);
  const right = legs.filter((leg) => leg.side === "right").sort((a, b) => b.station - a.station);
  return [...left, ...right];
}

export function applyVariableLegPreset(
  legs: VariableLegDeploymentLeg[],
  preset: Exclude<VariableLegGaitPreset, "custom">,
) {
  const ordered = waveOrder(legs);
  const waveIndex = new Map(ordered.map((leg, index) => [leg.id, index]));
  return legs.map((leg) => {
    let phaseOffset = 0;
    if (preset === "wave") phaseOffset = (waveIndex.get(leg.id) ?? 0) / Math.max(1, legs.length);
    if (preset === "alternating") phaseOffset = (leg.station + (leg.side === "right" ? 1 : 0)) % 2 ? 0.5 : 0;
    return { ...leg, phaseOffset };
  });
}

export function createVariableLegDeployment(
  legCount: VariableLegCount = 2,
  preset: Exclude<VariableLegGaitPreset, "custom"> = legCount === 2 ? "alternating" : "wave",
): VariableLegDeployment {
  const legs = createLegs(legCount);
  return {
    legCount,
    preset,
    mountSpan: legCount === 2 ? 0 : 420,
    showFootprints: true,
    legs: applyVariableLegPreset(legs, preset),
  };
}

export function changeVariableLegCount(deployment: VariableLegDeployment, legCount: VariableLegCount) {
  const preset = legCount === 2 ? "alternating" : "wave";
  return { ...createVariableLegDeployment(legCount, preset), mountSpan: deployment.mountSpan || 420, showFootprints: deployment.showFootprints };
}

export function changeVariableLegPreset(
  deployment: VariableLegDeployment,
  preset: Exclude<VariableLegGaitPreset, "custom">,
): VariableLegDeployment {
  return { ...deployment, preset, legs: applyVariableLegPreset(deployment.legs, preset) };
}

export function changeVariableLegPhase(deployment: VariableLegDeployment, legId: string, phaseOffset: number) {
  return {
    ...deployment,
    preset: "custom" as const,
    legs: deployment.legs.map((leg) => leg.id === legId ? { ...leg, phaseOffset: normalizeCycle(phaseOffset) } : leg),
  };
}

export function variableLegPresetLabel(legCount: VariableLegCount, preset: VariableLegGaitPreset) {
  if (preset === "custom") return "自定义相位";
  if (preset === "synchronous") return "同步步";
  if (preset === "alternating") return ({ 2: "交替步", 4: "对角小跑", 6: "三足交替", 8: "四足交替" } as const)[legCount];
  return ({ 2: "交替步", 4: "四拍行走", 6: "六拍波步", 8: "八拍波步" } as const)[legCount];
}

export function variableLegPresetOptions(legCount: VariableLegCount) {
  const presets: Array<Exclude<VariableLegGaitPreset, "custom">> = legCount === 2
    ? ["alternating", "synchronous"]
    : ["wave", "alternating", "synchronous"];
  return presets.map((value) => ({ value, label: variableLegPresetLabel(legCount, value) }));
}

export function variableLegMountX(leg: VariableLegDeploymentLeg, deployment: VariableLegDeployment) {
  const stationCount = deployment.legCount / 2;
  if (stationCount <= 1) return 0;
  return -deployment.mountSpan / 2 + deployment.mountSpan * leg.station / (stationCount - 1);
}

export function phaseIsInVariableLegStance(phase: number, start: number, end: number) {
  const normalizedPhase = normalizeCycle(phase);
  const normalizedStart = normalizeCycle(start);
  const normalizedEnd = normalizeCycle(end);
  if (normalizedStart <= normalizedEnd) return normalizedPhase >= normalizedStart && normalizedPhase <= normalizedEnd;
  return normalizedPhase >= normalizedStart || normalizedPhase <= normalizedEnd;
}

export function variableLegTargetPhase(
  inputPhase: number,
  phaseOffset: number,
  targetPhaseOffset: number,
) {
  return normalizeCycle(inputPhase / (Math.PI * 2) + phaseOffset + targetPhaseOffset);
}

export function variableLegSampleIndex(inputPhase: number, phaseOffset: number, sampleCount: number) {
  if (sampleCount <= 0) return 0;
  return Math.floor(normalizeCycle(inputPhase / (Math.PI * 2) + phaseOffset) * sampleCount) % sampleCount;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function variableLegTouchdownPhase(
  leg: VariableLegDeploymentLeg,
  mode: VariableLegMode,
  metrics: Pick<VariableLegModeMetrics, "targetPhaseOffset">,
) {
  return normalizeCycle(mode.stanceStart - metrics.targetPhaseOffset - leg.phaseOffset);
}

export function detectVariableLegTouchdowns(
  previousPhase: number,
  currentPhase: number,
  deployment: VariableLegDeployment,
  mode: VariableLegMode,
  metrics: Pick<VariableLegModeMetrics, "targetPhaseOffset">,
) {
  const previous = normalizeCycle(previousPhase / (Math.PI * 2));
  let current = normalizeCycle(currentPhase / (Math.PI * 2));
  if (current < previous) current += 1;
  if (current - previous > 0.5) return [];
  return deployment.legs.filter((leg) => {
    let touchdown = variableLegTouchdownPhase(leg, mode, metrics);
    if (touchdown <= previous) touchdown += 1;
    return touchdown <= current + 1e-9;
  });
}

export function appendVariableLegFootprints(
  footprints: VariableLegFootprint[],
  additions: VariableLegFootprint[],
  limit = 80,
) {
  return [...footprints, ...additions].slice(-Math.max(1, limit));
}

export function variableLegBodyAdvance(
  previousPhase: number,
  currentPhase: number,
  deployment: VariableLegDeployment,
  mode: VariableLegMode,
  metrics: VariableLegModeMetrics,
) {
  if (metrics.path.length < 2) return 0;
  const deltas: number[] = [];
  for (const leg of deployment.legs) {
    const previousTarget = variableLegTargetPhase(previousPhase, leg.phaseOffset, metrics.targetPhaseOffset);
    const currentTarget = variableLegTargetPhase(currentPhase, leg.phaseOffset, metrics.targetPhaseOffset);
    if (!phaseIsInVariableLegStance(previousTarget, mode.stanceStart, mode.stanceEnd)
      || !phaseIsInVariableLegStance(currentTarget, mode.stanceStart, mode.stanceEnd)) continue;
    const previousIndex = variableLegSampleIndex(previousPhase, leg.phaseOffset, metrics.path.length);
    const currentIndex = variableLegSampleIndex(currentPhase, leg.phaseOffset, metrics.path.length);
    deltas.push(metrics.path[previousIndex].x - metrics.path[currentIndex].x);
  }
  if (deltas.length) return median(deltas);
  let cycleDelta = normalizeCycle(currentPhase / (Math.PI * 2)) - normalizeCycle(previousPhase / (Math.PI * 2));
  if (cycleDelta < 0) cycleDelta += 1;
  return metrics.stepLength * cycleDelta;
}

export function analyzeVariableLegGait(
  deployment: VariableLegDeployment,
  mode: VariableLegMode,
  metrics: VariableLegModeMetrics,
  sampleCount = 144,
): VariableLegGaitMetrics {
  const supportCounts = Array.from({ length: sampleCount }, (_, index) => {
    const phase = index / sampleCount * Math.PI * 2;
    return deployment.legs.filter((leg) => phaseIsInVariableLegStance(
      variableLegTargetPhase(phase, leg.phaseOffset, metrics.targetPhaseOffset),
      mode.stanceStart,
      mode.stanceEnd,
    )).length;
  });
  const touchdownPhases = deployment.legs
    .map((leg) => variableLegTouchdownPhase(leg, mode, metrics))
    .sort((a, b) => a - b);
  const touchdownGaps = touchdownPhases.map((phase, index) => {
    const next = touchdownPhases[(index + 1) % touchdownPhases.length] + (index === touchdownPhases.length - 1 ? 1 : 0);
    return next - phase;
  });
  const idealGap = 1 / Math.max(1, touchdownPhases.length);
  const touchdownUniformity = clamp01(1 - standardDeviation(touchdownGaps) / Math.max(idealGap, 1e-6));
  const supportCoverage = supportCounts.filter((count) => count > 0).length / Math.max(1, supportCounts.length);
  const averageSupport = mean(supportCounts);
  const supportUniformity = clamp01(1 - standardDeviation(supportCounts) / Math.max(1, averageSupport));
  const landingSoftness = clamp01(1 - metrics.landingVerticalSpeed / 240);
  const smoothnessScore = Math.round(100 * (
    supportCoverage * 0.35
    + touchdownUniformity * 0.3
    + supportUniformity * 0.2
    + landingSoftness * 0.15
  ));
  const phaseGroups = new Map<string, number>();
  for (const phase of touchdownPhases) {
    const key = phase.toFixed(6);
    phaseGroups.set(key, (phaseGroups.get(key) ?? 0) + 1);
  }
  const slips: number[] = [];
  if (metrics.path.length >= 2) {
    for (let index = 0; index < metrics.path.length; index += 1) {
      const nextIndex = (index + 1) % metrics.path.length;
      const footDeltas: number[] = [];
      for (const leg of deployment.legs) {
        const phase = index / metrics.path.length * Math.PI * 2;
        const nextPhase = nextIndex / metrics.path.length * Math.PI * 2;
        const currentTarget = variableLegTargetPhase(phase, leg.phaseOffset, metrics.targetPhaseOffset);
        const nextTarget = variableLegTargetPhase(nextPhase, leg.phaseOffset, metrics.targetPhaseOffset);
        if (!phaseIsInVariableLegStance(currentTarget, mode.stanceStart, mode.stanceEnd)
          || !phaseIsInVariableLegStance(nextTarget, mode.stanceStart, mode.stanceEnd)) continue;
        const currentPathIndex = variableLegSampleIndex(phase, leg.phaseOffset, metrics.path.length);
        const nextPathIndex = variableLegSampleIndex(nextPhase, leg.phaseOffset, metrics.path.length);
        footDeltas.push(metrics.path[nextPathIndex].x - metrics.path[currentPathIndex].x);
      }
      const bodyDelta = -median(footDeltas);
      for (const delta of footDeltas) slips.push(delta + bodyDelta);
    }
  }
  return {
    minimumSupport: Math.min(...supportCounts),
    maximumSupport: Math.max(...supportCounts),
    supportCoverage,
    touchdownUniformity,
    supportUniformity,
    stanceSlip: slips.length ? Math.sqrt(mean(slips.map((value) => value ** 2))) : 0,
    maximumTouchdownCluster: Math.max(0, ...phaseGroups.values()),
    smoothnessScore,
    touchdownPhases,
  };
}

export function isVariableLegDeployment(value: unknown): value is VariableLegDeployment {
  if (!value || typeof value !== "object") return false;
  const deployment = value as Partial<VariableLegDeployment>;
  return isVariableLegCount(deployment.legCount)
    && (deployment.preset === "wave" || deployment.preset === "alternating" || deployment.preset === "synchronous" || deployment.preset === "custom")
    && typeof deployment.mountSpan === "number"
    && typeof deployment.showFootprints === "boolean"
    && Array.isArray(deployment.legs)
    && deployment.legs.length === deployment.legCount
    && deployment.legs.every((leg) => typeof leg.id === "string"
      && typeof leg.label === "string"
      && (leg.side === "left" || leg.side === "right")
      && typeof leg.station === "number"
      && typeof leg.phaseOffset === "number");
}

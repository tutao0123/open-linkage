import type { Point } from "./four-bar";
import {
  JANSEN_PROJECT,
  KLANN_PROJECT,
  cloneProject,
  maximumConstraintError,
  predictJointPositions,
  resolveTracerPoint,
  solveFreeMechanism,
  type FreeMechanismProject,
} from "./free-mechanism";
import { resampleClosedPath } from "./path-synthesis";

export type VariableLegTopology = "klann" | "jansen";
export type VariableLegAdjustmentKind = "moving-pivot" | "telescopic-bar";

export type MovingPivotAdjustment = {
  kind: "moving-pivot";
  targetId: string;
  baseX: number;
  baseY: number;
  railAngle: number;
  minimum: number;
  maximum: number;
};

export type TelescopicBarAdjustment = {
  kind: "telescopic-bar";
  targetId: string;
  baseLength: number;
  minimum: number;
  maximum: number;
};

export type VariableLegAdjustment = MovingPivotAdjustment | TelescopicBarAdjustment;

export type VariableLegMode = {
  id: string;
  name: string;
  color: string;
  targetPath: Point[];
  rpm: number;
  weight: number;
  stanceStart: number;
  stanceEnd: number;
  adjustmentValue: number;
};

export type VariableLegModeMetrics = {
  modeId: string;
  validRatio: number;
  maxConstraintError: number;
  closureError: number;
  branchSwitches: number;
  rmse: number;
  maxError: number;
  stepLength: number;
  liftHeight: number;
  stanceStraightness: number;
  singularityMargin: number;
  peakFootSpeed: number;
  peakFootAcceleration: number;
  landingVerticalSpeed: number;
  path: Point[];
};

export type VariableLegCandidate = {
  id: string;
  label: string;
  topology: VariableLegTopology;
  baseProject: FreeMechanismProject;
  adjustment: VariableLegAdjustment;
  modes: VariableLegMode[];
  score: number;
  familyRmse: number;
  adjustmentStroke: number;
  metrics: VariableLegModeMetrics[];
};

export type VariableLegProject = {
  version: 1;
  mechanismType: "variable-geometry-leg";
  topology: VariableLegTopology;
  baseProject: FreeMechanismProject;
  adjustment: VariableLegAdjustment;
  modes: VariableLegMode[];
  activeModeId: string;
  inputPhase: number;
  candidates?: VariableLegCandidate[];
  selectedCandidateId?: string | null;
};

export type VariableLegSample = {
  phase: number;
  project: FreeMechanismProject;
  tracer: Point | null;
  error: number;
  singularityMargin: number;
};

export const VARIABLE_LEG_MODE_COLORS = ["#287fa8", "#d4663b", "#7b68b4", "#2f8f61", "#b38726", "#c34f83"] as const;

export const VARIABLE_LEG_OPTIONS: Record<VariableLegTopology, {
  label: string;
  movingPivots: Array<{ id: string; label: string }>;
  telescopicBars: Array<{ id: string; label: string }>;
}> = {
  klann: {
    label: "克兰六杆腿",
    movingPivots: [
      { id: "J1", label: "后摇杆机架铰点 J1" },
      { id: "J2", label: "前摇杆机架铰点 J2" },
    ],
    telescopicBars: [
      { id: "L2", label: "前摇杆 L2" },
      { id: "L3", label: "后摇杆 L3" },
    ],
  },
  jansen: {
    label: "简森多杆腿",
    movingPivots: [{ id: "J3", label: "从动机架铰点 J3" }],
    telescopicBars: [
      { id: "L3", label: "上部耦合杆 L3" },
      { id: "L4", label: "后部摇杆 L4" },
      { id: "L7", label: "前腿耦合杆 L7" },
      { id: "L8", label: "足端上连杆 L8" },
    ],
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function meanPoint(points: Point[]) {
  if (!points.length) return { x: 0, y: 0 };
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function phaseIsInStance(phase: number, start: number, end: number) {
  const normalizedStart = ((start % 1) + 1) % 1;
  const normalizedEnd = ((end % 1) + 1) % 1;
  if (normalizedStart <= normalizedEnd) return phase >= normalizedStart && phase <= normalizedEnd;
  return phase >= normalizedStart || phase <= normalizedEnd;
}

function measureClearance(path: Point[], stanceStart: number, stanceEnd: number, targetShift = 0) {
  if (path.length < 3) return { clearance: 0, groundY: 0, stance: [] as Point[], swing: [] as Point[] };
  const stance: Point[] = [];
  const swing: Point[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const targetPhase = ((index + targetShift) % path.length) / path.length;
    (phaseIsInStance(targetPhase, stanceStart, stanceEnd) ? stance : swing).push(path[index]);
  }
  if (!stance.length || !swing.length) return { clearance: 0, groundY: 0, stance, swing };
  const groundY = median(stance.map((point) => point.y));
  const swingTopY = Math.min(...swing.map((point) => point.y));
  return { clearance: Math.max(0, groundY - swingTopY), groundY, stance, swing };
}

export function measureGaitClearance(path: Point[], stanceStart: number, stanceEnd: number) {
  return measureClearance(path, stanceStart, stanceEnd).clearance;
}

function cloneMode(mode: VariableLegMode): VariableLegMode {
  return { ...mode, targetPath: mode.targetPath.map((point) => ({ ...point })) };
}

export function cloneVariableLegProject(project: VariableLegProject): VariableLegProject {
  return {
    ...project,
    baseProject: cloneProject(project.baseProject),
    adjustment: { ...project.adjustment },
    modes: project.modes.map(cloneMode),
    candidates: project.candidates?.map((candidate) => ({
      ...candidate,
      baseProject: cloneProject(candidate.baseProject),
      adjustment: { ...candidate.adjustment },
      modes: candidate.modes.map(cloneMode),
      metrics: candidate.metrics.map((metric) => ({ ...metric, path: metric.path.map((point) => ({ ...point })) })),
    })),
  };
}

export function getVariableLegTemplate(topology: VariableLegTopology) {
  return cloneProject(topology === "klann" ? KLANN_PROJECT : JANSEN_PROJECT);
}

export function createGaitPath(
  stepLength: number,
  liftHeight: number,
  stanceRatio: number,
  centerX = -210,
  groundY = 160,
  sampleCount = 72,
): Point[] {
  const stance = clamp(stanceRatio, 0.35, 0.82);
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / sampleCount;
    if (progress < stance) {
      const local = progress / stance;
      return {
        x: centerX + stepLength / 2 - stepLength * local,
        y: groundY + Math.sin(local * Math.PI) * 1.5,
      };
    }
    const local = (progress - stance) / (1 - stance);
    return {
      x: centerX - stepLength / 2 + stepLength * local,
      y: groundY - liftHeight * Math.sin(local * Math.PI) ** 1.18,
    };
  });
}

export function smoothClosedPath(points: Point[], passes = 1) {
  let result = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < passes; pass += 1) {
    if (result.length < 4) return result;
    result = result.map((point, index) => {
      const previous = result[(index - 1 + result.length) % result.length];
      const next = result[(index + 1) % result.length];
      return {
        x: previous.x * 0.2 + point.x * 0.6 + next.x * 0.2,
        y: previous.y * 0.2 + point.y * 0.6 + next.y * 0.2,
      };
    });
  }
  return result;
}

export function createDefaultModes(): VariableLegMode[] {
  return [
    { id: "cruise", name: "巡航", color: VARIABLE_LEG_MODE_COLORS[0], targetPath: createGaitPath(260, 65, 0.62), rpm: 14, weight: 1, stanceStart: 0, stanceEnd: 0.62, adjustmentValue: 0 },
    { id: "sprint", name: "高速", color: VARIABLE_LEG_MODE_COLORS[1], targetPath: createGaitPath(360, 80, 0.52), rpm: 24, weight: 1.2, stanceStart: 0, stanceEnd: 0.52, adjustmentValue: 32 },
    { id: "obstacle", name: "越障", color: VARIABLE_LEG_MODE_COLORS[2], targetPath: createGaitPath(220, 130, 0.65), rpm: 8, weight: 1.1, stanceStart: 0, stanceEnd: 0.65, adjustmentValue: -24 },
  ];
}

export function createDefaultAdjustment(topology: VariableLegTopology, kind: VariableLegAdjustmentKind): VariableLegAdjustment {
  const template = getVariableLegTemplate(topology);
  if (kind === "moving-pivot") {
    const targetId = VARIABLE_LEG_OPTIONS[topology].movingPivots[0].id;
    const joint = template.joints.find((item) => item.id === targetId)!;
    return { kind, targetId, baseX: joint.x, baseY: joint.y, railAngle: -20, minimum: -45, maximum: 45 };
  }
  const targetId = VARIABLE_LEG_OPTIONS[topology].telescopicBars[0].id;
  const bar = template.bars.find((item) => item.id === targetId)!;
  return { kind, targetId, baseLength: bar.length, minimum: bar.length * 0.82, maximum: bar.length * 1.18 };
}

export function createDefaultVariableLegProject(): VariableLegProject {
  return {
    version: 1,
    mechanismType: "variable-geometry-leg",
    topology: "klann",
    baseProject: getVariableLegTemplate("klann"),
    adjustment: createDefaultAdjustment("klann", "moving-pivot"),
    modes: createDefaultModes(),
    activeModeId: "cruise",
    inputPhase: 0,
    candidates: [],
    selectedCandidateId: null,
  };
}

export function materializeVariableLegMode(
  baseProject: FreeMechanismProject,
  adjustment: VariableLegAdjustment,
  value: number,
) {
  const project = cloneProject(baseProject);
  const bounded = clamp(value, adjustment.minimum, adjustment.maximum);
  if (adjustment.kind === "moving-pivot") {
    const joint = project.joints.find((item) => item.id === adjustment.targetId);
    if (joint) {
      const angle = adjustment.railAngle * Math.PI / 180;
      joint.x = adjustment.baseX + bounded * Math.cos(angle);
      joint.y = adjustment.baseY + bounded * Math.sin(angle);
      joint.fixed = true;
    }
  } else {
    const bar = project.bars.find((item) => item.id === adjustment.targetId);
    if (bar) {
      bar.length = bounded;
      bar.type = "telescopic";
      bar.minLength = adjustment.minimum;
      bar.maxLength = adjustment.maximum;
    }
  }
  return project;
}

function jointAngleMargin(project: FreeMechanismProject) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  const neighbors = new Map<string, string[]>();
  for (const bar of project.bars) {
    neighbors.set(bar.a, [...(neighbors.get(bar.a) ?? []), bar.b]);
    neighbors.set(bar.b, [...(neighbors.get(bar.b) ?? []), bar.a]);
  }
  for (const body of project.bodies) {
    for (const pair of body.pairs) {
      neighbors.set(pair.a, [...(neighbors.get(pair.a) ?? []), pair.b]);
      neighbors.set(pair.b, [...(neighbors.get(pair.b) ?? []), pair.a]);
    }
  }
  let margin = 90;
  for (const joint of project.joints) {
    const adjacent = [...new Set(neighbors.get(joint.id) ?? [])];
    if (adjacent.length < 2) continue;
    for (let firstIndex = 0; firstIndex < adjacent.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < adjacent.length; secondIndex += 1) {
        const first = byId.get(adjacent[firstIndex]);
        const second = byId.get(adjacent[secondIndex]);
        if (!first || !second) continue;
        const ax = first.x - joint.x;
        const ay = first.y - joint.y;
        const bx = second.x - joint.x;
        const by = second.y - joint.y;
        const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
        if (denominator < 1e-6) return 0;
        const angle = Math.acos(clamp((ax * bx + ay * by) / denominator, -1, 1)) * 180 / Math.PI;
        margin = Math.min(margin, angle, 180 - angle);
      }
    }
  }
  return margin;
}

function branchSignature(project: FreeMechanismProject) {
  const tracer = resolveTracerPoint(project);
  const fixed = project.joints.filter((joint) => joint.fixed);
  if (!tracer || fixed.length < 2) return 0;
  const first = fixed[0];
  const second = fixed[1];
  return Math.sign((second.x - first.x) * (tracer.y - first.y) - (second.y - first.y) * (tracer.x - first.x));
}

export function sampleVariableLeg(
  baseProject: FreeMechanismProject,
  adjustment: VariableLegAdjustment,
  value: number,
  sampleCount = 72,
  iterations = 90,
  startPhase = 0,
): VariableLegSample[] {
  let state = materializeVariableLegMode(baseProject, adjustment, value);
  let previousJoints: typeof state.joints | null = null;
  const samples: VariableLegSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const phase = startPhase + index * Math.PI * 2 / sampleCount;
    const seeded = previousJoints ? { ...state, joints: predictJointPositions(state.joints, previousJoints) } : state;
    const before = state.joints.map((joint) => ({ ...joint, slider: joint.slider ? { ...joint.slider } : undefined }));
    const joints = solveFreeMechanism(seeded, phase, iterations);
    state = { ...state, joints };
    previousJoints = before;
    samples.push({
      phase,
      project: state,
      tracer: resolveTracerPoint(state),
      error: maximumConstraintError(state, phase),
      singularityMargin: jointAngleMargin(state),
    });
  }
  return samples;
}

function alignTargetToPath(target: Point[], path: Point[]) {
  const targetCenter = meanPoint(target);
  const pathCenter = meanPoint(path);
  return target.map((point) => ({ x: point.x - targetCenter.x + pathCenter.x, y: point.y - targetCenter.y + pathCenter.y }));
}

export function alignedTargetPath(target: Point[], path: Point[]) {
  return alignTargetToPath(resampleClosedPath(target, Math.max(12, path.length)), path);
}

function matchClosedPath(target: Point[], generated: Point[]) {
  if (target.length < 3 || generated.length < 3) return { rmse: Number.POSITIVE_INFINITY, maxError: Number.POSITIVE_INFINITY, shift: 0 };
  const sampledTarget = alignTargetToPath(resampleClosedPath(target, generated.length), generated);
  let best = { rmse: Number.POSITIVE_INFINITY, maxError: Number.POSITIVE_INFINITY, shift: 0 };
  for (let shift = 0; shift < generated.length; shift += 1) {
    let squared = 0;
    let maximum = 0;
    for (let index = 0; index < generated.length; index += 1) {
      const expected = sampledTarget[(index + shift) % sampledTarget.length];
      const error = Math.hypot(generated[index].x - expected.x, generated[index].y - expected.y);
      squared += error ** 2;
      maximum = Math.max(maximum, error);
    }
    const rmse = Math.sqrt(squared / generated.length);
    if (rmse < best.rmse) best = { rmse, maxError: maximum, shift };
  }
  return best;
}

export function analyzeVariableLegMode(
  baseProject: FreeMechanismProject,
  adjustment: VariableLegAdjustment,
  mode: VariableLegMode,
  sampleCount = 72,
  iterations = 90,
): VariableLegModeMetrics {
  const samples = sampleVariableLeg(baseProject, adjustment, mode.adjustmentValue, sampleCount, iterations);
  // The generic constraint solver reports a summed positional residual rather
  // than a normalized per-joint error. Scale the acceptance threshold with the
  // mechanism so the same project behaves consistently in mm-sized templates.
  const longestBar = Math.max(1, ...baseProject.bars.map((bar) => bar.length));
  const constraintTolerance = Math.max(0.75, longestBar * 0.025);
  const validSamples = samples.filter(
    (sample) => sample.tracer && Number.isFinite(sample.error) && sample.error <= constraintTolerance,
  );
  const path = validSamples.map((sample) => sample.tracer!).filter(Boolean);
  const match = matchClosedPath(mode.targetPath, path);
  const clearance = measureClearance(path, mode.stanceStart, mode.stanceEnd, match.shift);
  const xs = path.map((point) => point.x);
  const angleStep = Math.PI * 2 / Math.max(1, sampleCount);
  const angularSpeed = mode.rpm * Math.PI * 2 / 60;
  let peakFootSpeed = 0;
  let peakFootAcceleration = 0;
  const speeds: Point[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const previous = path[(index - 1 + path.length) % path.length];
    speeds.push({ x: (path[index].x - previous.x) / angleStep * angularSpeed, y: (path[index].y - previous.y) / angleStep * angularSpeed });
    peakFootSpeed = Math.max(peakFootSpeed, Math.hypot(speeds[index].x, speeds[index].y));
  }
  for (let index = 0; index < speeds.length; index += 1) {
    const previous = speeds[(index - 1 + speeds.length) % speeds.length];
    peakFootAcceleration = Math.max(peakFootAcceleration, Math.hypot(speeds[index].x - previous.x, speeds[index].y - previous.y) / angleStep * angularSpeed);
  }
  const stanceMean = clearance.stance.length ? clearance.stance.reduce((sum, point) => sum + point.y, 0) / clearance.stance.length : 0;
  const stanceStraightness = clearance.stance.length ? Math.sqrt(clearance.stance.reduce((sum, point) => sum + (point.y - stanceMean) ** 2, 0) / clearance.stance.length) : 0;
  const targetLandingIndex = Math.round(clamp(mode.stanceStart, 0, 1) * Math.max(0, path.length - 1));
  const landingIndex = ((targetLandingIndex - match.shift) % Math.max(1, path.length) + Math.max(1, path.length)) % Math.max(1, path.length);
  const landing = speeds[landingIndex] ?? { x: 0, y: 0 };
  let branchSwitches = 0;
  let lastSignature = 0;
  for (const sample of validSamples) {
    const signature = branchSignature(sample.project);
    if (lastSignature && signature && signature !== lastSignature) branchSwitches += 1;
    if (signature) lastSignature = signature;
  }
  const firstTracer = path[0];
  const lastTracer = path[path.length - 1];
  return {
    modeId: mode.id,
    validRatio: validSamples.length / Math.max(1, samples.length),
    maxConstraintError: Math.max(0, ...samples.map((sample) => Number.isFinite(sample.error) ? sample.error : 1e6)),
    closureError: firstTracer && lastTracer ? Math.hypot(firstTracer.x - lastTracer.x, firstTracer.y - lastTracer.y) : Number.POSITIVE_INFINITY,
    branchSwitches,
    rmse: match.rmse,
    maxError: match.maxError,
    stepLength: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    liftHeight: clearance.clearance,
    stanceStraightness,
    singularityMargin: Math.min(90, ...validSamples.map((sample) => sample.singularityMargin)),
    peakFootSpeed,
    peakFootAcceleration,
    landingVerticalSpeed: Math.abs(landing.y),
    path,
  };
}

export function variableLegModeCost(metric: VariableLegModeMetrics, mode: VariableLegMode) {
  const targetXs = mode.targetPath.map((point) => point.x);
  const targetStep = targetXs.length ? Math.max(...targetXs) - Math.min(...targetXs) : 0;
  const targetClearance = measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd);
  const scale = Math.max(targetStep, targetClearance * 2, 80);
  const shapeCost = Number.isFinite(metric.rmse) ? metric.rmse / scale : 5;
  const stepCost = Math.min(2, Math.abs(metric.stepLength - targetStep) / Math.max(40, targetStep));
  const clearanceDeficit = Math.min(2, Math.max(0, targetClearance - metric.liftHeight) / Math.max(10, targetClearance));
  const clearanceOvershoot = Math.min(1, Math.max(0, metric.liftHeight - targetClearance * 1.35) / Math.max(10, targetClearance));
  const continuityCost = (1 - metric.validRatio) * 5 + Math.min(2, metric.maxConstraintError / 2) + metric.branchSwitches * 0.5;
  const singularityCost = Math.max(0, (10 - metric.singularityMargin) / 10);
  const landingCost = Math.min(1.5, metric.landingVerticalSpeed / Math.max(100, scale * 2));
  return shapeCost * 0.3
    + stepCost * 0.13
    + clearanceDeficit * 0.38
    + clearanceOvershoot * 0.04
    + continuityCost * 0.1
    + singularityCost * 0.03
    + landingCost * 0.02;
}

export function scoreVariableLegFamily(metrics: VariableLegModeMetrics[], modes: VariableLegMode[], adjustment: VariableLegAdjustment) {
  let weightedCost = 0;
  let totalWeight = 0;
  for (const metric of metrics) {
    const mode = modes.find((item) => item.id === metric.modeId);
    const weight = Math.max(0.1, mode?.weight ?? 1);
    weightedCost += weight * (mode ? variableLegModeCost(metric, mode) : 5);
    totalWeight += weight;
  }
  const span = Math.max(1, adjustment.maximum - adjustment.minimum);
  const values = modes.map((mode) => mode.adjustmentValue);
  const stroke = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const strokePenalty = Math.max(0, stroke / span - 0.85) * 0.12;
  const clearanceRanking = modes.map((mode) => ({
    mode,
    target: measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd),
    actual: metrics.find((metric) => metric.modeId === mode.id)?.liftHeight ?? 0,
  })).sort((first, second) => second.target - first.target);
  const highest = clearanceRanking[0];
  const secondHighest = clearanceRanking[1];
  const targetGap = highest && secondHighest ? Math.max(0, highest.target - secondHighest.target) : 0;
  const requiredActualGap = targetGap * 0.35;
  const orderingPenalty = highest && secondHighest && highest.target > 0
    ? Math.max(0, secondHighest.actual + requiredActualGap - highest.actual) / highest.target * 0.3
    : 0;
  const cost = weightedCost / Math.max(0.1, totalWeight) + strokePenalty + orderingPenalty;
  return { score: clamp(100 * (1 - cost), 0, 100), cost, stroke };
}

export function analyzeVariableLegProject(project: VariableLegProject, sampleCount = 72, iterations = 90) {
  const metrics = project.modes.map((mode) => analyzeVariableLegMode(project.baseProject, project.adjustment, mode, sampleCount, iterations));
  const family = scoreVariableLegFamily(metrics, project.modes, project.adjustment);
  return { metrics, ...family };
}

export function isVariableLegProject(value: unknown): value is VariableLegProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<VariableLegProject>;
  return project.version === 1
    && project.mechanismType === "variable-geometry-leg"
    && (project.topology === "klann" || project.topology === "jansen")
    && Boolean(project.baseProject && Array.isArray(project.baseProject.joints) && Array.isArray(project.baseProject.bars))
    && Boolean(project.adjustment && (project.adjustment.kind === "moving-pivot" || project.adjustment.kind === "telescopic-bar"))
    && Array.isArray(project.modes)
    && project.modes.length > 0
    && project.modes.length <= 6
    && project.modes.every((mode) => typeof mode.id === "string" && Array.isArray(mode.targetPath));
}

export function projectForFreeDesigner(project: VariableLegProject) {
  const mode = project.modes.find((item) => item.id === project.activeModeId) ?? project.modes[0];
  return materializeVariableLegMode(project.baseProject, project.adjustment, mode.adjustmentValue);
}

import type { Point } from "./four-bar";
import {
  JANSEN_PROJECT,
  KLANN_PROJECT,
  cloneProject,
  createRigidBody,
  getRotationDriver,
  maximumConstraintError,
  predictJointPositions,
  resolveTracerPoint,
  solveFreeMechanism,
  type FreeMechanismProject,
} from "./free-mechanism";
import { resampleClosedPath } from "./path-synthesis";
import {
  createVariableLegDeployment,
  isVariableLegDeployment,
  type VariableLegDeployment,
} from "./variable-leg-gait";

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
  closureTolerance?: number;
  branchSwitches: number;
  rmse: number;
  maxError: number;
  stepLength: number;
  liftHeight: number;
  stanceRatio: number;
  stanceGroundY: number;
  stanceStraightness: number;
  singularityMargin: number;
  peakFootSpeed: number;
  peakFootAcceleration: number;
  landingVerticalSpeed: number;
  targetPhaseOffset: number;
  path: Point[];
};

export type VariableLegCandidateQuality = {
  level: "usable" | "continuous" | "invalid";
  issues: string[];
};

export type ConstraintLevel = "hard" | "soft";
export type ConstraintRule = "range" | "minimum" | "maximum";
export type VariableLegConstraintMetric = "stepLength" | "liftHeight" | "stanceRatio" | "landingVerticalSpeed";

export type MetricConstraint = {
  metric: VariableLegConstraintMetric;
  rule: ConstraintRule;
  target: number;
  tolerance: number;
  level: ConstraintLevel;
  weight: number;
};

export type ConditionRequirement = {
  modeId: string;
  enabled: boolean;
  role: "primary" | "supporting";
  rpm: number;
  constraints: Record<VariableLegConstraintMetric, MetricConstraint>;
};

export type MetricConstraintEvaluation = MetricConstraint & {
  actual: number | null;
  difference: number | null;
  passed: boolean;
  status: "passed" | "soft-failed" | "hard-failed";
  reason: string;
};

export type SafetyConstraintMetric = "validRatio" | "branchSwitches" | "closureError" | "singularityMargin";

export type SafetyConstraintEvaluation = {
  metric: SafetyConstraintMetric;
  rule: "minimum" | "maximum" | "finite";
  threshold: number | null;
  actual: number | null;
  passed: boolean;
  level: "hard";
  reason: string;
};

export type ConditionConstraintEvaluation = {
  modeId: string;
  enabled: boolean;
  hardPassed: boolean;
  softScore: number;
  metrics: Record<VariableLegConstraintMetric, MetricConstraintEvaluation>;
  safety: SafetyConstraintEvaluation[];
  issues: string[];
  warnings: string[];
};

export type ConstraintEvaluation = {
  passed: boolean;
  hardPassed: boolean;
  softScore: number;
  conditions: ConditionConstraintEvaluation[];
  issues: string[];
  warnings: string[];
};

export type GuidedDesignScenario = "cruise" | "sprint" | "obstacle";
export type GuidedDesignRole = "recommended" | "conservative" | "performance";

export type GuidedDesignTargets = {
  stepLength: number;
  liftHeight: number;
  stanceRatio: number;
  rpm: number;
  landingSpeedLimit: number;
};

export type GuidedDesignRequest = {
  scenario: GuidedDesignScenario;
  targets: GuidedDesignTargets;
  baselinePolicy: "auto-safe";
  mechanismVariation: "limited" | "balanced";
};

export type GuidedHardGateResult = {
  passed: boolean;
  modeId: GuidedDesignScenario;
  issues: string[];
  validRatio: number;
  singularityMargin: number;
};

export type GuidedScenarioCompatibility = {
  modeId: string;
  level: "compatible" | "exploratory" | "unavailable";
  validRatio: number;
  singularityMargin: number;
};

export type GuidedDesignPreflight = {
  source: "current" | "safe-baseline";
  currentGate: GuidedHardGateResult;
  selectedGate: GuidedHardGateResult;
  zones: Record<keyof GuidedDesignTargets, { recommended: [number, number]; exploratory: [number, number] }>;
  message: string;
};

export type GuidedDesignResult = {
  candidates: VariableLegCandidate[];
  preflight: GuidedDesignPreflight;
  suggestions: Array<{ key: keyof GuidedDesignTargets; value: number; label: string }>;
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
  role?: GuidedDesignRole;
  guidedScenario?: GuidedDesignScenario;
  hardGateResult?: GuidedHardGateResult;
  compatibility?: GuidedScenarioCompatibility[];
  constraintEvaluation?: ConstraintEvaluation;
};

export type VariableLegProject = {
  version: 3;
  mechanismType: "variable-geometry-leg";
  topology: VariableLegTopology;
  baseProject: FreeMechanismProject;
  adjustment: VariableLegAdjustment;
  modes: VariableLegMode[];
  activeModeId: string;
  inputPhase: number;
  deployment: VariableLegDeployment;
  requirements: ConditionRequirement[];
  revisionId: string;
  currentVersionId: string;
  /** @deprecated Transient synthesis results now belong in DesignRun state. */
  candidates?: VariableLegCandidate[];
  /** @deprecated The selected preview now belongs in view state. */
  selectedCandidateId?: string | null;
};

export type VariableLegSample = {
  phase: number;
  project: FreeMechanismProject;
  tracer: Point | null;
  error: number;
  singularityMargin: number;
};

export type VariableLegBarRole = "driver" | "adjustment" | "tracer-carrier" | "link";

export type VariableLegBarMetrics = {
  barId: string;
  endpointA: string;
  endpointB: string;
  role: VariableLegBarRole;
  baseLength: number;
  effectiveLength: number;
  angleRangeDegrees: number;
  peakAngularSpeedDegrees: number;
  maxConstraintResidual: number;
  minimumJointAngle: number;
  invalidPhases: number[];
};

export type VariableLegAdjustmentFeasibilitySample = {
  value: number;
  feasible: boolean;
  failedModeIds: string[];
};

export type VariableLegFeasibleInterval = {
  minimum: number;
  maximum: number;
};

export type VariableLegAdjustmentFeasibility = {
  minimum: number;
  maximum: number;
  samples: VariableLegAdjustmentFeasibilitySample[];
  intervals: VariableLegFeasibleInterval[];
  recommendedInterval: VariableLegFeasibleInterval | null;
};

export type VariableLegDesignerTransfer = {
  version: 1;
  direction: "to-designer" | "to-variable-leg";
  variableProject: VariableLegProject;
  editableProject: FreeMechanismProject;
};

export type VariableLegDesignerValidation = {
  valid: boolean;
  reasons: string[];
};

export type GuidedDesignSeedRole = GuidedDesignRole;

export type VariableLegBarLengthPreview = {
  barId: string;
  requestedLength: number;
  requestedValid: boolean;
  nearestFeasibleLength: number | null;
  previewProject: VariableLegProject | null;
  metrics: VariableLegModeMetrics[];
};

export type VariableLegEditableParameter =
  | { kind: "bar-length"; targetId: string }
  | { kind: "fixed-joint-coordinate"; targetId: string; axis: "x" | "y" };

export type VariableLegParameterPreview = {
  parameter: VariableLegEditableParameter;
  requestedValue: number;
  requestedValid: boolean;
  nearestFeasibleValue: number | null;
  previewProject: VariableLegProject | null;
  metrics: VariableLegModeMetrics[];
  intervals: VariableLegFeasibleInterval[];
  scannedMinimum: number;
  scannedMaximum: number;
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

function measurePathStanceRatio(path: Point[]) {
  if (path.length < 3) return 0;
  const ys = path.map((point) => point.y);
  const groundY = Math.max(...ys);
  const swingY = Math.min(...ys);
  const groundBand = Math.max(2, (groundY - swingY) * 0.08);
  return path.filter((point) => point.y >= groundY - groundBand).length / path.length;
}

function modeStanceRatio(mode: Pick<VariableLegMode, "stanceStart" | "stanceEnd">) {
  const start = ((mode.stanceStart % 1) + 1) % 1;
  const end = ((mode.stanceEnd % 1) + 1) % 1;
  return end >= start ? end - start : 1 - start + end;
}

function defaultLandingSpeedLimit(modeId: string) {
  if (modeId === "sprint") return 180;
  if (modeId === "obstacle") return 110;
  return 130;
}

export function createDefaultConditionRequirements(
  modes: VariableLegMode[],
  primaryModeId: string = modes[0]?.id ?? "",
): ConditionRequirement[] {
  const resolvedPrimaryModeId = modes.some((mode) => mode.id === primaryModeId)
    ? primaryModeId
    : modes[0]?.id ?? "";
  return modes.map((mode) => {
    const xs = mode.targetPath.map((point) => point.x);
    const stepLength = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const liftHeight = measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd);
    const stanceRatio = modeStanceRatio(mode);
    const level: ConstraintLevel = mode.id === resolvedPrimaryModeId ? "hard" : "soft";
    return {
      modeId: mode.id,
      enabled: true,
      role: mode.id === resolvedPrimaryModeId ? "primary" : "supporting",
      rpm: mode.rpm,
      constraints: {
        stepLength: {
          metric: "stepLength",
          rule: "range",
          target: stepLength,
          tolerance: stepLength * 0.05,
          level,
          weight: Math.max(0.1, mode.weight),
        },
        liftHeight: {
          metric: "liftHeight",
          rule: "minimum",
          target: liftHeight,
          tolerance: 0,
          level,
          weight: Math.max(0.1, mode.weight),
        },
        stanceRatio: {
          metric: "stanceRatio",
          rule: "range",
          target: stanceRatio,
          tolerance: 0.03,
          level,
          weight: Math.max(0.1, mode.weight),
        },
        landingVerticalSpeed: {
          metric: "landingVerticalSpeed",
          rule: "maximum",
          target: defaultLandingSpeedLimit(mode.id),
          tolerance: 0,
          level,
          weight: Math.max(0.1, mode.weight),
        },
      },
    };
  });
}

function evaluateMetricConstraint(
  constraint: MetricConstraint,
  actual: number | null,
): MetricConstraintEvaluation {
  const finiteActual = actual !== null && Number.isFinite(actual);
  const difference = finiteActual ? actual - constraint.target : null;
  const passed = finiteActual && (
    constraint.rule === "range"
      ? Math.abs(difference!) <= Math.max(0, constraint.tolerance)
      : constraint.rule === "minimum"
        ? actual >= constraint.target
        : actual <= constraint.target
  );
  const status = passed ? "passed" : constraint.level === "hard" ? "hard-failed" : "soft-failed";
  const ruleText = constraint.rule === "range"
    ? `${constraint.target} ± ${Math.max(0, constraint.tolerance)}`
    : constraint.rule === "minimum"
      ? `≥ ${constraint.target}`
      : `≤ ${constraint.target}`;
  return {
    ...constraint,
    actual: finiteActual ? actual : null,
    difference,
    passed,
    status,
    reason: passed
      ? `${constraint.metric} 已满足 ${ruleText}`
      : `${constraint.metric} 实际 ${finiteActual ? actual : "不可用"}，要求 ${ruleText}`,
  };
}

function metricClosureTolerance(metric: VariableLegModeMetrics | undefined) {
  return metric?.closureTolerance !== undefined && Number.isFinite(metric.closureTolerance)
    ? metric.closureTolerance
    : 0.25;
}

function metricClosurePassed(metric: VariableLegModeMetrics | undefined) {
  return Boolean(
    metric
    && Number.isFinite(metric.closureError)
    && metric.closureError <= metricClosureTolerance(metric),
  );
}

function evaluateSafetyConstraints(metric: VariableLegModeMetrics | undefined): SafetyConstraintEvaluation[] {
  const actual = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : null;
  const validRatio = actual(metric?.validRatio);
  const branchSwitches = actual(metric?.branchSwitches);
  const closureError = actual(metric?.closureError);
  const closureTolerance = metricClosureTolerance(metric);
  const singularityMargin = actual(metric?.singularityMargin);
  return [
    {
      metric: "validRatio",
      rule: "minimum",
      threshold: 0.99,
      actual: validRatio,
      passed: validRatio !== null && validRatio >= 0.99,
      level: "hard",
      reason: validRatio !== null && validRatio >= 0.99 ? "validRatio 整周求解率已达到 99%" : "validRatio 整周求解率必须至少为 99%",
    },
    {
      metric: "branchSwitches",
      rule: "maximum",
      threshold: 0,
      actual: branchSwitches,
      passed: branchSwitches !== null && branchSwitches === 0,
      level: "hard",
      reason: branchSwitches === 0 ? "branchSwitches 装配分支保持连续" : "branchSwitches 装配分支切换次数必须为 0",
    },
    {
      metric: "closureError",
      rule: "maximum",
      threshold: closureTolerance,
      actual: closureError,
      passed: closureError !== null && closureError <= closureTolerance,
      level: "hard",
      reason: closureError !== null && closureError <= closureTolerance
        ? `closureError 全机构 2π 闭合误差不超过 ${closureTolerance} mm`
        : `closureError 全机构 2π 闭合误差必须不超过 ${closureTolerance} mm`,
    },
    {
      metric: "singularityMargin",
      rule: "minimum",
      threshold: 5,
      actual: singularityMargin,
      passed: singularityMargin !== null && singularityMargin >= 5,
      level: "hard",
      reason: singularityMargin !== null && singularityMargin >= 5
        ? "singularityMargin 奇异裕度已达到 5°"
        : "singularityMargin 奇异裕度必须至少为 5°",
    },
  ];
}

function metricSoftScore(evaluation: MetricConstraintEvaluation) {
  if (evaluation.passed) return 1;
  if (evaluation.actual === null) return 0;
  const tolerance = evaluation.rule === "range" ? Math.max(0, evaluation.tolerance) : 0;
  const violation = evaluation.rule === "range"
    ? Math.max(0, Math.abs(evaluation.difference ?? 0) - tolerance)
    : evaluation.rule === "minimum"
      ? Math.max(0, -1 * (evaluation.difference ?? 0))
      : Math.max(0, evaluation.difference ?? 0);
  return clamp(1 - violation / Math.max(1, Math.abs(evaluation.target)), 0, 1);
}

export function evaluateVariableLegConstraints(
  metrics: VariableLegModeMetrics[],
  requirements: ConditionRequirement[],
): ConstraintEvaluation {
  const conditions = requirements.map((requirement): ConditionConstraintEvaluation => {
    const metric = metrics.find((item) => item.modeId === requirement.modeId);
    const evaluatedMetrics = Object.fromEntries(
      (Object.keys(requirement.constraints) as VariableLegConstraintMetric[]).map((key) => [
        key,
        evaluateMetricConstraint(requirement.constraints[key], metric?.[key] ?? null),
      ]),
    ) as Record<VariableLegConstraintMetric, MetricConstraintEvaluation>;
    const safety = requirement.enabled ? evaluateSafetyConstraints(metric) : [];
    const enabledEvaluations = requirement.enabled ? Object.values(evaluatedMetrics) : [];
    const issues = [
      ...safety.filter((item) => !item.passed).map((item) => `${requirement.modeId}: ${item.reason}`),
      ...enabledEvaluations
        .filter((item) => item.level === "hard" && !item.passed)
        .map((item) => `${requirement.modeId}: ${item.reason}`),
    ];
    const warnings = enabledEvaluations
      .filter((item) => item.level === "soft" && !item.passed)
      .map((item) => `${requirement.modeId}: ${item.reason}`);
    const softMetrics = enabledEvaluations.filter((item) => item.level === "soft");
    const softWeight = softMetrics.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    const softScore = softMetrics.length
      ? softMetrics.reduce((sum, item) => sum + metricSoftScore(item) * Math.max(0, item.weight), 0) / Math.max(1e-9, softWeight)
      : 1;
    return {
      modeId: requirement.modeId,
      enabled: requirement.enabled,
      hardPassed: issues.length === 0,
      softScore,
      metrics: evaluatedMetrics,
      safety,
      issues,
      warnings,
    };
  });
  const enabledConditions = conditions.filter((condition) => condition.enabled);
  const issues = enabledConditions.flatMap((condition) => condition.issues);
  const warnings = enabledConditions.flatMap((condition) => condition.warnings);
  const softScore = enabledConditions.length
    ? enabledConditions.reduce((sum, condition) => sum + condition.softScore, 0) / enabledConditions.length
    : 1;
  return {
    passed: issues.length === 0,
    hardPassed: issues.length === 0,
    softScore,
    conditions,
    issues,
    warnings,
  };
}

export function assessVariableLegCandidate(
  metrics: VariableLegModeMetrics[],
  modes: VariableLegMode[],
): VariableLegCandidateQuality {
  const issues: string[] = [];
  const continuous = metrics.length > 0 && metrics.every((metric) => (
    metric.validRatio >= 0.99
    && metric.branchSwitches === 0
    && metricClosurePassed(metric)
  ));
  if (!continuous) {
    return { level: "invalid", issues: ["存在不可达相位或装配分支跳变"] };
  }
  for (const metric of metrics) {
    const mode = modes.find((item) => item.id === metric.modeId);
    if (!mode) continue;
    const xs = mode.targetPath.map((point) => point.x);
    const targetStep = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const targetLift = measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd);
    if (metric.stepLength < Math.max(40, targetStep * 0.55)) issues.push(`${mode.name}步幅不足`);
    if (metric.liftHeight < Math.max(10, targetLift * 0.45)) issues.push(`${mode.name}抬脚不足`);
    if (metric.stanceStraightness > Math.max(35, targetStep * 0.16)) issues.push(`${mode.name}支撑段起伏偏大`);
  }
  return { level: issues.length ? "continuous" : "usable", issues: [...new Set(issues)] };
}

function cloneMode(mode: VariableLegMode): VariableLegMode {
  return { ...mode, targetPath: mode.targetPath.map((point) => ({ ...point })) };
}

function cloneConstraintEvaluation(evaluation: ConstraintEvaluation | undefined) {
  if (!evaluation) return undefined;
  return {
    ...evaluation,
    conditions: evaluation.conditions.map((condition) => ({
      ...condition,
      metrics: Object.fromEntries(
        (Object.entries(condition.metrics) as Array<[VariableLegConstraintMetric, MetricConstraintEvaluation]>)
          .map(([key, metric]) => [key, { ...metric }]),
      ) as Record<VariableLegConstraintMetric, MetricConstraintEvaluation>,
      safety: condition.safety.map((item) => ({ ...item })),
      issues: [...condition.issues],
      warnings: [...condition.warnings],
    })),
    issues: [...evaluation.issues],
    warnings: [...evaluation.warnings],
  };
}

export function cloneVariableLegProject(project: VariableLegProject): VariableLegProject {
  return {
    ...project,
    baseProject: cloneProject(project.baseProject),
    adjustment: { ...project.adjustment },
    modes: project.modes.map(cloneMode),
    deployment: {
      ...project.deployment,
      legs: project.deployment.legs.map((leg) => ({ ...leg })),
    },
    requirements: project.requirements.map((requirement) => ({
      ...requirement,
      constraints: Object.fromEntries(
        (Object.entries(requirement.constraints) as Array<[VariableLegConstraintMetric, MetricConstraint]>)
          .map(([key, constraint]) => [key, { ...constraint }]),
      ) as Record<VariableLegConstraintMetric, MetricConstraint>,
    })),
    candidates: project.candidates?.map((candidate) => ({
      ...candidate,
      baseProject: cloneProject(candidate.baseProject),
      adjustment: { ...candidate.adjustment },
      modes: candidate.modes.map(cloneMode),
      metrics: candidate.metrics.map((metric) => ({ ...metric, path: metric.path.map((point) => ({ ...point })) })),
      constraintEvaluation: cloneConstraintEvaluation(candidate.constraintEvaluation),
    })),
  };
}

let variableLegRevisionSequence = 0;

export function createVariableLegRevisionId(prefix = "revision") {
  variableLegRevisionSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${variableLegRevisionSequence.toString(36)}`;
}

export function advanceVariableLegProjectRevision(
  source: VariableLegProject,
  options: { checkpoint?: boolean } = {},
) {
  const project = cloneVariableLegProject(source);
  project.revisionId = createVariableLegRevisionId("revision");
  if (options.checkpoint) project.currentVersionId = createVariableLegRevisionId("version");
  return project;
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

export function restoreVariableLegStandardModes(source: VariableLegProject) {
  const project = cloneVariableLegProject(source);
  const standardIds = new Set(["cruise", "sprint", "obstacle"]);
  const existingModes = new Map(project.modes.map((mode) => [mode.id, mode]));
  const span = Math.max(0, project.adjustment.maximum - project.adjustment.minimum);
  const restored = createDefaultModes().map((mode, index) => {
    const existing = existingModes.get(mode.id);
    if (existing) return existing;
    const adjustmentValue = project.adjustment.kind === "moving-pivot"
      ? clamp(mode.adjustmentValue, project.adjustment.minimum, project.adjustment.maximum)
      : clamp(
        project.adjustment.baseLength + (index === 1 ? span * 0.25 : index === 2 ? -span * 0.25 : 0),
        project.adjustment.minimum,
        project.adjustment.maximum,
      );
    return { ...mode, adjustmentValue };
  });
  const customModes = project.modes.filter((mode) => !standardIds.has(mode.id));
  project.modes = [...restored, ...customModes].slice(0, 6);
  if (!project.modes.some((mode) => mode.id === project.activeModeId)) project.activeModeId = "cruise";
  const existingRequirements = new Map(project.requirements.map((requirement) => [requirement.modeId, requirement]));
  const primaryModeId = project.requirements.find((requirement) => requirement.role === "primary" && project.modes.some((mode) => mode.id === requirement.modeId))?.modeId
    ?? project.activeModeId;
  const defaults = createDefaultConditionRequirements(project.modes, primaryModeId);
  project.requirements = defaults.map((requirement) => {
    const existing = existingRequirements.get(requirement.modeId);
    if (!existing || existing.role !== requirement.role) return requirement;
    return existing;
  });
  project.candidates = [];
  project.selectedCandidateId = null;
  return project;
}

export function createDefaultAdjustment(topology: VariableLegTopology, kind: VariableLegAdjustmentKind): VariableLegAdjustment {
  const template = getVariableLegTemplate(topology);
  if (kind === "moving-pivot") {
    const targetId = VARIABLE_LEG_OPTIONS[topology].movingPivots[0].id;
    const joint = template.joints.find((item) => item.id === targetId)!;
    return {
      kind,
      targetId,
      baseX: joint.x,
      baseY: joint.y,
      railAngle: topology === "klann" ? -45 : -20,
      minimum: -45,
      maximum: 45,
    };
  }
  const targetId = VARIABLE_LEG_OPTIONS[topology].telescopicBars[0].id;
  const bar = template.bars.find((item) => item.id === targetId)!;
  return { kind, targetId, baseLength: bar.length, minimum: bar.length * 0.82, maximum: bar.length * 1.18 };
}

export function createDefaultVariableLegProject(): VariableLegProject {
  const modes = createDefaultModes();
  return {
    version: 3,
    mechanismType: "variable-geometry-leg",
    topology: "klann",
    baseProject: getVariableLegTemplate("klann"),
    adjustment: createDefaultAdjustment("klann", "moving-pivot"),
    modes,
    activeModeId: "cruise",
    inputPhase: 0,
    deployment: createVariableLegDeployment(),
    requirements: createDefaultConditionRequirements(modes, "cruise"),
    revisionId: "revision-0",
    currentVersionId: "version-0",
    candidates: [],
    selectedCandidateId: null,
  };
}

function scaleVariableLegMechanism(project: FreeMechanismProject, scale: number) {
  const next = cloneProject(project);
  next.joints = next.joints.map((joint) => ({
    ...joint,
    x: joint.x * scale,
    y: joint.y * scale,
    slider: joint.slider ? {
      ...joint.slider,
      originX: joint.slider.originX * scale,
      originY: joint.slider.originY * scale,
      offset: joint.slider.offset === undefined ? undefined : joint.slider.offset * scale,
    } : undefined,
  }));
  next.bars = next.bars.map((bar) => ({
    ...bar,
    length: bar.length * scale,
    minLength: bar.minLength === undefined ? undefined : bar.minLength * scale,
    maxLength: bar.maxLength === undefined ? undefined : bar.maxLength * scale,
  }));
  next.dimensions = next.dimensions.map((dimension) => ({ ...dimension, value: dimension.value * scale }));
  next.bodies = next.bodies.map((body) => ({ ...body, pairs: body.pairs.map((pair) => ({ ...pair, length: pair.length * scale })) }));
  next.tracers = next.tracers.map((tracer) => tracer.kind === "joint"
    ? { ...tracer }
    : { ...tracer, localX: tracer.localX * scale, localY: tracer.localY * scale });
  return next;
}

function modeTargetStats(mode: VariableLegMode) {
  const xs = mode.targetPath.map((point) => point.x);
  const ys = mode.targetPath.map((point) => point.y);
  return {
    step: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    lift: measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd),
    centerX: xs.length ? (Math.max(...xs) + Math.min(...xs)) / 2 : -210,
    groundY: ys.length ? Math.max(...ys) : 160,
  };
}

export function createGuidedDesignRequest(project: VariableLegProject, scenario: GuidedDesignScenario = "cruise"): GuidedDesignRequest {
  const activeMode = project.modes.find((mode) => mode.id === scenario) ?? project.modes.find((mode) => mode.id === project.activeModeId) ?? project.modes[0];
  const stats = activeMode ? modeTargetStats(activeMode) : { step: 260, lift: 65 };
  return {
    scenario,
    targets: {
      stepLength: Math.max(40, stats.step),
      liftHeight: Math.max(10, stats.lift),
      stanceRatio: clamp(activeMode ? activeMode.stanceEnd - activeMode.stanceStart : 0.62, 0.35, 0.82),
      rpm: activeMode?.rpm ?? (scenario === "sprint" ? 24 : scenario === "obstacle" ? 8 : 14),
      landingSpeedLimit: scenario === "sprint" ? 180 : scenario === "obstacle" ? 110 : 130,
    },
    baselinePolicy: "auto-safe",
    mechanismVariation: "balanced",
  };
}

export function buildGuidedDesignSeed(
  source: VariableLegProject,
  request: GuidedDesignRequest,
  role: GuidedDesignSeedRole,
) {
  const factors = {
    recommended: { scale: 1, crank: 1, step: 1, lift: 1, stance: 0 },
    conservative: { scale: 1.04, crank: 0.96, step: 0.9, lift: 0.94, stance: 0.04 },
    performance: { scale: 1, crank: 1.07, step: 1.08, lift: 1.08, stance: -0.025 },
  }[role];
  const selectedScale = factors.scale;
  const baseProject = scaleVariableLegMechanism(getVariableLegTemplate(source.topology), selectedScale);
  const driver = baseProject.bars.find((bar) => bar.id === baseProject.driverId);
  if (driver) {
    const templateDriver = getVariableLegTemplate(source.topology).bars.find((bar) => bar.id === baseProject.driverId);
    const nextLength = Math.max(5, (templateDriver?.length ?? driver.length) * factors.crank);
    driver.length = nextLength;
    const endpoints = new Set([driver.a, driver.b]);
    baseProject.dimensions = baseProject.dimensions.map((dimension) => (
      dimension.type === "distance" && endpoints.has(dimension.a) && endpoints.has(dimension.b)
        ? { ...dimension, value: nextLength }
        : dimension
    ));
  }
  let adjustment = createDefaultAdjustment(source.topology, source.adjustment.kind);
  const targetExists = adjustment.kind === "moving-pivot"
    ? baseProject.joints.some((joint) => joint.id === source.adjustment.targetId)
    : baseProject.bars.some((bar) => bar.id === source.adjustment.targetId && bar.id !== baseProject.driverId);
  if (targetExists) adjustment = { ...adjustment, targetId: source.adjustment.targetId } as VariableLegAdjustment;
  if (adjustment.kind === "moving-pivot") {
    const joint = baseProject.joints.find((item) => item.id === adjustment.targetId)!;
    const travel = 45 * selectedScale;
    adjustment = { ...adjustment, baseX: joint.x, baseY: joint.y, railAngle: source.adjustment.kind === "moving-pivot" ? source.adjustment.railAngle : -20, minimum: -travel, maximum: travel };
  } else {
    const bar = baseProject.bars.find((item) => item.id === adjustment.targetId)!;
    adjustment = { ...adjustment, baseLength: bar.length, minimum: bar.length * 0.82, maximum: bar.length * 1.18 };
  }
  const activeMode = source.modes.find((mode) => mode.id === request.scenario) ?? source.modes[0];
  const activeStats = activeMode ? modeTargetStats(activeMode) : { step: 260, lift: 65, centerX: -210, groundY: 160 };
  const requestedStep = request.targets.stepLength * factors.step;
  const requestedLift = request.targets.liftHeight * factors.lift;
  const requestedStance = clamp(request.targets.stanceRatio + factors.stance, 0.35, 0.82);
  const stepRatio = requestedStep / Math.max(1, activeStats.step);
  const liftRatio = requestedLift / Math.max(1, activeStats.lift);
  const stanceDelta = requestedStance - (activeMode ? activeMode.stanceEnd - activeMode.stanceStart : requestedStance);
  const modes = source.modes.map((mode) => {
    const stats = modeTargetStats(mode);
    const stanceRatio = clamp(mode.stanceEnd - mode.stanceStart + stanceDelta, 0.35, 0.82);
    const adjustmentValue = adjustment.kind === "moving-pivot"
      ? clamp(mode.adjustmentValue * selectedScale, adjustment.minimum, adjustment.maximum)
      : clamp(adjustment.baseLength + (mode.adjustmentValue - (source.adjustment.kind === "telescopic-bar" ? source.adjustment.baseLength : 0)) * selectedScale, adjustment.minimum, adjustment.maximum);
    return {
      ...mode,
      stanceStart: 0,
      stanceEnd: stanceRatio,
      adjustmentValue,
      targetPath: createGaitPath(
        Math.max(40, stats.step * stepRatio),
        Math.max(10, stats.lift * liftRatio),
        stanceRatio,
        stats.centerX * selectedScale,
        stats.groundY * selectedScale,
      ),
      rpm: mode.id === request.scenario ? request.targets.rpm : mode.rpm,
      weight: mode.id === request.scenario ? 2 : 0.35,
    };
  });
  return {
    ...cloneVariableLegProject(source),
    baseProject,
    adjustment,
    modes,
    requirements: createDefaultConditionRequirements(modes, request.scenario),
    activeModeId: modes.some((mode) => mode.id === source.activeModeId) ? source.activeModeId : (modes[0]?.id ?? source.activeModeId),
    candidates: [],
    selectedCandidateId: null,
  } satisfies VariableLegProject;
}

export function assessGuidedHardGate(metrics: VariableLegModeMetrics[], scenario: GuidedDesignScenario): GuidedHardGateResult {
  const metric = metrics.find((item) => item.modeId === scenario);
  const issues: string[] = [];
  if (!metric || metric.validRatio < 0.99) issues.push("完整求解率低于 99%");
  if (!metric || metric.branchSwitches !== 0) issues.push("存在装配分支跳变");
  if (!metricClosurePassed(metric)) issues.push("全机构 2π 闭合误差超限");
  if (!metric || metric.singularityMargin < 5) issues.push("最小夹角低于 5°");
  return {
    passed: issues.length === 0,
    modeId: scenario,
    issues,
    validRatio: metric?.validRatio ?? 0,
    singularityMargin: metric?.singularityMargin ?? 0,
  };
}

export function summarizeGuidedCompatibility(metrics: VariableLegModeMetrics[], scenario: GuidedDesignScenario): GuidedScenarioCompatibility[] {
  return metrics.filter((metric) => metric.modeId !== scenario).map((metric) => ({
    modeId: metric.modeId,
    level: metric.validRatio >= 0.99
      && metric.branchSwitches === 0
      && metricClosurePassed(metric)
      && metric.singularityMargin >= 5
      ? "compatible"
      : metric.validRatio >= 0.9 && metric.branchSwitches <= 1 ? "exploratory" : "unavailable",
    validRatio: metric.validRatio,
    singularityMargin: metric.singularityMargin,
  }));
}

export function guidedDesignZones(request: GuidedDesignRequest): GuidedDesignPreflight["zones"] {
  const zones: Record<GuidedDesignScenario, GuidedDesignPreflight["zones"]> = {
    cruise: {
      stepLength: { recommended: [180, 300], exploratory: [100, 380] },
      liftHeight: { recommended: [40, 90], exploratory: [20, 130] },
      stanceRatio: { recommended: [0.55, 0.7], exploratory: [0.42, 0.78] },
      rpm: { recommended: [8, 20], exploratory: [4, 30] },
      landingSpeedLimit: { recommended: [110, 220], exploratory: [70, 320] },
    },
    sprint: {
      stepLength: { recommended: [220, 380], exploratory: [120, 460] },
      liftHeight: { recommended: [45, 100], exploratory: [20, 140] },
      stanceRatio: { recommended: [0.42, 0.62], exploratory: [0.35, 0.72] },
      rpm: { recommended: [12, 28], exploratory: [6, 38] },
      landingSpeedLimit: { recommended: [130, 260], exploratory: [80, 380] },
    },
    obstacle: {
      stepLength: { recommended: [140, 280], exploratory: [80, 360] },
      liftHeight: { recommended: [70, 140], exploratory: [40, 180] },
      stanceRatio: { recommended: [0.55, 0.72], exploratory: [0.42, 0.8] },
      rpm: { recommended: [5, 14], exploratory: [3, 22] },
      landingSpeedLimit: { recommended: [80, 180], exploratory: [50, 260] },
    },
  };
  return zones[request.scenario];
}

export function setVariableLegBaseBarLength(source: VariableLegProject, barId: string, nextLength: number) {
  const project = cloneVariableLegProject(source);
  if (!Number.isFinite(nextLength) || nextLength <= 0) return project;
  const bar = project.baseProject.bars.find((item) => item.id === barId);
  if (!bar) return project;
  const delta = nextLength - bar.length;
  const endpoints = new Set([bar.a, bar.b]);
  project.baseProject.bars = project.baseProject.bars.map((item) => item.id === barId ? { ...item, length: nextLength } : item);
  project.baseProject.dimensions = project.baseProject.dimensions.map((dimension) => (
    dimension.type === "distance" && endpoints.has(dimension.a) && endpoints.has(dimension.b)
      ? { ...dimension, value: nextLength }
      : dimension
  ));
  if (project.adjustment.kind === "telescopic-bar" && project.adjustment.targetId === barId) {
    project.adjustment = {
      ...project.adjustment,
      baseLength: nextLength,
      minimum: project.adjustment.minimum + delta,
      maximum: project.adjustment.maximum + delta,
    };
    project.modes = project.modes.map((mode) => ({ ...mode, adjustmentValue: mode.adjustmentValue + delta }));
  }
  project.candidates = [];
  project.selectedCandidateId = null;
  return project;
}

function variableLegMetricsAreFeasible(metrics: VariableLegModeMetrics[], baselineMetrics?: VariableLegModeMetrics[]) {
  return metrics.every((metric) => {
    const baseline = baselineMetrics?.find((item) => item.modeId === metric.modeId);
    const requiredValidRatio = Math.min(0.999, baseline?.validRatio ?? 0.999);
    return metric.validRatio + 1e-9 >= requiredValidRatio && metricClosurePassed(metric);
  });
}

export function validateVariableLegKinematics(
  project: VariableLegProject,
  phaseSamples = 48,
  iterations = 70,
  baselineProject?: VariableLegProject,
) {
  const metrics = project.modes.map((mode) => analyzeVariableLegMode(project.baseProject, project.adjustment, mode, phaseSamples, iterations));
  const baselineMetrics = baselineProject?.modes.map((mode) => analyzeVariableLegMode(
    baselineProject.baseProject,
    baselineProject.adjustment,
    mode,
    phaseSamples,
    iterations,
  ));
  const failedModeIds = metrics.filter((metric) => !variableLegMetricsAreFeasible([metric], baselineMetrics)).map((metric) => metric.modeId);
  return { valid: failedModeIds.length === 0, failedModeIds, metrics };
}

export function setVariableLegEditableParameter(
  source: VariableLegProject,
  parameter: VariableLegEditableParameter,
  value: number,
) {
  if (parameter.kind === "bar-length") return setVariableLegBaseBarLength(source, parameter.targetId, value);
  const project = cloneVariableLegProject(source);
  if (!Number.isFinite(value)) return project;
  const joint = project.baseProject.joints.find((item) => item.id === parameter.targetId);
  if (!joint || !joint.fixed) return project;
  joint[parameter.axis] = value;
  project.baseProject.bodies = project.baseProject.bodies.map((body) => body.jointIds.includes(joint.id)
    ? createRigidBody(body.id, body.jointIds, project.baseProject.joints)
    : body);
  if (project.adjustment.kind === "moving-pivot" && project.adjustment.targetId === joint.id) {
    project.adjustment = {
      ...project.adjustment,
      baseX: parameter.axis === "x" ? value : project.adjustment.baseX,
      baseY: parameter.axis === "y" ? value : project.adjustment.baseY,
    };
  }
  project.candidates = [];
  project.selectedCandidateId = null;
  return project;
}

export function previewVariableLegEditableParameter(
  source: VariableLegProject,
  parameter: VariableLegEditableParameter,
  requestedValue: number,
  bounds?: VariableLegFeasibleInterval[],
  sampleCount = 25,
  phaseSamples = 48,
  iterations = 70,
): VariableLegParameterPreview {
  const currentValue = parameter.kind === "bar-length"
    ? source.baseProject.bars.find((bar) => bar.id === parameter.targetId)?.length
    : source.baseProject.joints.find((joint) => joint.id === parameter.targetId)?.[parameter.axis];
  const characteristicLength = Math.max(1, ...source.baseProject.bars.map((bar) => bar.length));
  const fallback = currentValue === undefined ? [] : parameter.kind === "bar-length"
    ? [{ minimum: Math.max(1, currentValue * 0.72), maximum: currentValue * 1.28 }]
    : [{ minimum: currentValue - characteristicLength * 0.22, maximum: currentValue + characteristicLength * 0.22 }];
  const scanBounds = bounds?.length ? bounds : fallback;
  const scannedMinimum = Math.min(...scanBounds.map((interval) => interval.minimum), requestedValue);
  const scannedMaximum = Math.max(...scanBounds.map((interval) => interval.maximum), requestedValue);

  const baselineMetrics = source.modes.map((mode) => analyzeVariableLegMode(source.baseProject, source.adjustment, mode, phaseSamples, iterations));
  const evaluate = (value: number) => {
    const project = setVariableLegEditableParameter(source, parameter, value);
    const metrics = project.modes.map((mode) => analyzeVariableLegMode(project.baseProject, project.adjustment, mode, phaseSamples, iterations));
    return { value, project, metrics, feasible: variableLegMetricsAreFeasible(metrics, baselineMetrics) };
  };
  const requested = evaluate(requestedValue);
  const values = scanBounds.flatMap((interval) => Array.from({ length: Math.max(3, sampleCount) }, (_, index) => (
    interval.minimum + (interval.maximum - interval.minimum) * index / (Math.max(3, sampleCount) - 1)
  )));
  if (currentValue !== undefined) values.push(currentValue);
  values.push(requestedValue);
  const results = [...new Set(values.map((value) => Number(value.toFixed(6))))]
    .sort((first, second) => first - second)
    .map((value) => Math.abs(value - requestedValue) < 1e-8 ? requested : evaluate(value));
  const feasibleResults = results.filter((result) => result.feasible);
  const nearest = feasibleResults.reduce<typeof requested | null>((best, result) => (
    !best || Math.abs(result.value - requestedValue) < Math.abs(best.value - requestedValue) ? result : best
  ), null);
  const intervalSamples = results.map((result) => ({ value: result.value, feasible: result.feasible, failedModeIds: result.metrics.filter((metric) => (
    metric.validRatio < 0.999
  )).map((metric) => metric.modeId) }));
  const activeValue = currentValue ?? requestedValue;
  const { intervals } = buildVariableLegFeasibleIntervals(intervalSamples, activeValue);
  return {
    parameter,
    requestedValue,
    requestedValid: requested.feasible,
    nearestFeasibleValue: requested.feasible ? requestedValue : nearest?.value ?? null,
    previewProject: requested.feasible ? requested.project : nearest?.project ?? null,
    metrics: requested.metrics,
    intervals,
    scannedMinimum,
    scannedMaximum,
  };
}

export function previewVariableLegBarLength(
  source: VariableLegProject,
  barId: string,
  requestedLength: number,
  sampleCount = 21,
  phaseSamples = 30,
  iterations = 70,
): VariableLegBarLengthPreview {
  const sourceBar = source.baseProject.bars.find((bar) => bar.id === barId);
  if (!sourceBar || !Number.isFinite(requestedLength) || requestedLength <= 0) {
    return { barId, requestedLength, requestedValid: false, nearestFeasibleLength: null, previewProject: null, metrics: [] };
  }
  const evaluate = (length: number) => {
    const project = setVariableLegBaseBarLength(source, barId, length);
    const metrics = project.modes.map((mode) => analyzeVariableLegMode(project.baseProject, project.adjustment, mode, phaseSamples, iterations));
    return { length, project, metrics, feasible: variableLegMetricsAreFeasible(metrics) };
  };
  const requested = evaluate(requestedLength);
  if (requested.feasible) return {
    barId,
    requestedLength,
    requestedValid: true,
    nearestFeasibleLength: requestedLength,
    previewProject: requested.project,
    metrics: requested.metrics,
  };
  const lower = Math.max(1, Math.min(sourceBar.length, requestedLength) * 0.72);
  const upper = Math.max(sourceBar.length, requestedLength) * 1.28;
  const values = Array.from({ length: Math.max(3, sampleCount) }, (_, index) => lower + (upper - lower) * index / (Math.max(3, sampleCount) - 1));
  values.push(sourceBar.length, requestedLength);
  let nearest: ReturnType<typeof evaluate> | null = null;
  for (const value of [...new Set(values.map((item) => Number(item.toFixed(6))))]) {
    const result = Math.abs(value - requestedLength) < 1e-8 ? requested : evaluate(value);
    if (result.feasible && (!nearest || Math.abs(result.length - requestedLength) < Math.abs(nearest.length - requestedLength))) nearest = result;
  }
  return {
    barId,
    requestedLength,
    requestedValid: false,
    nearestFeasibleLength: nearest?.length ?? null,
    previewProject: nearest?.project ?? null,
    metrics: requested.metrics,
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
  const rotationDriver = project.driverMode === "rotation" || project.driverMode === "oscillation"
    ? getRotationDriver(project.joints, project.bars, project.driverId)
    : null;
  let margin = 90;
  for (const joint of project.joints) {
    if (joint.fixed || joint.id === rotationDriver?.driven.id) continue;
    // A pairwise angle at a ternary or higher joint is not a mechanism
    // singularity: one edge may align while the remaining constraint still
    // fixes the link orientation. Restrict this inexpensive proxy to true
    // two-neighbour dyads; a future Jacobian metric can replace the proxy
    // without changing the unified constraint interface.
    const adjacent = [...new Set(neighbors.get(joint.id) ?? [])];
    if (adjacent.length !== 2) continue;
    const first = byId.get(adjacent[0]);
    const second = byId.get(adjacent[1]);
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
  return margin;
}

function branchSignatures(project: FreeMechanismProject) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  const incidentLinks = new Map<string, Array<{ neighborId: string; groupId: string }>>();
  const addIncidentLink = (jointId: string, neighborId: string, groupId: string) => {
    incidentLinks.set(jointId, [
      ...(incidentLinks.get(jointId) ?? []),
      { neighborId, groupId },
    ]);
  };
  for (const bar of project.bars) {
    addIncidentLink(bar.a, bar.b, `bar:${bar.id}`);
    addIncidentLink(bar.b, bar.a, `bar:${bar.id}`);
  }
  for (const body of project.bodies) {
    for (const pair of body.pairs) {
      addIncidentLink(pair.a, pair.b, `body:${body.id}`);
      addIncidentLink(pair.b, pair.a, `body:${body.id}`);
    }
  }
  const rotationDriver = project.driverMode === "rotation" || project.driverMode === "oscillation"
    ? getRotationDriver(project.joints, project.bars, project.driverId)
    : null;
  const signatures = new Map<string, number>();
  for (const joint of project.joints) {
    if (joint.fixed || joint.id === rotationDriver?.driven.id) continue;
    const groups = [...new Set((incidentLinks.get(joint.id) ?? []).map((item) => item.groupId))]
      .sort()
      .map((groupId) => {
        const representative = (incidentLinks.get(joint.id) ?? [])
          .filter((item) => item.groupId === groupId)
          .sort((first, second) => first.neighborId.localeCompare(second.neighborId))[0];
        return representative ? { ...representative, groupId } : null;
      })
      .filter((item): item is { neighborId: string; groupId: string } => item !== null);
    for (let firstIndex = 0; firstIndex < groups.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
        const first = byId.get(groups[firstIndex].neighborId);
        const second = byId.get(groups[secondIndex].neighborId);
        if (!first || !second) continue;
        const ax = first.x - joint.x;
        const ay = first.y - joint.y;
        const bx = second.x - joint.x;
        const by = second.y - joint.y;
        const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
        if (denominator < 1e-9) continue;
        signatures.set(
          `${joint.id}:${groups[firstIndex].groupId}:${groups[secondIndex].groupId}`,
          (ax * by - ay * bx) / denominator,
        );
      }
    }
  }
  return signatures;
}

function countBranchSwitches(samples: VariableLegSample[]) {
  let previous = samples[0] ? branchSignatures(samples[0].project) : new Map<string, number>();
  let branchSwitches = 0;
  const robustSignThreshold = Math.sin(5 * Math.PI / 180);
  for (const sample of samples.slice(1)) {
    const current = branchSignatures(sample.project);
    let switched = false;
    for (const [key, value] of current) {
      const previousValue = previous.get(key);
      if (previousValue === undefined) continue;
      if (
        Math.abs(previousValue) >= robustSignThreshold
        && Math.abs(value) >= robustSignThreshold
        && Math.sign(previousValue) !== Math.sign(value)
      ) {
        switched = true;
        break;
      }
    }
    if (switched) branchSwitches += 1;
    previous = current;
  }
  return branchSwitches;
}

function mechanismClosureError(first: FreeMechanismProject | undefined, last: FreeMechanismProject | undefined) {
  if (!first || !last) return Number.POSITIVE_INFINITY;
  const firstById = new Map(first.joints.map((joint) => [joint.id, joint]));
  if (!firstById.size || last.joints.length !== first.joints.length) return Number.POSITIVE_INFINITY;
  let closureError = 0;
  for (const joint of last.joints) {
    const initial = firstById.get(joint.id);
    if (!initial) return Number.POSITIVE_INFINITY;
    closureError = Math.max(closureError, Math.hypot(joint.x - initial.x, joint.y - initial.y));
  }
  return closureError;
}

function variableLegConstraintTolerance(project: FreeMechanismProject) {
  const longestBar = Math.max(1, ...project.bars.map((bar) => bar.length));
  return Math.max(0.75, longestBar * 0.025);
}

function variableLegPhaseDirection(project: FreeMechanismProject) {
  const tracer = project.tracers.find((item) => item.id === project.activeTracerId);
  // The standard Klann template is conventionally driven clockwise. The
  // generic mechanism solver uses increasing angles counter-clockwise, which
  // used to turn the long, nearly-flat return segment into the reported
  // "stance" and made otherwise valid Klann candidates appear to have no
  // lift. Keep the direction derived from the topology itself so edited Klann
  // projects retain the same walking convention without adding file-format
  // state.
  return tracer?.kind === "joint"
    && tracer.jointId === "J6"
    && project.bodies.some((body) => body.id === "B1")
    && project.bodies.some((body) => body.id === "B2")
    ? -1
    : 1;
}

export function sampleVariableLeg(
  baseProject: FreeMechanismProject,
  adjustment: VariableLegAdjustment,
  value: number,
  sampleCount = 72,
  iterations = 90,
  startPhase = 0,
  includeEndpoint = false,
): VariableLegSample[] {
  let state = materializeVariableLegMode(baseProject, adjustment, value);
  let previousJoints: typeof state.joints | null = null;
  const samples: VariableLegSample[] = [];
  const phaseDirection = variableLegPhaseDirection(baseProject);
  const intervalCount = Math.max(1, Math.round(sampleCount));
  const outputCount = intervalCount + (includeEndpoint ? 1 : 0);
  for (let index = 0; index < outputCount; index += 1) {
    const phase = startPhase + phaseDirection * index * Math.PI * 2 / intervalCount;
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
  const cycleSamples = sampleVariableLeg(
    baseProject,
    adjustment,
    mode.adjustmentValue,
    sampleCount,
    iterations,
    0,
    true,
  );
  const samples = cycleSamples.slice(0, -1);
  // The generic constraint solver reports a summed positional residual rather
  // than a normalized per-joint error. Scale the acceptance threshold with the
  // mechanism so the same project behaves consistently in mm-sized templates.
  const constraintTolerance = variableLegConstraintTolerance(baseProject);
  const sampleIsValid = (sample: VariableLegSample) => (
    sample.tracer && Number.isFinite(sample.error) && sample.error <= constraintTolerance
  );
  const validSamples = samples.filter(
    sampleIsValid,
  );
  const validCycleSamples = cycleSamples.filter(sampleIsValid);
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
  const branchSwitches = countBranchSwitches(cycleSamples);
  const closureTolerance = Math.max(0.25, constraintTolerance * 5);
  return {
    modeId: mode.id,
    validRatio: validCycleSamples.length / Math.max(1, cycleSamples.length),
    maxConstraintError: Math.max(0, ...cycleSamples.map((sample) => Number.isFinite(sample.error) ? sample.error : 1e6)),
    closureError: mechanismClosureError(cycleSamples[0]?.project, cycleSamples[cycleSamples.length - 1]?.project),
    closureTolerance,
    branchSwitches,
    rmse: match.rmse,
    maxError: match.maxError,
    stepLength: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    liftHeight: clearance.clearance,
    stanceRatio: measurePathStanceRatio(path),
    stanceGroundY: clearance.groundY,
    stanceStraightness,
    singularityMargin: Math.min(90, ...validSamples.map((sample) => sample.singularityMargin)),
    peakFootSpeed,
    peakFootAcceleration,
    landingVerticalSpeed: Math.abs(landing.y),
    targetPhaseOffset: path.length ? match.shift / path.length : 0,
    path,
  };
}

function angularDeltaDegrees(next: number, previous: number) {
  return ((next - previous + 540) % 360) - 180;
}

function selectedBarJointAngle(project: FreeMechanismProject, barId: string) {
  const bar = project.bars.find((item) => item.id === barId);
  if (!bar) return 0;
  const joints = new Map(project.joints.map((joint) => [joint.id, joint]));
  let minimum = 180;
  for (const endpointId of [bar.a, bar.b]) {
    const endpoint = joints.get(endpointId);
    const opposite = joints.get(endpointId === bar.a ? bar.b : bar.a);
    if (!endpoint || !opposite) continue;
    const adjacentIds = project.bars
      .filter((item) => item.id !== barId && (item.a === endpointId || item.b === endpointId))
      .map((item) => item.a === endpointId ? item.b : item.a);
    const bodyAdjacentIds = project.bodies.flatMap((body) => body.pairs
      .filter((pair) => pair.a === endpointId || pair.b === endpointId)
      .map((pair) => pair.a === endpointId ? pair.b : pair.a));
    for (const adjacentId of [...new Set([...adjacentIds, ...bodyAdjacentIds])]) {
      if (adjacentId === opposite.id) continue;
      const adjacent = joints.get(adjacentId);
      if (!adjacent) continue;
      const ax = opposite.x - endpoint.x;
      const ay = opposite.y - endpoint.y;
      const bx = adjacent.x - endpoint.x;
      const by = adjacent.y - endpoint.y;
      const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
      if (denominator < 1e-6) return 0;
      const angle = Math.acos(clamp((ax * bx + ay * by) / denominator, -1, 1)) * 180 / Math.PI;
      minimum = Math.min(minimum, angle, 180 - angle);
    }
  }
  return minimum === 180 ? 90 : minimum;
}

export function analyzeVariableLegBarSamples(
  baseProject: FreeMechanismProject,
  adjustment: VariableLegAdjustment,
  samples: VariableLegSample[],
  barId: string,
): VariableLegBarMetrics | null {
  const baseBar = baseProject.bars.find((bar) => bar.id === barId);
  if (!baseBar) return null;
  const activeTracer = baseProject.tracers.find((tracer) => tracer.id === baseProject.activeTracerId);
  const angles: number[] = [];
  const invalidPhases: number[] = [];
  let maximumResidual = 0;
  let minimumJointAngle = 90;
  let effectiveLength = baseBar.length;
  for (const sample of samples) {
    const bar = sample.project.bars.find((item) => item.id === barId);
    const first = sample.project.joints.find((joint) => joint.id === bar?.a);
    const second = sample.project.joints.find((joint) => joint.id === bar?.b);
    if (!bar || !first || !second || !Number.isFinite(sample.error)) {
      invalidPhases.push(sample.phase);
      continue;
    }
    angles.push(Math.atan2(second.y - first.y, second.x - first.x) * 180 / Math.PI);
    effectiveLength = bar.length;
    maximumResidual = Math.max(maximumResidual, sample.error);
    minimumJointAngle = Math.min(minimumJointAngle, selectedBarJointAngle(sample.project, barId));
    if (!sample.tracer || sample.error > variableLegConstraintTolerance(baseProject)) invalidPhases.push(sample.phase);
  }
  const unwrapped: number[] = [];
  for (const angle of angles) {
    const previous = unwrapped.at(-1);
    unwrapped.push(previous === undefined ? angle : previous + angularDeltaDegrees(angle, previous));
  }
  const circularDeltas = unwrapped.length > 1
    ? unwrapped.map((angle, index) => Math.abs(angularDeltaDegrees(unwrapped[(index + 1) % unwrapped.length], angle)))
    : [0];
  const tracerCarrier = activeTracer?.kind === "bar" && activeTracer.barId === barId
    || activeTracer?.kind === "joint" && (activeTracer.jointId === baseBar.a || activeTracer.jointId === baseBar.b);
  return {
    barId,
    endpointA: baseBar.a,
    endpointB: baseBar.b,
    role: baseProject.driverId === barId
      ? "driver"
      : adjustment.targetId === barId
        ? "adjustment"
        : tracerCarrier
          ? "tracer-carrier"
          : "link",
    baseLength: baseBar.length,
    effectiveLength,
    angleRangeDegrees: unwrapped.length ? Math.max(...unwrapped) - Math.min(...unwrapped) : 0,
    peakAngularSpeedDegrees: Math.max(0, ...circularDeltas) * samples.length,
    maxConstraintResidual: maximumResidual,
    minimumJointAngle,
    invalidPhases,
  };
}

export function analyzeVariableLegBar(
  project: VariableLegProject,
  mode: VariableLegMode,
  barId: string,
  sampleCount = 72,
  iterations = 90,
) {
  const samples = sampleVariableLeg(project.baseProject, project.adjustment, mode.adjustmentValue, sampleCount, iterations);
  return analyzeVariableLegBarSamples(project.baseProject, project.adjustment, samples, barId);
}

export function buildVariableLegFeasibleIntervals(
  samples: VariableLegAdjustmentFeasibilitySample[],
  activeValue: number,
) {
  const intervals: VariableLegFeasibleInterval[] = [];
  let start: number | null = null;
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index];
    if (sample?.feasible && start === null) start = sample.value;
    if ((!sample?.feasible || index === samples.length) && start !== null) {
      intervals.push({ minimum: start, maximum: samples[index - 1].value });
      start = null;
    }
  }
  const containing = intervals.filter((interval) => activeValue >= interval.minimum - 1e-6 && activeValue <= interval.maximum + 1e-6);
  return {
    intervals,
    recommendedInterval: containing.sort((first, second) => (second.maximum - second.minimum) - (first.maximum - first.minimum))[0] ?? null,
  };
}

export function scanVariableLegAdjustmentFeasibility(
  project: VariableLegProject,
  valueSamples = 41,
  phaseSamples = 36,
  iterations = 70,
): VariableLegAdjustmentFeasibility {
  const count = Math.max(2, valueSamples);
  const samples: VariableLegAdjustmentFeasibilitySample[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = project.adjustment.minimum
      + (project.adjustment.maximum - project.adjustment.minimum) * index / (count - 1);
    const failedModeIds: string[] = [];
    for (const mode of project.modes) {
      const metric = analyzeVariableLegMode(
        project.baseProject,
        project.adjustment,
        { ...mode, adjustmentValue: value },
        phaseSamples,
        iterations,
      );
      if (metric.validRatio < 0.999
        || metric.branchSwitches > 0
        || metric.maxConstraintError > variableLegConstraintTolerance(project.baseProject)
        || !metricClosurePassed(metric)
        || metric.singularityMargin < 5) failedModeIds.push(mode.id);
    }
    samples.push({ value, feasible: failedModeIds.length === 0, failedModeIds });
  }
  const activeValue = project.modes.find((mode) => mode.id === project.activeModeId)?.adjustmentValue
    ?? project.modes[0]?.adjustmentValue
    ?? 0;
  const { intervals, recommendedInterval } = buildVariableLegFeasibleIntervals(samples, activeValue);
  return {
    minimum: project.adjustment.minimum,
    maximum: project.adjustment.maximum,
    samples,
    intervals,
    recommendedInterval,
  };
}

export function applyVariableLegRecommendedRange(
  source: VariableLegProject,
  feasibility: VariableLegAdjustmentFeasibility,
) {
  const interval = feasibility.recommendedInterval;
  if (!interval) return { project: cloneVariableLegProject(source), clampedModeIds: [] as string[] };
  const project = cloneVariableLegProject(source);
  project.adjustment.minimum = interval.minimum;
  project.adjustment.maximum = interval.maximum;
  const clampedModeIds: string[] = [];
  project.modes = project.modes.map((mode) => {
    const adjustmentValue = clamp(mode.adjustmentValue, interval.minimum, interval.maximum);
    if (Math.abs(adjustmentValue - mode.adjustmentValue) > 1e-8) clampedModeIds.push(mode.id);
    return { ...mode, adjustmentValue };
  });
  project.candidates = [];
  project.selectedCandidateId = null;
  return { project, clampedModeIds };
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
  const requirementsByMode = new Map(project.requirements.map((requirement) => [requirement.modeId, requirement]));
  const metrics = project.modes.map((mode) => {
    const requirement = requirementsByMode.get(mode.id);
    const modeWithFixedRpm = requirement ? { ...mode, rpm: requirement.rpm } : mode;
    return analyzeVariableLegMode(project.baseProject, project.adjustment, modeWithFixedRpm, sampleCount, iterations);
  });
  const family = scoreVariableLegFamily(metrics, project.modes, project.adjustment);
  const evaluation = evaluateVariableLegConstraints(metrics, project.requirements);
  return { metrics, ...family, evaluation };
}

const VARIABLE_LEG_CONSTRAINT_METRICS: VariableLegConstraintMetric[] = [
  "stepLength",
  "liftHeight",
  "stanceRatio",
  "landingVerticalSpeed",
];

function isMetricConstraint(value: unknown, metric: VariableLegConstraintMetric): value is MetricConstraint {
  if (!value || typeof value !== "object") return false;
  const constraint = value as Partial<MetricConstraint>;
  return constraint.metric === metric
    && (constraint.rule === "range" || constraint.rule === "minimum" || constraint.rule === "maximum")
    && Number.isFinite(constraint.target)
    && Number.isFinite(constraint.tolerance)
    && (constraint.tolerance ?? -1) >= 0
    && (constraint.level === "hard" || constraint.level === "soft")
    && Number.isFinite(constraint.weight)
    && (constraint.weight ?? -1) >= 0;
}

function areConditionRequirementsValid(value: unknown, modeIds: string[]): value is ConditionRequirement[] {
  if (!Array.isArray(value) || value.length !== modeIds.length) return false;
  const requirementIds = value.map((requirement) => (
    requirement && typeof requirement === "object"
      ? (requirement as Partial<ConditionRequirement>).modeId
      : undefined
  ));
  if (new Set(requirementIds).size !== requirementIds.length) return false;
  if (!modeIds.every((modeId) => requirementIds.includes(modeId))) return false;
  let primaryCount = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const requirement = item as Partial<ConditionRequirement>;
    if (typeof requirement.modeId !== "string"
      || typeof requirement.enabled !== "boolean"
      || (requirement.role !== "primary" && requirement.role !== "supporting")
      || !Number.isFinite(requirement.rpm)
      || (requirement.rpm ?? 0) <= 0
      || !requirement.constraints
      || !VARIABLE_LEG_CONSTRAINT_METRICS.every((metric) => isMetricConstraint(requirement.constraints?.[metric], metric))) return false;
    if (requirement.role === "primary") primaryCount += 1;
  }
  return primaryCount === 1;
}

function hasVariableLegProjectCore(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<VariableLegProject>;
  return project.mechanismType === "variable-geometry-leg"
    && (project.topology === "klann" || project.topology === "jansen")
    && Boolean(project.baseProject && Array.isArray(project.baseProject.joints) && Array.isArray(project.baseProject.bars))
    && Boolean(project.adjustment && (project.adjustment.kind === "moving-pivot" || project.adjustment.kind === "telescopic-bar"))
    && Array.isArray(project.modes)
    && project.modes.length > 0
    && project.modes.length <= 6
    && project.modes.every((mode) => (
      typeof mode.id === "string"
      && Array.isArray(mode.targetPath)
      && Number.isFinite(mode.rpm)
      && Number.isFinite(mode.weight)
      && Number.isFinite(mode.stanceStart)
      && Number.isFinite(mode.stanceEnd)
      && Number.isFinite(mode.adjustmentValue)
    ));
}

export function isVariableLegProject(value: unknown): value is VariableLegProject {
  if (!hasVariableLegProjectCore(value)) return false;
  const project = value as Partial<VariableLegProject>;
  const modeIds = project.modes!.map((mode) => mode.id);
  return project.version === 3
    && new Set(modeIds).size === modeIds.length
    && typeof project.activeModeId === "string"
    && modeIds.includes(project.activeModeId)
    && Number.isFinite(project.inputPhase)
    && isVariableLegDeployment(project.deployment)
    && areConditionRequirementsValid(project.requirements, modeIds)
    && typeof project.revisionId === "string"
    && project.revisionId.length > 0
    && typeof project.currentVersionId === "string"
    && project.currentVersionId.length > 0;
}

export function migrateVariableLegProject(value: unknown): VariableLegProject | null {
  if (isVariableLegProject(value)) return cloneVariableLegProject(value);
  if (!hasVariableLegProjectCore(value)) return null;
  const legacy = value as Omit<VariableLegProject, "version" | "deployment" | "requirements" | "revisionId" | "currentVersionId"> & {
    version: unknown;
    deployment?: unknown;
    requirements?: unknown;
    revisionId?: unknown;
    currentVersionId?: unknown;
  };
  if (legacy.version !== 1 && legacy.version !== 2) return null;
  const activeModeId = typeof legacy.activeModeId === "string" && legacy.modes.some((mode) => mode.id === legacy.activeModeId)
    ? legacy.activeModeId
    : legacy.modes[0].id;
  const modeIds = legacy.modes.map((mode) => mode.id);
  const requirements = areConditionRequirementsValid(legacy.requirements, modeIds)
    ? legacy.requirements
    : createDefaultConditionRequirements(legacy.modes, activeModeId);
  const migrated = {
    ...legacy,
    version: 3 as const,
    inputPhase: typeof legacy.inputPhase === "number" ? legacy.inputPhase : 0,
    activeModeId,
    deployment: isVariableLegDeployment(legacy.deployment) ? legacy.deployment : createVariableLegDeployment(),
    requirements,
    revisionId: typeof legacy.revisionId === "string" && legacy.revisionId ? legacy.revisionId : "revision-imported-0",
    currentVersionId: typeof legacy.currentVersionId === "string" && legacy.currentVersionId
      ? legacy.currentVersionId
      : "version-imported-0",
  } as VariableLegProject;
  return isVariableLegProject(migrated) ? cloneVariableLegProject(migrated) : null;
}

export function projectForFreeDesigner(project: VariableLegProject) {
  return cloneProject(project.baseProject);
}

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && [...first].sort().every((id, index) => id === [...second].sort()[index]);
}

export function createVariableLegDesignerTransfer(project: VariableLegProject): VariableLegDesignerTransfer {
  const variableProject = cloneVariableLegProject(project);
  variableProject.candidates = [];
  variableProject.selectedCandidateId = null;
  return {
    version: 1,
    direction: "to-designer",
    variableProject,
    editableProject: projectForFreeDesigner(project),
  };
}

export function isVariableLegDesignerTransfer(value: unknown): value is VariableLegDesignerTransfer {
  if (!value || typeof value !== "object") return false;
  const transfer = value as Partial<VariableLegDesignerTransfer>;
  return transfer.version === 1
    && (transfer.direction === "to-designer" || transfer.direction === "to-variable-leg")
    && isVariableLegProject(transfer.variableProject)
    && Boolean(transfer.editableProject
      && Array.isArray(transfer.editableProject.joints)
      && Array.isArray(transfer.editableProject.bars)
      && Array.isArray(transfer.editableProject.bodies)
      && Array.isArray(transfer.editableProject.tracers));
}

export function validateVariableLegDesignerProject(
  source: FreeMechanismProject,
  edited: FreeMechanismProject,
): VariableLegDesignerValidation {
  const reasons: string[] = [];
  if (!sameIds(source.joints.map((item) => item.id), edited.joints.map((item) => item.id))) reasons.push("铰点被删除、增加或改名");
  if (!sameIds(source.bars.map((item) => item.id), edited.bars.map((item) => item.id))) reasons.push("杆件被删除、增加或改名");
  if (!sameIds(source.bodies.map((item) => item.id), edited.bodies.map((item) => item.id))) reasons.push("刚体被删除、增加或改名");
  if (!sameIds(source.tracers.map((item) => item.id), edited.tracers.map((item) => item.id))) reasons.push("轨迹点被删除、增加或改名");
  if (source.driverId !== edited.driverId || source.driverMode !== edited.driverMode) reasons.push("主动杆或驱动方式已改变");
  if (source.activeTracerId !== edited.activeTracerId) reasons.push("活动轨迹点已改变");
  for (const bar of source.bars) {
    const next = edited.bars.find((item) => item.id === bar.id);
    if (next && (next.a !== bar.a || next.b !== bar.b)) reasons.push(`杆件 ${bar.id} 的连接关系已改变`);
  }
  for (const body of source.bodies) {
    const next = edited.bodies.find((item) => item.id === body.id);
    const pairKeys = body.pairs.map((pair) => [pair.a, pair.b].sort().join("–"));
    const nextPairKeys = next?.pairs.map((pair) => [pair.a, pair.b].sort().join("–")) ?? [];
    if (next && (!sameIds(body.jointIds, next.jointIds) || !sameIds(pairKeys, nextPairKeys))) reasons.push(`刚体 ${body.id} 的连接关系已改变`);
  }
  for (const tracer of source.tracers) {
    const next = edited.tracers.find((item) => item.id === tracer.id);
    if (!next || next.kind !== tracer.kind) continue;
    if (tracer.kind === "joint" && next.kind === "joint" && tracer.jointId !== next.jointId) reasons.push(`轨迹点 ${tracer.id} 的所属铰点已改变`);
    if (tracer.kind === "bar" && next.kind === "bar" && tracer.barId !== next.barId) reasons.push(`轨迹点 ${tracer.id} 的所属杆件已改变`);
    if (tracer.kind === "body" && next.kind === "body" && tracer.bodyId !== next.bodyId) reasons.push(`轨迹点 ${tracer.id} 的所属刚体已改变`);
  }
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function applyVariableLegDesignerReturn(transfer: VariableLegDesignerTransfer) {
  const source = transfer.variableProject;
  const validation = validateVariableLegDesignerProject(source.baseProject, transfer.editableProject);
  if (!validation.valid) return { project: cloneVariableLegProject(source), validation };
  const project = cloneVariableLegProject(source);
  const previousBar = source.baseProject.bars.find((bar) => bar.id === source.adjustment.targetId);
  const nextBar = transfer.editableProject.bars.find((bar) => bar.id === source.adjustment.targetId);
  const nextJoint = transfer.editableProject.joints.find((joint) => joint.id === source.adjustment.targetId);
  project.baseProject = cloneProject(transfer.editableProject);
  if (project.adjustment.kind === "telescopic-bar" && previousBar && nextBar) {
    const delta = nextBar.length - previousBar.length;
    project.adjustment = {
      ...project.adjustment,
      baseLength: nextBar.length,
      minimum: project.adjustment.minimum + delta,
      maximum: project.adjustment.maximum + delta,
    };
    project.modes = project.modes.map((mode) => ({ ...mode, adjustmentValue: mode.adjustmentValue + delta }));
  } else if (project.adjustment.kind === "moving-pivot" && nextJoint) {
    project.adjustment = { ...project.adjustment, baseX: nextJoint.x, baseY: nextJoint.y };
  }
  project.candidates = [];
  project.selectedCandidateId = null;
  return { project, validation };
}

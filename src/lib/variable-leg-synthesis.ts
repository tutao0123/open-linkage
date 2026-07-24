import {
  VARIABLE_LEG_OPTIONS,
  analyzeVariableLegMode,
  assessGuidedHardGate,
  buildGuidedDesignSeed,
  cloneVariableLegProject,
  createDefaultAdjustment,
  evaluateVariableLegConstraints,
  guidedDesignZones,
  getVariableLegTemplate,
  scoreVariableLegFamily,
  summarizeGuidedCompatibility,
  variableLegModeCost,
  type ConstraintEvaluation,
  type VariableLegAdjustmentFeasibility,
  type VariableLegAdjustment,
  type VariableLegAdjustmentKind,
  type VariableLegBarLengthPreview,
  type VariableLegCandidate,
  type VariableLegConstraintMetric,
  type VariableLegEditableParameter,
  type VariableLegFeasibleInterval,
  type VariableLegMode,
  type VariableLegModeMetrics,
  type VariableLegParameterPreview,
  type VariableLegProject,
  type GuidedDesignPreflight,
  type GuidedDesignRequest,
  type GuidedDesignResult,
  type GuidedDesignRole,
  type VariableLegTopology,
} from "./variable-leg";
import { createGuidedSafeBaseline } from "./variable-leg-guided-baselines";
import { cloneProject, createRigidBody, type FreeMechanismProject } from "./free-mechanism";

export type VariableLegSynthesisProgress = {
  progress: number;
  stage: "scan" | "refine" | "finalize";
  message: string;
};

export type VariableLegSynthesisScope = "global" | "current-target";

export type VariableLegRefinementParameterId =
  | `bar-length:${string}`
  | `joint-x:${string}`
  | `joint-y:${string}`
  | "adjustment:rail-angle"
  | `mode-adjustment:${string}`;

export type RefinementRequest = {
  allowedParameterIds: VariableLegRefinementParameterId[];
  selectedBarId?: string;
  modeIds: string[];
  iterations?: number;
  parentRunId?: string;
};

export type VariableLegGenerationRequest = {
  /**
   * Generation starts from a clone of the current mechanism unless the caller
   * explicitly opts into a template seed.
   */
  seedSource?: "current" | "template";
};

export type VariableLegGuidedSynthesisOptions = {
  /**
   * Offline baselines are never selected implicitly. The UI must expose and
   * explicitly send this choice.
   */
  allowOfflineBaselineFallback?: boolean;
};

export type VariableLegWorkerCorrelation = {
  requestId: string;
  runId?: string;
  sourceRevisionId?: string;
};

type VariableLegWorkerRequestBase = VariableLegWorkerCorrelation & {
  project: VariableLegProject;
};

export type VariableLegWorkerRequest =
  | (VariableLegWorkerRequestBase & {
    type: "start";
    scope?: VariableLegSynthesisScope;
    refinementRequest?: RefinementRequest;
    generationRequest?: VariableLegGenerationRequest;
  })
  | (VariableLegWorkerRequestBase & { type: "feasibility" })
  | (VariableLegWorkerRequestBase & {
    type: "guided-design";
    request: GuidedDesignRequest;
    allowOfflineBaselineFallback?: boolean;
  })
  | (VariableLegWorkerRequestBase & {
    type: "guided-preflight";
    request: GuidedDesignRequest;
    allowOfflineBaselineFallback?: boolean;
  })
  | (VariableLegWorkerRequestBase & {
    type: "bar-preview";
    barId: string;
    requestedLength: number;
  })
  | (VariableLegWorkerRequestBase & {
    type: "parameter-preview";
    parameter: VariableLegEditableParameter;
    requestedValue: number;
    bounds?: VariableLegFeasibleInterval[];
  })
  | (VariableLegWorkerRequestBase & {
    type: "project-check";
    baselineProject?: VariableLegProject;
  })
  | (VariableLegWorkerCorrelation & { type: "cancel" });

type VariableLegWorkerResponseBase = {
  requestId: string;
  runId: string;
  sourceRevisionId: string;
};

export type VariableLegWorkerResponse =
  | (VariableLegWorkerResponseBase & { type: "progress"; progress: VariableLegSynthesisProgress })
  | (VariableLegWorkerResponseBase & { type: "result"; candidates: VariableLegCandidate[] })
  | (VariableLegWorkerResponseBase & { type: "guided-design-result"; result: GuidedDesignResult })
  | (VariableLegWorkerResponseBase & { type: "guided-preflight-result"; preflight: GuidedDesignPreflight })
  | (VariableLegWorkerResponseBase & { type: "feasibility-result"; feasibility: VariableLegAdjustmentFeasibility })
  | (VariableLegWorkerResponseBase & { type: "bar-preview-result"; preview: VariableLegBarLengthPreview })
  | (VariableLegWorkerResponseBase & { type: "parameter-preview-result"; preview: VariableLegParameterPreview })
  | (VariableLegWorkerResponseBase & {
    type: "project-check-result";
    validation: { valid: boolean; failedModeIds: string[]; metrics: VariableLegModeMetrics[] };
  })
  | (VariableLegWorkerResponseBase & { type: "cancelled" })
  | (VariableLegWorkerResponseBase & { type: "error"; message: string });

export function variableLegBarLengthParameterId(barId: string): VariableLegRefinementParameterId {
  return `bar-length:${barId}`;
}

export function variableLegJointParameterId(
  jointId: string,
  axis: "x" | "y",
): VariableLegRefinementParameterId {
  return `joint-${axis}:${jointId}`;
}

export function variableLegModeAdjustmentParameterId(modeId: string): VariableLegRefinementParameterId {
  return `mode-adjustment:${modeId}`;
}

export const VARIABLE_LEG_RAIL_ANGLE_PARAMETER_ID = "adjustment:rail-angle" as const;

export class VariableLegSynthesisCancelled extends Error {
  constructor() {
    super("可变几何综合已取消");
    this.name = "VariableLegSynthesisCancelled";
  }
}

type SearchSeed = {
  topology: VariableLegTopology;
  baseProject: FreeMechanismProject;
  adjustment: VariableLegAdjustment;
  modes: VariableLegMode[];
  score: number;
  cost: number;
  evaluation?: ConstraintEvaluation;
};

type ResolvedRefinementParameter =
  | { kind: "bar-length"; targetId: string }
  | { kind: "joint-coordinate"; targetId: string; axis: "x" | "y" }
  | { kind: "rail-angle" }
  | { kind: "mode-adjustment"; modeId: string };

type EvaluatedSeed = {
  metrics: VariableLegModeMetrics[];
  evaluation: ConstraintEvaluation;
  score: number;
  cost: number;
  continuity: number;
};

function metricHardViolation(evaluation: ConstraintEvaluation["conditions"][number]["metrics"][VariableLegConstraintMetric]) {
  if (evaluation.level !== "hard" || evaluation.passed) return 0;
  if (evaluation.actual === null) return 10;
  const tolerance = evaluation.rule === "range" ? Math.max(0, evaluation.tolerance) : 0;
  const violation = evaluation.rule === "range"
    ? Math.max(0, Math.abs(evaluation.difference ?? 0) - tolerance)
    : evaluation.rule === "minimum"
      ? Math.max(0, -1 * (evaluation.difference ?? 0))
      : Math.max(0, evaluation.difference ?? 0);
  return violation / Math.max(0.01, Math.abs(evaluation.target));
}

function safetyHardViolation(
  evaluation: ConstraintEvaluation["conditions"][number]["safety"][number],
) {
  if (evaluation.passed) return 0;
  if (evaluation.actual === null) return 10;
  if (evaluation.rule === "minimum" && evaluation.threshold !== null) {
    return Math.max(0, evaluation.threshold - evaluation.actual) / Math.max(0.01, Math.abs(evaluation.threshold));
  }
  if (evaluation.rule === "maximum" && evaluation.threshold !== null) {
    return Math.max(0, evaluation.actual - evaluation.threshold) / Math.max(0.01, Math.abs(evaluation.threshold) || 1);
  }
  return 10;
}

function constraintHardViolation(evaluation: ConstraintEvaluation | undefined) {
  if (!evaluation) return Number.POSITIVE_INFINITY;
  return evaluation.conditions
    .filter((condition) => condition.enabled)
    .reduce((sum, condition) => sum
      + Object.values(condition.metrics).reduce((metricSum, metric) => metricSum + metricHardViolation(metric), 0)
      + condition.safety.reduce((safetySum, safety) => safetySum + safetyHardViolation(safety), 0), 0);
}

function evaluateSearchSeed(
  source: VariableLegProject,
  seed: Pick<SearchSeed, "baseProject" | "adjustment" | "modes">,
  phaseSamples: number,
  iterations: number,
): EvaluatedSeed {
  const metrics = seed.modes.map((mode) => analyzeVariableLegMode(
    seed.baseProject,
    seed.adjustment,
    mode,
    phaseSamples,
    iterations,
  ));
  const family = scoreVariableLegFamily(metrics, seed.modes, seed.adjustment);
  return {
    metrics,
    evaluation: evaluateVariableLegConstraints(metrics, source.requirements),
    score: family.score,
    cost: family.cost,
    continuity: continuityPenalty(metrics),
  };
}

function seedEvaluationIsBetter(
  current: EvaluatedSeed,
  candidate: EvaluatedSeed,
  preferContinuity = true,
) {
  if (candidate.evaluation.hardPassed !== current.evaluation.hardPassed) {
    return candidate.evaluation.hardPassed;
  }
  const currentHardViolation = constraintHardViolation(current.evaluation);
  const candidateHardViolation = constraintHardViolation(candidate.evaluation);
  if (Math.abs(candidateHardViolation - currentHardViolation) > 1e-6) {
    return candidateHardViolation < currentHardViolation;
  }
  if (preferContinuity && candidate.continuity < current.continuity - 1e-6) return true;
  if (!preferContinuity || Math.abs(candidate.continuity - current.continuity) <= 1e-6) {
    if (Math.abs(candidate.score - current.score) > 1e-6) return candidate.score > current.score;
    return candidate.evaluation.softScore >= current.evaluation.softScore;
  }
  return false;
}

function candidateFromSeed(
  source: VariableLegProject,
  seed: SearchSeed,
  id: string,
  label: string,
  phaseSamples = 72,
  iterations = 90,
): VariableLegCandidate {
  const result = evaluateSearchSeed(source, seed, phaseSamples, iterations);
  return {
    id,
    label,
    topology: seed.topology,
    baseProject: cloneProject(seed.baseProject),
    adjustment: { ...seed.adjustment },
    modes: cloneModes(seed.modes),
    score: result.score,
    familyRmse: result.metrics.reduce((sum, metric) => sum + metric.rmse, 0) / Math.max(1, result.metrics.length),
    adjustmentStroke: scoreVariableLegFamily(result.metrics, seed.modes, seed.adjustment).stroke,
    metrics: result.metrics,
    constraintEvaluation: result.evaluation,
  };
}

function resolveRefinementParameters(
  source: VariableLegProject,
  request: RefinementRequest,
): ResolvedRefinementParameter[] {
  const parameterIds = new Set<VariableLegRefinementParameterId>(request.allowedParameterIds);
  if (request.selectedBarId) parameterIds.add(variableLegBarLengthParameterId(request.selectedBarId));

  const modeIds = new Set(request.modeIds);
  for (const modeId of modeIds) {
    if (!source.modes.some((mode) => mode.id === modeId)) {
      throw new Error(`精修工况不存在：${modeId}`);
    }
    parameterIds.add(variableLegModeAdjustmentParameterId(modeId));
  }

  const resolved: ResolvedRefinementParameter[] = [];
  for (const parameterId of parameterIds) {
    if (parameterId.startsWith("bar-length:")) {
      const targetId = parameterId.slice("bar-length:".length);
      if (request.selectedBarId && targetId !== request.selectedBarId) {
        throw new Error(`当前杆件精修只能修改 ${request.selectedBarId}`);
      }
      if (!source.baseProject.bars.some((bar) => bar.id === targetId)) {
        throw new Error(`精修杆件不存在：${targetId}`);
      }
      resolved.push({ kind: "bar-length", targetId });
      continue;
    }
    if (parameterId.startsWith("joint-x:") || parameterId.startsWith("joint-y:")) {
      const axis = parameterId.startsWith("joint-x:") ? "x" : "y";
      const targetId = parameterId.slice("joint-x:".length);
      const joint = source.baseProject.joints.find((item) => item.id === targetId);
      if (!joint?.fixed) throw new Error(`精修固定铰点不存在：${targetId}`);
      resolved.push({ kind: "joint-coordinate", targetId, axis });
      continue;
    }
    if (parameterId === VARIABLE_LEG_RAIL_ANGLE_PARAMETER_ID) {
      if (source.adjustment.kind !== "moving-pivot") {
        throw new Error("只有移动铰点调节允许精修导轨角度");
      }
      resolved.push({ kind: "rail-angle" });
      continue;
    }
    if (parameterId.startsWith("mode-adjustment:")) {
      const modeId = parameterId.slice("mode-adjustment:".length);
      if (!modeIds.has(modeId)) {
        throw new Error(`锁止值参数必须同时列入 modeIds：${modeId}`);
      }
      resolved.push({ kind: "mode-adjustment", modeId });
      continue;
    }
    throw new Error(`不支持的精修参数：${parameterId}`);
  }
  return resolved;
}

function continuityPenalty(metrics: ReturnType<typeof analyzeVariableLegMode>[]) {
  return metrics.reduce((sum, metric) => sum
    + (1 - metric.validRatio) * 100
    + metric.branchSwitches * 12
    + Math.max(0, 5 - metric.singularityMargin) * 0.5
    + (Number.isFinite(metric.closureError) ? 0 : 100), 0);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function scaleProject(project: FreeMechanismProject, scale: number) {
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
  next.tracers = next.tracers.map((tracer) => tracer.kind === "joint" ? { ...tracer } : { ...tracer, localX: tracer.localX * scale, localY: tracer.localY * scale });
  return next;
}

export function createGuidedDesignSearchSeed(
  source: VariableLegProject,
  request: GuidedDesignRequest,
  role: GuidedDesignRole,
) {
  const roleGeometry = {
    recommended: { scale: 1, crank: 1 },
    conservative: { scale: 1.04, crank: 0.96 },
    performance: { scale: 1, crank: 1.07 },
  }[role];
  const seed = buildGuidedDesignSeed(source, request, role);
  const baseProject = scaleProject(source.baseProject, roleGeometry.scale);
  const driver = baseProject.bars.find((bar) => bar.id === baseProject.driverId);
  if (driver) {
    driver.length *= roleGeometry.crank;
    const endpoints = new Set([driver.a, driver.b]);
    baseProject.dimensions = baseProject.dimensions.map((dimension) => (
      dimension.type === "distance" && endpoints.has(dimension.a) && endpoints.has(dimension.b)
        ? { ...dimension, value: driver.length }
        : dimension
    ));
  }

  let adjustment: VariableLegAdjustment;
  if (source.adjustment.kind === "moving-pivot") {
    const joint = baseProject.joints.find((item) => item.id === source.adjustment.targetId);
    if (!joint) throw new Error(`当前机构缺少调节铰点：${source.adjustment.targetId}`);
    adjustment = {
      ...source.adjustment,
      baseX: joint.x,
      baseY: joint.y,
      minimum: source.adjustment.minimum * roleGeometry.scale,
      maximum: source.adjustment.maximum * roleGeometry.scale,
    };
  } else {
    const bar = baseProject.bars.find((item) => item.id === source.adjustment.targetId);
    if (!bar) throw new Error(`当前机构缺少调节杆件：${source.adjustment.targetId}`);
    adjustment = {
      ...source.adjustment,
      baseLength: bar.length,
      minimum: source.adjustment.minimum * roleGeometry.scale,
      maximum: source.adjustment.maximum * roleGeometry.scale,
    };
  }

  const modes = seed.modes.map((mode) => {
    const sourceMode = source.modes.find((item) => item.id === mode.id) ?? mode;
    const adjustmentValue = source.adjustment.kind === "moving-pivot"
      ? clamp(sourceMode.adjustmentValue * roleGeometry.scale, adjustment.minimum, adjustment.maximum)
      : clamp(
        (adjustment.kind === "telescopic-bar" ? adjustment.baseLength : source.adjustment.baseLength)
          + (sourceMode.adjustmentValue - source.adjustment.baseLength) * roleGeometry.scale,
        adjustment.minimum,
        adjustment.maximum,
      );
    return { ...mode, adjustmentValue };
  });
  return {
    ...seed,
    baseProject,
    adjustment,
    modes,
  } satisfies VariableLegProject;
}

function adjustmentFor(
  topology: VariableLegTopology,
  kind: VariableLegAdjustmentKind,
  targetId: string,
  project: FreeMechanismProject,
) {
  const adjustment = createDefaultAdjustment(topology, kind);
  if (kind === "moving-pivot") {
    const joint = project.joints.find((item) => item.id === targetId)!;
    const scale = Math.max(40, ...project.bars.map((bar) => bar.length)) / 200;
    return {
      ...adjustment,
      targetId,
      baseX: joint.x,
      baseY: joint.y,
      minimum: -45 * scale,
      maximum: 45 * scale,
    } as VariableLegAdjustment;
  }
  const bar = project.bars.find((item) => item.id === targetId)!;
  return {
    ...adjustment,
    targetId,
    baseLength: bar.length,
    minimum: bar.length * 0.82,
    maximum: bar.length * 1.18,
  } as VariableLegAdjustment;
}

function modeCost(metric: ReturnType<typeof analyzeVariableLegMode>, mode: VariableLegMode) {
  return Math.max(0.1, mode.weight) * variableLegModeCost(metric, mode);
}

function cloneModes(modes: VariableLegMode[]) {
  return modes.map((mode) => ({ ...mode, targetPath: mode.targetPath.map((point) => ({ ...point })) }));
}

async function yieldToWorker() {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

async function refineCurrentTarget(
  source: VariableLegProject,
  request: RefinementRequest,
  onProgress: ((progress: VariableLegSynthesisProgress) => void) | undefined,
  shouldCancel: () => boolean,
) {
  const parameters = resolveRefinementParameters(source, request);
  const random = createRandom(20260715);
  let best: SearchSeed = {
    topology: source.topology,
    baseProject: cloneProject(source.baseProject),
    adjustment: { ...source.adjustment },
    modes: cloneModes(source.modes),
    score: -1,
    cost: Number.POSITIVE_INFINITY,
  };
  let bestEvaluation = evaluateSearchSeed(source, best, 42, 56);
  best = { ...best, score: bestEvaluation.score, cost: bestEvaluation.cost };
  if (parameters.length === 0) {
    onProgress?.({ progress: 1, stage: "finalize", message: "未解锁精修参数，已返回未修改候选" });
    return [candidateFromSeed(source, best, "variable-leg-refinement-no-change", "未修改候选")];
  }

  const iterations = clamp(Math.round(request.iterations ?? 32), 1, 200);
  const characteristicLength = Math.max(40, ...source.baseProject.bars.map((bar) => bar.length));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (shouldCancel()) throw new VariableLegSynthesisCancelled();
    const temperature = 1 - iteration / iterations;
    const testProject = cloneProject(best.baseProject);
    let testAdjustment: VariableLegAdjustment = { ...best.adjustment };
    const testModes = cloneModes(best.modes);
    const parameter = parameters[Math.floor(random() * parameters.length)];

    if (parameter.kind === "bar-length") {
      const bar = testProject.bars.find((item) => item.id === parameter.targetId)!;
      const previousLength = bar.length;
      bar.length *= 1 + (random() * 2 - 1) * 0.05 * temperature;
      if (testAdjustment.kind === "telescopic-bar" && bar.id === testAdjustment.targetId) {
        const delta = bar.length - previousLength;
        testAdjustment = {
          ...testAdjustment,
          baseLength: bar.length,
          minimum: testAdjustment.minimum + delta,
          maximum: testAdjustment.maximum + delta,
        };
      }
    } else if (parameter.kind === "joint-coordinate") {
      const joint = testProject.joints.find((item) => item.id === parameter.targetId)!;
      joint[parameter.axis] += (random() * 2 - 1) * characteristicLength * 0.025 * temperature;
      testProject.bodies = testProject.bodies.map((body) => body.jointIds.includes(joint.id)
        ? createRigidBody(body.id, body.jointIds, testProject.joints)
        : body);
      if (testAdjustment.kind === "moving-pivot" && testAdjustment.targetId === joint.id) {
        testAdjustment = {
          ...testAdjustment,
          baseX: joint.x,
          baseY: joint.y,
        };
      }
    } else if (parameter.kind === "rail-angle" && testAdjustment.kind === "moving-pivot") {
      testAdjustment = {
        ...testAdjustment,
        railAngle: clamp(testAdjustment.railAngle + (random() * 2 - 1) * 12 * temperature, -85, 85),
      };
    } else if (parameter.kind === "mode-adjustment") {
      const mode = testModes.find((item) => item.id === parameter.modeId)!;
      mode.adjustmentValue = clamp(
        mode.adjustmentValue + (random() * 2 - 1) * (testAdjustment.maximum - testAdjustment.minimum) * 0.16 * temperature,
        testAdjustment.minimum,
        testAdjustment.maximum,
      );
    }

    const testSeed: SearchSeed = {
      ...best,
      baseProject: testProject,
      adjustment: testAdjustment,
      modes: testModes,
    };
    const testEvaluation = evaluateSearchSeed(source, testSeed, 42, 56);
    if (seedEvaluationIsBetter(bestEvaluation, testEvaluation)) {
      best = {
        ...testSeed,
        baseProject: testProject,
        adjustment: testAdjustment,
        modes: testModes,
        score: testEvaluation.score,
        cost: testEvaluation.cost,
      };
      bestEvaluation = testEvaluation;
    }
    onProgress?.({
      progress: (iteration + 1) / iterations * 0.92,
      stage: "refine",
      message: `受控精修：${iteration + 1}/${iterations}`,
    });
    if (iteration % 2 === 1) await yieldToWorker();
  }
  const label = request.selectedBarId ? `${request.selectedBarId} 精修候选` : "受控精修候选";
  onProgress?.({ progress: 1, stage: "finalize", message: `${label}已生成，等待预览和应用` });
  return [candidateFromSeed(source, best, "variable-leg-controlled-refinement", label)];
}

export async function refineVariableLeg(
  source: VariableLegProject,
  request: RefinementRequest,
  onProgress?: (progress: VariableLegSynthesisProgress) => void,
  shouldCancel: () => boolean = () => false,
): Promise<VariableLegCandidate[]> {
  const sourceSnapshot = cloneVariableLegProject(source);
  return refineCurrentTarget(sourceSnapshot, request, onProgress, shouldCancel);
}

function guidedPreflightMetrics(project: VariableLegProject, request: GuidedDesignRequest) {
  const mode = project.modes.find((item) => item.id === request.scenario);
  if (!mode) return [];
  // Sparse phase steps can make the continuation solver jump branches and
  // falsely label the same mechanism unhealthy. Preflight and final
  // verification therefore share the same 72 × 90 continuation resolution.
  return [analyzeVariableLegMode(project.baseProject, project.adjustment, mode, 72, 90)];
}

export function preflightGuidedDesign(
  source: VariableLegProject,
  request: GuidedDesignRequest,
  options: VariableLegGuidedSynthesisOptions = {},
): GuidedDesignPreflight {
  const currentGate = assessGuidedHardGate(guidedPreflightMetrics(source, request), request.scenario);
  const useOfflineBaseline = !currentGate.passed && options.allowOfflineBaselineFallback === true;
  const selected = useOfflineBaseline
    ? createGuidedSafeBaseline(source.topology, request.scenario)
    : source;
  const selectedGate = assessGuidedHardGate(guidedPreflightMetrics(selected, request), request.scenario);
  return {
    source: useOfflineBaseline ? "safe-baseline" : "current",
    currentGate,
    selectedGate,
    zones: guidedDesignZones(request),
    message: currentGate.passed
      ? "当前机构通过快速健康检查，本次从当前机构继续搜索。"
      : useOfflineBaseline && selectedGate.passed
        ? "当前机构不可用，本次从同拓扑安全基线生成；不会覆盖当前项目。"
        : useOfflineBaseline
          ? "当前机构与显式选择的离线种子均未通过快速检查；只有最终通过完整硬门槛的候选才会返回。"
          : "当前机构未通过快速检查；离线种子回退未启用，将只从当前机构克隆继续搜索。",
  };
}

function guidedSuggestions(request: GuidedDesignRequest) {
  if (request.scenario === "sprint") return [
    { key: "rpm" as const, value: Math.max(6, Math.round(request.targets.rpm * 0.82)), label: "降低主轴转速 18%" },
    { key: "landingSpeedLimit" as const, value: Math.round(request.targets.landingSpeedLimit * 1.2), label: "放宽落地速度上限 20%" },
  ];
  if (request.scenario === "obstacle") return [
    { key: "liftHeight" as const, value: Math.max(20, Math.round(request.targets.liftHeight * 0.85)), label: "降低净离地高度 15%" },
    { key: "stepLength" as const, value: Math.max(50, Math.round(request.targets.stepLength * 0.88)), label: "缩短步长 12%" },
  ];
  return [
    { key: "stepLength" as const, value: Math.max(50, Math.round(request.targets.stepLength * 0.88)), label: "缩短步长 12%" },
    { key: "landingSpeedLimit" as const, value: Math.round(request.targets.landingSpeedLimit * 1.15), label: "放宽落地速度上限 15%" },
  ];
}

export async function synthesizeVariableLegGuidedDesign(
  source: VariableLegProject,
  request: GuidedDesignRequest,
  onProgress?: (progress: VariableLegSynthesisProgress) => void,
  shouldCancel: () => boolean = () => false,
  options: VariableLegGuidedSynthesisOptions = {},
): Promise<GuidedDesignResult> {
  const sourceSnapshot = cloneVariableLegProject(source);
  const preflight = preflightGuidedDesign(sourceSnapshot, request, options);
  const baseline = preflight.source === "current" ? cloneVariableLegProject(sourceSnapshot) : (() => {
    const project = createGuidedSafeBaseline(sourceSnapshot.topology, request.scenario);
    project.deployment = sourceSnapshot.deployment;
    return project;
  })();
  const roles: Array<{ role: GuidedDesignRole; label: string }> = [
    { role: "recommended", label: "推荐方案" },
    { role: "conservative", label: "保守备选" },
    { role: "performance", label: "性能备选" },
  ];
  const candidates: VariableLegCandidate[] = [];
  for (let index = 0; index < roles.length; index += 1) {
    if (shouldCancel()) throw new VariableLegSynthesisCancelled();
    const option = roles[index];
    const seed = createGuidedDesignSearchSeed(baseline, request, option.role);
    const seedMetrics: ReturnType<typeof analyzeVariableLegMode>[] = [];
    seed.modes = seed.modes.map((mode) => {
      let bestMode = { ...mode };
      let bestMetric = analyzeVariableLegMode(seed.baseProject, seed.adjustment, mode, 72, 90);
      let bestPenalty = continuityPenalty([bestMetric]);
      let bestCost = modeCost(bestMetric, mode);
      for (let sampleIndex = 0; sampleIndex < 11; sampleIndex += 1) {
        const adjustmentValue = seed.adjustment.minimum
          + (seed.adjustment.maximum - seed.adjustment.minimum) * sampleIndex / 10;
        const testMode = { ...mode, adjustmentValue };
        const metric = analyzeVariableLegMode(seed.baseProject, seed.adjustment, testMode, 72, 90);
        const penalty = continuityPenalty([metric]);
        const cost = modeCost(metric, testMode);
        if (penalty < bestPenalty - 1e-6 || (Math.abs(penalty - bestPenalty) <= 1e-6 && cost < bestCost)) {
          bestMode = testMode;
          bestMetric = metric;
          bestPenalty = penalty;
          bestCost = cost;
        }
      }
      seedMetrics.push(bestMetric);
      return bestMode;
    });
    onProgress?.({
      progress: (index + 0.08) / roles.length,
      stage: "scan",
      message: `${option.label}：正在寻找各工况连续锁止值`,
    });
    await yieldToWorker();
    const seedIsUsable = assessGuidedHardGate(seedMetrics, request.scenario).passed;
    const refined = seedIsUsable ? [] : await refineCurrentTarget(
        seed,
        {
          allowedParameterIds: seed.baseProject.bars
            .filter((bar) => bar.id !== seed.baseProject.driverId)
            .map((bar) => variableLegBarLengthParameterId(bar.id)),
          modeIds: seed.modes.map((mode) => mode.id),
        },
        (progress) => onProgress?.({
          ...progress,
          progress: (index + progress.progress) / roles.length,
          message: `${option.label}：${progress.message}`,
        }),
        shouldCancel,
      );
    const family = scoreVariableLegFamily(seedMetrics, seed.modes, seed.adjustment);
    const candidate = refined[0] ?? {
      id: `guided-design-${option.role}`,
      label: option.label,
      topology: seed.topology,
      baseProject: seed.baseProject,
      adjustment: seed.adjustment,
      modes: seed.modes,
      score: family.score,
      familyRmse: seedMetrics.reduce((sum, metric) => sum + metric.rmse, 0) / Math.max(1, seedMetrics.length),
      adjustmentStroke: family.stroke,
      metrics: seedMetrics,
    } satisfies VariableLegCandidate;
    if (candidate) {
      const finalMetrics = candidate.modes.map((mode) => analyzeVariableLegMode(candidate.baseProject, candidate.adjustment, mode, 72, 90));
      const hardGateResult = assessGuidedHardGate(finalMetrics, request.scenario);
      if (hardGateResult.passed) candidates.push({
      ...candidate,
      id: `guided-design-${option.role}`,
      label: option.label,
      topology: source.topology,
      role: option.role,
      guidedScenario: request.scenario,
      hardGateResult,
      compatibility: summarizeGuidedCompatibility(finalMetrics, request.scenario),
      metrics: finalMetrics,
      constraintEvaluation: evaluateVariableLegConstraints(finalMetrics, sourceSnapshot.requirements),
      });
    }
  }
  onProgress?.({ progress: 1, stage: "finalize", message: candidates.length ? `已找到 ${candidates.length} 个通过硬门槛的方案` : "没有方案通过所选场景硬门槛" });
  return { candidates, preflight, suggestions: candidates.length ? [] : guidedSuggestions(request) };
}

export async function synthesizeVariableLeg(
  source: VariableLegProject,
  onProgress?: (progress: VariableLegSynthesisProgress) => void,
  shouldCancel: () => boolean = () => false,
  scope: VariableLegSynthesisScope = "global",
  refinementRequest?: RefinementRequest,
  generationRequest: VariableLegGenerationRequest = {},
): Promise<VariableLegCandidate[]> {
  const sourceSnapshot = cloneVariableLegProject(source);
  if (sourceSnapshot.modes.length === 0 || sourceSnapshot.modes.some((mode) => mode.targetPath.length < 12)) {
    throw new Error("每个工况至少需要 12 个目标轨迹点");
  }
  if (scope === "current-target") {
    return refineCurrentTarget(
      sourceSnapshot,
      refinementRequest ?? { allowedParameterIds: [], modeIds: [] },
      onProgress,
      shouldCancel,
    );
  }

  // The topology selector is an engineering constraint, not merely the
  // initial preview. Global synthesis explores adjustment targets and scales
  // within the selected family so a Klann project cannot silently turn into a
  // Jansen project (and vice versa).
  const topologies: VariableLegTopology[] = [sourceSnapshot.topology];
  const scales = [0.86, 1, 1.14];
  const combinations = topologies.flatMap((topology) => {
    const options = VARIABLE_LEG_OPTIONS[topology];
    const availableProject = generationRequest.seedSource === "template"
      ? getVariableLegTemplate(topology)
      : sourceSnapshot.baseProject;
    const available = [
      ...options.movingPivots
        .filter((option) => availableProject.joints.some((joint) => joint.id === option.id))
        .map((option) => ({ topology, kind: "moving-pivot" as const, targetId: option.id })),
      ...options.telescopicBars
        .filter((option) => availableProject.bars.some((bar) => bar.id === option.id))
        .map((option) => ({ topology, kind: "telescopic-bar" as const, targetId: option.id })),
    ];
    const currentTargetExists = sourceSnapshot.adjustment.kind === "moving-pivot"
      ? availableProject.joints.some((joint) => joint.id === sourceSnapshot.adjustment.targetId)
      : availableProject.bars.some((bar) => bar.id === sourceSnapshot.adjustment.targetId);
    if (currentTargetExists && !available.some((item) => (
      item.kind === sourceSnapshot.adjustment.kind
      && item.targetId === sourceSnapshot.adjustment.targetId
    ))) {
      available.unshift({
        topology,
        kind: sourceSnapshot.adjustment.kind,
        targetId: sourceSnapshot.adjustment.targetId,
      });
    }
    return available;
  });
  if (combinations.length === 0) {
    throw new Error("当前机构没有可用于生成的调节对象；如需模板种子，请显式选择模板生成。");
  }
  const totalScanSteps = combinations.length * scales.length * sourceSnapshot.modes.length;
  let completedScanSteps = 0;
  const seeds: SearchSeed[] = [];

  for (const combination of combinations) {
    for (const scale of scales) {
      if (shouldCancel()) throw new VariableLegSynthesisCancelled();
      const seedProject = generationRequest.seedSource === "template"
        ? getVariableLegTemplate(combination.topology)
        : sourceSnapshot.baseProject;
      const baseProject = scaleProject(seedProject, scale);
      let adjustment = adjustmentFor(combination.topology, combination.kind, combination.targetId, baseProject);
      if (adjustment.kind === "moving-pivot") {
        adjustment = {
          ...adjustment,
          railAngle: sourceSnapshot.adjustment.kind === "moving-pivot" ? sourceSnapshot.adjustment.railAngle : -20,
        };
      }
      const modes = cloneModes(sourceSnapshot.modes);
      let weightedCost = 0;
      for (const mode of modes) {
        let bestValue = clamp(mode.adjustmentValue, adjustment.minimum, adjustment.maximum);
        let bestMetric = analyzeVariableLegMode(baseProject, adjustment, { ...mode, adjustmentValue: bestValue }, 36, 48);
        let bestCost = modeCost(bestMetric, mode);
        const requirement = sourceSnapshot.requirements.find((item) => item.modeId === mode.id);
        let bestHardViolation = requirement
          ? constraintHardViolation(evaluateVariableLegConstraints([bestMetric], [requirement]))
          : 0;
        for (let sampleIndex = 0; sampleIndex < 7; sampleIndex += 1) {
          const value = adjustment.minimum + (adjustment.maximum - adjustment.minimum) * sampleIndex / 6;
          const testMode = { ...mode, adjustmentValue: value };
          const metric = analyzeVariableLegMode(baseProject, adjustment, testMode, 36, 48);
          const cost = modeCost(metric, mode);
          const hardViolation = requirement
            ? constraintHardViolation(evaluateVariableLegConstraints([metric], [requirement]))
            : 0;
          if (hardViolation < bestHardViolation - 1e-6
            || (Math.abs(hardViolation - bestHardViolation) <= 1e-6 && cost < bestCost)) {
            bestCost = cost;
            bestHardViolation = hardViolation;
            bestValue = value;
            bestMetric = metric;
          }
        }
        mode.adjustmentValue = bestValue;
        weightedCost += bestCost;
        void bestMetric;
        completedScanSteps += 1;
        onProgress?.({
          progress: completedScanSteps / Math.max(1, totalScanSteps) * 0.58,
          stage: "scan",
          message: `灵敏度扫描：${VARIABLE_LEG_OPTIONS[combination.topology].label} / ${combination.targetId}`,
        });
        await yieldToWorker();
      }
      const metrics = modes.map((mode) => analyzeVariableLegMode(baseProject, adjustment, mode, 36, 48));
      const family = scoreVariableLegFamily(metrics, modes, adjustment);
      seeds.push({
        topology: combination.topology,
        baseProject,
        adjustment,
        modes,
        score: family.score,
        cost: weightedCost,
        evaluation: evaluateVariableLegConstraints(metrics, sourceSnapshot.requirements),
      });
    }
  }

  seeds.sort((first, second) => {
    if (first.evaluation?.hardPassed !== second.evaluation?.hardPassed) {
      return first.evaluation?.hardPassed ? -1 : 1;
    }
    const hardViolationDifference = constraintHardViolation(first.evaluation)
      - constraintHardViolation(second.evaluation);
    if (Math.abs(hardViolationDifference) > 1e-6) return hardViolationDifference;
    const scoreDifference = second.score - first.score;
    if (Math.abs(scoreDifference) > 1e-6) return scoreDifference;
    const softDifference = (second.evaluation?.softScore ?? 0) - (first.evaluation?.softScore ?? 0);
    return Math.abs(softDifference) > 1e-6 ? softDifference : first.cost - second.cost;
  });
  const selectedSeeds: SearchSeed[] = [];
  for (const seed of seeds) {
    const duplicate = selectedSeeds.some((item) => item.topology === seed.topology
      && item.adjustment.kind === seed.adjustment.kind
      && item.adjustment.targetId === seed.adjustment.targetId);
    if (!duplicate || selectedSeeds.length < 3) selectedSeeds.push(seed);
    if (selectedSeeds.length >= 10) break;
  }

  const random = createRandom(20260714);
  const refined: SearchSeed[] = [];
  for (let seedIndex = 0; seedIndex < selectedSeeds.length; seedIndex += 1) {
    if (shouldCancel()) throw new VariableLegSynthesisCancelled();
    let best = selectedSeeds[seedIndex];
    let bestEvaluation = evaluateSearchSeed(sourceSnapshot, best, 42, 56);
    const iterations = 18;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const temperature = 1 - iteration / iterations;
      const testProject = cloneProject(best.baseProject);
      const mutableBars = testProject.bars.filter((bar) => bar.id !== testProject.driverId && bar.id !== best.adjustment.targetId);
      const bar = mutableBars[Math.floor(random() * mutableBars.length)];
      if (bar) bar.length *= 1 + (random() * 2 - 1) * 0.065 * temperature;
      let testAdjustment: VariableLegAdjustment = { ...best.adjustment };
      if (testAdjustment.kind === "moving-pivot" && random() < 0.45) {
        testAdjustment = { ...testAdjustment, railAngle: clamp(testAdjustment.railAngle + (random() * 2 - 1) * 18 * temperature, -85, 85) };
      }
      const testModes = best.modes.map((mode) => ({
        ...mode,
        targetPath: mode.targetPath.map((point) => ({ ...point })),
        adjustmentValue: clamp(
          mode.adjustmentValue + (random() * 2 - 1) * (testAdjustment.maximum - testAdjustment.minimum) * 0.18 * temperature,
          testAdjustment.minimum,
          testAdjustment.maximum,
        ),
      }));
      const testSeed = { ...best, baseProject: testProject, adjustment: testAdjustment, modes: testModes };
      const testEvaluation = evaluateSearchSeed(sourceSnapshot, testSeed, 42, 56);
      if (seedEvaluationIsBetter(bestEvaluation, testEvaluation, false)) {
        best = {
          ...testSeed,
          score: testEvaluation.score,
          cost: testEvaluation.cost,
        };
        bestEvaluation = testEvaluation;
      }
      onProgress?.({
        progress: 0.58 + ((seedIndex * iterations + iteration + 1) / Math.max(1, selectedSeeds.length * iterations)) * 0.37,
        stage: "refine",
        message: `局部精修：候选 ${seedIndex + 1}/${selectedSeeds.length}`,
      });
      if (iteration % 2 === 1) await yieldToWorker();
    }
    refined.push(best);
  }

  if (shouldCancel()) throw new VariableLegSynthesisCancelled();
  const finalCandidates = refined.map((seed, index) => candidateFromSeed(
    sourceSnapshot,
    seed,
    `variable-leg-${index + 1}`,
    index === 0 ? "综合推荐" : seed.adjustment.kind === "moving-pivot" ? "低惯量调节" : "轨迹变化优先",
  )).sort((first, second) => {
    if (first.constraintEvaluation?.hardPassed !== second.constraintEvaluation?.hardPassed) {
      return first.constraintEvaluation?.hardPassed ? -1 : 1;
    }
    const hardViolationDifference = constraintHardViolation(first.constraintEvaluation)
      - constraintHardViolation(second.constraintEvaluation);
    if (Math.abs(hardViolationDifference) > 1e-6) return hardViolationDifference;
    const scoreDifference = second.score - first.score;
    if (Math.abs(scoreDifference) > 1e-6) return scoreDifference;
    return (second.constraintEvaluation?.softScore ?? 0)
      - (first.constraintEvaluation?.softScore ?? 0);
  });

  const diverse: VariableLegCandidate[] = [];
  for (const candidate of finalCandidates) {
    const duplicate = diverse.some((item) => item.topology === candidate.topology
      && item.adjustment.kind === candidate.adjustment.kind
      && item.adjustment.targetId === candidate.adjustment.targetId);
    if (!duplicate || diverse.length < 2) diverse.push(candidate);
    if (diverse.length >= 5) break;
  }
  for (const candidate of finalCandidates) {
    if (!diverse.includes(candidate)) diverse.push(candidate);
    if (diverse.length >= 5) break;
  }

  onProgress?.({ progress: 1, stage: "finalize", message: `已完成 ${diverse.length} 套候选方案` });
  return diverse.map((candidate, index) => ({
    ...candidate,
    id: `variable-leg-${index + 1}`,
    label: index === 0 ? "综合推荐" : candidate.label,
  }));
}

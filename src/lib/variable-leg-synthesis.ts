import {
  VARIABLE_LEG_OPTIONS,
  analyzeVariableLegMode,
  assessVariableLegCandidate,
  buildVariableLegQuickDesignSeed,
  createDefaultAdjustment,
  getVariableLegTemplate,
  scoreVariableLegFamily,
  variableLegModeCost,
  type VariableLegAdjustment,
  type VariableLegAdjustmentKind,
  type VariableLegCandidate,
  type VariableLegMode,
  type VariableLegProject,
  type VariableLegQuickDesign,
  type VariableLegQuickDesignPreset,
  type VariableLegTopology,
} from "./variable-leg";
import { cloneProject, type FreeMechanismProject } from "./free-mechanism";

export type VariableLegSynthesisProgress = {
  progress: number;
  stage: "scan" | "refine" | "finalize";
  message: string;
};

export type VariableLegSynthesisScope = "global" | "current-target";

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
};

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
  onProgress: ((progress: VariableLegSynthesisProgress) => void) | undefined,
  shouldCancel: () => boolean,
) {
  const random = createRandom(20260715);
  let best: SearchSeed = {
    topology: source.topology,
    baseProject: cloneProject(source.baseProject),
    adjustment: { ...source.adjustment },
    modes: cloneModes(source.modes),
    score: -1,
    cost: Number.POSITIVE_INFINITY,
  };
  const initialMetrics = best.modes.map((mode) => analyzeVariableLegMode(best.baseProject, best.adjustment, mode, 42, 56));
  const initialFamily = scoreVariableLegFamily(initialMetrics, best.modes, best.adjustment);
  let bestContinuityPenalty = continuityPenalty(initialMetrics);
  best = { ...best, score: initialFamily.score, cost: initialFamily.cost };
  const iterations = 32;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (shouldCancel()) throw new VariableLegSynthesisCancelled();
    const temperature = 1 - iteration / iterations;
    const testProject = cloneProject(best.baseProject);
    let testAdjustment: VariableLegAdjustment = { ...best.adjustment };
    let adjustmentDelta = 0;
    const mutableBars = testProject.bars.filter((bar) => bar.id !== testProject.driverId);
    const bar = mutableBars[Math.floor(random() * mutableBars.length)];
    if (bar) {
      const previousLength = bar.length;
      bar.length *= 1 + (random() * 2 - 1) * 0.05 * temperature;
      if (testAdjustment.kind === "telescopic-bar" && bar.id === testAdjustment.targetId) {
        const delta = bar.length - previousLength;
        adjustmentDelta = delta;
        testAdjustment = {
          ...testAdjustment,
          baseLength: bar.length,
          minimum: testAdjustment.minimum + delta,
          maximum: testAdjustment.maximum + delta,
        };
      }
    }
    const testModes = best.modes.map((mode) => ({
      ...mode,
      targetPath: mode.targetPath.map((point) => ({ ...point })),
      adjustmentValue: clamp(
        mode.adjustmentValue + adjustmentDelta + (random() * 2 - 1) * (testAdjustment.maximum - testAdjustment.minimum) * 0.16 * temperature,
        testAdjustment.minimum,
        testAdjustment.maximum,
      ),
    }));
    const metrics = testModes.map((mode) => analyzeVariableLegMode(testProject, testAdjustment, mode, 42, 56));
    const family = scoreVariableLegFamily(metrics, testModes, testAdjustment);
    const testContinuityPenalty = continuityPenalty(metrics);
    if (testContinuityPenalty < bestContinuityPenalty - 1e-6
      || (Math.abs(testContinuityPenalty - bestContinuityPenalty) <= 1e-6 && family.score >= best.score)) {
      best = {
        ...best,
        baseProject: testProject,
        adjustment: testAdjustment,
        modes: testModes,
        score: family.score,
        cost: family.cost,
      };
      bestContinuityPenalty = testContinuityPenalty;
    }
    onProgress?.({
      progress: (iteration + 1) / iterations * 0.92,
      stage: "refine",
      message: `精修当前杆件：${iteration + 1}/${iterations}`,
    });
    if (iteration % 2 === 1) await yieldToWorker();
  }
  const metrics = best.modes.map((mode) => analyzeVariableLegMode(best.baseProject, best.adjustment, mode, 72, 90));
  const family = scoreVariableLegFamily(metrics, best.modes, best.adjustment);
  onProgress?.({ progress: 1, stage: "finalize", message: "当前杆件精修完成" });
  return [{
    id: "variable-leg-current-target",
    label: "当前杆精修",
    topology: best.topology,
    baseProject: best.baseProject,
    adjustment: best.adjustment,
    modes: best.modes,
    score: family.score,
    familyRmse: metrics.reduce((sum, metric) => sum + metric.rmse, 0) / Math.max(1, metrics.length),
    adjustmentStroke: family.stroke,
    metrics,
  } satisfies VariableLegCandidate];
}

export async function synthesizeVariableLegQuickDesign(
  source: VariableLegProject,
  design: VariableLegQuickDesign,
  onProgress?: (progress: VariableLegSynthesisProgress) => void,
  shouldCancel: () => boolean = () => false,
) {
  const presets: Array<{ preset: VariableLegQuickDesignPreset; label: string }> = [
    { preset: "stable", label: "稳健基础" },
    { preset: "stride", label: "大步幅基础" },
    { preset: "clearance", label: "高抬腿基础" },
  ];
  const candidates: VariableLegCandidate[] = [];
  for (let index = 0; index < presets.length; index += 1) {
    if (shouldCancel()) throw new VariableLegSynthesisCancelled();
    const option = presets[index];
    const seed = buildVariableLegQuickDesignSeed(source, design, option.preset);
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
      progress: (index + 0.08) / presets.length,
      stage: "scan",
      message: `${option.label}：正在寻找各工况连续锁止值`,
    });
    await yieldToWorker();
    const seedIsUsable = assessVariableLegCandidate(seedMetrics, seed.modes).level === "usable";
    const refined = seedIsUsable ? [] : await refineCurrentTarget(
        seed,
        (progress) => onProgress?.({
          ...progress,
          progress: (index + progress.progress) / presets.length,
          message: `${option.label}：${progress.message}`,
        }),
        shouldCancel,
      );
    const family = scoreVariableLegFamily(seedMetrics, seed.modes, seed.adjustment);
    const candidate = refined[0] ?? {
      id: `quick-design-${option.preset}`,
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
    if (candidate) candidates.push({
      ...candidate,
      id: `quick-design-${option.preset}`,
      label: option.label,
      topology: source.topology,
    });
  }
  onProgress?.({ progress: 1, stage: "finalize", message: "三个基础方案已完成" });
  return candidates;
}

export async function synthesizeVariableLeg(
  source: VariableLegProject,
  onProgress?: (progress: VariableLegSynthesisProgress) => void,
  shouldCancel: () => boolean = () => false,
  scope: VariableLegSynthesisScope = "global",
): Promise<VariableLegCandidate[]> {
  if (source.modes.length === 0 || source.modes.some((mode) => mode.targetPath.length < 12)) {
    throw new Error("每个工况至少需要 12 个目标轨迹点");
  }
  if (scope === "current-target") return refineCurrentTarget(source, onProgress, shouldCancel);

  // The topology selector is an engineering constraint, not merely the
  // initial preview. Global synthesis explores adjustment targets and scales
  // within the selected family so a Klann project cannot silently turn into a
  // Jansen project (and vice versa).
  const topologies: VariableLegTopology[] = [source.topology];
  const scales = [0.86, 1, 1.14];
  const combinations = topologies.flatMap((topology) => {
    const options = VARIABLE_LEG_OPTIONS[topology];
    return [
      ...options.movingPivots.map((option) => ({ topology, kind: "moving-pivot" as const, targetId: option.id })),
      ...options.telescopicBars.map((option) => ({ topology, kind: "telescopic-bar" as const, targetId: option.id })),
    ];
  });
  const totalScanSteps = combinations.length * scales.length * source.modes.length;
  let completedScanSteps = 0;
  const seeds: SearchSeed[] = [];

  for (const combination of combinations) {
    for (const scale of scales) {
      if (shouldCancel()) throw new VariableLegSynthesisCancelled();
      const baseProject = scaleProject(getVariableLegTemplate(combination.topology), scale);
      let adjustment = adjustmentFor(combination.topology, combination.kind, combination.targetId, baseProject);
      if (adjustment.kind === "moving-pivot") {
        adjustment = { ...adjustment, railAngle: source.adjustment.kind === "moving-pivot" ? source.adjustment.railAngle : -20 };
      }
      const modes = cloneModes(source.modes);
      let weightedCost = 0;
      for (const mode of modes) {
        let bestValue = clamp(mode.adjustmentValue, adjustment.minimum, adjustment.maximum);
        let bestMetric = analyzeVariableLegMode(baseProject, adjustment, { ...mode, adjustmentValue: bestValue }, 36, 48);
        let bestCost = modeCost(bestMetric, mode);
        for (let sampleIndex = 0; sampleIndex < 7; sampleIndex += 1) {
          const value = adjustment.minimum + (adjustment.maximum - adjustment.minimum) * sampleIndex / 6;
          const testMode = { ...mode, adjustmentValue: value };
          const metric = analyzeVariableLegMode(baseProject, adjustment, testMode, 36, 48);
          const cost = modeCost(metric, mode);
          if (cost < bestCost) {
            bestCost = cost;
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
      seeds.push({ topology: combination.topology, baseProject, adjustment, modes, score: family.score, cost: weightedCost });
    }
  }

  seeds.sort((first, second) => second.score - first.score || first.cost - second.cost);
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
      const metrics = testModes.map((mode) => analyzeVariableLegMode(testProject, testAdjustment, mode, 42, 56));
      const family = scoreVariableLegFamily(metrics, testModes, testAdjustment);
      if (family.score >= best.score) best = { ...best, baseProject: testProject, adjustment: testAdjustment, modes: testModes, score: family.score, cost: 100 - family.score };
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
  const finalCandidates = refined.map((seed, index): VariableLegCandidate => {
    const metrics = seed.modes.map((mode) => analyzeVariableLegMode(seed.baseProject, seed.adjustment, mode, 72, 90));
    const family = scoreVariableLegFamily(metrics, seed.modes, seed.adjustment);
    return {
      id: `variable-leg-${index + 1}`,
      label: index === 0 ? "综合推荐" : seed.adjustment.kind === "moving-pivot" ? "低惯量调节" : "轨迹变化优先",
      topology: seed.topology,
      baseProject: seed.baseProject,
      adjustment: seed.adjustment,
      modes: seed.modes,
      score: family.score,
      familyRmse: metrics.reduce((sum, metric) => sum + metric.rmse, 0) / Math.max(1, metrics.length),
      adjustmentStroke: family.stroke,
      metrics,
    };
  }).sort((first, second) => second.score - first.score);

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

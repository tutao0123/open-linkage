import {
  createDefaultAdjustment,
  createDefaultModes,
  getVariableLegTemplate,
  analyzeVariableLegMode,
  type VariableLegTopology,
} from "../src/lib/variable-leg";

type ScanTask = {
  key: string;
  topology: VariableLegTopology;
  kind: "bar-length" | "fixed-joint-coordinate";
  targetId: string;
  axis?: "x" | "y";
  baseline: number;
  referenceLength: number;
  minimum: number;
  maximum: number;
};

type Interval = { minimum: number; maximum: number };

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function referenceLength(topology: VariableLegTopology) {
  const project = getVariableLegTemplate(topology);
  return median(project.bars.filter((bar) => bar.id !== project.driverId).map((bar) => bar.length));
}

function scanTasks(): ScanTask[] {
  return (["klann", "jansen"] as const).flatMap((topology) => {
    const project = getVariableLegTemplate(topology);
    const reference = referenceLength(topology);
    const bars = project.bars.map((bar) => ({
      key: `bar:${bar.id}`,
      topology,
      kind: "bar-length" as const,
      targetId: bar.id,
      baseline: bar.length,
      referenceLength: reference,
      minimum: bar.length * 0.62,
      maximum: bar.length * 1.38,
    }));
    const joints = project.joints.filter((joint) => joint.fixed).flatMap((joint) => (["x", "y"] as const).map((axis) => ({
      key: `joint:${joint.id}:${axis}`,
      topology,
      kind: "fixed-joint-coordinate" as const,
      targetId: joint.id,
      axis,
      baseline: joint[axis],
      referenceLength: reference,
      minimum: joint[axis] - reference * 0.42,
      maximum: joint[axis] + reference * 0.42,
    })));
    return [...bars, ...joints];
  });
}

function applyTask(task: ScanTask, value: number) {
  const project = getVariableLegTemplate(task.topology);
  if (task.kind === "bar-length") {
    const bar = project.bars.find((item) => item.id === task.targetId);
    if (bar) bar.length = value;
  } else {
    const joint = project.joints.find((item) => item.id === task.targetId);
    if (joint && task.axis) joint[task.axis] = value;
  }
  return project;
}

function metricFor(task: ScanTask, value: number, phaseSamples: number, iterations: number) {
  const project = applyTask(task, value);
  const adjustment = createDefaultAdjustment(task.topology, "telescopic-bar");
  const targetBar = project.bars.find((bar) => bar.id === adjustment.targetId);
  if (targetBar && adjustment.kind === "telescopic-bar") {
    adjustment.baseLength = targetBar.length;
    adjustment.minimum = targetBar.length;
    adjustment.maximum = targetBar.length;
  }
  const mode = { ...createDefaultModes()[0], adjustmentValue: adjustment.kind === "telescopic-bar" ? adjustment.baseLength : 0 };
  return analyzeVariableLegMode(project, adjustment, mode, phaseSamples, iterations);
}

function isFeasible(
  task: ScanTask,
  value: number,
  phaseSamples: number,
  iterations: number,
  baselineMetric: ReturnType<typeof metricFor>,
) {
  const metric = metricFor(task, value, phaseSamples, iterations);
  // Offline baselines are a broad structural envelope. The browser Worker
  // applies the stricter residual and singularity checks to the current
  // multi-mode project before a value can be committed.
  const minimumValidRatio = Math.max(0.85, Math.min(0.99, baselineMetric.validRatio - 1 / phaseSamples));
  return metric.validRatio >= minimumValidRatio
    && metric.branchSwitches <= baselineMetric.branchSwitches
    && Number.isFinite(metric.closureError);
}

function intervalsFromSamples(samples: Array<{ value: number; feasible: boolean }>, step: number): Interval[] {
  const intervals: Interval[] = [];
  let start: number | null = null;
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index];
    if (sample?.feasible && start === null) start = sample.value;
    if ((!sample?.feasible || index === samples.length) && start !== null) {
      const end = samples[index - 1].value;
      const minimum = start === samples[0].value ? start : Math.min(end, start + step * 0.5);
      const maximum = end === samples[samples.length - 1].value ? end : Math.max(minimum, end - step * 0.5);
      intervals.push({ minimum, maximum });
      start = null;
    }
  }
  return intervals;
}

function normalizedIntervals(task: ScanTask, intervals: Interval[]) {
  if (task.kind === "bar-length") {
    return intervals.map((interval) => ({
      minimum: interval.minimum / task.baseline,
      maximum: interval.maximum / task.baseline,
    }));
  }
  return intervals.map((interval) => ({
    minimum: (interval.minimum - task.baseline) / task.referenceLength,
    maximum: (interval.maximum - task.baseline) / task.referenceLength,
  }));
}

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const tasks = scanTasks();
if (process.argv.includes("--list")) {
  process.stdout.write(JSON.stringify(tasks));
} else {
  const topology = arg("--topology") as VariableLegTopology | undefined;
  const key = arg("--task");
  const task = tasks.find((item) => item.topology === topology && item.key === key);
  if (!task) throw new Error(`Unknown scan task: ${topology ?? "?"}/${key ?? "?"}`);
  const valueSamples = Math.max(9, Number(arg("--samples", "81")));
  const phaseSamples = Math.max(12, Number(arg("--phases", "36")));
  const iterations = Math.max(30, Number(arg("--iterations", "70")));
  const baselineMetric = metricFor(task, task.baseline, phaseSamples, iterations);
  if (process.argv.includes("--diagnose")) {
    const metric = metricFor(task, task.baseline, phaseSamples, iterations);
    process.stdout.write(JSON.stringify({
      validRatio: metric.validRatio,
      branchSwitches: metric.branchSwitches,
      closureError: metric.closureError,
      singularityMargin: metric.singularityMargin,
      maxConstraintError: metric.maxConstraintError,
    }));
    process.exit(0);
  }
  const step = (task.maximum - task.minimum) / (valueSamples - 1);
  const samples = Array.from({ length: valueSamples }, (_, index) => {
    const value = task.minimum + step * index;
    return { value, feasible: isFeasible(task, value, phaseSamples, iterations, baselineMetric) };
  });
  const intervals = intervalsFromSamples(samples, step);
  process.stdout.write(JSON.stringify({
    ...task,
    phaseSamples,
    iterations,
    valueSamples,
    intervals: normalizedIntervals(task, intervals),
    feasibleSamples: samples.filter((sample) => sample.feasible).length,
    baselineQuality: {
      validRatio: baselineMetric.validRatio,
      branchSwitches: baselineMetric.branchSwitches,
      singularityMargin: baselineMetric.singularityMargin,
    },
  }));
}

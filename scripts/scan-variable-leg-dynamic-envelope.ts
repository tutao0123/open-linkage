import baselineData from "../src/data/variable-leg-baselines.json";
import {
  createDefaultAdjustment,
  createDefaultModes,
  getVariableLegTemplate,
  sampleVariableLeg,
  VARIABLE_LEG_OPTIONS,
  type VariableLegMode,
  type VariableLegTopology,
} from "../src/lib/variable-leg";
import {
  maximumConstraintError,
  resolveTracerPoint,
  solveFreeMechanism,
  type FreeBar,
  type FreeMechanismProject,
} from "../src/lib/free-mechanism";

type Interval = { minimum: number; maximum: number; minimumSingularityMargin: number };
type PhaseResult = { phase: number; intervals: Interval[]; recommended: number | null; minimumSingularityMargin: number | null };
type SampleResult = { ratio: number; feasible: boolean; singularityMargin: number };

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function tasks() {
  return (Object.keys(VARIABLE_LEG_OPTIONS) as VariableLegTopology[]).flatMap((topology) => (
    VARIABLE_LEG_OPTIONS[topology].telescopicBars.map((bar) => ({ topology, barId: bar.id, label: bar.label }))
  ));
}

function jointAngleMargin(project: FreeMechanismProject) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  const neighbors = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  };
  project.bars.forEach((bar) => connect(bar.a, bar.b));
  project.bodies.forEach((body) => body.pairs.forEach((pair) => connect(pair.a, pair.b)));
  let margin = 90;
  for (const joint of project.joints) {
    const adjacent = [...new Set(neighbors.get(joint.id) ?? [])];
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
        const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / denominator));
        const angle = Math.acos(cosine) * 180 / Math.PI;
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
  const [first, second] = fixed;
  return Math.sign((second.x - first.x) * (tracer.y - first.y) - (second.y - first.y) * (tracer.x - first.x));
}

function withBarLength(project: FreeMechanismProject, bar: FreeBar, length: number) {
  const endpoints = new Set([bar.a, bar.b]);
  return {
    ...project,
    bars: project.bars.map((item) => item.id === bar.id ? { ...item, length } : item),
    dimensions: project.dimensions.map((dimension) => (
      dimension.type === "distance" && endpoints.has(dimension.a) && endpoints.has(dimension.b)
        ? { ...dimension, value: length }
        : dimension
    )),
  };
}

function intervalsFromSamples(samples: SampleResult[]): Interval[] {
  const intervals: Interval[] = [];
  let start = -1;
  for (let index = 0; index <= samples.length; index += 1) {
    if (samples[index]?.feasible && start < 0) start = index;
    if ((!samples[index]?.feasible || index === samples.length) && start >= 0) {
      const end = index - 1;
      intervals.push({
        minimum: samples[start].ratio,
        maximum: samples[end].ratio,
        minimumSingularityMargin: Math.min(...samples.slice(start, end + 1).map((sample) => sample.singularityMargin)),
      });
      start = -1;
    }
  }
  return intervals;
}

function closestFeasible(samples: SampleResult[]) {
  const feasible = samples.filter((sample) => sample.feasible);
  return feasible.reduce<SampleResult | null>((best, sample) => (
    !best || Math.abs(sample.ratio - 1) < Math.abs(best.ratio - 1) ? sample : best
  ), null);
}

function scanMode(
  topology: VariableLegTopology,
  barId: string,
  mode: VariableLegMode,
  ratios: number[],
  phaseSamples: number,
  iterations: number,
) {
  const baseProject = getVariableLegTemplate(topology);
  const adjustment = createDefaultAdjustment(topology, "moving-pivot");
  const nominal = sampleVariableLeg(baseProject, adjustment, mode.adjustmentValue, phaseSamples, iterations);
  const baseLength = baseProject.bars.find((bar) => bar.id === barId)?.length;
  if (!baseLength) throw new Error(`Unknown bar ${topology}/${barId}`);
  const samplesByPhase: SampleResult[][] = [];
  const phases = nominal.map((nominalSample) => {
    const nominalBar = nominalSample.project.bars.find((bar) => bar.id === barId)!;
    const nominalBranch = branchSignature(nominalSample.project);
    const tolerance = Math.max(0.75, Math.max(...nominalSample.project.bars.map((bar) => bar.length)) * 0.025);
    const samples = ratios.map((ratio) => {
      const seeded = withBarLength(nominalSample.project, nominalBar, baseLength * ratio);
      const joints = solveFreeMechanism(seeded, nominalSample.phase, iterations);
      const solved = { ...seeded, joints };
      const error = maximumConstraintError(solved, nominalSample.phase);
      const singularityMargin = jointAngleMargin(solved);
      const branch = branchSignature(solved);
      return {
        ratio,
        feasible: Boolean(resolveTracerPoint(solved))
          && Number.isFinite(error)
          && error <= tolerance
          && singularityMargin >= 0.25
          && (nominalBranch === 0 || branch === nominalBranch),
        singularityMargin,
      };
    });
    samplesByPhase.push(samples);
    const recommended = closestFeasible(samples);
    return {
      phase: ((nominalSample.phase / (Math.PI * 2)) % 1 + 1) % 1,
      intervals: intervalsFromSamples(samples),
      recommended: recommended?.ratio ?? null,
      minimumSingularityMargin: recommended?.singularityMargin ?? null,
    } satisfies PhaseResult;
  });
  return { mode: { id: mode.id, name: mode.name, rpm: mode.rpm }, phases, samplesByPhase };
}

function commonPhases(modeResults: ReturnType<typeof scanMode>[], ratios: number[]) {
  return modeResults[0].phases.map((phase, phaseIndex) => {
    const samples = ratios.map((ratio, ratioIndex) => {
      const members = modeResults.map((result) => result.samplesByPhase[phaseIndex][ratioIndex]);
      return {
        ratio,
        feasible: members.every((sample) => sample.feasible),
        singularityMargin: Math.min(...members.map((sample) => sample.singularityMargin)),
      };
    });
    const recommended = closestFeasible(samples);
    return {
      phase: phase.phase,
      intervals: intervalsFromSamples(samples),
      recommended: recommended?.ratio ?? null,
      minimumSingularityMargin: recommended?.singularityMargin ?? null,
    } satisfies PhaseResult;
  });
}

function transitionStats(phases: PhaseResult[], baseline: number, rpm: number) {
  const recommended = phases.map((phase) => phase.recommended);
  const secondsPerStep = 60 / Math.max(1, rpm) / phases.length;
  let maxRecommendedSpeed = 0;
  let maxRecommendedAcceleration = 0;
  let previousSpeed = 0;
  let overlappingTransitions = 0;
  for (let index = 0; index < phases.length; index += 1) {
    const nextIndex = (index + 1) % phases.length;
    const current = recommended[index];
    const next = recommended[nextIndex];
    const overlaps = phases[index].intervals.some((first) => phases[nextIndex].intervals.some((second) => (
      Math.max(first.minimum, second.minimum) <= Math.min(first.maximum, second.maximum)
    )));
    if (overlaps) overlappingTransitions += 1;
    if (current === null || next === null) continue;
    const speed = (next - current) * baseline / secondsPerStep;
    maxRecommendedSpeed = Math.max(maxRecommendedSpeed, Math.abs(speed));
    maxRecommendedAcceleration = Math.max(maxRecommendedAcceleration, Math.abs(speed - previousSpeed) / secondsPerStep);
    previousSpeed = speed;
  }
  return {
    phaseCoverage: phases.filter((phase) => phase.intervals.length > 0).length / phases.length,
    overlappingTransitionRatio: overlappingTransitions / phases.length,
    maxRecommendedSpeed,
    maxRecommendedAcceleration,
  };
}

const availableTasks = tasks();
if (process.argv.includes("--list")) {
  process.stdout.write(JSON.stringify(availableTasks));
} else {
  const topology = arg("--topology") as VariableLegTopology;
  const barId = arg("--bar");
  const task = availableTasks.find((item) => item.topology === topology && item.barId === barId);
  if (!task) throw new Error(`Unknown dynamic scan task ${topology}/${barId}`);
  const phaseSamples = Math.max(12, Number(arg("--phases", "72")));
  const lengthSamples = Math.max(15, Number(arg("--lengths", "61")));
  const iterations = Math.max(30, Number(arg("--iterations", "70")));
  const baseProject = getVariableLegTemplate(topology);
  const baseline = baseProject.bars.find((bar) => bar.id === barId)?.length;
  if (!baseline) throw new Error(`Missing baseline length for ${topology}/${barId}`);
  const staticParameter = (baselineData.topologies[topology]?.parameters as Record<string, { intervals?: Array<{ minimum: number; maximum: number }> }> | undefined)?.[`bar:${barId}`];
  const staticIntervals = staticParameter?.intervals ?? [{ minimum: 0.72, maximum: 1.28 }];
  const minimumRatio = Math.max(0.55, Math.min(...staticIntervals.map((interval) => interval.minimum)));
  const maximumRatio = Math.min(1.45, Math.max(...staticIntervals.map((interval) => interval.maximum)));
  const ratios = Array.from({ length: lengthSamples }, (_, index) => minimumRatio + (maximumRatio - minimumRatio) * index / (lengthSamples - 1));
  const modes = createDefaultModes();
  const modeResults = modes.map((mode) => scanMode(topology, barId!, mode, ratios, phaseSamples, iterations));
  const common = commonPhases(modeResults, ratios);
  const maximumRpm = Math.max(...modes.map((mode) => mode.rpm));
  process.stdout.write(JSON.stringify({
    topology,
    barId,
    label: task.label,
    baseline,
    ratioRange: { minimum: minimumRatio, maximum: maximumRatio },
    phaseSamples,
    lengthSamples,
    iterations,
    modes: Object.fromEntries(modeResults.map((result) => [result.mode.id, {
      ...result.mode,
      phases: result.phases,
      transition: transitionStats(result.phases, baseline, result.mode.rpm),
    }])),
    common: {
      phases: common,
      transition: transitionStats(common, baseline, maximumRpm),
      conservativeRpm: maximumRpm,
    },
  }));
}

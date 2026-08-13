import { solveFourBar, type AssemblyMode, type FourBarParameters, type Point } from "./four-bar";

export type SimilarityTransform = {
  scale: number;
  rotation: number;
  translation: Point;
};

export type SketchLinkageCandidate = {
  id: string;
  parameters: FourBarParameters;
  assemblyMode: AssemblyMode;
  transform: SimilarityTransform;
  phaseIndex: number;
  direction: 1 | -1;
  rmse: number;
  normalizedRmse: number;
  minimumTransmissionAngle: number;
  trajectory: Point[];
};

export type SketchLinkageProgress = {
  progress: number;
  stage: "global" | "refine" | "verify";
  bestNormalizedRmse: number | null;
};

type NormalizedParameters = Omit<FourBarParameters, "ground"> & { ground: 1 };

type EvaluatedCandidate = Omit<SketchLinkageCandidate, "id" | "parameters"> & {
  parameters: NormalizedParameters;
  score: number;
};

export const CAT_TARGET_CURVE: Point[] = [
  { x: 164, y: 458 },
  { x: 136, y: 424 },
  { x: 132, y: 372 },
  { x: 147, y: 323 },
  { x: 116, y: 293 },
  { x: 82, y: 267 },
  { x: 66, y: 224 },
  { x: 79, y: 178 },
  { x: 104, y: 214 },
  { x: 105, y: 252 },
  { x: 151, y: 276 },
  { x: 191, y: 247 },
  { x: 251, y: 226 },
  { x: 326, y: 229 },
  { x: 371, y: 204 },
  { x: 385, y: 164 },
  { x: 379, y: 91 },
  { x: 435, y: 141 },
  { x: 492, y: 103 },
  { x: 480, y: 177 },
  { x: 514, y: 207 },
  { x: 493, y: 239 },
  { x: 443, y: 249 },
  { x: 421, y: 293 },
  { x: 427, y: 349 },
  { x: 444, y: 405 },
  { x: 439, y: 458 },
  { x: 391, y: 458 },
  { x: 384, y: 391 },
  { x: 350, y: 439 },
  { x: 314, y: 458 },
  { x: 258, y: 458 },
  { x: 218, y: 438 },
  { x: 207, y: 458 },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function resampleClosedCurve(points: Point[], sampleCount = 64): Point[] {
  if (points.length < 2 || sampleCount < 2) return [...points];
  const cleaned = points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > 1e-6);
  if (cleaned.length < 2) return cleaned;
  const loop = [...cleaned, cleaned[0]];
  const cumulative = [0];
  for (let index = 1; index < loop.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(loop[index - 1], loop[index]));
  }
  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength < 1e-9) return [cleaned[0]];

  const samples: Point[] = [];
  let segment = 1;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const targetLength = (sample / sampleCount) * totalLength;
    while (segment < cumulative.length - 1 && cumulative[segment] < targetLength) segment += 1;
    const start = loop[segment - 1];
    const end = loop[segment];
    const span = cumulative[segment] - cumulative[segment - 1] || 1;
    const ratio = (targetLength - cumulative[segment - 1]) / span;
    samples.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }
  return samples;
}

export function applySimilarity(point: Point, transform: SimilarityTransform): Point {
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return {
    x: transform.translation.x + transform.scale * (cosine * point.x - sine * point.y),
    y: transform.translation.y + transform.scale * (sine * point.x + cosine * point.y),
  };
}

function similarityForCorrespondence(source: Point[], target: Point[]) {
  const count = source.length;
  const sourceCenter = source.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  const targetCenter = target.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  sourceCenter.x /= count;
  sourceCenter.y /= count;
  targetCenter.x /= count;
  targetCenter.y /= count;

  let dot = 0;
  let cross = 0;
  let sourceEnergy = 0;
  for (let index = 0; index < count; index += 1) {
    const sx = source[index].x - sourceCenter.x;
    const sy = source[index].y - sourceCenter.y;
    const tx = target[index].x - targetCenter.x;
    const ty = target[index].y - targetCenter.y;
    dot += sx * tx + sy * ty;
    cross += sx * ty - sy * tx;
    sourceEnergy += sx * sx + sy * sy;
  }
  const rotation = Math.atan2(cross, dot);
  const scale = sourceEnergy > 1e-12 ? Math.hypot(dot, cross) / sourceEnergy : 1;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const translation = {
    x: targetCenter.x - scale * (cosine * sourceCenter.x - sine * sourceCenter.y),
    y: targetCenter.y - scale * (sine * sourceCenter.x + cosine * sourceCenter.y),
  };
  const transform = { scale, rotation, translation };
  let squaredError = 0;
  for (let index = 0; index < count; index += 1) {
    const aligned = applySimilarity(source[index], transform);
    squaredError += (aligned.x - target[index].x) ** 2 + (aligned.y - target[index].y) ** 2;
  }
  return { transform, rmse: Math.sqrt(squaredError / count) };
}

export function alignClosedCurves(source: Point[], target: Point[]) {
  if (source.length !== target.length || source.length < 3) throw new Error("curves must have the same sample count");
  let best: {
    transform: SimilarityTransform;
    rmse: number;
    phaseIndex: number;
    direction: 1 | -1;
    orderedSource: Point[];
  } | null = null;
  const count = source.length;
  for (const direction of [1, -1] as const) {
    for (let shift = 0; shift < count; shift += 1) {
      const orderedSource = target.map((_, index) => source[(shift + direction * index + count * 2) % count]);
      const fit = similarityForCorrespondence(orderedSource, target);
      if (!best || fit.rmse < best.rmse) best = { ...fit, phaseIndex: shift, direction, orderedSource };
    }
  }
  if (!best) throw new Error("curve alignment failed");
  return best;
}

function targetDiagonal(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(1, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
}

function sampleTrajectory(parameters: NormalizedParameters, assemblyMode: AssemblyMode, sampleCount = 144) {
  const points: Point[] = [];
  let minimumTransmissionAngle = Number.POSITIVE_INFINITY;
  for (let index = 0; index < sampleCount; index += 1) {
    const position = solveFourBar(parameters, (index / sampleCount) * 360, assemblyMode);
    if (!position) return null;
    points.push({ x: position.couplerPoint.x, y: -position.couplerPoint.y });
    minimumTransmissionAngle = Math.min(minimumTransmissionAngle, position.transmissionAngle);
  }
  return { points, minimumTransmissionAngle };
}

function evaluateParameters(
  parameters: NormalizedParameters,
  target: Point[],
  diagonal: number,
  assemblyMode: AssemblyMode,
): EvaluatedCandidate | null {
  const sampled = sampleTrajectory(parameters, assemblyMode);
  if (!sampled) return null;
  const trajectory = resampleClosedCurve(sampled.points, target.length);
  const alignment = alignClosedCurves(trajectory, target);
  const normalizedRmse = alignment.rmse / diagonal;
  const transmissionPenalty = Math.max(0, 8 - sampled.minimumTransmissionAngle) / 250;
  return {
    parameters,
    assemblyMode,
    transform: alignment.transform,
    phaseIndex: alignment.phaseIndex,
    direction: alignment.direction,
    rmse: alignment.rmse,
    normalizedRmse,
    minimumTransmissionAngle: sampled.minimumTransmissionAngle,
    trajectory: alignment.orderedSource.map((point) => applySimilarity(point, alignment.transform)),
    score: normalizedRmse + transmissionPenalty,
  };
}

function randomParameters(random: () => number): NormalizedParameters {
  return {
    ground: 1,
    input: 0.12 + random() * 0.7,
    coupler: 0.35 + random() * 1.55,
    output: 0.35 + random() * 1.45,
    couplerPointRatio: random(),
    couplerPointOffset: -1.45 + random() * 2.9,
  };
}

function mutateParameters(base: NormalizedParameters, random: () => number, temperature: number): NormalizedParameters {
  const delta = (range: number) => (random() + random() + random() - 1.5) * range * temperature;
  return {
    ground: 1,
    input: clamp(base.input + delta(0.5), 0.08, 0.95),
    coupler: clamp(base.coupler + delta(0.8), 0.2, 2.2),
    output: clamp(base.output + delta(0.7), 0.2, 2),
    couplerPointRatio: clamp(base.couplerPointRatio + delta(0.7), 0, 1),
    couplerPointOffset: clamp(base.couplerPointOffset + delta(1.2), -1.8, 1.8),
  };
}

function parameterDistance(first: NormalizedParameters, second: NormalizedParameters) {
  return Math.hypot(
    first.input - second.input,
    first.coupler - second.coupler,
    first.output - second.output,
    (first.couplerPointRatio - second.couplerPointRatio) * 0.5,
    (first.couplerPointOffset - second.couplerPointOffset) * 0.5,
  );
}

function addToPool(pool: EvaluatedCandidate[], candidate: EvaluatedCandidate, maximum = 28) {
  pool.push(candidate);
  pool.sort((first, second) => first.score - second.score);
  if (pool.length > maximum) pool.length = maximum;
}

function toPublicCandidate(candidate: EvaluatedCandidate, index: number): SketchLinkageCandidate {
  const unit = 100;
  return {
    id: `cat-four-bar-${index + 1}`,
    parameters: {
      ground: unit,
      input: candidate.parameters.input * unit,
      coupler: candidate.parameters.coupler * unit,
      output: candidate.parameters.output * unit,
      couplerPointRatio: candidate.parameters.couplerPointRatio,
      couplerPointOffset: candidate.parameters.couplerPointOffset * unit,
    },
    assemblyMode: candidate.assemblyMode,
    transform: {
      scale: candidate.transform.scale / unit,
      rotation: candidate.transform.rotation,
      translation: candidate.transform.translation,
    },
    phaseIndex: candidate.phaseIndex,
    direction: candidate.direction,
    rmse: candidate.rmse,
    normalizedRmse: candidate.normalizedRmse,
    minimumTransmissionAngle: candidate.minimumTransmissionAngle,
    trajectory: candidate.trajectory,
  };
}

export function fitFourBarToSketch(
  rawTarget: Point[],
  options: { iterations?: number; seed?: number; onProgress?: (progress: SketchLinkageProgress) => void } = {},
) {
  const target = resampleClosedCurve(rawTarget, 64);
  if (target.length < 8) throw new Error("target curve is too short");
  const iterations = Math.max(120, options.iterations ?? 2800);
  const globalIterations = Math.round(iterations * 0.58);
  const random = createRandom(options.seed ?? 20260813);
  const diagonal = targetDiagonal(target);
  const pool: EvaluatedCandidate[] = [];

  const report = (iteration: number, stage: SketchLinkageProgress["stage"]) => {
    options.onProgress?.({
      progress: iteration / iterations,
      stage,
      bestNormalizedRmse: pool[0]?.normalizedRmse ?? null,
    });
  };

  for (let iteration = 0; iteration < globalIterations; iteration += 1) {
    const parameters = randomParameters(random);
    const assemblyMode = random() < 0.5 ? "open" : "crossed";
    const evaluated = evaluateParameters(parameters, target, diagonal, assemblyMode);
    if (evaluated) addToPool(pool, evaluated);
    if (iteration % 80 === 79) report(iteration + 1, "global");
  }
  if (pool.length === 0) throw new Error("no full-cycle four-bar candidate found");

  for (let iteration = globalIterations; iteration < iterations; iteration += 1) {
    const progress = (iteration - globalIterations) / Math.max(1, iterations - globalIterations);
    const base = pool[Math.floor(random() * Math.min(8, pool.length))];
    const parameters = mutateParameters(base.parameters, random, Math.max(0.04, 1 - progress));
    const assemblyMode = random() < 0.03 ? (base.assemblyMode === "open" ? "crossed" : "open") : base.assemblyMode;
    const evaluated = evaluateParameters(parameters, target, diagonal, assemblyMode);
    if (evaluated) addToPool(pool, evaluated);
    if (iteration % 80 === 79) report(iteration + 1, "refine");
  }

  const diverse: EvaluatedCandidate[] = [];
  for (const candidate of pool) {
    if (diverse.every((existing) => parameterDistance(existing.parameters, candidate.parameters) > 0.16)) {
      diverse.push(candidate);
    }
    if (diverse.length === 3) break;
  }
  while (diverse.length < Math.min(3, pool.length)) diverse.push(pool[diverse.length]);
  options.onProgress?.({ progress: 1, stage: "verify", bestNormalizedRmse: diverse[0].normalizedRmse });
  return diverse.map(toPublicCandidate);
}

export function sampleCandidateMechanism(candidate: SketchLinkageCandidate, angleDegrees: number) {
  const position = solveFourBar(candidate.parameters, angleDegrees, candidate.assemblyMode);
  if (!position) return null;
  const plot = (point: Point) => applySimilarity({ x: point.x, y: -point.y }, candidate.transform);
  return {
    inputPivot: plot({ x: 0, y: 0 }),
    outputPivot: plot({ x: candidate.parameters.ground, y: 0 }),
    inputJoint: plot(position.inputJoint),
    couplerJoint: plot(position.couplerJoint),
    couplerPoint: plot(position.couplerPoint),
  };
}

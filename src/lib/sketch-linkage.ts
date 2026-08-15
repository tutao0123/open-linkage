import { solveFourBar, type AssemblyMode, type FourBarParameters, type Point } from "./four-bar";
import {
  gearedFiveBarPitchRadii,
  solveGearedFiveBar,
  type GearedFiveBarParameters,
} from "./geared-five-bar";

export type SimilarityTransform = {
  scale: number;
  rotation: number;
  translation: Point;
};

export type MechanismFamily = "four-bar" | "geared-five-bar";

type SketchLinkageCandidateBase = {
  id: string;
  assemblyMode: AssemblyMode;
  transform: SimilarityTransform;
  phaseIndex: number;
  direction: 1 | -1;
  rmse: number;
  normalizedRmse: number;
  minimumTransmissionAngle: number;
  trajectory: Point[];
};

export type FourBarSketchCandidate = SketchLinkageCandidateBase & {
  family: "four-bar";
  parameters: FourBarParameters;
};

export type GearedFiveBarSketchCandidate = SketchLinkageCandidateBase & {
  family: "geared-five-bar";
  parameters: GearedFiveBarParameters;
};

export type SketchLinkageCandidate = FourBarSketchCandidate | GearedFiveBarSketchCandidate;

export type SketchLinkageProgress = {
  progress: number;
  stage: "global" | "refine" | "verify";
  family: MechanismFamily;
  bestNormalizedRmse: number | null;
};

type NormalizedParameters = Omit<FourBarParameters, "ground"> & { ground: 1 };

type NormalizedFiveBarParameters = Omit<GearedFiveBarParameters, "ground"> & { ground: 1 };

type EvaluatedCandidate = Omit<FourBarSketchCandidate, "id" | "parameters" | "family"> & {
  parameters: NormalizedParameters;
  score: number;
};

type EvaluatedFiveBarCandidate = Omit<GearedFiveBarSketchCandidate, "id" | "parameters" | "family"> & {
  parameters: NormalizedFiveBarParameters;
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

/** Current public experiment target; the original cat target remains exported but hidden. */
export const TROJAN_HORSE_TARGET_CURVE: Point[] = [
{ x: 507, y: 194 },
  { x: 506, y: 196 },
  { x: 506, y: 198 },
  { x: 505, y: 200 },
  { x: 504, y: 202 },
  { x: 503, y: 203 },
  { x: 502, y: 205 },
  { x: 501, y: 206 },
  { x: 500, y: 208 },
  { x: 498, y: 209 },
  { x: 497, y: 210 },
  { x: 495, y: 211 },
  { x: 493, y: 212 },
  { x: 491, y: 212 },
  { x: 489, y: 212 },
  { x: 487, y: 212 },
  { x: 486, y: 212 },
  { x: 484, y: 211 },
  { x: 482, y: 210 },
  { x: 480, y: 209 },
  { x: 479, y: 208 },
  { x: 478, y: 206 },
  { x: 476, y: 205 },
  { x: 474, y: 204 },
  { x: 473, y: 203 },
  { x: 471, y: 202 },
  { x: 469, y: 201 },
  { x: 467, y: 200 },
  { x: 466, y: 200 },
  { x: 464, y: 199 },
  { x: 462, y: 198 },
  { x: 460, y: 198 },
  { x: 458, y: 197 },
  { x: 456, y: 196 },
  { x: 453, y: 195 },
  { x: 451, y: 195 },
  { x: 449, y: 194 },
  { x: 446, y: 193 },
  { x: 443, y: 193 },
  { x: 440, y: 192 },
  { x: 437, y: 192 },
  { x: 434, y: 192 },
  { x: 431, y: 193 },
  { x: 428, y: 194 },
  { x: 426, y: 196 },
  { x: 424, y: 198 },
  { x: 422, y: 201 },
  { x: 421, y: 204 },
  { x: 420, y: 207 },
  { x: 419, y: 210 },
  { x: 418, y: 213 },
  { x: 418, y: 216 },
  { x: 417, y: 220 },
  { x: 417, y: 223 },
  { x: 416, y: 226 },
  { x: 416, y: 230 },
  { x: 416, y: 233 },
  { x: 415, y: 237 },
  { x: 415, y: 240 },
  { x: 415, y: 243 },
  { x: 415, y: 247 },
  { x: 415, y: 250 },
  { x: 415, y: 254 },
  { x: 416, y: 257 },
  { x: 416, y: 261 },
  { x: 416, y: 264 },
  { x: 416, y: 267 },
  { x: 417, y: 271 },
  { x: 417, y: 274 },
  { x: 418, y: 277 },
  { x: 418, y: 281 },
  { x: 418, y: 285 },
  { x: 418, y: 291 },
  { x: 417, y: 303 },
  { x: 408, y: 321 },
  { x: 396, y: 346 },
  { x: 386, y: 372 },
  { x: 382, y: 396 },
  { x: 385, y: 417 },
  { x: 396, y: 442 },
  { x: 398, y: 455 },
  { x: 385, y: 458 },
  { x: 371, y: 455 },
  { x: 368, y: 444 },
  { x: 363, y: 423 },
  { x: 361, y: 405 },
  { x: 360, y: 395 },
  { x: 360, y: 384 },
  { x: 358, y: 377 },
  { x: 353, y: 379 },
  { x: 349, y: 387 },
  { x: 346, y: 396 },
  { x: 344, y: 404 },
  { x: 344, y: 415 },
  { x: 347, y: 438 },
  { x: 346, y: 454 },
  { x: 334, y: 455 },
  { x: 320, y: 447 },
  { x: 319, y: 428 },
  { x: 323, y: 411 },
  { x: 324, y: 400 },
  { x: 326, y: 390 },
  { x: 326, y: 382 },
  { x: 324, y: 376 },
  { x: 320, y: 372 },
  { x: 313, y: 370 },
  { x: 304, y: 370 },
  { x: 295, y: 371 },
  { x: 285, y: 371 },
  { x: 274, y: 371 },
  { x: 264, y: 370 },
  { x: 253, y: 370 },
  { x: 243, y: 369 },
  { x: 232, y: 368 },
  { x: 222, y: 368 },
  { x: 211, y: 368 },
  { x: 201, y: 368 },
  { x: 191, y: 369 },
  { x: 182, y: 370 },
  { x: 174, y: 371 },
  { x: 168, y: 375 },
  { x: 163, y: 379 },
  { x: 161, y: 386 },
  { x: 160, y: 393 },
  { x: 161, y: 402 },
  { x: 164, y: 414 },
  { x: 175, y: 440 },
  { x: 179, y: 453 },
  { x: 170, y: 458 },
  { x: 154, y: 456 },
  { x: 147, y: 448 },
  { x: 143, y: 419 },
  { x: 140, y: 406 },
  { x: 136, y: 398 },
  { x: 132, y: 393 },
  { x: 128, y: 395 },
  { x: 124, y: 402 },
  { x: 121, y: 409 },
  { x: 121, y: 422 },
  { x: 124, y: 439 },
  { x: 122, y: 450 },
  { x: 110, y: 456 },
  { x: 99, y: 453 },
  { x: 95, y: 431 },
  { x: 99, y: 409 },
  { x: 102, y: 397 },
  { x: 104, y: 387 },
  { x: 107, y: 376 },
  { x: 110, y: 366 },
  { x: 113, y: 356 },
  { x: 114, y: 347 },
  { x: 113, y: 339 },
  { x: 110, y: 330 },
  { x: 106, y: 321 },
  { x: 103, y: 313 },
  { x: 101, y: 304 },
  { x: 100, y: 296 },
  { x: 100, y: 287 },
  { x: 101, y: 276 },
  { x: 103, y: 262 },
  { x: 102, y: 257 },
  { x: 96, y: 266 },
  { x: 93, y: 286 },
  { x: 93, y: 313 },
  { x: 93, y: 337 },
  { x: 89, y: 336 },
  { x: 86, y: 343 },
  { x: 81, y: 368 },
  { x: 72, y: 383 },
  { x: 69, y: 381 },
  { x: 67, y: 377 },
  { x: 52, y: 390 },
  { x: 52, y: 386 },
  { x: 41, y: 384 },
  { x: 44, y: 369 },
  { x: 44, y: 361 },
  { x: 40, y: 360 },
  { x: 46, y: 340 },
  { x: 47, y: 317 },
  { x: 49, y: 288 },
  { x: 55, y: 268 },
  { x: 66, y: 250 },
  { x: 84, y: 230 },
  { x: 108, y: 225 },
  { x: 140, y: 217 },
  { x: 169, y: 210 },
  { x: 191, y: 207 },
  { x: 213, y: 208 },
  { x: 237, y: 213 },
  { x: 262, y: 216 },
  { x: 284, y: 214 },
  { x: 304, y: 209 },
  { x: 309, y: 202 },
  { x: 327, y: 179 },
  { x: 332, y: 167 },
  { x: 329, y: 167 },
  { x: 345, y: 152 },
  { x: 359, y: 137 },
  { x: 361, y: 132 },
  { x: 363, y: 130 },
  { x: 366, y: 128 },
  { x: 369, y: 127 },
  { x: 372, y: 125 },
  { x: 374, y: 124 },
  { x: 376, y: 122 },
  { x: 376, y: 119 },
  { x: 375, y: 117 },
  { x: 376, y: 115 },
  { x: 379, y: 113 },
  { x: 382, y: 112 },
  { x: 385, y: 111 },
  { x: 388, y: 110 },
  { x: 391, y: 109 },
  { x: 395, y: 108 },
  { x: 397, y: 107 },
  { x: 397, y: 106 },
  { x: 399, y: 105 },
  { x: 403, y: 104 },
  { x: 406, y: 102 },
  { x: 409, y: 101 },
  { x: 412, y: 100 },
  { x: 415, y: 99 },
  { x: 418, y: 97 },
  { x: 421, y: 95 },
  { x: 423, y: 93 },
  { x: 426, y: 91 },
  { x: 428, y: 88 },
  { x: 430, y: 86 },
  { x: 433, y: 84 },
  { x: 435, y: 82 },
  { x: 438, y: 82 },
  { x: 440, y: 83 },
  { x: 441, y: 86 },
  { x: 443, y: 88 },
  { x: 445, y: 88 },
  { x: 448, y: 87 },
  { x: 451, y: 86 },
  { x: 453, y: 87 },
  { x: 455, y: 88 },
  { x: 457, y: 90 },
  { x: 458, y: 91 },
  { x: 459, y: 93 },
  { x: 460, y: 94 },
  { x: 462, y: 96 },
  { x: 463, y: 98 },
  { x: 464, y: 99 },
  { x: 465, y: 101 },
  { x: 467, y: 103 },
  { x: 468, y: 104 },
  { x: 469, y: 106 },
  { x: 470, y: 108 },
  { x: 471, y: 109 },
  { x: 472, y: 111 },
  { x: 472, y: 113 },
  { x: 472, y: 115 },
  { x: 473, y: 117 },
  { x: 474, y: 119 },
  { x: 474, y: 120 },
  { x: 474, y: 122 },
  { x: 474, y: 124 },
  { x: 474, y: 126 },
  { x: 473, y: 128 },
  { x: 474, y: 130 },
  { x: 474, y: 132 },
  { x: 474, y: 134 },
  { x: 475, y: 136 },
  { x: 476, y: 138 },
  { x: 476, y: 140 },
  { x: 477, y: 142 },
  { x: 478, y: 143 },
  { x: 479, y: 145 },
  { x: 480, y: 147 },
  { x: 481, y: 148 },
  { x: 482, y: 150 },
  { x: 484, y: 152 },
  { x: 485, y: 153 },
  { x: 486, y: 155 },
  { x: 488, y: 156 },
  { x: 489, y: 158 },
  { x: 490, y: 159 },
  { x: 491, y: 161 },
  { x: 493, y: 163 },
  { x: 494, y: 164 },
  { x: 496, y: 166 },
  { x: 497, y: 167 },
  { x: 498, y: 169 },
  { x: 500, y: 170 },
  { x: 501, y: 172 },
  { x: 503, y: 173 },
  { x: 504, y: 175 },
  { x: 505, y: 176 },
  { x: 507, y: 178 },
  { x: 508, y: 179 },
  { x: 509, y: 181 },
  { x: 510, y: 183 },
  { x: 510, y: 184 },
  { x: 510, y: 186 },
  { x: 509, y: 188 },
  { x: 508, y: 190 },
  { x: 508, y: 192 },
];

export const ACTIVE_SKETCH_TARGET_CURVE = TROJAN_HORSE_TARGET_CURVE;

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
    family: "four-bar",
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
      family: "four-bar",
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
  options.onProgress?.({ progress: 1, stage: "verify", family: "four-bar", bestNormalizedRmse: diverse[0].normalizedRmse });
  return diverse.map(toPublicCandidate);
}

function sampleFiveBarTrajectory(
  parameters: NormalizedFiveBarParameters,
  assemblyMode: AssemblyMode,
  sampleCount = 144,
) {
  const points: Point[] = [];
  let minimumTransmissionAngle = Number.POSITIVE_INFINITY;
  for (let index = 0; index < sampleCount; index += 1) {
    const position = solveGearedFiveBar(parameters, (index / sampleCount) * 360, assemblyMode);
    if (!position) return null;
    points.push({ x: position.couplerPoint.x, y: -position.couplerPoint.y });
    minimumTransmissionAngle = Math.min(minimumTransmissionAngle, position.transmissionAngle);
  }
  return { points, minimumTransmissionAngle };
}

function evaluateFiveBarParameters(
  parameters: NormalizedFiveBarParameters,
  target: Point[],
  diagonal: number,
  assemblyMode: AssemblyMode,
): EvaluatedFiveBarCandidate | null {
  const sampled = sampleFiveBarTrajectory(parameters, assemblyMode);
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

function randomFiveBarParameters(random: () => number): NormalizedFiveBarParameters {
  return {
    ground: 1,
    leftInput: 0.1 + random() * 0.65,
    leftCoupler: 0.45 + random() * 1.45,
    rightCoupler: 0.45 + random() * 1.45,
    rightInput: 0.1 + random() * 0.65,
    gearRatio: random() < 0.72 ? -1 : -2,
    gearPhase: random() * 360,
    couplerPointRatio: random(),
    couplerPointOffset: -1.5 + random() * 3,
  };
}

function wrapDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function mutateFiveBarParameters(
  base: NormalizedFiveBarParameters,
  random: () => number,
  temperature: number,
): NormalizedFiveBarParameters {
  const delta = (range: number) => (random() + random() + random() - 1.5) * range * temperature;
  return {
    ground: 1,
    leftInput: clamp(base.leftInput + delta(0.45), 0.06, 0.95),
    leftCoupler: clamp(base.leftCoupler + delta(0.8), 0.2, 2.2),
    rightCoupler: clamp(base.rightCoupler + delta(0.8), 0.2, 2.2),
    rightInput: clamp(base.rightInput + delta(0.45), 0.06, 0.95),
    gearRatio: random() < 0.025 ? (base.gearRatio === -1 ? -2 : -1) : base.gearRatio,
    gearPhase: wrapDegrees(base.gearPhase + delta(150)),
    couplerPointRatio: clamp(base.couplerPointRatio + delta(0.7), 0, 1),
    couplerPointOffset: clamp(base.couplerPointOffset + delta(1.2), -1.8, 1.8),
  };
}

function fiveBarParameterDistance(first: NormalizedFiveBarParameters, second: NormalizedFiveBarParameters) {
  return Math.hypot(
    first.leftInput - second.leftInput,
    first.leftCoupler - second.leftCoupler,
    first.rightCoupler - second.rightCoupler,
    first.rightInput - second.rightInput,
    (first.couplerPointRatio - second.couplerPointRatio) * 0.5,
    (first.couplerPointOffset - second.couplerPointOffset) * 0.5,
    Math.min(Math.abs(first.gearPhase - second.gearPhase), 360 - Math.abs(first.gearPhase - second.gearPhase)) / 180,
    first.gearRatio === second.gearRatio ? 0 : 0.5,
  );
}

function addFiveBarToPool(pool: EvaluatedFiveBarCandidate[], candidate: EvaluatedFiveBarCandidate, maximum = 28) {
  pool.push(candidate);
  pool.sort((first, second) => first.score - second.score);
  if (pool.length > maximum) pool.length = maximum;
}

function toPublicFiveBarCandidate(candidate: EvaluatedFiveBarCandidate, index: number): GearedFiveBarSketchCandidate {
  const unit = 100;
  return {
    id: `cat-geared-five-bar-${index + 1}`,
    family: "geared-five-bar",
    parameters: {
      ground: unit,
      leftInput: candidate.parameters.leftInput * unit,
      leftCoupler: candidate.parameters.leftCoupler * unit,
      rightCoupler: candidate.parameters.rightCoupler * unit,
      rightInput: candidate.parameters.rightInput * unit,
      gearRatio: candidate.parameters.gearRatio,
      gearPhase: candidate.parameters.gearPhase,
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

export function fitGearedFiveBarToSketch(
  rawTarget: Point[],
  options: { iterations?: number; seed?: number; onProgress?: (progress: SketchLinkageProgress) => void } = {},
) {
  const target = resampleClosedCurve(rawTarget, 64);
  if (target.length < 8) throw new Error("target curve is too short");
  const iterations = Math.max(180, options.iterations ?? 3600);
  const globalIterations = Math.round(iterations * 0.62);
  const random = createRandom(options.seed ?? 20260814);
  const diagonal = targetDiagonal(target);
  const pool: EvaluatedFiveBarCandidate[] = [];

  const report = (iteration: number, stage: SketchLinkageProgress["stage"]) => options.onProgress?.({
    progress: iteration / iterations,
    stage,
    family: "geared-five-bar",
    bestNormalizedRmse: pool[0]?.normalizedRmse ?? null,
  });

  for (let iteration = 0; iteration < globalIterations; iteration += 1) {
    const parameters = randomFiveBarParameters(random);
    const assemblyMode = random() < 0.5 ? "open" : "crossed";
    const evaluated = evaluateFiveBarParameters(parameters, target, diagonal, assemblyMode);
    if (evaluated) addFiveBarToPool(pool, evaluated);
    if (iteration % 80 === 79) report(iteration + 1, "global");
  }
  if (pool.length === 0) throw new Error("no full-cycle geared five-bar candidate found");

  for (let iteration = globalIterations; iteration < iterations; iteration += 1) {
    const progress = (iteration - globalIterations) / Math.max(1, iterations - globalIterations);
    const base = pool[Math.floor(random() * Math.min(8, pool.length))];
    const parameters = mutateFiveBarParameters(base.parameters, random, Math.max(0.04, 1 - progress));
    const assemblyMode = random() < 0.025 ? (base.assemblyMode === "open" ? "crossed" : "open") : base.assemblyMode;
    const evaluated = evaluateFiveBarParameters(parameters, target, diagonal, assemblyMode);
    if (evaluated) addFiveBarToPool(pool, evaluated);
    if (iteration % 80 === 79) report(iteration + 1, "refine");
  }

  const diverse: EvaluatedFiveBarCandidate[] = [];
  for (const candidate of pool) {
    if (diverse.every((existing) => fiveBarParameterDistance(existing.parameters, candidate.parameters) > 0.2)) {
      diverse.push(candidate);
    }
    if (diverse.length === 3) break;
  }
  while (diverse.length < Math.min(3, pool.length)) diverse.push(pool[diverse.length]);
  options.onProgress?.({
    progress: 1,
    stage: "verify",
    family: "geared-five-bar",
    bestNormalizedRmse: diverse[0].normalizedRmse,
  });
  return diverse.map(toPublicFiveBarCandidate);
}

export function fitMechanismFamiliesToSketch(
  rawTarget: Point[],
  options: {
    families?: MechanismFamily[];
    iterations?: number;
    seed?: number;
    onProgress?: (progress: SketchLinkageProgress) => void;
  } = {},
) {
  const families = options.families?.length ? [...new Set(options.families)] : ["four-bar", "geared-five-bar"];
  const totalIterations = Math.max(360, options.iterations ?? 6000);
  const candidates: SketchLinkageCandidate[] = [];
  families.forEach((family, familyIndex) => {
    const span = 1 / families.length;
    const onProgress = (progress: SketchLinkageProgress) => options.onProgress?.({
      ...progress,
      progress: familyIndex * span + progress.progress * span,
    });
    const familyOptions = {
      iterations: Math.round(totalIterations / families.length),
      seed: (options.seed ?? 20260813) + familyIndex * 7919,
      onProgress,
    };
    candidates.push(...(family === "four-bar"
      ? fitFourBarToSketch(rawTarget, familyOptions)
      : fitGearedFiveBarToSketch(rawTarget, familyOptions)));
  });
  const sorted = candidates.sort((first, second) => first.normalizedRmse - second.normalizedRmse);
  const selected = sorted.slice(0, Math.min(4, sorted.length));
  for (const family of families) {
    if (selected.some((candidate) => candidate.family === family)) continue;
    const familyLeader = sorted.find((candidate) => candidate.family === family);
    if (familyLeader) selected[selected.length - 1] = familyLeader;
  }
  return selected.sort((first, second) => first.normalizedRmse - second.normalizedRmse);
}

export function sampleCandidateMechanism(candidate: SketchLinkageCandidate, angleDegrees: number) {
  const plot = (point: Point) => applySimilarity({ x: point.x, y: -point.y }, candidate.transform);
  const inputPivot = plot({ x: 0, y: 0 });
  const outputPivot = plot({ x: candidate.parameters.ground, y: 0 });
  if (candidate.family === "four-bar") {
    const position = solveFourBar(candidate.parameters, angleDegrees, candidate.assemblyMode);
    if (!position) return null;
    const inputJoint = plot(position.inputJoint);
    const couplerJoint = plot(position.couplerJoint);
    const couplerPoint = plot(position.couplerPoint);
    return {
      family: candidate.family,
      ground: { start: inputPivot, end: outputPivot },
      links: [
        { start: inputPivot, end: inputJoint, kind: "input" as const },
        { start: inputJoint, end: couplerJoint, kind: "coupler" as const },
        { start: couplerJoint, end: outputPivot, kind: "output" as const },
      ],
      joints: [inputPivot, outputPivot, inputJoint, couplerJoint],
      tracerBase: inputJoint,
      couplerPoint,
      gears: [],
    };
  }

  const position = solveGearedFiveBar(candidate.parameters, angleDegrees, candidate.assemblyMode);
  if (!position) return null;
  const leftInputJoint = plot(position.leftInputJoint);
  const rightInputJoint = plot(position.rightInputJoint);
  const centerJoint = plot(position.centerJoint);
  const couplerPoint = plot(position.couplerPoint);
  const pitchRadii = gearedFiveBarPitchRadii(candidate.parameters);
  const rotationOffset = candidate.transform.rotation * 180 / Math.PI;
  return {
    family: candidate.family,
    ground: { start: inputPivot, end: outputPivot },
    links: [
      { start: inputPivot, end: leftInputJoint, kind: "input" as const },
      { start: leftInputJoint, end: centerJoint, kind: "coupler" as const },
      { start: centerJoint, end: rightInputJoint, kind: "coupler" as const },
      { start: rightInputJoint, end: outputPivot, kind: "output" as const },
    ],
    joints: [inputPivot, outputPivot, leftInputJoint, rightInputJoint, centerJoint],
    tracerBase: leftInputJoint,
    couplerPoint,
    gears: [
      { center: inputPivot, radius: pitchRadii.left * candidate.transform.scale, rotation: rotationOffset - angleDegrees },
      { center: outputPivot, radius: pitchRadii.right * candidate.transform.scale, rotation: rotationOffset - position.rightInputAngle },
    ],
  };
}

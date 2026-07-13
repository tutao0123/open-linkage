import type { Point } from "./four-bar";
import { resampleClosedPath } from "./path-synthesis";
import {
  getSixBarTransmissionAngles,
  solveSixBarLeg,
  type SixBarParameters,
} from "./six-bar";

export type SynthesisPriority = "balanced" | "accuracy" | "transmission";

export type SixBarCandidate = {
  id: string;
  label: string;
  parameters: SixBarParameters;
  phase: number;
  direction: 1 | -1;
  score: number;
  rmse: number;
  maxError: number;
  validRatio: number;
  minTransmissionAngle: number;
  meanTransmissionAngle: number;
  landingVelocityPerRadian: number;
  envelopeWidth: number;
  generatedPath: Point[];
};

type Bounds = Array<[number, number]>;

type Evaluation = Omit<SixBarCandidate, "id" | "label" | "parameters"> & {
  cost: number;
};

const PARAMETER_KEYS: Array<keyof SixBarParameters> = [
  "groundPivot",
  "rearPivotX",
  "rearPivotY",
  "crank",
  "firstCoupler",
  "firstRocker",
  "secondCoupler",
  "secondRocker",
  "footRatio",
  "footOffset",
];

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toVector(parameters: SixBarParameters, phase: number, direction: 1 | -1) {
  return [...PARAMETER_KEYS.map((key) => parameters[key]), phase, direction === 1 ? 1 : 0];
}

function fromVector(vector: number[]) {
  const parameters = Object.fromEntries(
    PARAMETER_KEYS.map((key, index) => [key, vector[index]]),
  ) as SixBarParameters;
  return {
    parameters,
    phase: ((vector[10] % 360) + 360) % 360,
    direction: (vector[11] >= 0.5 ? 1 : -1) as 1 | -1,
  };
}

function getBounds(target: Point[], initial: SixBarParameters): Bounds {
  const xs = target.map((point) => point.x);
  const ys = target.map((point) => point.y);
  const targetWidth = Math.max(...xs) - Math.min(...xs);
  const targetHeight = Math.max(...ys) - Math.min(...ys);
  const scale = Math.max(targetWidth, targetHeight * 1.7, 80);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const maximumLength = Math.max(scale * 3.2, initial.groundPivot * 1.5);
  return [
    [Math.max(30, scale * 0.25), maximumLength],
    [centerX - scale * 1.8, centerX + scale * 1.8],
    [centerY - scale * 1.8, centerY + scale * 1.2],
    [Math.max(12, scale * 0.08), Math.max(35, scale * 0.75)],
    [Math.max(25, scale * 0.2), maximumLength],
    [Math.max(25, scale * 0.15), maximumLength],
    [Math.max(25, scale * 0.2), maximumLength],
    [Math.max(25, scale * 0.15), maximumLength],
    [0.35, 2.8],
    [-scale * 1.25, scale * 1.25],
    [0, 360],
    [0, 1],
  ];
}

function findLandingIndex(target: Point[]) {
  const minimumY = Math.min(...target.map((point) => point.y));
  const maximumY = Math.max(...target.map((point) => point.y));
  const threshold = minimumY + (maximumY - minimumY) * 0.22;
  let bestIndex = 0;
  let bestDescent = Number.POSITIVE_INFINITY;
  for (let index = 0; index < target.length; index += 1) {
    const previous = target[(index - 1 + target.length) % target.length];
    const descent = target[index].y - previous.y;
    if (target[index].y <= threshold && descent < bestDescent) {
      bestDescent = descent;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function evaluate(
  vector: number[],
  target: Point[],
  pathScale: number,
  landingIndex: number,
  priority: SynthesisPriority,
): Evaluation {
  const { parameters, phase, direction } = fromVector(vector);
  const generatedPath: Point[] = [];
  let squaredError = 0;
  let maxError = 0;
  let valid = 0;
  let minimumTransmission = 90;
  let transmissionSum = 0;
  let transmissionCount = 0;

  for (let index = 0; index < target.length; index += 1) {
    const angle = phase + direction * (index / target.length) * 360;
    const position = solveSixBarLeg(parameters, angle);
    if (!position) {
      generatedPath.push({ x: Number.NaN, y: Number.NaN });
      squaredError += pathScale ** 2 * 25;
      maxError = Math.max(maxError, pathScale * 5);
      continue;
    }
    valid += 1;
    generatedPath.push(position.footPoint);
    const error = Math.hypot(
      position.footPoint.x - target[index].x,
      position.footPoint.y - target[index].y,
    );
    squaredError += error ** 2;
    maxError = Math.max(maxError, error);
    const angles = getSixBarTransmissionAngles(parameters, position);
    minimumTransmission = Math.min(minimumTransmission, angles.first, angles.second);
    transmissionSum += angles.first + angles.second;
    transmissionCount += 2;
  }

  const validRatio = valid / target.length;
  const rmse = Math.sqrt(squaredError / target.length);
  const meanTransmissionAngle = transmissionCount ? transmissionSum / transmissionCount : 0;
  const previousLanding = generatedPath[(landingIndex - 1 + generatedPath.length) % generatedPath.length];
  const landing = generatedPath[landingIndex];
  const angleStep = (Math.PI * 2) / target.length;
  const landingVelocityPerRadian = landing && previousLanding && Number.isFinite(landing.y) && Number.isFinite(previousLanding.y)
    ? Math.abs(landing.y - previousLanding.y) / angleStep
    : pathScale * 8;
  const finitePoints = generatedPath.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const envelopeWidth = finitePoints.length
    ? Math.max(...finitePoints.map((point) => point.x)) - Math.min(...finitePoints.map((point) => point.x))
    : pathScale * 5;
  const normalizedError = rmse / pathScale;
  const continuityPenalty = 1 - validRatio;
  const transmissionPenalty = Math.max(0, (38 - minimumTransmission) / 38);
  const landingPenalty = Math.min(2, landingVelocityPerRadian / pathScale);
  const weights = priority === "accuracy"
    ? { error: 0.82, continuity: 0.1, transmission: 0.06, landing: 0.02 }
    : priority === "transmission"
      ? { error: 0.4, continuity: 0.2, transmission: 0.34, landing: 0.06 }
      : { error: 0.6, continuity: 0.18, transmission: 0.17, landing: 0.05 };
  const cost = weights.error * normalizedError
    + weights.continuity * continuityPenalty * 4
    + weights.transmission * transmissionPenalty
    + weights.landing * landingPenalty;
  const score = clamp(100 * (1 - cost), 0, 100);

  return {
    phase,
    direction,
    score,
    rmse,
    maxError,
    validRatio,
    minTransmissionAngle: valid ? minimumTransmission : 0,
    meanTransmissionAngle,
    landingVelocityPerRadian,
    envelopeWidth,
    generatedPath,
    cost,
  };
}

function parameterDistance(first: number[], second: number[], bounds: Bounds) {
  let squaredDistance = 0;
  for (let index = 0; index < 10; index += 1) {
    const range = bounds[index][1] - bounds[index][0] || 1;
    squaredDistance += ((first[index] - second[index]) / range) ** 2;
  }
  return Math.sqrt(squaredDistance);
}

function assignLabels(candidates: SixBarCandidate[]) {
  if (!candidates.length) return candidates;
  const accuracy = candidates.reduce((best, candidate) => candidate.rmse < best.rmse ? candidate : best);
  const transmission = candidates.reduce((best, candidate) => candidate.minTransmissionAngle > best.minTransmissionAngle ? candidate : best);
  const compact = candidates.reduce((best, candidate) => candidate.envelopeWidth < best.envelopeWidth ? candidate : best);
  return candidates.map((candidate, index) => ({
    ...candidate,
    label: index === 0
      ? "综合推荐"
      : candidate.id === accuracy.id
        ? "精度最佳"
        : candidate.id === transmission.id
          ? "传动最佳"
          : candidate.id === compact.id
            ? "最紧凑"
            : "多样化备选",
  }));
}

export async function synthesizeSixBarLeg(
  rawTarget: Point[],
  initial: SixBarParameters,
  priority: SynthesisPriority = "balanced",
  onProgress?: (progress: number) => void,
  candidateCount = 5,
): Promise<SixBarCandidate[]> {
  const target = resampleClosedPath(rawTarget, 56);
  if (target.length < 12) throw new Error("目标轨迹过短");
  const xs = target.map((point) => point.x);
  const ys = target.map((point) => point.y);
  const pathScale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 60);
  const landingIndex = findLandingIndex(target);
  const bounds = getBounds(target, initial);
  const random = createRandom(20260713 + priority.length * 97);
  const populationSize = 52;
  const generations = 82;
  const initialSeeds: number[][] = [];

  for (const direction of [1, -1] as const) {
    for (let phase = 0; phase < 360; phase += 45) {
      initialSeeds.push(toVector(initial, phase, direction));
    }
  }
  const population = Array.from({ length: populationSize }, (_, index) => {
    if (index < initialSeeds.length) return initialSeeds[index].map((value, valueIndex) => clamp(value, bounds[valueIndex][0], bounds[valueIndex][1]));
    if (index < initialSeeds.length + 12) {
      const base = toVector(initial, random() * 360, random() > 0.5 ? 1 : -1);
      return base.map((value, valueIndex) => {
        const [minimum, maximum] = bounds[valueIndex];
        return clamp(value + (random() * 2 - 1) * (maximum - minimum) * 0.22, minimum, maximum);
      });
    }
    return bounds.map(([minimum, maximum]) => minimum + random() * (maximum - minimum));
  });
  const evaluations = population.map((vector) => evaluate(vector, target, pathScale, landingIndex, priority));
  const archive: Array<{ vector: number[]; evaluation: Evaluation }> = population.map((vector, index) => ({
    vector: [...vector],
    evaluation: evaluations[index],
  }));

  for (let generation = 0; generation < generations; generation += 1) {
    for (let index = 0; index < populationSize; index += 1) {
      const choices: number[] = [];
      while (choices.length < 3) {
        const choice = Math.floor(random() * populationSize);
        if (choice !== index && !choices.includes(choice)) choices.push(choice);
      }
      const forcedIndex = Math.floor(random() * bounds.length);
      const trial = population[index].map((value, valueIndex) => {
        if (valueIndex !== forcedIndex && random() > 0.82) return value;
        const mutation = population[choices[0]][valueIndex]
          + 0.72 * (population[choices[1]][valueIndex] - population[choices[2]][valueIndex]);
        return clamp(mutation, bounds[valueIndex][0], bounds[valueIndex][1]);
      });
      const trialEvaluation = evaluate(trial, target, pathScale, landingIndex, priority);
      if (trialEvaluation.cost <= evaluations[index].cost) {
        population[index] = trial;
        evaluations[index] = trialEvaluation;
        archive.push({ vector: [...trial], evaluation: trialEvaluation });
      }
    }
    if (archive.length > 1200) archive.sort((first, second) => first.evaluation.cost - second.evaluation.cost).splice(800);
    if (generation % 2 === 1) {
      onProgress?.((generation + 1) / generations);
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
    }
  }

  archive.sort((first, second) => first.evaluation.cost - second.evaluation.cost);
  const selected: Array<{ vector: number[]; evaluation: Evaluation }> = [];
  for (const item of archive) {
    if (item.evaluation.validRatio < 0.96) continue;
    if (selected.every((existing) => parameterDistance(item.vector, existing.vector, bounds) > 0.115)) selected.push(item);
    if (selected.length >= candidateCount) break;
  }
  if (selected.length < candidateCount) {
    for (const item of archive) {
      if (item.evaluation.validRatio < 0.9 || selected.includes(item)) continue;
      selected.push(item);
      if (selected.length >= candidateCount) break;
    }
  }

  onProgress?.(1);
  return assignLabels(selected.map((item, index) => {
    const decoded = fromVector(item.vector);
    const evaluation = item.evaluation;
    return {
      id: `six-bar-${index + 1}`,
      label: "备选",
      parameters: decoded.parameters,
      phase: evaluation.phase,
      direction: evaluation.direction,
      score: evaluation.score,
      rmse: evaluation.rmse,
      maxError: evaluation.maxError,
      validRatio: evaluation.validRatio,
      minTransmissionAngle: evaluation.minTransmissionAngle,
      meanTransmissionAngle: evaluation.meanTransmissionAngle,
      landingVelocityPerRadian: evaluation.landingVelocityPerRadian,
      envelopeWidth: evaluation.envelopeWidth,
      generatedPath: evaluation.generatedPath,
    };
  }));
}

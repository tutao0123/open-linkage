import { solveFourBar, type AssemblyMode, type FourBarParameters, type Point } from "./four-bar";

export type PathFitResult = {
  parameters: FourBarParameters;
  phase: number;
  direction: 1 | -1;
  rmse: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resampleClosedPath(points: Point[], sampleCount = 48): Point[] {
  if (points.length < 2) return points;
  const cleaned = points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > 0.5);
  if (cleaned.length < 2) return cleaned;
  const loop = [...cleaned, cleaned[0]];
  const cumulative = [0];
  for (let index = 1; index < loop.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(loop[index - 1], loop[index]));
  }
  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength < 1) return [cleaned[0]];

  const samples: Point[] = [];
  let segment = 1;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const targetLength = (sample / sampleCount) * totalLength;
    while (segment < cumulative.length - 1 && cumulative[segment] < targetLength) segment += 1;
    const startLength = cumulative[segment - 1];
    const segmentLength = cumulative[segment] - startLength || 1;
    const ratio = (targetLength - startLength) / segmentLength;
    samples.push({
      x: loop[segment - 1].x + (loop[segment].x - loop[segment - 1].x) * ratio,
      y: loop[segment - 1].y + (loop[segment].y - loop[segment - 1].y) * ratio,
    });
  }
  return samples;
}

function createRandom(seed = 20260713) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function evaluate(
  parameters: FourBarParameters,
  target: Point[],
  phase: number,
  direction: 1 | -1,
  assemblyMode: AssemblyMode,
  penaltyScale: number,
) {
  let squaredError = 0;
  for (let index = 0; index < target.length; index += 1) {
    const angle = phase + direction * (index / target.length) * 360;
    const position = solveFourBar(parameters, angle, assemblyMode);
    if (!position) {
      squaredError += penaltyScale * penaltyScale * 16;
      continue;
    }
    const dx = position.couplerPoint.x - target[index].x;
    const dy = position.couplerPoint.y - target[index].y;
    squaredError += dx * dx + dy * dy;
  }
  return Math.sqrt(squaredError / target.length);
}

export async function fitFourBarToClosedPath(
  rawTarget: Point[],
  initial: FourBarParameters,
  assemblyMode: AssemblyMode,
  onProgress?: (progress: number) => void,
): Promise<PathFitResult> {
  const target = resampleClosedPath(rawTarget);
  if (target.length < 8) throw new Error("target path is too short");

  const xs = target.map((point) => point.x);
  const ys = target.map((point) => point.y);
  const pathScale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 80);
  const maximumLength = pathScale * 3.5;
  const random = createRandom();

  let best: PathFitResult = {
    parameters: { ...initial },
    phase: 0,
    direction: 1,
    rmse: Number.POSITIVE_INFINITY,
  };

  for (const direction of [1, -1] as const) {
    for (let phase = 0; phase < 360; phase += 30) {
      const rmse = evaluate(initial, target, phase, direction, assemblyMode, pathScale);
      if (rmse < best.rmse) best = { parameters: { ...initial }, phase, direction, rmse };
    }
  }

  const iterations = 1600;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const temperature = 1 - iteration / iterations;
    const globalSearch = random() < 0.16;
    const base = best.parameters;
    const mutateLength = (value: number, strength: number) =>
      clamp(globalSearch ? 10 + random() * maximumLength : value + (random() * 2 - 1) * strength * temperature, 10, maximumLength);
    const candidate: FourBarParameters = {
      ground: mutateLength(base.ground, pathScale * 0.9),
      input: mutateLength(base.input, pathScale * 0.65),
      coupler: mutateLength(base.coupler, pathScale * 0.9),
      output: mutateLength(base.output, pathScale * 0.75),
      couplerPointRatio: clamp(globalSearch ? random() : base.couplerPointRatio + (random() * 2 - 1) * 0.45 * temperature, 0, 1),
      couplerPointOffset: clamp(globalSearch ? (random() * 2 - 1) * pathScale * 1.5 : base.couplerPointOffset + (random() * 2 - 1) * pathScale * 0.8 * temperature, -pathScale * 1.5, pathScale * 1.5),
    };
    const phase = (globalSearch ? random() * 360 : best.phase + (random() * 2 - 1) * 120 * temperature + 360) % 360;
    const direction = random() < 0.04 ? (best.direction === 1 ? -1 : 1) : best.direction;
    const rmse = evaluate(candidate, target, phase, direction, assemblyMode, pathScale);
    if (rmse < best.rmse) best = { parameters: candidate, phase, direction, rmse };

    if (iteration % 80 === 79) {
      onProgress?.((iteration + 1) / iterations);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  onProgress?.(1);
  return best;
}

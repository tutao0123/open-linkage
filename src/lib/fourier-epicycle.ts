import type { Point } from "./four-bar";
import { resampleClosedCurve } from "./sketch-linkage";

export type FourierEpicycleTerm = {
  frequency: number;
  amplitude: number;
  phaseDegrees: number;
};

export type FourierEpicycleParameters = {
  family: "fourier-epicycle";
  sampleCount: number;
  termCount: number;
  center: Point;
  terms: FourierEpicycleTerm[];
  targetBounds: { minimum: Point; maximum: Point };
  normalizedRmse: number;
};

export type FourierEpicycleGeometry = {
  inputAngleDegrees: number;
  joints: Point[];
  point: Point;
};

type Complex = { real: number; imaginary: number };

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function degreesToRadians(degrees: number) {
  return degrees * Math.PI / 180;
}

function boundsOf(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minimum: { x: Math.min(...xs), y: Math.min(...ys) },
    maximum: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

function dftCoefficient(samples: Point[], frequency: number): Complex {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const angle = 2 * Math.PI * frequency * index / samples.length;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    real += samples[index].x * cosine + samples[index].y * sine;
    imaginary += samples[index].y * cosine - samples[index].x * sine;
  }
  return {
    real: real / samples.length,
    imaginary: imaginary / samples.length,
  };
}

export function solveFourierEpicycle(
  parameters: FourierEpicycleParameters,
  inputAngleDegrees: number,
): FourierEpicycleGeometry {
  const angle = degreesToRadians(inputAngleDegrees);
  const joints = [{ ...parameters.center }];
  let point = { ...parameters.center };
  for (const term of parameters.terms) {
    const phase = degreesToRadians(term.phaseDegrees) + term.frequency * angle;
    point = {
      x: point.x + term.amplitude * Math.cos(phase),
      y: point.y + term.amplitude * Math.sin(phase),
    };
    joints.push(point);
  }
  return { inputAngleDegrees, joints, point };
}

export function sampleFourierEpicycleTrajectory(
  parameters: FourierEpicycleParameters,
  sampleCount = 360,
): Point[] {
  const count = Math.max(2, Math.round(sampleCount));
  return Array.from({ length: count }, (_, index) =>
    solveFourierEpicycle(parameters, index * 360 / count).point);
}

export function normalizedFourierEpicycleRmse(
  target: Point[],
  parameters: FourierEpicycleParameters,
) {
  const samples = resampleClosedCurve(target, parameters.sampleCount);
  if (samples.length < 3) throw new Error("target curve is too short");
  const bounds = boundsOf(samples);
  const diagonal = Math.max(1e-9, Math.hypot(
    bounds.maximum.x - bounds.minimum.x,
    bounds.maximum.y - bounds.minimum.y,
  ));
  let squaredError = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const actual = solveFourierEpicycle(parameters, index * 360 / samples.length).point;
    squaredError += (actual.x - samples[index].x) ** 2 + (actual.y - samples[index].y) ** 2;
  }
  return Math.sqrt(squaredError / samples.length) / diagonal;
}

export function fitFourierEpicycle(
  target: Point[],
  options: { termCount?: number; sampleCount?: number } = {},
): FourierEpicycleParameters {
  const sampleCount = clampInteger(options.sampleCount ?? 128, 16, 2048);
  const samples = resampleClosedCurve(target, sampleCount);
  if (samples.length < 8) throw new Error("target curve is too short");
  const maximumTerms = Math.max(1, samples.length - 1);
  const termCount = clampInteger(options.termCount ?? 18, 1, maximumTerms);
  const centerCoefficient = dftCoefficient(samples, 0);
  const frequencies = Array.from({ length: samples.length - 1 }, (_, index) => {
    const positiveFrequency = index + 1;
    return positiveFrequency <= Math.floor(samples.length / 2)
      ? positiveFrequency
      : positiveFrequency - samples.length;
  });
  const terms = frequencies
    .map((frequency) => {
      const coefficient = dftCoefficient(samples, frequency);
      return {
        frequency,
        amplitude: Math.hypot(coefficient.real, coefficient.imaginary),
        phaseDegrees: Math.atan2(coefficient.imaginary, coefficient.real) * 180 / Math.PI,
      };
    })
    .sort((left, right) => right.amplitude - left.amplitude || Math.abs(left.frequency) - Math.abs(right.frequency))
    .slice(0, termCount);
  const provisional: FourierEpicycleParameters = {
    family: "fourier-epicycle",
    sampleCount,
    termCount,
    center: { x: centerCoefficient.real, y: centerCoefficient.imaginary },
    terms,
    targetBounds: boundsOf(samples),
    normalizedRmse: 0,
  };
  return { ...provisional, normalizedRmse: normalizedFourierEpicycleRmse(samples, provisional) };
}

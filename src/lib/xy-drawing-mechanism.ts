import type { Point } from "./four-bar";
import { resampleClosedCurve } from "./sketch-linkage";

export type XYDrawingAxis = "x" | "y";

export type XYHarmonicDrive = {
  harmonic: number;
  /** Integer speed ratio from the shared input shaft to this eccentric. */
  gearRatio: number;
  cosineEccentricity: number;
  sineEccentricity: number;
  eccentricity: number;
  phaseDegrees: number;
};

export type XYDrawingMechanismParameters = {
  family: "gear-synchronized-xy";
  harmonicCount: number;
  sampleCount: number;
  inputShaftPhaseDegrees: number;
  x: { offset: number; drives: XYHarmonicDrive[] };
  y: { offset: number; drives: XYHarmonicDrive[] };
  targetBounds: { minimum: Point; maximum: Point };
  normalizedRmse: number;
};

export type XYDrawingPosition = {
  inputAngleDegrees: number;
  point: Point;
  xSlider: Point;
  ySlider: Point;
};

export type XYHarmonicGeometry = {
  axis: XYDrawingAxis;
  harmonic: number;
  gearRatio: number;
  gearCenter: Point;
  pitchRadius: number;
  rotationDegrees: number;
  eccentricity: number;
  eccentricPhaseDegrees: number;
  eccentricPin: Point;
};

export type XYDrawingMechanismGeometry = XYDrawingPosition & {
  sharedInputShaft: { center: Point; rotationDegrees: number };
  xGuide: { start: Point; end: Point };
  yGuide: { start: Point; end: Point };
  harmonicDrives: XYHarmonicGeometry[];
};

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

function evaluateAxis(offset: number, drives: XYHarmonicDrive[], angleRadians: number) {
  return drives.reduce(
    (value, drive) => value
      + drive.cosineEccentricity * Math.cos(drive.gearRatio * angleRadians)
      + drive.sineEccentricity * Math.sin(drive.gearRatio * angleRadians),
    offset,
  );
}

function fitAxis(values: number[], harmonicCount: number, inputPhaseDegrees: number) {
  const count = values.length;
  const offset = values.reduce((sum, value) => sum + value, 0) / count;
  const drives: XYHarmonicDrive[] = [];
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    let cosine = 0;
    let sine = 0;
    for (let index = 0; index < count; index += 1) {
      const angle = harmonic * (2 * Math.PI * index / count + degreesToRadians(inputPhaseDegrees));
      cosine += values[index] * Math.cos(angle);
      sine += values[index] * Math.sin(angle);
    }
    cosine *= 2 / count;
    sine *= 2 / count;
    drives.push({
      harmonic,
      gearRatio: harmonic,
      cosineEccentricity: cosine,
      sineEccentricity: sine,
      eccentricity: Math.hypot(cosine, sine),
      phaseDegrees: Math.atan2(-sine, cosine) * 180 / Math.PI,
    });
  }
  return { offset, drives };
}

export function solveXYDrawingMechanism(
  parameters: XYDrawingMechanismParameters,
  inputAngleDegrees: number,
): XYDrawingPosition {
  const shaftAngle = degreesToRadians(inputAngleDegrees + parameters.inputShaftPhaseDegrees);
  const x = evaluateAxis(parameters.x.offset, parameters.x.drives, shaftAngle);
  const y = evaluateAxis(parameters.y.offset, parameters.y.drives, shaftAngle);
  return {
    inputAngleDegrees,
    point: { x, y },
    xSlider: { x, y: parameters.targetBounds.maximum.y },
    ySlider: { x: parameters.targetBounds.minimum.x, y },
  };
}

export function sampleXYDrawingTrajectory(parameters: XYDrawingMechanismParameters, sampleCount = 360): Point[] {
  const count = Math.max(2, Math.round(sampleCount));
  return Array.from({ length: count }, (_, index) =>
    solveXYDrawingMechanism(parameters, index * 360 / count).point);
}

export function normalizedXYDrawingRmse(target: Point[], parameters: XYDrawingMechanismParameters) {
  const resampled = resampleClosedCurve(target, parameters.sampleCount);
  if (resampled.length < 3) throw new Error("target curve is too short");
  const bounds = boundsOf(resampled);
  const diagonal = Math.max(1e-9, Math.hypot(
    bounds.maximum.x - bounds.minimum.x,
    bounds.maximum.y - bounds.minimum.y,
  ));
  let squaredError = 0;
  for (let index = 0; index < resampled.length; index += 1) {
    const actual = solveXYDrawingMechanism(parameters, index * 360 / resampled.length).point;
    squaredError += (actual.x - resampled[index].x) ** 2 + (actual.y - resampled[index].y) ** 2;
  }
  return Math.sqrt(squaredError / resampled.length) / diagonal;
}

export function fitXYDrawingMechanism(
  target: Point[],
  options: { harmonicCount?: number; sampleCount?: number; inputShaftPhaseDegrees?: number } = {},
): XYDrawingMechanismParameters {
  const sampleCount = clampInteger(options.sampleCount ?? 128, 16, 2048);
  const maximumHarmonics = Math.max(1, Math.floor((sampleCount - 1) / 2));
  const harmonicCount = clampInteger(options.harmonicCount ?? 10, 1, maximumHarmonics);
  const samples = resampleClosedCurve(target, sampleCount);
  if (samples.length < 8) throw new Error("target curve is too short");
  const phaseDegrees = options.inputShaftPhaseDegrees ?? 0;
  const bounds = boundsOf(samples);
  const provisional: XYDrawingMechanismParameters = {
    family: "gear-synchronized-xy",
    harmonicCount,
    sampleCount,
    inputShaftPhaseDegrees: phaseDegrees,
    x: fitAxis(samples.map((point) => point.x), harmonicCount, phaseDegrees),
    y: fitAxis(samples.map((point) => point.y), harmonicCount, phaseDegrees),
    targetBounds: bounds,
    normalizedRmse: 0,
  };
  return { ...provisional, normalizedRmse: normalizedXYDrawingRmse(samples, provisional) };
}

export function createXYDrawingMechanismGeometry(
  parameters: XYDrawingMechanismParameters,
  inputAngleDegrees: number,
): XYDrawingMechanismGeometry {
  const position = solveXYDrawingMechanism(parameters, inputAngleDegrees);
  const bounds = parameters.targetBounds;
  const width = Math.max(1, bounds.maximum.x - bounds.minimum.x);
  const height = Math.max(1, bounds.maximum.y - bounds.minimum.y);
  const margin = Math.max(width, height) * 0.08;
  const shaftCenter = { x: bounds.minimum.x - margin * 2.2, y: bounds.minimum.y - margin * 2.2 };
  const allDrives = (["x", "y"] as const).flatMap((axis, axisIndex) =>
    parameters[axis].drives.map((drive, index) => {
      const pitchRadius = margin * (0.38 + drive.harmonic * 0.055);
      const gearCenter = {
        x: shaftCenter.x + index * margin * 1.15,
        y: shaftCenter.y - axisIndex * margin * 1.25,
      };
      const rotationDegrees = drive.gearRatio * (inputAngleDegrees + parameters.inputShaftPhaseDegrees)
        + drive.phaseDegrees;
      const eccentricAngle = degreesToRadians(rotationDegrees);
      const displayEccentricity = Math.min(drive.eccentricity, pitchRadius * 0.72);
      return {
        axis,
        harmonic: drive.harmonic,
        gearRatio: drive.gearRatio,
        gearCenter,
        pitchRadius,
        rotationDegrees,
        eccentricity: drive.eccentricity,
        eccentricPhaseDegrees: drive.phaseDegrees,
        eccentricPin: {
          x: gearCenter.x + Math.cos(eccentricAngle) * displayEccentricity,
          y: gearCenter.y + Math.sin(eccentricAngle) * displayEccentricity,
        },
      };
    }));
  return {
    ...position,
    sharedInputShaft: {
      center: shaftCenter,
      rotationDegrees: inputAngleDegrees + parameters.inputShaftPhaseDegrees,
    },
    xGuide: {
      start: { x: bounds.minimum.x - margin, y: bounds.maximum.y },
      end: { x: bounds.maximum.x + margin, y: bounds.maximum.y },
    },
    yGuide: {
      start: { x: bounds.minimum.x, y: bounds.minimum.y - margin },
      end: { x: bounds.minimum.x, y: bounds.maximum.y + margin },
    },
    harmonicDrives: allDrives,
  };
}

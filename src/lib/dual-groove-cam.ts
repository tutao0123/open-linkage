import type { Point } from "./four-bar";

export type PeriodicSplineLaw = {
  interpolation: "periodic-catmull-rom";
  phaseDegrees: number;
  minimum: number;
  maximum: number;
  lift: number;
  baseRadius: number;
  samples: number[];
};

export type DualGrooveCamParameters = {
  family: "dual-groove-cam";
  model: "kinematic-slot-profile";
  modelNote: string;
  inputPeriodDegrees: 360;
  sampleCount: number;
  xLaw: PeriodicSplineLaw;
  yLaw: PeriodicSplineLaw;
  layout: {
    xCamCenter: Point;
    yCamCenter: Point;
    followerGuideLength: number;
  };
};

export type DualGrooveCamOptions = {
  sampleCount?: number;
  baseRadius?: number;
  xBaseRadius?: number;
  yBaseRadius?: number;
  xPhaseDegrees?: number;
  yPhaseDegrees?: number;
  camSpacing?: number;
  followerGuideLength?: number;
};

export type CamFollowerGeometry = {
  value: number;
  displacement: number;
  contactPoint: Point;
  rollerCenter: Point;
  guideStart: Point;
  guideEnd: Point;
};

export type CamSvgGeometry = {
  center: Point;
  baseCircleRadius: number;
  groove: Point[];
  contactPoint: Point;
  rotationDegrees: number;
};

export type DualGrooveCamPosition = {
  inputAngleDegrees: number;
  xFollower: CamFollowerGeometry;
  yFollower: CamFollowerGeometry;
  crossSlide: {
    horizontalCarriage: Point;
    verticalCarriage: Point;
    drawingPoint: Point;
  };
  cams: {
    x: CamSvgGeometry;
    y: CamSvgGeometry;
  };
};

const EPSILON = 1e-9;
const DEFAULT_SAMPLE_COUNT = 360;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Resamples a closed polyline at equal arc-length intervals. */
export function resampleClosedTargetCurve(points: Point[], sampleCount = DEFAULT_SAMPLE_COUNT): Point[] {
  if (!Number.isInteger(sampleCount) || sampleCount < 8) {
    throw new RangeError("A dual-groove cam requires at least 8 integer samples.");
  }
  if (points.length < 3 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError("The target must contain at least three finite points.");
  }

  const cleaned = points.filter(
    (point, index) => index === 0 || distance(point, points[index - 1]) > EPSILON,
  );
  if (cleaned.length > 2 && distance(cleaned[0], cleaned[cleaned.length - 1]) <= EPSILON) {
    cleaned.pop();
  }
  if (cleaned.length < 3) throw new RangeError("The target must contain three distinct points.");

  const loop = [...cleaned, cleaned[0]];
  const cumulative = [0];
  for (let index = 1; index < loop.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(loop[index - 1], loop[index]));
  }
  const perimeter = cumulative[cumulative.length - 1];
  if (perimeter <= EPSILON) throw new RangeError("The target curve must have a non-zero perimeter.");

  const result: Point[] = [];
  let segment = 1;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const arcLength = (sampleIndex / sampleCount) * perimeter;
    while (segment < cumulative.length - 1 && cumulative[segment] < arcLength) segment += 1;
    const start = loop[segment - 1];
    const end = loop[segment];
    const span = cumulative[segment] - cumulative[segment - 1];
    const ratio = span > EPSILON ? (arcLength - cumulative[segment - 1]) / span : 0;
    result.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }
  return result;
}

function periodicCatmullRom(samples: number[], angleDegrees: number) {
  const count = samples.length;
  const position = (positiveModulo(angleDegrees, 360) / 360) * count;
  const index = Math.floor(position);
  const t = position - index;
  const p0 = samples[positiveModulo(index - 1, count)];
  const p1 = samples[index % count];
  const p2 = samples[(index + 1) % count];
  const p3 = samples[(index + 2) % count];
  const t2 = t * t;
  const t3 = t2 * t;
  const interpolated = 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
  // A slot radius must stay inside the sampled rise envelope. Catmull-Rom can
  // overshoot at sharp corners, so clamp only that non-physical interpolation.
  return Math.min(Math.max(interpolated, Math.min(p1, p2)), Math.max(p1, p2));
}

function createLaw(
  values: number[],
  baseRadius: number,
  phaseDegrees: number,
): PeriodicSplineLaw {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return {
    interpolation: "periodic-catmull-rom",
    phaseDegrees,
    minimum,
    maximum,
    lift: maximum - minimum,
    baseRadius,
    samples: values.map((value) => value - minimum),
  };
}

/**
 * Creates two synchronized radial slot-cam displacement laws from a closed target.
 * This is a kinematic groove-profile model, not a contact, stress, undercut, or manufacturing simulation.
 */
export function createDualGrooveCam(
  target: Point[],
  options: DualGrooveCamOptions = {},
): DualGrooveCamParameters {
  const sampleCount = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  const samples = resampleClosedTargetCurve(target, sampleCount);
  const xs = samples.map((point) => point.x);
  const ys = samples.map((point) => point.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const defaultBaseRadius = Math.max(12, span * 0.18);
  const xBaseRadius = options.xBaseRadius ?? options.baseRadius ?? defaultBaseRadius;
  const yBaseRadius = options.yBaseRadius ?? options.baseRadius ?? defaultBaseRadius;
  if (!(xBaseRadius > 0) || !(yBaseRadius > 0)) {
    throw new RangeError("Cam base radii must be positive.");
  }

  const xLaw = createLaw(xs, xBaseRadius, options.xPhaseDegrees ?? 0);
  const yLaw = createLaw(ys, yBaseRadius, options.yPhaseDegrees ?? 0);
  const camSpacing = options.camSpacing ?? Math.max(
    xLaw.baseRadius + xLaw.lift + yLaw.baseRadius + yLaw.lift + span * 0.2,
    span,
  );

  return {
    family: "dual-groove-cam",
    model: "kinematic-slot-profile",
    modelNote: "Kinematic groove profiles only; contact forces, strength, undercut, and manufacturability are not evaluated.",
    inputPeriodDegrees: 360,
    sampleCount,
    xLaw,
    yLaw,
    layout: {
      xCamCenter: { x: 0, y: 0 },
      yCamCenter: { x: camSpacing, y: 0 },
      followerGuideLength: options.followerGuideLength ?? span * 0.35 + 24,
    },
  };
}

function evaluateLaw(law: PeriodicSplineLaw, inputAngleDegrees: number) {
  const displacement = periodicCatmullRom(law.samples, inputAngleDegrees + law.phaseDegrees);
  return { displacement, value: law.minimum + displacement };
}

function rotate(point: Point, angleRadians: number): Point {
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  return {
    x: cosine * point.x - sine * point.y,
    y: sine * point.x + cosine * point.y,
  };
}

function createCamGeometry(
  law: PeriodicSplineLaw,
  center: Point,
  inputAngleDegrees: number,
  followerDirectionDegrees: number,
): CamSvgGeometry {
  const rotation = toRadians(inputAngleDegrees);
  const groove: Point[] = [];
  for (let index = 0; index < law.samples.length; index += 1) {
    const localAngleDegrees = (index / law.samples.length) * 360;
    const displacement = periodicCatmullRom(
      law.samples,
      followerDirectionDegrees - localAngleDegrees + law.phaseDegrees,
    );
    const radius = law.baseRadius + displacement;
    const localAngle = toRadians(localAngleDegrees);
    const rotated = rotate(
      { x: radius * Math.cos(localAngle), y: radius * Math.sin(localAngle) },
      rotation,
    );
    groove.push({ x: center.x + rotated.x, y: center.y + rotated.y });
  }

  const evaluated = evaluateLaw(law, inputAngleDegrees);
  const direction = toRadians(followerDirectionDegrees);
  const contactRadius = law.baseRadius + evaluated.displacement;
  const contactPoint = {
    x: center.x + contactRadius * Math.cos(direction),
    y: center.y + contactRadius * Math.sin(direction),
  };
  return {
    center,
    baseCircleRadius: law.baseRadius,
    groove,
    contactPoint,
    rotationDegrees: inputAngleDegrees,
  };
}

/** Solves the synchronized X/Y followers and returns SVG-ready cam geometry. */
export function solveDualGrooveCam(
  parameters: DualGrooveCamParameters,
  inputAngleDegrees: number,
): DualGrooveCamPosition {
  if (!Number.isFinite(inputAngleDegrees)) throw new RangeError("Input angle must be finite.");
  const normalizedAngle = positiveModulo(inputAngleDegrees, 360);
  const x = evaluateLaw(parameters.xLaw, normalizedAngle);
  const y = evaluateLaw(parameters.yLaw, normalizedAngle);
  const xCam = createCamGeometry(parameters.xLaw, parameters.layout.xCamCenter, normalizedAngle, 0);
  const yCam = createCamGeometry(parameters.yLaw, parameters.layout.yCamCenter, normalizedAngle, -90);
  const guideLength = parameters.layout.followerGuideLength;

  const xFollower: CamFollowerGeometry = {
    ...x,
    contactPoint: xCam.contactPoint,
    rollerCenter: xCam.contactPoint,
    guideStart: { x: xCam.contactPoint.x, y: xCam.contactPoint.y - guideLength / 2 },
    guideEnd: { x: xCam.contactPoint.x, y: xCam.contactPoint.y + guideLength / 2 },
  };
  const yFollower: CamFollowerGeometry = {
    ...y,
    contactPoint: yCam.contactPoint,
    rollerCenter: yCam.contactPoint,
    guideStart: { x: yCam.contactPoint.x - guideLength / 2, y: yCam.contactPoint.y },
    guideEnd: { x: yCam.contactPoint.x + guideLength / 2, y: yCam.contactPoint.y },
  };

  return {
    inputAngleDegrees: normalizedAngle,
    xFollower,
    yFollower,
    crossSlide: {
      horizontalCarriage: { x: x.value, y: parameters.yLaw.minimum },
      verticalCarriage: { x: parameters.xLaw.minimum, y: y.value },
      drawingPoint: { x: x.value, y: y.value },
    },
    cams: { x: xCam, y: yCam },
  };
}

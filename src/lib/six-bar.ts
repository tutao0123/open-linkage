import type { AssemblyMode, Point } from "./four-bar";

export type SixBarParameters = {
  groundPivot: number;
  rearPivotX: number;
  rearPivotY: number;
  crank: number;
  firstCoupler: number;
  firstRocker: number;
  secondCoupler: number;
  secondRocker: number;
  footRatio: number;
  footOffset: number;
};

export type SixBarPosition = {
  crankJoint: Point;
  sharedJoint: Point;
  secondJoint: Point;
  footPoint: Point;
};

export type SixBarSample = {
  angle: number;
  position: SixBarPosition;
  firstTransmissionAngle: number;
  secondTransmissionAngle: number;
};

export type SixBarAnalysis = {
  validRatio: number;
  stepLength: number;
  liftHeight: number;
  minTransmissionAngle: number;
  meanTransmissionAngle: number;
  peakFootSpeedPerRadian: number;
  performanceScore: number;
  trailPath: string;
  samples: SixBarSample[];
};

const EPSILON = 1e-8;

function circleIntersection(
  firstCenter: Point,
  firstRadius: number,
  secondCenter: Point,
  secondRadius: number,
  branch: 1 | -1,
): Point | null {
  const dx = secondCenter.x - firstCenter.x;
  const dy = secondCenter.y - firstCenter.y;
  const distance = Math.hypot(dx, dy);
  if (
    distance < EPSILON ||
    distance > firstRadius + secondRadius + EPSILON ||
    distance < Math.abs(firstRadius - secondRadius) - EPSILON
  ) return null;

  const along = (firstRadius ** 2 - secondRadius ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, firstRadius ** 2 - along ** 2));
  const unitX = dx / distance;
  const unitY = dy / distance;
  return {
    x: firstCenter.x + along * unitX - branch * height * unitY,
    y: firstCenter.y + along * unitY + branch * height * unitX,
  };
}

function transmissionAngle(vertex: Point, first: Point, second: Point) {
  const firstX = first.x - vertex.x;
  const firstY = first.y - vertex.y;
  const secondX = second.x - vertex.x;
  const secondY = second.y - vertex.y;
  const denominator = Math.hypot(firstX, firstY) * Math.hypot(secondX, secondY);
  if (denominator < EPSILON) return 0;
  const cosine = Math.min(1, Math.max(-1, (firstX * secondX + firstY * secondY) / denominator));
  const angle = (Math.acos(cosine) * 180) / Math.PI;
  return Math.min(angle, 180 - angle);
}

export function getSixBarTransmissionAngles(
  parameters: SixBarParameters,
  position: SixBarPosition,
) {
  const frontPivot = { x: parameters.groundPivot, y: 0 };
  const rearPivot = { x: parameters.rearPivotX, y: parameters.rearPivotY };
  return {
    first: transmissionAngle(position.sharedJoint, position.crankJoint, frontPivot),
    second: transmissionAngle(position.secondJoint, position.sharedJoint, rearPivot),
  };
}

export function solveSixBarLeg(
  parameters: SixBarParameters,
  inputAngleDegrees: number,
  firstMode: AssemblyMode = "open",
  secondMode: AssemblyMode = "crossed",
): SixBarPosition | null {
  const lengths = [
    parameters.groundPivot,
    parameters.crank,
    parameters.firstCoupler,
    parameters.firstRocker,
    parameters.secondCoupler,
    parameters.secondRocker,
  ];
  if (lengths.some((length) => !Number.isFinite(length) || length <= 0)) return null;
  if (!Number.isFinite(parameters.rearPivotX) || !Number.isFinite(parameters.rearPivotY)) return null;

  const angle = (inputAngleDegrees * Math.PI) / 180;
  const crankJoint = {
    x: parameters.crank * Math.cos(angle),
    y: parameters.crank * Math.sin(angle),
  };
  const frontPivot = { x: parameters.groundPivot, y: 0 };
  const rearPivot = { x: parameters.rearPivotX, y: parameters.rearPivotY };
  const sharedJoint = circleIntersection(
    crankJoint,
    parameters.firstCoupler,
    frontPivot,
    parameters.firstRocker,
    firstMode === "open" ? 1 : -1,
  );
  if (!sharedJoint) return null;

  const secondJoint = circleIntersection(
    sharedJoint,
    parameters.secondCoupler,
    rearPivot,
    parameters.secondRocker,
    secondMode === "open" ? 1 : -1,
  );
  if (!secondJoint) return null;

  const linkX = secondJoint.x - sharedJoint.x;
  const linkY = secondJoint.y - sharedJoint.y;
  const linkLength = Math.hypot(linkX, linkY);
  if (linkLength < EPSILON) return null;
  const normalX = -linkY / linkLength;
  const normalY = linkX / linkLength;
  const footPoint = {
    x: sharedJoint.x + parameters.footRatio * linkX + parameters.footOffset * normalX,
    y: sharedJoint.y + parameters.footRatio * linkY + parameters.footOffset * normalY,
  };

  return { crankJoint, sharedJoint, secondJoint, footPoint };
}

export function sampleSixBarLeg(
  parameters: SixBarParameters,
  sampleCount = 120,
  phase = 0,
  direction: 1 | -1 = 1,
  firstMode: AssemblyMode = "open",
  secondMode: AssemblyMode = "crossed",
): Array<SixBarSample | null> {
  return Array.from({ length: sampleCount }, (_, index) => {
    const angle = phase + direction * (index / sampleCount) * 360;
    const position = solveSixBarLeg(parameters, angle, firstMode, secondMode);
    if (!position) return null;
    const angles = getSixBarTransmissionAngles(parameters, position);
    return {
      angle,
      position,
      firstTransmissionAngle: angles.first,
      secondTransmissionAngle: angles.second,
    };
  });
}

export function analyzeSixBarLeg(
  parameters: SixBarParameters,
  firstMode: AssemblyMode = "open",
  secondMode: AssemblyMode = "crossed",
): SixBarAnalysis {
  const rawSamples = sampleSixBarLeg(parameters, 120, 0, 1, firstMode, secondMode);
  const samples = rawSamples.filter((sample): sample is SixBarSample => sample !== null);
  const footPoints = samples.map((sample) => sample.position.footPoint);
  const minimumX = footPoints.length ? Math.min(...footPoints.map((point) => point.x)) : 0;
  const maximumX = footPoints.length ? Math.max(...footPoints.map((point) => point.x)) : 0;
  const minimumY = footPoints.length ? Math.min(...footPoints.map((point) => point.y)) : 0;
  const maximumY = footPoints.length ? Math.max(...footPoints.map((point) => point.y)) : 0;
  const transmissionAngles = samples.flatMap((sample) => [sample.firstTransmissionAngle, sample.secondTransmissionAngle]);
  const minTransmissionAngle = transmissionAngles.length ? Math.min(...transmissionAngles) : 0;
  const meanTransmissionAngle = transmissionAngles.length
    ? transmissionAngles.reduce((sum, angle) => sum + angle, 0) / transmissionAngles.length
    : 0;
  const angleStep = (Math.PI * 2) / rawSamples.length;
  let peakFootSpeedPerRadian = 0;
  for (let index = 0; index < rawSamples.length; index += 1) {
    const current = rawSamples[index];
    const previous = rawSamples[(index - 1 + rawSamples.length) % rawSamples.length];
    if (!current || !previous) continue;
    peakFootSpeedPerRadian = Math.max(
      peakFootSpeedPerRadian,
      Math.hypot(
        current.position.footPoint.x - previous.position.footPoint.x,
        current.position.footPoint.y - previous.position.footPoint.y,
      ) / angleStep,
    );
  }
  const validRatio = samples.length / rawSamples.length;
  const continuityScore = validRatio * 45;
  const transmissionScore = Math.min(1, minTransmissionAngle / 40) * 40;
  const speedScale = Math.max(maximumX - minimumX, maximumY - minimumY, 1);
  const smoothnessScore = Math.max(0, 1 - peakFootSpeedPerRadian / (speedScale * 3.5)) * 15;
  const trailPath = footPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${(-point.y).toFixed(2)}`)
    .join(" ");

  return {
    validRatio,
    stepLength: maximumX - minimumX,
    liftHeight: maximumY - minimumY,
    minTransmissionAngle,
    meanTransmissionAngle,
    peakFootSpeedPerRadian,
    performanceScore: continuityScore + transmissionScore + smoothnessScore,
    trailPath: `${trailPath}${validRatio === 1 && trailPath ? " Z" : ""}`,
    samples,
  };
}

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

export type SixBarAnalysis = {
  validRatio: number;
  stepLength: number;
  liftHeight: number;
  trailPath: string;
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
  const normalX = -linkY / linkLength;
  const normalY = linkX / linkLength;
  const footPoint = {
    x: sharedJoint.x + parameters.footRatio * linkX + parameters.footOffset * normalX,
    y: sharedJoint.y + parameters.footRatio * linkY + parameters.footOffset * normalY,
  };

  return { crankJoint, sharedJoint, secondJoint, footPoint };
}

export function analyzeSixBarLeg(
  parameters: SixBarParameters,
  firstMode: AssemblyMode = "open",
  secondMode: AssemblyMode = "crossed",
): SixBarAnalysis {
  let valid = 0;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let trailPath = "";
  let drawing = false;

  for (let angle = 0; angle <= 360; angle += 1) {
    const position = solveSixBarLeg(parameters, angle, firstMode, secondMode);
    if (!position) {
      drawing = false;
      continue;
    }
    valid += 1;
    minimumX = Math.min(minimumX, position.footPoint.x);
    maximumX = Math.max(maximumX, position.footPoint.x);
    minimumY = Math.min(minimumY, position.footPoint.y);
    maximumY = Math.max(maximumY, position.footPoint.y);
    trailPath += `${drawing ? "L" : "M"}${position.footPoint.x.toFixed(2)},${(-position.footPoint.y).toFixed(2)} `;
    drawing = true;
  }

  return {
    validRatio: valid / 361,
    stepLength: valid ? maximumX - minimumX : 0,
    liftHeight: valid ? maximumY - minimumY : 0,
    trailPath: trailPath.trim(),
  };
}

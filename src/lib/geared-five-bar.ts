import type { AssemblyMode, Point } from "./four-bar";

export type GearRatio = -2 | -1;

export type GearedFiveBarParameters = {
  ground: number;
  leftInput: number;
  leftCoupler: number;
  rightCoupler: number;
  rightInput: number;
  gearRatio: GearRatio;
  gearPhase: number;
  couplerPointRatio: number;
  couplerPointOffset: number;
};

export type GearedFiveBarPosition = {
  leftInputJoint: Point;
  rightInputJoint: Point;
  centerJoint: Point;
  couplerPoint: Point;
  rightInputAngle: number;
  transmissionAngle: number;
};

const EPSILON = 1e-9;

function radians(degrees: number) {
  return degrees * Math.PI / 180;
}

function degrees(radiansValue: number) {
  return radiansValue * 180 / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function solveGearedFiveBar(
  parameters: GearedFiveBarParameters,
  inputAngleDegrees: number,
  assemblyMode: AssemblyMode,
): GearedFiveBarPosition | null {
  const {
    ground,
    leftInput,
    leftCoupler,
    rightCoupler,
    rightInput,
    gearRatio,
    gearPhase,
    couplerPointRatio,
    couplerPointOffset,
  } = parameters;
  if ([ground, leftInput, leftCoupler, rightCoupler, rightInput].some((length) => length <= 0)) return null;
  if (gearRatio !== -1 && gearRatio !== -2) return null;

  const leftAngle = radians(inputAngleDegrees);
  const rightAngleDegrees = gearRatio * inputAngleDegrees + gearPhase;
  const rightAngle = radians(rightAngleDegrees);
  const leftInputJoint = {
    x: leftInput * Math.cos(leftAngle),
    y: leftInput * Math.sin(leftAngle),
  };
  const rightInputJoint = {
    x: ground + rightInput * Math.cos(rightAngle),
    y: rightInput * Math.sin(rightAngle),
  };
  const dx = rightInputJoint.x - leftInputJoint.x;
  const dy = rightInputJoint.y - leftInputJoint.y;
  const centerDistance = Math.hypot(dx, dy);
  if (
    centerDistance > leftCoupler + rightCoupler + EPSILON ||
    centerDistance < Math.abs(leftCoupler - rightCoupler) - EPSILON ||
    centerDistance < EPSILON
  ) return null;

  const along = (
    leftCoupler * leftCoupler - rightCoupler * rightCoupler + centerDistance * centerDistance
  ) / (2 * centerDistance);
  const height = Math.sqrt(Math.max(0, leftCoupler * leftCoupler - along * along));
  const unitX = dx / centerDistance;
  const unitY = dy / centerDistance;
  const base = {
    x: leftInputJoint.x + along * unitX,
    y: leftInputJoint.y + along * unitY,
  };
  const branch = assemblyMode === "open" ? 1 : -1;
  const centerJoint = {
    x: base.x - branch * height * unitY,
    y: base.y + branch * height * unitX,
  };

  const couplerX = centerJoint.x - leftInputJoint.x;
  const couplerY = centerJoint.y - leftInputJoint.y;
  const normalX = -couplerY / leftCoupler;
  const normalY = couplerX / leftCoupler;
  const couplerPoint = {
    x: leftInputJoint.x + couplerPointRatio * couplerX + couplerPointOffset * normalX,
    y: leftInputJoint.y + couplerPointRatio * couplerY + couplerPointOffset * normalY,
  };

  const vectorLeft = { x: leftInputJoint.x - centerJoint.x, y: leftInputJoint.y - centerJoint.y };
  const vectorRight = { x: rightInputJoint.x - centerJoint.x, y: rightInputJoint.y - centerJoint.y };
  const cosine = clamp(
    (vectorLeft.x * vectorRight.x + vectorLeft.y * vectorRight.y) / (leftCoupler * rightCoupler),
    -1,
    1,
  );
  const includedAngle = degrees(Math.acos(cosine));

  return {
    leftInputJoint,
    rightInputJoint,
    centerJoint,
    couplerPoint,
    rightInputAngle: rightAngleDegrees,
    transmissionAngle: Math.min(includedAngle, 180 - includedAngle),
  };
}

export function gearedFiveBarPitchRadii(parameters: Pick<GearedFiveBarParameters, "ground" | "gearRatio">) {
  const magnitude = Math.abs(parameters.gearRatio);
  return {
    left: parameters.ground * magnitude / (1 + magnitude),
    right: parameters.ground / (1 + magnitude),
  };
}

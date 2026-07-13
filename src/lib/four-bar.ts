export type Point = { x: number; y: number };

export type AssemblyMode = "open" | "crossed";

export type FourBarParameters = {
  ground: number;
  input: number;
  coupler: number;
  output: number;
  couplerPointRatio: number;
  couplerPointOffset: number;
};

export type FourBarPosition = {
  inputJoint: Point;
  couplerJoint: Point;
  couplerPoint: Point;
  outputAngle: number;
  transmissionAngle: number;
};

export type MotionAnalysis = {
  validRatio: number;
  outputSwing: number;
  minimumTransmissionAngle: number | null;
  trailPath: string;
};

const EPSILON = 1e-9;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function solveFourBar(
  parameters: FourBarParameters,
  inputAngleDegrees: number,
  assemblyMode: AssemblyMode,
): FourBarPosition | null {
  const { ground, input, coupler, output, couplerPointRatio, couplerPointOffset } = parameters;
  if ([ground, input, coupler, output].some((length) => length <= 0)) return null;

  const theta = toRadians(inputAngleDegrees);
  const inputJoint = {
    x: input * Math.cos(theta),
    y: input * Math.sin(theta),
  };
  const outputPivot = { x: ground, y: 0 };
  const dx = outputPivot.x - inputJoint.x;
  const dy = outputPivot.y - inputJoint.y;
  const centerDistance = Math.hypot(dx, dy);

  if (
    centerDistance > coupler + output + EPSILON ||
    centerDistance < Math.abs(coupler - output) - EPSILON ||
    centerDistance < EPSILON
  ) {
    return null;
  }

  const along =
    (coupler * coupler - output * output + centerDistance * centerDistance) /
    (2 * centerDistance);
  const heightSquared = Math.max(0, coupler * coupler - along * along);
  const height = Math.sqrt(heightSquared);
  const unitX = dx / centerDistance;
  const unitY = dy / centerDistance;
  const base = {
    x: inputJoint.x + along * unitX,
    y: inputJoint.y + along * unitY,
  };
  const branch = assemblyMode === "open" ? 1 : -1;
  const couplerJoint = {
    x: base.x - branch * height * unitY,
    y: base.y + branch * height * unitX,
  };

  const couplerX = couplerJoint.x - inputJoint.x;
  const couplerY = couplerJoint.y - inputJoint.y;
  const couplerLength = Math.hypot(couplerX, couplerY);
  const normalX = -couplerY / couplerLength;
  const normalY = couplerX / couplerLength;
  const couplerPoint = {
    x: inputJoint.x + couplerPointRatio * couplerX + couplerPointOffset * normalX,
    y: inputJoint.y + couplerPointRatio * couplerY + couplerPointOffset * normalY,
  };

  const vectorToInput = {
    x: inputJoint.x - couplerJoint.x,
    y: inputJoint.y - couplerJoint.y,
  };
  const vectorToPivot = {
    x: outputPivot.x - couplerJoint.x,
    y: outputPivot.y - couplerJoint.y,
  };
  const cosine = clamp(
    (vectorToInput.x * vectorToPivot.x + vectorToInput.y * vectorToPivot.y) /
      (coupler * output),
    -1,
    1,
  );
  const includedAngle = toDegrees(Math.acos(cosine));

  return {
    inputJoint,
    couplerJoint,
    couplerPoint,
    outputAngle: toDegrees(Math.atan2(couplerJoint.y, couplerJoint.x - ground)),
    transmissionAngle: Math.min(includedAngle, 180 - includedAngle),
  };
}

export function classifyFourBar(parameters: FourBarParameters) {
  const links = [
    { name: "ground", length: parameters.ground },
    { name: "input", length: parameters.input },
    { name: "coupler", length: parameters.coupler },
    { name: "output", length: parameters.output },
  ].sort((a, b) => a.length - b.length);
  const shortest = links[0];
  const longest = links[3];
  const grashof = shortest.length + longest.length <= links[1].length + links[2].length + EPSILON;

  if (!grashof) return { grashof, label: "双摇杆机构" };
  if (shortest.name === "ground") return { grashof, label: "双曲柄机构" };
  if (shortest.name === "input" || shortest.name === "output") {
    return { grashof, label: "曲柄摇杆机构" };
  }
  return { grashof, label: "双摇杆机构" };
}

export function analyzeMotion(parameters: FourBarParameters, assemblyMode: AssemblyMode): MotionAnalysis {
  const samples = 361;
  let valid = 0;
  let minimumTransmissionAngle = Number.POSITIVE_INFINITY;
  let minimumOutputAngle = Number.POSITIVE_INFINITY;
  let maximumOutputAngle = Number.NEGATIVE_INFINITY;
  let previousRawAngle: number | null = null;
  let previousUnwrappedAngle: number | null = null;
  let path = "";
  let drawingSegment = false;

  for (let index = 0; index < samples; index += 1) {
    const position = solveFourBar(parameters, index, assemblyMode);
    if (!position) {
      drawingSegment = false;
      continue;
    }

    valid += 1;
    minimumTransmissionAngle = Math.min(minimumTransmissionAngle, position.transmissionAngle);

    let unwrappedAngle = position.outputAngle;
    if (previousRawAngle !== null && previousUnwrappedAngle !== null) {
      let difference = position.outputAngle - previousRawAngle;
      if (difference > 180) difference -= 360;
      if (difference < -180) difference += 360;
      unwrappedAngle = previousUnwrappedAngle + difference;
    }
    previousRawAngle = position.outputAngle;
    previousUnwrappedAngle = unwrappedAngle;
    minimumOutputAngle = Math.min(minimumOutputAngle, unwrappedAngle);
    maximumOutputAngle = Math.max(maximumOutputAngle, unwrappedAngle);

    const command = drawingSegment ? "L" : "M";
    path += `${command}${position.couplerPoint.x.toFixed(2)},${(-position.couplerPoint.y).toFixed(2)} `;
    drawingSegment = true;
  }

  return {
    validRatio: valid / samples,
    outputSwing: valid > 0 ? maximumOutputAngle - minimumOutputAngle : 0,
    minimumTransmissionAngle: Number.isFinite(minimumTransmissionAngle)
      ? minimumTransmissionAngle
      : null,
    trailPath: path.trim(),
  };
}

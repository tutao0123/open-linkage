import {
  analyzeVariableLegMode,
  sampleVariableLeg,
} from "../lib/variable-leg";
import {
  changeVariableLegCount,
  variableLegMountX,
} from "../lib/variable-leg-gait";
import { createVariableLegReferenceProject } from "../lib/variable-leg-reference-library";

export const HOME_MECHANISM_FRAME_COUNT = 48;

const SOLVER_ITERATIONS = 90;
const METRIC_SAMPLE_COUNT = 72;
const VISUAL_SCALE = 0.72;

export type HomeMechanismPoint = [x: number, y: number];

export type HomeMechanismFrame = {
  phase: number;
  joints: HomeMechanismPoint[];
  tracer: HomeMechanismPoint;
  constraintError: number;
  singularityMargin: number;
};

export type HomeMechanismBar = {
  id: string;
  a: number;
  b: number;
  role: "driver" | "adjustment" | "link";
};

export type HomeMechanismBody = {
  id: string;
  joints: number[];
};

export type HomeMechanismLeg = {
  id: string;
  label: string;
  side: "left" | "right";
  station: number;
  phaseOffset: number;
  mountX: number;
};

export type HomeMechanismScene = {
  version: 1;
  source: {
    preset: "smooth";
    topology: "jansen";
    modeId: string;
  };
  viewBox: [x: number, y: number, width: number, height: number];
  topology: {
    jointIds: string[];
    fixedJoints: number[];
    bars: HomeMechanismBar[];
    bodies: HomeMechanismBody[];
  };
  frames: HomeMechanismFrame[];
  footPath: HomeMechanismPoint[];
  legs: HomeMechanismLeg[];
  anchor: HomeMechanismPoint;
  visualScale: number;
  chassis: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  groundY: number;
  metrics: {
    rpm: number;
    stepLength: number;
    liftHeight: number;
    stanceRatio: number;
    stanceStart: number;
    stanceEnd: number;
    targetPhaseOffset: number;
  };
  solver: {
    status: "ready";
    frameSamples: number;
    metricSamples: number;
    iterations: number;
    validRatio: number;
    maxConstraintError: number;
    minimumSingularityMargin: number;
  };
};

function round(value: number, precision = 3) {
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function point(x: number, y: number): HomeMechanismPoint {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("The home mechanism solver returned a non-finite coordinate");
  }
  return [round(x), round(y)];
}

function averageFixedPoint(
  joints: Array<{ x: number; y: number; fixed: boolean }>,
): HomeMechanismPoint {
  const fixed = joints.filter((joint) => joint.fixed);
  if (!fixed.length) return [0, 0];
  const total = fixed.reduce(
    (sum, joint) => ({ x: sum.x + joint.x, y: sum.y + joint.y }),
    { x: 0, y: 0 },
  );
  return point(total.x / fixed.length, total.y / fixed.length);
}

/**
 * Builds the serializable payload consumed by the homepage Client Component.
 * Keep solver and reference-library imports in this server-side preparation
 * module; the preview imports only the erased HomeMechanismScene type.
 */
export function createHomeMechanismScene(): HomeMechanismScene {
  const project = createVariableLegReferenceProject("smooth");
  if (project.topology !== "jansen") {
    throw new Error("The smooth homepage reference must use the Jansen topology");
  }

  const mode = project.modes.find((candidate) => candidate.id === project.activeModeId);
  if (!mode) throw new Error("The smooth homepage reference has no active mode");

  const samples = sampleVariableLeg(
    project.baseProject,
    project.adjustment,
    mode.adjustmentValue,
    HOME_MECHANISM_FRAME_COUNT,
    SOLVER_ITERATIONS,
  );
  const metrics = analyzeVariableLegMode(
    project.baseProject,
    project.adjustment,
    mode,
    METRIC_SAMPLE_COUNT,
    SOLVER_ITERATIONS,
  );
  if (samples.length !== HOME_MECHANISM_FRAME_COUNT) {
    throw new Error(`Expected ${HOME_MECHANISM_FRAME_COUNT} homepage mechanism frames`);
  }
  if (metrics.validRatio < 0.99 || metrics.branchSwitches !== 0) {
    throw new Error("The smooth homepage reference did not pass its solver checks");
  }

  const jointIds = project.baseProject.joints.map((joint) => joint.id);
  const jointIndex = new Map(jointIds.map((id, index) => [id, index]));
  const frames = samples.map<HomeMechanismFrame>((sample) => {
    const solvedJoints = new Map(sample.project.joints.map((joint) => [joint.id, joint]));
    const joints = jointIds.map((id) => {
      const solved = solvedJoints.get(id);
      if (!solved) throw new Error(`Solved homepage frame is missing joint ${id}`);
      return point(solved.x, solved.y);
    });
    if (!sample.tracer) throw new Error("Solved homepage frame is missing its foot tracer");
    if (!Number.isFinite(sample.error) || !Number.isFinite(sample.singularityMargin)) {
      throw new Error("The home mechanism solver returned a non-finite metric");
    }
    return {
      phase: round(sample.phase, 6),
      joints,
      tracer: point(sample.tracer.x, sample.tracer.y),
      constraintError: round(sample.error, 6),
      singularityMargin: round(sample.singularityMargin, 6),
    };
  });

  const deployment = changeVariableLegCount(project.deployment, 4);
  const legs = deployment.legs
    .map<HomeMechanismLeg>((leg) => ({
      id: leg.id,
      label: leg.label,
      side: leg.side,
      station: leg.station,
      phaseOffset: round(leg.phaseOffset, 6),
      mountX: round(variableLegMountX(leg, deployment)),
    }))
    .sort((first, second) => (
      (first.side === second.side ? 0 : first.side === "right" ? -1 : 1)
      || first.station - second.station
    ));

  const fixedJoints = project.baseProject.joints.flatMap((joint, index) => (
    joint.fixed ? [index] : []
  ));
  const topology = {
    jointIds,
    fixedJoints,
    bars: project.baseProject.bars.map<HomeMechanismBar>((bar) => {
      const a = jointIndex.get(bar.a);
      const b = jointIndex.get(bar.b);
      if (a === undefined || b === undefined) {
        throw new Error(`Homepage topology bar ${bar.id} has a missing endpoint`);
      }
      return {
        id: bar.id,
        a,
        b,
        role: bar.id === project.baseProject.driverId
          ? "driver"
          : bar.id === project.adjustment.targetId
            ? "adjustment"
            : "link",
      };
    }),
    bodies: project.baseProject.bodies.map<HomeMechanismBody>((body) => ({
      id: body.id,
      joints: body.jointIds.map((id) => {
        const index = jointIndex.get(id);
        if (index === undefined) throw new Error(`Homepage body ${body.id} is missing joint ${id}`);
        return index;
      }),
    })),
  };

  const anchor = averageFixedPoint(project.baseProject.joints);
  const fixed = project.baseProject.joints.filter((joint) => joint.fixed);
  const minimumX = Math.min(...fixed.map((joint) => joint.x));
  const maximumX = Math.max(...fixed.map((joint) => joint.x));
  const chassis = {
    x: round(minimumX - deployment.mountSpan / 2 - 34),
    y: round(anchor[1] - 42),
    width: round(maximumX - minimumX + deployment.mountSpan + 68),
    height: 64,
  };
  const minimumSingularityMargin = Math.min(...frames.map((frame) => frame.singularityMargin));

  return {
    version: 1,
    source: {
      preset: "smooth",
      topology: project.topology,
      modeId: mode.id,
    },
    viewBox: [-440, -145, 880, 520],
    topology,
    frames,
    footPath: frames.map((frame) => [...frame.tracer]),
    legs,
    anchor,
    visualScale: VISUAL_SCALE,
    chassis,
    groundY: round(anchor[1] + (metrics.stanceGroundY - anchor[1]) * VISUAL_SCALE + 10),
    metrics: {
      rpm: round(mode.rpm, 3),
      stepLength: round(metrics.stepLength, 3),
      liftHeight: round(metrics.liftHeight, 3),
      stanceRatio: round(metrics.stanceRatio, 6),
      stanceStart: round(mode.stanceStart, 6),
      stanceEnd: round(mode.stanceEnd, 6),
      targetPhaseOffset: round(metrics.targetPhaseOffset, 6),
    },
    solver: {
      status: "ready",
      frameSamples: HOME_MECHANISM_FRAME_COUNT,
      metricSamples: METRIC_SAMPLE_COUNT,
      iterations: SOLVER_ITERATIONS,
      validRatio: round(metrics.validRatio, 6),
      maxConstraintError: round(metrics.maxConstraintError, 6),
      minimumSingularityMargin: round(minimumSingularityMargin, 6),
    },
  };
}

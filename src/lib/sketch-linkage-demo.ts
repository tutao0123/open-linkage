import { solveFourBar, type Point } from "./four-bar";
import { solveGearedFiveBar } from "./geared-five-bar";
import { createDualGrooveCam, solveDualGrooveCam, type DualGrooveCamParameters } from "./dual-groove-cam";
import {
  fitXYDrawingMechanism,
  sampleXYDrawingTrajectory,
  type XYDrawingMechanismParameters,
} from "./xy-drawing-mechanism";
import {
  fitFourierEpicycle,
  sampleFourierEpicycleTrajectory,
  type FourierEpicycleParameters,
} from "./fourier-epicycle";
import {
  ACTIVE_SKETCH_TARGET_CURVE,
  applySimilarity,
  resampleClosedCurve,
  type FourBarSketchCandidate,
  type GearedFiveBarSketchCandidate,
  type MechanismFamily,
  type SketchLinkageCandidate,
} from "./sketch-linkage";

export type DemoMechanismFamily = MechanismFamily | "gear-synchronized-xy" | "dual-groove-cam" | "fourier-epicycle";

export type XYDrawingDemoCandidate = {
  id: string;
  family: "gear-synchronized-xy";
  parameters: XYDrawingMechanismParameters;
  trajectory: Point[];
  normalizedRmse: number;
};

export type DualCamDemoCandidate = {
  id: string;
  family: "dual-groove-cam";
  parameters: DualGrooveCamParameters;
  trajectory: Point[];
  normalizedRmse: number;
};

export type FourierEpicycleDemoCandidate = {
  id: string;
  family: "fourier-epicycle";
  parameters: FourierEpicycleParameters;
  trajectory: Point[];
  normalizedRmse: number;
};

export type SketchDemoCandidate = SketchLinkageCandidate | XYDrawingDemoCandidate | DualCamDemoCandidate | FourierEpicycleDemoCandidate;

type CandidateSeed =
  | Omit<FourBarSketchCandidate, "trajectory">
  | Omit<GearedFiveBarSketchCandidate, "trajectory">;

const SEEDS: CandidateSeed[] = [
  {
    id: "trojan-geared-five-bar-1",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 70.15232061248022,
      leftCoupler: 112.41022601915903,
      rightCoupler: 140.96567924047994,
      rightInput: 70.34926026440411,
      gearRatio: -1,
      gearPhase: 133.9675269058207,
      couplerPointRatio: 0.6437376732763145,
      couplerPointOffset: -43.13375298244584,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.0707773836361967,
      rotation: 2.8594406962169234,
      translation: { x: 374.4490521135418, y: 460.85110645931184 },
    },
    phaseIndex: 32,
    direction: -1,
    rmse: 59.30583617418985,
    normalizedRmse: 0.09941716990343433,
    minimumTransmissionAngle: 12.083892747596684,
  },
  {
    id: "trojan-geared-five-bar-2",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 71.25073477800686,
      leftCoupler: 108.95487844540186,
      rightCoupler: 139.951758182302,
      rightInput: 71.34130475274473,
      gearRatio: -1,
      gearPhase: 133.6006871914724,
      couplerPointRatio: 0.6493716841724011,
      couplerPointOffset: -44.151045964785695,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.0709778618591965,
      rotation: 2.8426822878780778,
      translation: { x: 374.3902717540002, y: 459.19058884261784 },
    },
    phaseIndex: 32,
    direction: -1,
    rmse: 59.30999588044485,
    normalizedRmse: 0.0994241430151916,
    minimumTransmissionAngle: 11.257727710645584,
  },
  {
    id: "trojan-geared-five-bar-3",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 70.45320552198898,
      leftCoupler: 111.40867416454859,
      rightCoupler: 140.22308725516487,
      rightInput: 70.84356625271215,
      gearRatio: -1,
      gearPhase: 134.2257589061046,
      couplerPointRatio: 0.6434812879583108,
      couplerPointOffset: -42.269399361439824,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.0758262374157344,
      rotation: 2.862421018715056,
      translation: { x: 374.8029484231902, y: 459.1066587948836 },
    },
    phaseIndex: 32,
    direction: -1,
    rmse: 59.31233321077677,
    normalizedRmse: 0.09942806119225005,
    minimumTransmissionAngle: 11.793841401807953,
  },
  {
    id: "trojan-four-bar-1",
    family: "four-bar",
    parameters: {
      ground: 100,
      input: 80.13475523106125,
      coupler: 132.87249986422688,
      output: 124.31957344963061,
      couplerPointRatio: 0.9968275520988067,
      couplerPointOffset: 106.72725421857707,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.129265655154147,
      rotation: -2.942733871464224,
      translation: { x: 575.252210885465, y: 501.1021294080479 },
    },
    phaseIndex: 21,
    direction: 1,
    rmse: 59.61498599135799,
    normalizedRmse: 0.09993541232073619,
    minimumTransmissionAngle: 7.999484312343714,
  },
];

function buildTrajectory(seed: CandidateSeed) {
  const raw: Point[] = [];
  for (let index = 0; index < 144; index += 1) {
    const angle = index / 144 * 360;
    const position = seed.family === "four-bar"
      ? solveFourBar(seed.parameters, angle, seed.assemblyMode)
      : solveGearedFiveBar(seed.parameters, angle, seed.assemblyMode);
    if (!position) throw new Error(`Invalid precomputed candidate: ${seed.id}`);
    raw.push({ x: position.couplerPoint.x, y: -position.couplerPoint.y });
  }
  const sampled = resampleClosedCurve(raw, 64);
  return sampled.map((_, index) => {
    const sourceIndex = (seed.phaseIndex + seed.direction * index + sampled.length * 2) % sampled.length;
    return applySimilarity(sampled[sourceIndex], seed.transform);
  });
}

const LINKAGE_CANDIDATES: SketchLinkageCandidate[] = SEEDS.map((seed) => {
  const trajectory = buildTrajectory(seed);
  return seed.family === "four-bar"
    ? { ...seed, trajectory }
    : { ...seed, trajectory };
});

const xyParameters = fitXYDrawingMechanism(ACTIVE_SKETCH_TARGET_CURVE, { harmonicCount: 16, sampleCount: 192 });
const XY_CANDIDATE: XYDrawingDemoCandidate = {
  id: "trojan-gear-synchronized-xy-1",
  family: "gear-synchronized-xy",
  parameters: xyParameters,
  trajectory: sampleXYDrawingTrajectory(xyParameters, 192),
  normalizedRmse: xyParameters.normalizedRmse,
};

const camParameters = createDualGrooveCam(ACTIVE_SKETCH_TARGET_CURVE, { sampleCount: 192 });
const CAM_CANDIDATE: DualCamDemoCandidate = {
  id: "trojan-dual-groove-cam-1",
  family: "dual-groove-cam",
  parameters: camParameters,
  trajectory: Array.from({ length: 192 }, (_, index) =>
    solveDualGrooveCam(camParameters, index * 360 / 192).crossSlide.drawingPoint),
  normalizedRmse: 0,
};

const epicycleParameters = fitFourierEpicycle(ACTIVE_SKETCH_TARGET_CURVE, { sampleCount: 192, termCount: 28 });
const EPICYCLE_CANDIDATE: FourierEpicycleDemoCandidate = {
  id: "trojan-fourier-epicycle-1",
  family: "fourier-epicycle",
  parameters: epicycleParameters,
  trajectory: sampleFourierEpicycleTrajectory(epicycleParameters, 192),
  normalizedRmse: epicycleParameters.normalizedRmse,
};

export const PRECOMPUTED_SKETCH_CANDIDATES: SketchDemoCandidate[] = [
  CAM_CANDIDATE,
  XY_CANDIDATE,
  EPICYCLE_CANDIDATE,
  ...LINKAGE_CANDIDATES,
];

export function precomputedCandidatesFor(family: DemoMechanismFamily | "compare") {
  return family === "compare"
    ? PRECOMPUTED_SKETCH_CANDIDATES
    : PRECOMPUTED_SKETCH_CANDIDATES.filter((candidate) => candidate.family === family);
}

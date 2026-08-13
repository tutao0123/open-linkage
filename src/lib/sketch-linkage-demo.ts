import { solveFourBar, type Point } from "./four-bar";
import { solveGearedFiveBar } from "./geared-five-bar";
import {
  applySimilarity,
  resampleClosedCurve,
  type FourBarSketchCandidate,
  type GearedFiveBarSketchCandidate,
  type MechanismFamily,
  type SketchLinkageCandidate,
} from "./sketch-linkage";

type CandidateSeed =
  | Omit<FourBarSketchCandidate, "trajectory">
  | Omit<GearedFiveBarSketchCandidate, "trajectory">;

const SEEDS: CandidateSeed[] = [
  {
    id: "cat-geared-five-bar-1",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 54.76600531785441,
      leftCoupler: 128.91286378640586,
      rightCoupler: 138.14636027403668,
      rightInput: 56.46410008376207,
      gearRatio: -1,
      gearPhase: 336.30385890155776,
      couplerPointRatio: 0.77628984180299,
      couplerPointOffset: 146.58337428056828,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.261430919618903,
      rotation: 1.0117255449630689,
      translation: { x: 188.82666050018622, y: -39.339250108537726 },
    },
    phaseIndex: 5,
    direction: 1,
    rmse: 30.49603888931023,
    normalizedRmse: 0.053364337364811124,
    minimumTransmissionAngle: 42.04982126860428,
  },
  {
    id: "cat-geared-five-bar-2",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 47.10882600030585,
      leftCoupler: 142.13030845717236,
      rightCoupler: 131.27802854805182,
      rightInput: 55.64522461379774,
      gearRatio: -1,
      gearPhase: 355.01041563941567,
      couplerPointRatio: 0.6622988898414695,
      couplerPointOffset: 142.46265578264442,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.628790331567574,
      rotation: 1.1970875254726665,
      translation: { x: 170.6264297613069, y: -85.64137769644498 },
    },
    phaseIndex: 8,
    direction: 1,
    rmse: 30.573923090697825,
    normalizedRmse: 0.05350062518938146,
    minimumTransmissionAngle: 38.79391289780164,
  },
  {
    id: "cat-geared-five-bar-3",
    family: "geared-five-bar",
    parameters: {
      ground: 100,
      leftInput: 54.61083083600323,
      leftCoupler: 153.83920918626245,
      rightCoupler: 116.6314673935535,
      rightInput: 57.67928429081574,
      gearRatio: -1,
      gearPhase: 2.145147714825214,
      couplerPointRatio: 0.8589826638375503,
      couplerPointOffset: 147.18143513338876,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 2.1936629593152785,
      rotation: 1.2750113337765372,
      translation: { x: 180.30775554271625, y: -75.43437932985296 },
    },
    phaseIndex: 9,
    direction: 1,
    rmse: 30.78579959947154,
    normalizedRmse: 0.05387138316011065,
    minimumTransmissionAngle: 39.03002738795285,
  },
  {
    id: "cat-four-bar-1",
    family: "four-bar",
    parameters: {
      ground: 100,
      input: 49.91056668395322,
      coupler: 131.93390032401575,
      output: 87.58809958396934,
      couplerPointRatio: 0.9626509438124194,
      couplerPointOffset: 90.4069286404219,
    },
    assemblyMode: "crossed",
    transform: {
      scale: 4.207505942740663,
      rotation: 0.21004409952985845,
      translation: { x: -365.9863493524806, y: 129.47773082893934 },
    },
    phaseIndex: 27,
    direction: 1,
    rmse: 31.315859632266758,
    normalizedRmse: 0.05479892337332837,
    minimumTransmissionAngle: 12.437562456945233,
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

export const PRECOMPUTED_SKETCH_CANDIDATES: SketchLinkageCandidate[] = SEEDS.map((seed) => {
  const trajectory = buildTrajectory(seed);
  return seed.family === "four-bar"
    ? { ...seed, trajectory }
    : { ...seed, trajectory };
});

export function precomputedCandidatesFor(family: MechanismFamily | "compare") {
  return family === "compare"
    ? PRECOMPUTED_SKETCH_CANDIDATES
    : PRECOMPUTED_SKETCH_CANDIDATES.filter((candidate) => candidate.family === family);
}

import type { Point } from "./four-bar";
import type { SixBarCandidate, SynthesisPriority } from "./six-bar-synthesis";
import type { SixBarParameters } from "./six-bar";

export const SIX_BAR_STORAGE_KEY = "open-linkage:six-bar-project:v3";
export const LEGACY_SIX_BAR_STORAGE_KEY = "open-linkage:six-bar-project:v2";

export type SixBarProject = {
  version: 3;
  mechanismType: "six-bar-leg";
  parameters: SixBarParameters;
  inputAngle: number;
  speed: number;
  targetPath: Point[];
  priority: SynthesisPriority;
  candidates: SixBarCandidate[];
};

function hasValidParameters(project: { parameters?: SixBarParameters }) {
  if (!project.parameters || !Object.values(project.parameters).every(Number.isFinite)) return false;
  return [
    project.parameters.groundPivot,
    project.parameters.crank,
    project.parameters.firstCoupler,
    project.parameters.firstRocker,
    project.parameters.secondCoupler,
    project.parameters.secondRocker,
  ].every((value) => value > 0);
}

function isPriority(value: unknown): value is SynthesisPriority {
  return value === "balanced" || value === "accuracy" || value === "transmission";
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return typeof point.x === "number"
    && Number.isFinite(point.x)
    && typeof point.y === "number"
    && Number.isFinite(point.y);
}

function isCandidate(value: unknown): value is SixBarCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SixBarCandidate>;
  return typeof candidate.id === "string"
    && typeof candidate.label === "string"
    && typeof candidate.phase === "number"
    && (candidate.direction === 1 || candidate.direction === -1)
    && typeof candidate.workAngleSpan === "number"
    && candidate.workAngleSpan >= 60
    && candidate.workAngleSpan <= 300
    && Array.isArray(candidate.generatedPath)
    && hasValidParameters({ parameters: candidate.parameters });
}

export function parseSixBarProject(value: unknown): { project: SixBarProject; migrated: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const source = value as {
    version?: unknown;
    mechanismType?: unknown;
    parameters?: SixBarParameters;
    inputAngle?: unknown;
    speed?: unknown;
    targetPath?: unknown;
    priority?: unknown;
    candidates?: unknown;
  };
  if (source.mechanismType !== "six-bar-leg" || !hasValidParameters(source)) return null;
  if (
    typeof source.inputAngle !== "number"
    || !Number.isFinite(source.inputAngle)
    || typeof source.speed !== "number"
    || !Number.isFinite(source.speed)
  ) return null;

  if (source.version === 2) {
    return {
      migrated: true,
      project: {
        version: 3,
        mechanismType: "six-bar-leg",
        parameters: source.parameters as SixBarParameters,
        inputAngle: source.inputAngle,
        speed: source.speed,
        targetPath: [],
        priority: isPriority(source.priority) ? source.priority : "balanced",
        candidates: [],
      },
    };
  }

  if (source.version !== 3) return null;
  return {
    migrated: false,
    project: {
      version: 3,
      mechanismType: "six-bar-leg",
      parameters: source.parameters as SixBarParameters,
      inputAngle: source.inputAngle,
      speed: source.speed,
      targetPath: Array.isArray(source.targetPath) ? source.targetPath.filter(isPoint) : [],
      priority: isPriority(source.priority) ? source.priority : "balanced",
      candidates: Array.isArray(source.candidates) ? source.candidates.filter(isCandidate) : [],
    },
  };
}

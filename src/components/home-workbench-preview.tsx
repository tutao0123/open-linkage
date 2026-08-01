import {
  FOUR_BAR_PROJECT,
  JANSEN_PROJECT,
  KLANN_PROJECT,
  MULTI_JOINT_BODY_PROJECT,
  PEAUCELLIER_PROJECT,
  resolveTracerPoint,
  solveFreeMechanism,
  type FreeMechanismProject,
} from "@/lib/free-mechanism";
import type { PreviewKind } from "./home-content";
import styles from "./home-workbench-preview.module.css";

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 180;
const VIEWBOX_PADDING = 24;
const SOLVER_ITERATIONS = 360;

type Point = { x: number; y: number };

type PreviewConfig = {
  project: FreeMechanismProject;
  phase: number;
};

type PreviewJoint = Point & {
  id: string;
  fixed: boolean;
};

type PreviewSegment = {
  id: string;
  a: Point;
  b: Point;
  driver: boolean;
};

type PreviewScene = {
  joints: PreviewJoint[];
  bars: PreviewSegment[];
  bodyEdges: PreviewSegment[];
  tracer: Point | null;
};

const PREVIEW_CONFIGS = {
  "four-bar": { project: FOUR_BAR_PROJECT, phase: Math.PI * 0.27 },
  "six-bar": { project: KLANN_PROJECT, phase: Math.PI * 0.41 },
  "variable-leg": { project: JANSEN_PROJECT, phase: Math.PI * 0.67 },
  "straight-line": { project: PEAUCELLIER_PROJECT, phase: 0 },
  "free-mechanism": { project: MULTI_JOINT_BODY_PROJECT, phase: Math.PI * 0.35 },
} satisfies Record<PreviewKind, PreviewConfig>;

function isFinitePoint(point: Point | null | undefined): point is Point {
  return point !== null
    && point !== undefined
    && Number.isFinite(point.x)
    && Number.isFinite(point.y);
}

function roundCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function createPointNormalizer(points: Point[]) {
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  const spanX = Math.max(1, maximumX - minimumX);
  const spanY = Math.max(1, maximumY - minimumY);
  const availableWidth = VIEWBOX_WIDTH - VIEWBOX_PADDING * 2;
  const availableHeight = VIEWBOX_HEIGHT - VIEWBOX_PADDING * 2;
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY);
  const offsetX = (VIEWBOX_WIDTH - spanX * scale) / 2;
  const offsetY = (VIEWBOX_HEIGHT - spanY * scale) / 2;

  return (point: Point): Point => ({
    x: roundCoordinate(offsetX + (point.x - minimumX) * scale),
    y: roundCoordinate(offsetY + (point.y - minimumY) * scale),
  });
}

function createPreviewScene({ project, phase }: PreviewConfig): PreviewScene {
  const solvedJoints = solveFreeMechanism(project, phase, SOLVER_ITERATIONS)
    .filter((joint) => isFinitePoint(joint));
  const solvedProject = { ...project, joints: solvedJoints };
  const solvedTracer = resolveTracerPoint(solvedProject);
  const tracer = isFinitePoint(solvedTracer) ? solvedTracer : null;
  const normalizer = createPointNormalizer(tracer ? [...solvedJoints, tracer] : solvedJoints);
  const joints = solvedJoints.map((joint) => ({
    id: joint.id,
    fixed: joint.fixed,
    ...normalizer(joint),
  }));
  const normalizedById = new Map(joints.map((joint) => [joint.id, joint]));

  const bars = project.bars.flatMap((bar): PreviewSegment[] => {
    const a = normalizedById.get(bar.a);
    const b = normalizedById.get(bar.b);
    if (!a || !b) return [];
    return [{ id: bar.id, a, b, driver: bar.id === project.driverId }];
  });
  const bodyEdges = project.bodies.flatMap((body) => body.pairs.flatMap((pair): PreviewSegment[] => {
    const a = normalizedById.get(pair.a);
    const b = normalizedById.get(pair.b);
    if (!a || !b) return [];
    return [{ id: `${body.id}:${pair.a}:${pair.b}`, a, b, driver: false }];
  }));

  return {
    joints,
    bars,
    bodyEdges,
    tracer: tracer ? normalizer(tracer) : null,
  };
}

const PREVIEW_SCENES = {
  "four-bar": createPreviewScene(PREVIEW_CONFIGS["four-bar"]),
  "six-bar": createPreviewScene(PREVIEW_CONFIGS["six-bar"]),
  "variable-leg": createPreviewScene(PREVIEW_CONFIGS["variable-leg"]),
  "straight-line": createPreviewScene(PREVIEW_CONFIGS["straight-line"]),
  "free-mechanism": createPreviewScene(PREVIEW_CONFIGS["free-mechanism"]),
} satisfies Record<PreviewKind, PreviewScene>;

export function HomeWorkbenchPreview({
  kind,
  className,
}: {
  kind: PreviewKind;
  className?: string;
}) {
  const scene = PREVIEW_SCENES[kind];
  const rootClassName = [styles.preview, className].filter(Boolean).join(" ");

  return (
    <svg
      className={rootClassName}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-preview-kind={kind}
    >
      <rect className={styles.surface} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx="12" />
      <path className={styles.grid} d="M16 45H304M16 90H304M16 135H304M80 12V168M160 12V168M240 12V168" />

      <g className={styles.mechanism}>
        {scene.bodyEdges.map((edge) => (
          <line
            key={edge.id}
            className={styles.bodyEdge}
            x1={edge.a.x}
            y1={edge.a.y}
            x2={edge.b.x}
            y2={edge.b.y}
          />
        ))}
        {scene.bars.map((bar) => (
          <line
            key={bar.id}
            className={bar.driver ? styles.driver : styles.bar}
            x1={bar.a.x}
            y1={bar.a.y}
            x2={bar.b.x}
            y2={bar.b.y}
          />
        ))}
        {scene.joints.map((joint) => joint.fixed ? (
          <g key={joint.id}>
            <path
              className={styles.fixedMount}
              d={`M${joint.x - 8} ${joint.y + 12}L${joint.x} ${joint.y + 3}L${joint.x + 8} ${joint.y + 12}Z`}
            />
            <circle className={styles.fixedJoint} cx={joint.x} cy={joint.y} r="5" />
          </g>
        ) : (
          <circle
            key={joint.id}
            className={styles.movableJoint}
            cx={joint.x}
            cy={joint.y}
            r="4"
          />
        ))}
        {scene.tracer ? (
          <g className={styles.tracer}>
            <circle cx={scene.tracer.x} cy={scene.tracer.y} r="9" />
            <circle cx={scene.tracer.x} cy={scene.tracer.y} r="2.5" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}

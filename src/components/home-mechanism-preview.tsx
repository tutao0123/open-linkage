"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  HomeMechanismLeg,
  HomeMechanismPoint,
  HomeMechanismScene,
} from "./home-mechanism-scene";
import styles from "./home-mechanism-preview.module.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FRAME_INTERVAL = 1000 / 30;

export type HomeMechanismPreviewLabels = {
  sceneAriaLabel: string;
  playAriaLabel: string;
  pauseAriaLabel: string;
  phaseLabel: string;
  solverLabel: string;
  solverReadyLabel: string;
  trajectoryLabel: string;
};

export type HomeMechanismPreviewProps = {
  scene: HomeMechanismScene;
  labels: HomeMechanismPreviewLabels;
  className?: string;
};

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function serverReducedMotionSnapshot() {
  return false;
}

function normalizeCycle(value: number) {
  return ((value % 1) + 1) % 1;
}

function inStance(scene: HomeMechanismScene, legPhase: number) {
  const phase = normalizeCycle(legPhase + scene.metrics.targetPhaseOffset);
  const start = normalizeCycle(scene.metrics.stanceStart);
  const end = normalizeCycle(scene.metrics.stanceEnd);
  return start <= end
    ? phase >= start && phase <= end
    : phase >= start || phase <= end;
}

function frameForLeg(scene: HomeMechanismScene, leg: HomeMechanismLeg) {
  const index = Math.floor(normalizeCycle(leg.phaseOffset) * scene.frames.length);
  return scene.frames[index] ?? scene.frames[0];
}

function pathData(points: HomeMechanismPoint[]) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
}

function groupTransform(scene: HomeMechanismScene, mountX: number) {
  const [anchorX, anchorY] = scene.anchor;
  return `translate(${mountX} 0) translate(${anchorX} ${anchorY}) scale(${scene.visualScale}) translate(${-anchorX} ${-anchorY})`;
}

export function HomeMechanismPreview({
  scene,
  labels,
  className,
}: HomeMechanismPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const phaseTextRef = useRef<HTMLSpanElement>(null);
  const legRefs = useRef<Array<SVGGElement | null>>([]);
  const barRefs = useRef<Array<SVGLineElement | null>>([]);
  const bodyRefs = useRef<Array<SVGPolygonElement | null>>([]);
  const jointRefs = useRef<Array<SVGGElement | null>>([]);
  const tracerRefs = useRef<Array<SVGCircleElement | null>>([]);
  const phaseRef = useRef(0);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    serverReducedMotionSnapshot,
  );
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(null);
  const isPlaying = playbackOverride ?? !prefersReducedMotion;
  const instanceId = useId().replace(/:/g, "");
  const gridId = `${instanceId}-home-mechanism-grid`;
  const titleId = `${instanceId}-home-mechanism-title`;
  const footPath = pathData(scene.footPath);
  const fixedJoints = new Set(scene.topology.fixedJoints);
  const barCount = scene.topology.bars.length;
  const bodyCount = scene.topology.bodies.length;
  const jointCount = scene.topology.jointIds.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isPlaying || scene.frames.length < 2) return;

    let animationFrame: number | null = null;
    let intersecting = typeof IntersectionObserver === "undefined";
    let previousUpdate = performance.now();
    const jointBuffers = scene.legs.map(() => new Float64Array(jointCount * 2));

    const renderFrame = (phase: number) => {
      for (let legIndex = 0; legIndex < scene.legs.length; legIndex += 1) {
        const leg = scene.legs[legIndex];
        const legPhase = normalizeCycle(phase + leg.phaseOffset);
        const framePosition = legPhase * scene.frames.length;
        const frameIndex = Math.floor(framePosition) % scene.frames.length;
        const nextIndex = (frameIndex + 1) % scene.frames.length;
        const mix = framePosition - Math.floor(framePosition);
        const current = scene.frames[frameIndex];
        const next = scene.frames[nextIndex];
        const buffer = jointBuffers[legIndex];

        for (let jointIndex = 0; jointIndex < jointCount; jointIndex += 1) {
          const currentPoint = current.joints[jointIndex];
          const nextPoint = next.joints[jointIndex];
          buffer[jointIndex * 2] = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * mix;
          buffer[jointIndex * 2 + 1] = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * mix;
        }

        for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
          const bar = scene.topology.bars[barIndex];
          const element = barRefs.current[legIndex * barCount + barIndex];
          if (!element) continue;
          element.setAttribute("x1", buffer[bar.a * 2].toFixed(2));
          element.setAttribute("y1", buffer[bar.a * 2 + 1].toFixed(2));
          element.setAttribute("x2", buffer[bar.b * 2].toFixed(2));
          element.setAttribute("y2", buffer[bar.b * 2 + 1].toFixed(2));
        }

        for (let bodyIndex = 0; bodyIndex < bodyCount; bodyIndex += 1) {
          const body = scene.topology.bodies[bodyIndex];
          const element = bodyRefs.current[legIndex * bodyCount + bodyIndex];
          if (!element) continue;
          element.setAttribute("points", body.joints.map((jointIndex) => (
            `${buffer[jointIndex * 2].toFixed(2)},${buffer[jointIndex * 2 + 1].toFixed(2)}`
          )).join(" "));
        }

        for (let jointIndex = 0; jointIndex < jointCount; jointIndex += 1) {
          const element = jointRefs.current[legIndex * jointCount + jointIndex];
          if (!element) continue;
          element.setAttribute(
            "transform",
            `translate(${buffer[jointIndex * 2].toFixed(2)} ${buffer[jointIndex * 2 + 1].toFixed(2)})`,
          );
        }

        const tracerX = current.tracer[0] + (next.tracer[0] - current.tracer[0]) * mix;
        const tracerY = current.tracer[1] + (next.tracer[1] - current.tracer[1]) * mix;
        const tracer = tracerRefs.current[legIndex];
        tracer?.setAttribute("cx", tracerX.toFixed(2));
        tracer?.setAttribute("cy", tracerY.toFixed(2));
        const legGroup = legRefs.current[legIndex];
        if (legGroup) legGroup.dataset.stance = String(inStance(scene, legPhase));
      }

      if (phaseTextRef.current) {
        phaseTextRef.current.textContent = `${labels.phaseLabel} ${Math.round(phase * 360).toString().padStart(3, "0")}°`;
      }
    };

    const tick = (now: number) => {
      animationFrame = null;
      if (!intersecting || document.hidden) return;
      const elapsed = now - previousUpdate;
      if (elapsed >= FRAME_INTERVAL) {
        phaseRef.current = normalizeCycle(
          phaseRef.current + Math.min(elapsed, 100) / 1000 * scene.metrics.rpm / 60,
        );
        previousUpdate = now - elapsed % FRAME_INTERVAL;
        renderFrame(phaseRef.current);
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (animationFrame !== null || !intersecting || document.hidden) return;
      previousUpdate = performance.now();
      animationFrame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      if (animationFrame === null) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        if (intersecting) start();
        else stop();
      }, { threshold: 0.05 });

    observer?.observe(root);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!observer) start();

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [barCount, bodyCount, isPlaying, jointCount, labels.phaseLabel, scene]);

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.preview} ${className}` : styles.preview}
      data-playing={isPlaying}
    >
      <div className={styles.header} aria-hidden="true">
        <span>LINKAGE / 4-LEG WALK</span>
        <span ref={phaseTextRef}>{labels.phaseLabel} 000°</span>
      </div>

      <svg
        className={styles.canvas}
        viewBox={scene.viewBox.join(" ")}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{labels.sceneAriaLabel}</title>
        <defs>
          <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" className={styles.gridLine} />
          </pattern>
        </defs>
        <rect
          x={scene.viewBox[0]}
          y={scene.viewBox[1]}
          width={scene.viewBox[2]}
          height={scene.viewBox[3]}
          fill={`url(#${gridId})`}
        />
        <line
          className={styles.ground}
          x1={scene.viewBox[0]}
          y1={scene.groundY}
          x2={scene.viewBox[0] + scene.viewBox[2]}
          y2={scene.groundY}
        />

        <g aria-hidden="true">
          {scene.legs.map((leg) => (
            <path
              key={`path-${leg.id}`}
              className={styles.trajectory}
              data-side={leg.side}
              d={footPath}
              pathLength="1"
              transform={groupTransform(scene, leg.mountX)}
            />
          ))}
        </g>

        {scene.legs.map((leg, legIndex) => {
          const frame = frameForLeg(scene, leg);
          return (
            <g
              key={leg.id}
              ref={(element) => { legRefs.current[legIndex] = element; }}
              className={styles.leg}
              data-side={leg.side}
              data-stance={inStance(scene, leg.phaseOffset)}
              aria-hidden="true"
            >
              <g transform={groupTransform(scene, leg.mountX)}>
                {scene.topology.bodies.map((body, bodyIndex) => (
                  <polygon
                    key={body.id}
                    ref={(element) => {
                      bodyRefs.current[legIndex * bodyCount + bodyIndex] = element;
                    }}
                    className={styles.body}
                    points={body.joints.map((jointIndex) => frame.joints[jointIndex].join(",")).join(" ")}
                  />
                ))}
                {scene.topology.bars.map((bar, barIndex) => {
                  const a = frame.joints[bar.a];
                  const b = frame.joints[bar.b];
                  return (
                    <line
                      key={bar.id}
                      ref={(element) => {
                        barRefs.current[legIndex * barCount + barIndex] = element;
                      }}
                      className={`${styles.bar} ${styles[bar.role]}`}
                      x1={a[0]}
                      y1={a[1]}
                      x2={b[0]}
                      y2={b[1]}
                    />
                  );
                })}
                {frame.joints.map(([x, y], jointIndex) => (
                  <g
                    key={scene.topology.jointIds[jointIndex]}
                    ref={(element) => {
                      jointRefs.current[legIndex * jointCount + jointIndex] = element;
                    }}
                    className={fixedJoints.has(jointIndex) ? styles.fixedJoint : styles.joint}
                    transform={`translate(${x} ${y})`}
                  >
                    <circle className={styles.jointOuter} r={fixedJoints.has(jointIndex) ? 7.5 : 5.5} />
                    <circle className={styles.jointCore} r="2.2" />
                  </g>
                ))}
                <circle
                  ref={(element) => { tracerRefs.current[legIndex] = element; }}
                  className={styles.foot}
                  cx={frame.tracer[0]}
                  cy={frame.tracer[1]}
                  r="9"
                />
              </g>
            </g>
          );
        })}

        <g className={styles.chassis} aria-hidden="true">
          <rect
            x={scene.chassis.x}
            y={scene.chassis.y}
            width={scene.chassis.width}
            height={scene.chassis.height}
            rx="12"
          />
          <line
            x1={scene.chassis.x + 28}
            y1={scene.chassis.y + scene.chassis.height / 2}
            x2={scene.chassis.x + scene.chassis.width - 28}
            y2={scene.chassis.y + scene.chassis.height / 2}
          />
          <text
            x={scene.chassis.x + scene.chassis.width / 2}
            y={scene.chassis.y + 24}
          >
            OPENLINKAGE / 4-LEG WALK
          </text>
        </g>
      </svg>

      <div className={styles.footer}>
        <span>
          {labels.trajectoryLabel}
          <strong>{Math.round(scene.metrics.stepLength)} MM</strong>
        </span>
        <span className={styles.gait}>4-BEAT WAVE</span>
        <span className={styles.solver}>
          {labels.solverLabel}
          <strong>{labels.solverReadyLabel}</strong>
        </span>
        <button
          type="button"
          className={styles.playback}
          aria-label={isPlaying ? labels.pauseAriaLabel : labels.playAriaLabel}
          title={isPlaying ? labels.pauseAriaLabel : labels.playAriaLabel}
          onClick={() => setPlaybackOverride(!isPlaying)}
        >
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  analyzeVariableLegMode,
  sampleVariableLeg,
  type VariableLegModeMetrics,
  type VariableLegSample,
} from "@/lib/variable-leg";
import { createVariableLegReferenceProject } from "@/lib/variable-leg-reference-library";
import {
  changeVariableLegCount,
  phaseIsInVariableLegStance,
  variableLegMountX,
  variableLegSampleIndex,
  variableLegTargetPhase,
} from "@/lib/variable-leg-gait";
import type { Language } from "@/lib/i18n";

type Point = { x: number; y: number };

const SAMPLE_COUNT = 72;
const SOLVER_ITERATIONS = 90;
const VISUAL_SCALE = 0.72;

function degrees(radians: number) {
  return ((radians * 180) / Math.PI + 360) % 360;
}

function averagePoint(points: Point[], fallback: Point) {
  if (!points.length) return fallback;
  return points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
}

function bodyPoints(sample: VariableLegSample, jointIds: string[]) {
  const joints = new Map(sample.project.joints.map((joint) => [joint.id, joint]));
  return jointIds
    .map((id) => joints.get(id))
    .filter((joint): joint is NonNullable<typeof joint> => Boolean(joint));
}

export function MechanismPreview({ language }: { language: Language }) {
  const project = useMemo(() => {
    const reference = createVariableLegReferenceProject("smooth");
    return {
      ...reference,
      deployment: changeVariableLegCount(reference.deployment, 4),
    };
  }, []);
  const mode = project.modes.find((item) => item.id === project.activeModeId) ?? project.modes[0];
  const metrics = useMemo<VariableLegModeMetrics>(
    () => analyzeVariableLegMode(project.baseProject, project.adjustment, mode, SAMPLE_COUNT, SOLVER_ITERATIONS),
    [mode, project.adjustment, project.baseProject],
  );
  const samples = useMemo(
    () => sampleVariableLeg(project.baseProject, project.adjustment, mode.adjustmentValue, SAMPLE_COUNT, SOLVER_ITERATIONS),
    [mode.adjustmentValue, project.adjustment, project.baseProject],
  );
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      setPhase((current) => (current + mode.rpm * Math.PI * 2 / 60 * elapsed) % (Math.PI * 2));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [mode.rpm]);

  const anchor = useMemo(() => {
    const fixed = samples[0]?.project.joints.filter((joint) => joint.fixed) ?? [];
    const average = averagePoint(fixed, { x: 0, y: 0 });
    return fixed.length ? { x: average.x / fixed.length, y: average.y / fixed.length } : average;
  }, [samples]);
  const groundY = anchor.y + (metrics.stanceGroundY - anchor.y) * VISUAL_SCALE + 10;
  const chassis = useMemo(() => {
    const fixed = samples[0]?.project.joints.filter((joint) => joint.fixed) ?? [];
    const minimumX = fixed.length ? Math.min(...fixed.map((joint) => joint.x)) : -40;
    const maximumX = fixed.length ? Math.max(...fixed.map((joint) => joint.x)) : 180;
    return {
      x: minimumX - project.deployment.mountSpan / 2 - 34,
      y: anchor.y - 42,
      width: maximumX - minimumX + project.deployment.mountSpan + 68,
      height: 64,
    };
  }, [anchor.y, project.deployment.mountSpan, samples]);
  const orderedLegs = [...project.deployment.legs].sort((first, second) => {
    if (first.side === second.side) return first.station - second.station;
    return first.side === "right" ? -1 : 1;
  });

  const labels = language === "zh"
    ? {
      card: "四条可变几何步行腿动画",
      image: "四条腿波步行走动画",
      gait: "四拍波步",
      plane: "平面",
      legs: "腿数",
      ground: "足端轨迹",
      ready: "求解器就绪",
    }
    : {
      card: "Animated four-leg variable-geometry walking mechanism",
      image: "Four-leg wave gait animation",
      gait: "FOUR-BEAT WAVE",
      plane: "PLANE",
      legs: "LEGS",
      ground: "FOOT PATH",
      ready: "SOLVER READY",
    };

  return (
    <div className="mechanism-card walking-preview-card" aria-label={labels.card}>
      <div className="card-head">
        <span>LINKAGE / 4-LEG WALK</span>
        <span>θ {degrees(phase).toFixed(1)}°</span>
      </div>
      <svg viewBox="-420 -170 840 560" role="img" aria-label={labels.image}>
        <defs>
          <pattern id="walking-preview-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" className="walking-grid" />
          </pattern>
        </defs>
        <rect x="-560" y="-170" width="1120" height="560" fill="url(#walking-preview-grid)" />
        <line className="walking-ground" x1="-540" y1={groundY} x2="540" y2={groundY} />
        <g className="walking-chassis">
          <rect x={chassis.x} y={chassis.y} width={chassis.width} height={chassis.height} rx="14" />
          <line x1={chassis.x + 30} y1={chassis.y + chassis.height / 2} x2={chassis.x + chassis.width - 30} y2={chassis.y + chassis.height / 2} />
          <text x={chassis.x + chassis.width / 2} y={chassis.y + 25}>OPENLINKAGE / 4-LEG WALK</text>
        </g>
        {orderedLegs.map((leg) => {
          const sample = samples[variableLegSampleIndex(phase, leg.phaseOffset, samples.length)];
          if (!sample) return null;
          const targetPhase = variableLegTargetPhase(phase, leg.phaseOffset, metrics.targetPhaseOffset);
          const stance = phaseIsInVariableLegStance(targetPhase, mode.stanceStart, mode.stanceEnd);
          const joints = new Map(sample.project.joints.map((joint) => [joint.id, joint]));
          const mountX = variableLegMountX(leg, project.deployment);
          const transform = `translate(${mountX} 0) translate(${anchor.x} ${anchor.y}) scale(${VISUAL_SCALE}) translate(${-anchor.x} ${-anchor.y})`;
          return (
            <g
              key={leg.id}
              className={`walking-leg ${stance ? "walking-leg-stance" : "walking-leg-swing"} ${leg.side === "right" ? "walking-leg-right" : ""}`}
            >
              <g transform={transform}>
                {sample.project.bodies.map((body) => {
                  const points = bodyPoints(sample, body.jointIds);
                  return points.length >= 3
                    ? <polygon key={body.id} points={points.map((joint) => `${joint.x},${joint.y}`).join(" ")} className="walking-body" />
                    : null;
                })}
                {sample.project.bars.map((bar) => {
                  const a = joints.get(bar.a);
                  const b = joints.get(bar.b);
                  if (!a || !b) return null;
                  return <line key={bar.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`walking-link ${bar.id === sample.project.driverId ? "walking-driver" : ""}`} />;
                })}
                {sample.project.joints.map((joint) => (
                  <g key={joint.id} className="walking-joint">
                    <circle cx={joint.x} cy={joint.y} r={joint.fixed ? 8 : 6} />
                    <circle cx={joint.x} cy={joint.y} r="2.5" />
                  </g>
                ))}
                {sample.tracer && <circle cx={sample.tracer.x} cy={sample.tracer.y} r="10" className="walking-foot" />}
              </g>
              <text x={mountX + anchor.x} y={chassis.y - 12} className="walking-leg-label" textAnchor="middle">{leg.side === "left" ? "L" : "R"}{leg.station + 1}</text>
            </g>
          );
        })}
        <g className="walking-footprints" aria-hidden="true">
          {[-360, -250, -140, -30, 80, 190, 300].map((x, index) => (
            <ellipse key={x} cx={x} cy={groundY + 12 + (index % 2) * 13} rx="18" ry="6" />
          ))}
        </g>
      </svg>
      <div className="card-stats">
        <span>{labels.plane} <b>XY</b></span>
        <span>{labels.legs} <b>4</b></span>
        <span>{labels.gait} <b>WAVE</b></span>
        <span>{labels.ground} <b>J8</b></span>
        <span><b>{labels.ready}</b></span>
      </div>
    </div>
  );
}

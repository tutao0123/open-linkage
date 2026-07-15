import { useMemo } from "react";

import type { VariableLegMode, VariableLegModeMetrics, VariableLegSample } from "@/lib/variable-leg";
import {
  phaseIsInVariableLegStance,
  variableLegMountX,
  variableLegSampleIndex,
  variableLegTargetPhase,
  type VariableLegDeployment,
  type VariableLegFootprint,
} from "@/lib/variable-leg-gait";

import styles from "./variable-geometry-leg-lab.module.css";

type VariableLegDeploymentViewProps = {
  samples: VariableLegSample[];
  deployment: VariableLegDeployment;
  mode: VariableLegMode;
  metrics: VariableLegModeMetrics;
  phase: number;
  bodyWorldX: number;
  footprints: VariableLegFootprint[];
  selectedBarId: string | null;
  onSelectBar: (barId: string) => void;
};

export function VariableLegDeploymentView({
  samples,
  deployment,
  mode,
  metrics,
  phase,
  bodyWorldX,
  footprints,
  selectedBarId,
  onSelectBar,
}: VariableLegDeploymentViewProps) {
  const visualScale = ({ 2: 0.82, 4: 0.72, 6: 0.63, 8: 0.56 } as const)[deployment.legCount];
  const anchor = useMemo(() => {
    const fixed = samples[0]?.project.joints.filter((joint) => joint.fixed) ?? [];
    return {
      x: fixed.length ? fixed.reduce((sum, joint) => sum + joint.x, 0) / fixed.length : 80,
      y: fixed.length ? fixed.reduce((sum, joint) => sum + joint.y, 0) / fixed.length : -80,
    };
  }, [samples]);
  const rawGroundY = Number.isFinite(metrics.stanceGroundY) ? metrics.stanceGroundY : 190;
  const groundY = anchor.y + (rawGroundY - anchor.y) * visualScale + 8;
  const chassis = useMemo(() => {
    const frame = samples[0]?.project;
    const fixed = frame?.joints.filter((joint) => joint.fixed) ?? [];
    const minimumX = fixed.length ? Math.min(...fixed.map((joint) => joint.x)) : -40;
    const maximumX = fixed.length ? Math.max(...fixed.map((joint) => joint.x)) : 180;
    const minimumY = fixed.length ? Math.min(...fixed.map((joint) => joint.y)) : -200;
    return {
      x: minimumX - deployment.mountSpan / 2 - 38,
      y: minimumY - 42,
      width: maximumX - minimumX + deployment.mountSpan + 76,
      height: 72,
    };
  }, [deployment.mountSpan, samples]);
  const orderedLegs = [...deployment.legs].sort((first, second) => {
    if (first.side === second.side) return first.station - second.station;
    return first.side === "right" ? -1 : 1;
  });

  return <>
    <defs>
      <pattern id="variable-leg-deployment-grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M25 0H0V25" className={styles.grid} />
      </pattern>
      <clipPath id="variable-leg-footprint-clip"><rect x="-540" y="244" width="1080" height="108" /></clipPath>
    </defs>
    <rect x="-560" y="-360" width="1120" height="760" fill="url(#variable-leg-deployment-grid)" />
    <line x1="-560" y1={groundY} x2="560" y2={groundY} className={styles.deploymentGround} />
    <g className={styles.chassis}>
      <rect x={chassis.x} y={chassis.y} width={chassis.width} height={chassis.height} rx="14" />
      <line x1={chassis.x + 28} y1={chassis.y + chassis.height / 2} x2={chassis.x + chassis.width - 28} y2={chassis.y + chassis.height / 2} />
      <text x={chassis.x + chassis.width / 2} y={chassis.y + 26}>OPENLINKAGE · {deployment.legCount} LEGS</text>
    </g>

    {orderedLegs.map((leg) => {
      const sample = samples[variableLegSampleIndex(phase, leg.phaseOffset, samples.length)];
      if (!sample) return null;
      const isStance = phaseIsInVariableLegStance(
        variableLegTargetPhase(phase, leg.phaseOffset, metrics.targetPhaseOffset),
        mode.stanceStart,
        mode.stanceEnd,
      );
      const jointMap = new Map(sample.project.joints.map((joint) => [joint.id, joint]));
      const mountX = variableLegMountX(leg, deployment);
      const sideOffsetX = leg.side === "right" ? 14 : 0;
      const transform = `translate(${mountX + sideOffsetX} 0) translate(${anchor.x} ${anchor.y}) scale(${visualScale}) translate(${-anchor.x} ${-anchor.y})`;
      return <g key={leg.id}>
        <g
          transform={transform}
          className={`${styles.deployedLeg} ${isStance ? styles.deployedLegStance : styles.deployedLegSwing} ${leg.side === "right" ? styles.deployedLegRear : ""}`}
        >
        {sample.project.bodies.map((body) => {
          const points = body.jointIds.map((id) => jointMap.get(id)).filter((joint): joint is NonNullable<typeof joint> => Boolean(joint));
          return points.length >= 3 ? <polygon key={body.id} points={points.map((joint) => `${joint.x},${joint.y}`).join(" ")} className={styles.deployedBody} /> : null;
        })}
        {sample.project.bars.map((bar) => {
          const a = jointMap.get(bar.a);
          const b = jointMap.get(bar.b);
          if (!a || !b) return null;
          return <g key={bar.id} role="button" tabIndex={0} aria-label={`检查${leg.label}杆件 ${bar.id}`} className={styles.selectableBar} onPointerDown={(event) => { event.stopPropagation(); onSelectBar(bar.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectBar(bar.id); } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.barHitArea} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.deployedLink} ${bar.id === sample.project.driverId ? styles.deployedDriver : ""} ${bar.id === selectedBarId ? styles.selectedBar : ""}`} />
          </g>;
        })}
        {sample.project.joints.map((joint) => <g key={joint.id} className={styles.deployedJoint}>
          <circle cx={joint.x} cy={joint.y} r={joint.fixed ? 7 : 6} />
        </g>)}
        {sample.tracer && <circle cx={sample.tracer.x} cy={sample.tracer.y} r="10" className={styles.deployedFoot} />}
        </g>
        <text
          x={mountX + anchor.x + sideOffsetX}
          y={chassis.y - (leg.side === "right" ? 26 : 10)}
          className={styles.deployedLegLabel}
          textAnchor="middle"
        >{leg.label} · {Math.round(leg.phaseOffset * 360)}°</text>
      </g>;
    })}

    <g className={styles.footprintPlot}>
      <rect x="-548" y="238" width="1096" height="122" rx="8" />
      <text x="-528" y="258">落足记录 · 世界坐标跟随</text>
      <line x1="-520" y1="286" x2="520" y2="286" />
      <line x1="-520" y1="326" x2="520" y2="326" />
      <text x="-535" y="290">左</text><text x="-535" y="330">右</text>
      {deployment.showFootprints && <g clipPath="url(#variable-leg-footprint-clip)">
        {footprints.map((footprint) => {
          const x = footprint.worldX - bodyWorldX;
          const y = footprint.side === "left" ? 286 : 326;
          return <g key={footprint.id} transform={`translate(${x} ${y})`} className={styles.footprintMark}>
            <ellipse rx="12" ry="7" />
            <text x="0" y="-10">{footprint.sequence}</text>
          </g>;
        })}
      </g>}
    </g>
  </>;
}

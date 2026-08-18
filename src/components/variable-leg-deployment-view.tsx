import { useMemo } from "react";

import { localizeReactTree } from "@/lib/i18n";
import { TROJAN_HORSE_TARGET_CURVE } from "@/lib/sketch-linkage";
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
import { useLanguage } from "./locale-shell";

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
  view: { x: number; y: number; width: number; height: number };
  showHorse: boolean;
  showFrame: boolean;
};

// 马形机架：复用特洛伊木马描摹轮廓（马首朝行进方向）。马身与马尾分别裁剪——
// 马身裁掉自身四肢贴齐横梁，马尾单独加深裁剪线保留垂坠感；x 分区映射见 horseFrame。
const HORSE_TORSO_POINTS = (() => {
  const curve = TROJAN_HORSE_TARGET_CURVE;
  const xs = curve.map((point) => point.x);
  const ys = curve.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // 0.79 恰好在马腹底线（≈0.77）之下、大腿根之上：腹部曲线完整保留，仅四肢被裁；
  // 尾区（nx<0.115，尾部与后腿的分界）不裁剪，保留垂坠的尾巴。
  const bodyCut = minY + (maxY - minY) * 0.79;
  const range = bodyCut - minY;
  return curve.map((point) => {
    const nx = (point.x - minX) / (maxX - minX);
    const cut = nx < 0.115 ? maxY : bodyCut;
    return { x: nx, y: (Math.min(point.y, cut) - minY) / range };
  });
})();

export const VARIABLE_LEG_DEPLOYMENT_SCALE = { 2: 0.82, 4: 0.72, 6: 0.63, 8: 0.56 } as const;

const FRAME_RAIL_HEIGHT = 16;
const FRAME_RAIL_CLEARANCE = 8;
const FRAME_TOP_MARGIN = 10;
const FRAME_HORSE_HEIGHT = 280;

// 机架几何按拓扑区分：克兰（三个固定铰高低分布大）用桁架——横梁让开整条连杆，
// 竖杠接到各固定铰点；简森（曲柄与髋点几乎同高）用髋部横梁——梁覆盖固定铰带，
// 各腿曲柄共轴，画一根贯穿全机的曲柄轴线。视口均按需上扩以容纳马身。
export function variableLegChassisFrame(samples: VariableLegSample[], legCount: VariableLegDeployment["legCount"]) {
  const visualScale = VARIABLE_LEG_DEPLOYMENT_SCALE[legCount];
  const frame = samples[0]?.project;
  const fixed = frame?.joints.filter((joint) => joint.fixed) ?? [];
  const anchor = {
    x: fixed.length ? fixed.reduce((sum, joint) => sum + joint.x, 0) / fixed.length : 80,
    y: fixed.length ? fixed.reduce((sum, joint) => sum + joint.y, 0) / fixed.length : -80,
  };
  const renderedY = (rawY: number) => anchor.y + (rawY - anchor.y) * visualScale;
  const truss = fixed.length >= 3;
  let railTop: number;
  let railBottom: number;
  if (truss) {
    let topmost = Infinity;
    for (const sample of samples) {
      for (const joint of sample.project.joints) {
        const y = renderedY(joint.y);
        if (y < topmost) topmost = y;
      }
    }
    if (!Number.isFinite(topmost)) topmost = anchor.y - 200;
    railTop = topmost - FRAME_RAIL_CLEARANCE - FRAME_RAIL_HEIGHT;
    railBottom = railTop + FRAME_RAIL_HEIGHT;
  } else {
    const fixedYs = fixed.map((joint) => renderedY(joint.y));
    const fixedTop = fixedYs.length ? Math.min(...fixedYs) : anchor.y;
    railBottom = (fixedYs.length ? Math.max(...fixedYs) : anchor.y) + 8;
    railTop = Math.min(fixedTop - 8, railBottom - 30);
  }
  const driverBar = frame?.bars.find((bar) => bar.id === frame.driverId);
  const axleJoint = driverBar ? [driverBar.a, driverBar.b].map((id) => fixed.find((joint) => joint.id === id)).find((joint) => Boolean(joint)) : undefined;
  const horseTop = railTop - FRAME_HORSE_HEIGHT;
  return {
    anchor,
    truss,
    railTop,
    railBottom,
    railBottomRaw: anchor.y + (railBottom - anchor.y) / visualScale,
    axleY: axleJoint && !truss ? renderedY(axleJoint.y) : null,
    horseHeight: FRAME_HORSE_HEIGHT,
    horseTop,
    requiredViewportTop: Math.min(-360, horseTop - FRAME_TOP_MARGIN),
  };
}

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
  view,
  showHorse,
  showFrame,
}: VariableLegDeploymentViewProps) {
  const language = useLanguage();
  const visualScale = VARIABLE_LEG_DEPLOYMENT_SCALE[deployment.legCount];
  const frame = useMemo(() => variableLegChassisFrame(samples, deployment.legCount), [samples, deployment.legCount]);
  const anchor = frame.anchor;
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
  const horseFrame = useMemo(() => {
    const railTop = frame.railTop;
    const beamWidth = chassis.width - 8;
    const height = Math.min(beamWidth / 2.02, frame.horseHeight);
    const naturalWidth = height * 2.02;
    const originX = chassis.x + 4;
    const rumpWidth = 0.2 * naturalWidth;
    const headWidth = 0.196 * naturalWidth;
    const barrelWidth = Math.max(40, beamWidth - rumpWidth);
    // 后躯与头颈保持自然比例，中段马身拉伸补宽；胸口（0.804 为贴梁区前边界）对齐横梁前端，
    // 马首因此探出梁外，尾部垂坠覆盖梁尾端。
    const mapX = (nx: number) => nx < 0.2
      ? originX + (nx / 0.2) * rumpWidth
      : nx < 0.804
        ? originX + rumpWidth + ((nx - 0.2) / 0.604) * barrelWidth
        : originX + rumpWidth + barrelWidth + ((nx - 0.804) / 0.196) * headWidth;
    const closed = [...HORSE_TORSO_POINTS, HORSE_TORSO_POINTS[0]];
    const path = `M ${closed.map((point) => `${mapX(point.x).toFixed(1)} ${(railTop - height + point.y * height).toFixed(1)}`).join(" L ")} Z`;
    return {
      railTop,
      path,
      top: railTop - height,
    };
  }, [chassis, frame]);
  const orderedLegs = [...deployment.legs].sort((first, second) => {
    if (first.side === second.side) return first.station - second.station;
    return first.side === "right" ? -1 : 1;
  });

  return localizeReactTree(<>
    <defs>
      <pattern id="variable-leg-deployment-grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M25 0H0V25" className={styles.grid} />
      </pattern>
      <clipPath id="variable-leg-footprint-clip"><rect x="-540" y="244" width="1080" height="108" /></clipPath>
    </defs>
    <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#variable-leg-deployment-grid)" />
    <line x1={view.x} y1={groundY} x2={view.x + view.width} y2={groundY} className={styles.deploymentGround} />
    <g className={styles.chassis}>
      {showFrame && <>
        <rect x={chassis.x} y={frame.railTop} width={chassis.width} height={frame.railBottom - frame.railTop} rx="8" />
        <line x1={chassis.x + 24} y1={frame.railTop + (frame.railBottom - frame.railTop) / 2} x2={chassis.x + chassis.width - 24} y2={frame.railTop + (frame.railBottom - frame.railTop) / 2} />
        {frame.axleY !== null && <line x1={chassis.x + 10} y1={frame.axleY} x2={chassis.x + chassis.width - 10} y2={frame.axleY} className={styles.frameAxle} />}
      </>}
      {showHorse && <path className={styles.horseTorso} d={horseFrame.path} />}
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
      const transform = `translate(${mountX} 0) translate(${anchor.x} ${anchor.y}) scale(${visualScale}) translate(${-anchor.x} ${-anchor.y})`;
      return <g key={leg.id}>
        <g
          transform={transform}
          className={`${styles.deployedLeg} ${isStance ? styles.deployedLegStance : styles.deployedLegSwing} ${leg.side === "right" ? styles.deployedLegRear : ""}`}
        >
          {showFrame && frame.truss && sample.project.joints.filter((joint) => joint.fixed).map((joint) => joint.y - frame.railBottomRaw > 16
            ? <line
                key={`strut-${joint.id}`}
                x1={joint.x}
                y1={frame.railBottomRaw + 2}
                x2={joint.x}
                y2={joint.y - 4}
                className={styles.frameStrut}
              />
            : null)}
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
      </g>;
    })}

    <g className={styles.footprintPlot}>
      <rect x="-548" y="238" width="1096" height="122" rx="8" />
      <text x="-528" y="258">落足记录 · 世界坐标跟随</text>
      <line x1="-520" y1="286" x2="520" y2="286" />
      <line x1="-520" y1="326" x2="520" y2="326" />
      <text x="-535" y="290">左</text><text x="-535" y="330">右</text>
      <g clipPath="url(#variable-leg-footprint-clip)">
        {footprints.map((footprint) => {
          const x = footprint.worldX - bodyWorldX;
          const y = footprint.side === "left" ? 286 : 326;
          return <g key={footprint.id} transform={`translate(${x} ${y})`} className={styles.footprintMark}>
            <ellipse rx="12" ry="7" />
            <text x="0" y="-10">{footprint.sequence}</text>
          </g>;
        })}
      </g>
    </g>
  </>, language);
}

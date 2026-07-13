"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CHEBYSHEV_PROJECT,
  HOEKENS_PROJECT,
  PEAUCELLIER_PROJECT,
  WATT_PROJECT,
  analyzeMechanismCycle,
  cloneProject,
  getRotationDriver,
  predictJointPositions,
  resolveTracerPoint,
  solveFreeMechanism,
  type FreeJoint,
  type FreeMechanismProject,
} from "@/lib/free-mechanism";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSvgViewport } from "./use-svg-viewport";
import styles from "./straight-line-workbench.module.css";

type Point = { x: number; y: number };

type StraightTemplate = {
  id: string;
  name: string;
  english: string;
  kind: string;
  summary: string;
  principle: string;
  application: string;
  project: FreeMechanismProject;
};

const TEMPLATES: StraightTemplate[] = [
  {
    id: "watt",
    name: "瓦特连杆",
    english: "WATT'S LINKAGE",
    kind: "四杆 · 近似直线",
    summary: "利用双摇杆之间的刚性连杆，在八字轨迹中心获得短而平顺的近似直线段。",
    principle: "中间刚体上的轨迹点在两个圆弧约束之间折中，中心区曲率互相抵消。",
    application: "汽车后桥横向定位、蒸汽机活塞导向",
    project: WATT_PROJECT,
  },
  {
    id: "chebyshev",
    name: "彻比雪夫连杆",
    english: "CHEBYSHEV LINKAGE",
    kind: "四杆 · 近似匀速",
    summary: "通过经典杆长比例，让轨迹点在指定区间内接近水平直线并保持较均匀的位移。",
    principle: "用三个等误差位置约束轨迹，使直线区间的最大偏差被均匀分配。",
    application: "早期工业机械、无导轨直线送料",
    project: CHEBYSHEV_PROJECT,
  },
  {
    id: "hoekens",
    name: "霍肯连杆",
    english: "HOEKENS LINKAGE",
    kind: "四杆 · 慢进快回",
    summary: "彻比雪夫机构的延伸构型，可获得较长的近似直线工作段与快速返回段。",
    principle: "将轨迹点布置在连杆延长线上，放大直线工作行程并形成非对称速度特性。",
    application: "推料机构、插秧与间歇输送机械",
    project: HOEKENS_PROJECT,
  },
  {
    id: "peaucellier",
    name: "波塞利耶–利普金",
    english: "PEAUCELLIER–LIPKIN",
    kind: "八杆 · 精确直线",
    summary: "经典反演机构，不依赖移动导轨即可把圆弧输入严格转换为几何直线。",
    principle: "菱形与等长杆组保持反演点积为常数，使输出点落在输入圆的反演直线上。",
    application: "精密导向、机械计算与机构学教学",
    project: PEAUCELLIER_PROJECT,
  },
];

function initialPhase(project: FreeMechanismProject) {
  if (project.driverMode !== "rotation") return 0;
  const driver = getRotationDriver(project.joints, project.bars, project.driverId);
  return driver ? Math.atan2(driver.driven.y - driver.pivot.y, driver.driven.x - driver.pivot.x) : 0;
}

function sampleTrajectory(source: FreeMechanismProject, samples = 240) {
  const start = initialPhase(source);
  let state = cloneProject(source);
  let previous: FreeJoint[] | null = null;
  let beforePrevious: FreeJoint[] | null = null;
  const points: Point[] = [];
  for (let index = 0; index < samples; index += 1) {
    const phase = start + index * Math.PI * 2 / samples;
    const seed = { ...state, joints: predictJointPositions(state.joints, beforePrevious) };
    const joints = solveFreeMechanism(seed, phase, 500);
    state = { ...state, joints };
    const point = resolveTracerPoint(state);
    if (point) points.push(point);
    beforePrevious = previous;
    previous = joints.map((joint) => ({ ...joint, slider: joint.slider ? { ...joint.slider } : undefined }));
  }
  return points;
}

function straightSegment(points: Point[]) {
  if (points.length < 8) return null;
  const windowSize = Math.max(16, Math.floor(points.length * 0.3));
  let best: {
    points: Point[];
    start: Point;
    end: Point;
    stroke: number;
    rms: number;
    maxDeviation: number;
    speedVariation: number;
    score: number;
  } | null = null;

  for (let offset = 0; offset < points.length; offset += 2) {
    const section = Array.from({ length: windowSize }, (_, index) => points[(offset + index) % points.length]);
    const center = section.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    center.x /= section.length;
    center.y /= section.length;
    let xx = 0;
    let xy = 0;
    let yy = 0;
    for (const point of section) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      xx += dx * dx;
      xy += dx * dy;
      yy += dy * dy;
    }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    const axis = { x: Math.cos(angle), y: Math.sin(angle) };
    const normal = { x: -axis.y, y: axis.x };
    const along = section.map((point) => (point.x - center.x) * axis.x + (point.y - center.y) * axis.y);
    const deviations = section.map((point) => Math.abs((point.x - center.x) * normal.x + (point.y - center.y) * normal.y));
    const minimum = Math.min(...along);
    const maximum = Math.max(...along);
    const stroke = maximum - minimum;
    const rms = Math.sqrt(deviations.reduce((sum, value) => sum + value * value, 0) / deviations.length);
    const steps = along.slice(1).map((value, index) => Math.abs(value - along[index]));
    const averageStep = steps.reduce((sum, value) => sum + value, 0) / Math.max(1, steps.length);
    const speedVariation = averageStep > 0.0001
      ? Math.sqrt(steps.reduce((sum, value) => sum + (value - averageStep) ** 2, 0) / steps.length) / averageStep * 100
      : 0;
    const score = rms / Math.max(stroke, 1);
    if (!best || score < best.score) {
      best = {
        points: section,
        start: { x: center.x + axis.x * minimum, y: center.y + axis.y * minimum },
        end: { x: center.x + axis.x * maximum, y: center.y + axis.y * maximum },
        stroke,
        rms,
        maxDeviation: Math.max(...deviations),
        speedVariation,
        score,
      };
    }
  }
  return best;
}

function svgPath(points: Point[]) {
  return points.length > 1
    ? `M ${points.map((point) => `${renderCoordinate(point.x)} ${renderCoordinate(point.y)}`).join(" L ")}`
    : "";
}

function renderCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function StraightLineWorkbench() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const activeTemplate = TEMPLATES.find((template) => template.id === templateId) ?? TEMPLATES[0];
  const [project, setProject] = useState(() => cloneProject(activeTemplate.project));
  const [phase, setPhase] = useState(() => initialPhase(activeTemplate.project));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(32);
  const projectRef = useRef(project);
  const phaseRef = useRef(phase);
  const previousRef = useRef<FreeJoint[] | null>(null);
  const viewport = useSvgViewport(useMemo(() => ({ x: -430, y: -330, width: 860, height: 660 }), []));

  const trajectory = useMemo(() => sampleTrajectory(activeTemplate.project), [activeTemplate]);
  const segment = useMemo(() => straightSegment(trajectory), [trajectory]);
  const cycle = useMemo(() => analyzeMechanismCycle(activeTemplate.project, 96, 500, 0.15), [activeTemplate]);
  const trajectoryPath = useMemo(() => svgPath(trajectory), [trajectory]);
  const segmentPath = useMemo(() => svgPath(segment?.points ?? []), [segment]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousTime = 0;
    const tick = (time: number) => {
      const elapsed = previousTime === 0 ? 0 : Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      phaseRef.current += elapsed * speed * Math.PI / 180;
      const current = projectRef.current;
      const seed = { ...current, joints: predictJointPositions(current.joints, previousRef.current) };
      const joints = solveFreeMechanism(seed, phaseRef.current, 400);
      previousRef.current = current.joints.map((joint) => ({ ...joint, slider: joint.slider ? { ...joint.slider } : undefined }));
      const next = { ...current, joints };
      projectRef.current = next;
      setProject(next);
      setPhase(phaseRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const selectTemplate = (template: StraightTemplate) => {
    const next = cloneProject(template.project);
    const nextPhase = initialPhase(next);
    setPlaying(false);
    setTemplateId(template.id);
    setProject(next);
    projectRef.current = next;
    setPhase(nextPhase);
    phaseRef.current = nextPhase;
    previousRef.current = null;
    viewport.resetView();
  };

  const setManualPhase = (degrees: number) => {
    setPlaying(false);
    const nextPhase = degrees * Math.PI / 180;
    phaseRef.current = nextPhase;
    const base = cloneProject(projectRef.current);
    const next = { ...base, joints: solveFreeMechanism(base, nextPhase, 500) };
    projectRef.current = next;
    setProject(next);
    setPhase(nextPhase);
    previousRef.current = null;
  };

  const activePoint = resolveTracerPoint(project);
  const fixedJoints = project.joints.filter((joint) => joint.fixed);
  const phaseDegrees = ((phase * 180 / Math.PI) % 360 + 360) % 360;

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav><Link href="/lab">四杆设计</Link><Link href="/leg">六杆腿设计</Link><Link href="/designer">自由设计</Link><span>直线机构工作台 · 0.1</span></nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>经典机构</h1></div><b>4 TYPES</b></div>
          <div className={styles.templateList}>
            {TEMPLATES.map((template) => (
              <button type="button" key={template.id} className={template.id === activeTemplate.id ? styles.activeTemplate : ""} onClick={() => selectTemplate(template)}>
                <span>{template.english}</span><b>{template.name}</b><small>{template.kind}</small>
              </button>
            ))}
          </div>
          <section className={styles.explanation}>
            <span>工作原理</span>
            <p>{activeTemplate.principle}</p>
            <span>典型应用</span>
            <p>{activeTemplate.application}</p>
          </section>
          <Link className={styles.editLink} href={`/designer?template=${activeTemplate.id}`}>在自由设计器中编辑 <span>↗</span></Link>
          <small className={styles.editHint}>会以当前经典机构作为起点，之后可自由添加杆件、刚体、移动副和驱动。</small>
        </aside>

        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <div><span>{activeTemplate.english}</span><b>{activeTemplate.name}</b></div>
            <div className={styles.legend}><span><i className={styles.fullLegend} />完整轨迹</span><span><i className={styles.segmentLegend} />最佳直线段</span></div>
            <strong className={cycle.valid ? styles.pass : styles.warn}>{cycle.valid ? "CYCLE SOLVED" : "CHECK ASSEMBLY"}</strong>
          </div>
          <div className={styles.canvas}>
            <SvgViewportControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.resetView} />
            <svg viewBox={viewport.viewBox} onWheel={viewport.handleWheel} onPointerDown={viewport.startPan} onPointerMove={viewport.movePan} onPointerUp={viewport.endPan} onPointerCancel={viewport.endPan} aria-label={`${activeTemplate.name}运动与轨迹`}>
              <defs><pattern id="straight-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" className={styles.gridLine} /></pattern></defs>
              <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#straight-grid)" />
              <line x1={viewport.view.x} y1="0" x2={viewport.view.x + viewport.view.width} y2="0" className={styles.axis} />
              <line x1="0" y1={viewport.view.y} x2="0" y2={viewport.view.y + viewport.view.height} className={styles.axis} />
              {trajectoryPath && <path d={trajectoryPath} className={styles.trajectory} />}
              {segmentPath && <path d={segmentPath} className={styles.straightPath} />}
              {segment && <line x1={renderCoordinate(segment.start.x)} y1={renderCoordinate(segment.start.y)} x2={renderCoordinate(segment.end.x)} y2={renderCoordinate(segment.end.y)} className={styles.fitLine} />}
              {fixedJoints.length > 1 && <line x1={fixedJoints[0].x} y1={fixedJoints[0].y} x2={fixedJoints[1].x} y2={fixedJoints[1].y} className={styles.groundLink} />}
              {project.bodies.map((body) => {
                const points = body.jointIds.map((id) => project.joints.find((joint) => joint.id === id)).filter((joint): joint is FreeJoint => Boolean(joint));
                return points.length >= 3 ? <polygon key={body.id} points={points.map((point) => `${point.x},${point.y}`).join(" ")} className={styles.body} /> : null;
              })}
              {project.bars.map((bar, index) => {
                const a = project.joints.find((joint) => joint.id === bar.a);
                const b = project.joints.find((joint) => joint.id === bar.b);
                return a && b ? <line key={bar.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.link} ${index === 0 ? styles.driverLink : ""}`} /> : null;
              })}
              {project.joints.map((joint) => <g key={joint.id}>
                {joint.fixed && <path d={`M ${joint.x - 18} ${joint.y + 18} L ${joint.x + 18} ${joint.y + 18} M ${joint.x - 13} ${joint.y + 18} l -8 11 M ${joint.x + 3} ${joint.y + 18} l -8 11 M ${joint.x + 18} ${joint.y + 18} l -8 11`} className={styles.groundMark} />}
                <circle cx={joint.x} cy={joint.y} r="12" className={`${styles.joint} ${joint.fixed ? styles.fixedJoint : ""}`} />
                <circle cx={joint.x} cy={joint.y} r="4" className={styles.pin} />
                <text x={joint.x + 14} y={joint.y - 13}>{joint.id}</text>
              </g>)}
              {activePoint && <g className={styles.tracer}><circle cx={activePoint.x} cy={activePoint.y} r="9" /><text x={activePoint.x + 13} y={activePoint.y + 4}>P</text></g>}
            </svg>
          </div>
          <div className={styles.transport}>
            <button type="button" className={styles.playButton} onClick={() => setPlaying((current) => !current)} aria-label={playing ? "暂停机构运动" : "播放机构运动"}>{playing ? "Ⅱ" : "▶"}</button>
            <label>输入相位 <input type="range" min="0" max="360" step="0.5" value={phaseDegrees} onChange={(event) => setManualPhase(Number(event.target.value))} /><b>{phaseDegrees.toFixed(1)}°</b></label>
            <label className={styles.speed}>速度 <input type="number" min="5" max="180" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><span>°/s</span></label>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.analysis}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>直线性能</h2></div><b>AUTO FIT</b></div>
          <section className={styles.summary}><span>{activeTemplate.kind}</span><h3>{activeTemplate.name}</h3><p>{activeTemplate.summary}</p></section>
          <section className={styles.metrics}>
            <div><span>有效直线行程</span><strong>{segment?.stroke.toFixed(1) ?? "—"}<small> mm</small></strong></div>
            <div><span>最大直线偏差</span><strong>{segment?.maxDeviation.toFixed(3) ?? "—"}<small> mm</small></strong></div>
            <div><span>均方根误差</span><strong>{segment?.rms.toFixed(3) ?? "—"}<small> mm</small></strong></div>
            <div><span>相对直线误差</span><strong>{segment ? (segment.maxDeviation / Math.max(segment.stroke, 0.001) * 100).toFixed(3) : "—"}<small> %</small></strong></div>
            <div><span>速度波动</span><strong>{segment?.speedVariation.toFixed(1) ?? "—"}<small> %</small></strong></div>
          </section>
          <section className={`${styles.health} ${cycle.valid ? styles.healthy : styles.attention}`}>
            <div><b>{cycle.valid ? "整周连续" : "需要检查"}</b><span>{cycle.samples} samples</span></div>
            <p>{cycle.valid
              ? `无不可达采样和装配分支跳变，首尾闭合误差 ${cycle.closureError.toFixed(3)} mm。`
              : `${cycle.failedPhases.length} 个采样未满足约束；建议转到自由设计器检查尺寸和初始装配。`}</p>
          </section>
          <section className={styles.methodNote}><b>指标说明</b><p>系统在完整输出轨迹上滑动搜索，并以最小二乘直线拟合自动识别最佳 30% 工作区间。速度波动基于该区间相邻采样的投影位移计算。</p></section>
        </aside>
      </div>
    </main>
  );
}

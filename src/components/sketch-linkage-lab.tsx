"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CAT_TARGET_CURVE,
  sampleCandidateMechanism,
} from "@/lib/sketch-linkage";
import {
  precomputedCandidatesFor,
  type DemoMechanismFamily,
  type SketchDemoCandidate,
} from "@/lib/sketch-linkage-demo";
import { createXYDrawingMechanismGeometry } from "@/lib/xy-drawing-mechanism";
import { solveDualGrooveCam } from "@/lib/dual-groove-cam";
import { panSketchCanvas } from "@/lib/sketch-canvas-view";
import type { Point } from "@/lib/four-bar";
import { useLanguage } from "./locale-shell";
import styles from "./sketch-linkage-lab.module.css";
import familyStyles from "./sketch-linkage-family.module.css";

const COPY = {
  zh: {
    back: "OpenLinkage",
    badge: "FIRST PRINCIPLES / PHASE 1",
    title: "Sketch → Mechanism",
    subtitle: "从猫轮廓出发，比较连杆、齿轮谐波滑台与双槽凸轮方案。",
    target: "目标曲线",
    targetName: "猫轮廓 · 固定示例",
    targetNote: "第一阶段只解决这一条闭合曲线，不尝试通用草图识别。",
    solve: "加载预计算演示",
    solveAgain: "重新载入演示",
    global: "全局探索",
    refine: "局部精修",
    verify: "完整转动验证",
    waiting: "演示结果待载入",
    ready: "预计算候选已载入",
    failed: "求解失败，请重试",
    canvas: "机构动画与轨迹比较",
    targetLegend: "猫目标",
    traceLegend: "Coupler 轨迹",
    mechanismLegend: "候选机构",
    play: "播放",
    pause: "暂停",
    candidates: "候选机构",
    empty: "加载演示后，这里会显示连杆、齿轮 X–Y 与双槽凸轮候选。",
    candidate: "候选",
    error: "归一化误差",
    transmission: "最小传动角",
    parameters: "机构参数",
    ground: "机架",
    input: "曲柄",
    coupler: "连杆",
    output: "摇杆",
    leftInput: "左曲柄",
    leftCoupler: "左连杆",
    rightCoupler: "右连杆",
    rightInput: "右曲柄",
    gearRatio: "齿轮传动比",
    gearPhase: "装配相位",
    point: "绘图点",
    ratio: "沿连杆比例",
    offset: "法向偏移",
    normalized: "杆长以机架 100 mm 归一化；整体等比例缩放不会改变轨迹形状。",
    principleTitle: "当前 Solver 做了什么",
    principle: "候选已在本地预计算并通过 360° 验证。页面实时重放连杆闭环、齿轮谐波 X–Y 滑台和双槽凸轮运动学。",
    limitationTitle: "第一阶段边界",
    limitation: "误差不能单独代表方案优劣：连杆参数少但轮廓受限；谐波机构零件更多；双槽凸轮精度最高，但还需接触、强度与制造校核。",
    familyTitle: "参与搜索的机构族",
    compare: "四杆 + 齿轮五杆",
    fourBar: "经典四杆",
    gearedFiveBar: "齿轮同步五杆",
    fourBarCode: "4-BAR",
    gearedFiveBarCode: "GEARED 5-BAR",
    allFamilies: "全部方案",
    xyDrawing: "齿轮同步 X–Y",
    dualCam: "双槽凸轮",
    xyCode: "GEARED X–Y",
    camCode: "DUAL CAM",
    complexity: "机构复杂度",
    harmonics: "谐波级数",
    camSamples: "凸轮槽采样",
    kinematicExact: "离散点精确",
    zoomOut: "缩小画布",
    resetZoom: "适应画布",
    zoomIn: "放大画布",
    panHint: "按住鼠标中键拖动画布",
    inputShaftLabel: "① 共同输入轴",
    harmonicBankLabel: "② 整数倍频 + 偏心合成",
    crossSlideLabel: "③ X/Y 十字滑台",
    camPairLabel: "① 同步 X/Y 槽凸轮",
    followerLabel: "② 滚子从动件 + 推杆",
    penLabel: "④ 绘图笔",
  },
  en: {
    back: "OpenLinkage",
    badge: "FIRST PRINCIPLES / PHASE 1",
    title: "Sketch → Mechanism",
    subtitle: "Compare linkages, a geared harmonic X–Y stage, and dual groove cams for the same cat outline.",
    target: "Target curve",
    targetName: "Cat outline · fixed example",
    targetNote: "Phase one solves this single closed curve; it does not attempt general sketch recognition.",
    solve: "Load precomputed demo",
    solveAgain: "Reload demo",
    global: "Global exploration",
    refine: "Local refinement",
    verify: "Full-cycle verification",
    waiting: "Demo results ready to load",
    ready: "Precomputed candidates loaded",
    failed: "Solver failed. Please retry.",
    canvas: "Mechanism animation and curve comparison",
    targetLegend: "Cat target",
    traceLegend: "Coupler curve",
    mechanismLegend: "Candidate mechanism",
    play: "Play",
    pause: "Pause",
    candidates: "Mechanism candidates",
    empty: "Load the demo to compare linkage, geared X–Y, and dual-cam candidates.",
    candidate: "Candidate",
    error: "Normalized error",
    transmission: "Min. transmission angle",
    parameters: "Mechanism parameters",
    ground: "Ground",
    input: "Crank",
    coupler: "Coupler",
    output: "Rocker",
    leftInput: "Left crank",
    leftCoupler: "Left coupler",
    rightCoupler: "Right coupler",
    rightInput: "Right crank",
    gearRatio: "Gear ratio",
    gearPhase: "Assembly phase",
    point: "Drawing point",
    ratio: "Along-link ratio",
    offset: "Normal offset",
    normalized: "Lengths are normalized to a 100 mm ground link. Uniform scaling preserves the curve shape.",
    principleTitle: "What the solver does",
    principle: "Candidates were precomputed and verified over 360°. The page replays linkage loops, a geared harmonic X–Y stage, and dual groove-cam kinematics in real time.",
    limitationTitle: "Phase-one boundary",
    limitation: "Error alone is not a fair ranking: linkages use fewer parameters, harmonics need more parts, and accurate groove cams still require contact, strength, and manufacturing checks.",
    familyTitle: "Mechanism families to search",
    compare: "Four-bar + geared five-bar",
    fourBar: "Classic four-bar",
    gearedFiveBar: "Gear-synchronized five-bar",
    fourBarCode: "4-BAR",
    gearedFiveBarCode: "GEARED 5-BAR",
    allFamilies: "All concepts",
    xyDrawing: "Gear-synchronized X–Y",
    dualCam: "Dual groove cams",
    xyCode: "GEARED X–Y",
    camCode: "DUAL CAM",
    complexity: "Mechanism complexity",
    harmonics: "Harmonic stages",
    camSamples: "Cam groove samples",
    kinematicExact: "Exact at samples",
    zoomOut: "Zoom out",
    resetZoom: "Fit canvas",
    zoomIn: "Zoom in",
    panHint: "Hold the middle mouse button to pan",
    inputShaftLabel: "① Shared input shaft",
    harmonicBankLabel: "② Integer gears + eccentric summing",
    crossSlideLabel: "③ X/Y cross slide",
    camPairLabel: "① Synchronized X/Y groove cams",
    followerLabel: "② Roller followers + pushrods",
    penLabel: "④ Drawing pen",
  },
} as const;

function pointsPath(points: Point[], closed = true) {
  if (points.length === 0) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}${closed ? " Z" : ""}`;
}

function format(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function JointMarker({ x, y, label, fixed = false, active = false }: {
  x: number;
  y: number;
  label: string;
  fixed?: boolean;
  active?: boolean;
}) {
  return (
    <g className={`${familyStyles.jointMarker} ${fixed ? familyStyles.fixedJoint : ""} ${active ? familyStyles.activeJoint : ""}`}>
      {fixed && <path d={`M${x - 13} ${y + 13}H${x + 13}M${x - 9} ${y + 13}l-5 7M${x} ${y + 13}l-5 7M${x + 9} ${y + 13}l-5 7`} />}
      <circle cx={x} cy={y} r="7" />
      <circle cx={x} cy={y} r="2.5" />
      <text x={x + 10} y={y - 10}>{label}</text>
    </g>
  );
}

function FlatGear({
  x,
  y,
  radius,
  rotation,
  axis,
}: {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  axis: "x" | "y";
}) {
  return (
    <g
      className={`${familyStyles.flatGear} ${axis === "x" ? familyStyles.flatGearX : familyStyles.flatGearY}`}
      transform={`rotate(${rotation} ${x} ${y})`}
    >
      <circle cx={x} cy={y} r={radius + 2.5} className={familyStyles.flatGearTeeth} />
      <circle cx={x} cy={y} r={radius} />
      <line x1={x - radius * 0.68} y1={y} x2={x + radius * 0.68} y2={y} />
      <line x1={x} y1={y - radius * 0.68} x2={x} y2={y + radius * 0.68} />
      <circle cx={x} cy={y} r={Math.max(2.3, radius * 0.2)} />
    </g>
  );
}

type FamilyMode = DemoMechanismFamily | "compare";

function familyCode(family: DemoMechanismFamily, copy: typeof COPY.zh | typeof COPY.en) {
  if (family === "four-bar") return copy.fourBarCode;
  if (family === "geared-five-bar") return copy.gearedFiveBarCode;
  if (family === "gear-synchronized-xy") return copy.xyCode;
  return copy.camCode;
}

function defaultZoomFor(family?: DemoMechanismFamily) {
  return family === "gear-synchronized-xy" || family === "dual-groove-cam" ? 0.8 : 1;
}

export function SketchLinkageLab() {
  const language = useLanguage();
  const copy = COPY[language];
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [candidates, setCandidates] = useState<SketchDemoCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [familyMode, setFamilyMode] = useState<FamilyMode>("compare");

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  const linkageMechanism = useMemo(() => selected && (selected.family === "four-bar" || selected.family === "geared-five-bar")
    ? sampleCandidateMechanism(selected, angle)
    : null, [angle, selected]);
  const xyMechanism = useMemo(() => selected?.family === "gear-synchronized-xy"
    ? createXYDrawingMechanismGeometry(selected.parameters, angle)
    : null, [angle, selected]);
  const camMechanism = useMemo(() => selected?.family === "dual-groove-cam"
    ? solveDualGrooveCam(selected.parameters, angle)
    : null, [angle, selected]);
  const camDisplay = useMemo(() => {
    if (!camMechanism || selected?.family !== "dual-groove-cam") return null;
    const mapCam = (
      cam: typeof camMechanism.cams.x,
      law: typeof selected.parameters.xLaw,
      center: Point,
    ) => {
      const scale = 54 / Math.max(1, law.baseRadius + law.lift);
      const mapPoint = (point: Point) => ({
        x: center.x + (point.x - cam.center.x) * scale,
        y: center.y + (point.y - cam.center.y) * scale,
      });
      return {
        center,
        baseRadius: cam.baseCircleRadius * scale,
        groove: cam.groove.map(mapPoint),
        contactPoint: mapPoint(cam.contactPoint),
      };
    };
    return {
      x: mapCam(camMechanism.cams.x, selected.parameters.xLaw, { x: 105, y: 130 }),
      y: mapCam(camMechanism.cams.y, selected.parameters.yLaw, { x: 245, y: 130 }),
    };
  }, [camMechanism, selected]);
  const targetPath = useMemo(() => pointsPath(CAT_TARGET_CURVE), []);
  const tracePath = useMemo(() => selected ? pointsPath(selected.trajectory) : "", [selected]);
  const canvasViewBox = useMemo(() => {
    const width = 540 / zoom;
    const height = 450 / zoom;
    return `${295 + pan.x - width / 2} ${275 + pan.y - height / 2} ${width} ${height}`;
  }, [pan, zoom]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    if (!playing || !selected) {
      previousTimeRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      return;
    }
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const elapsed = Math.min(50, time - previousTimeRef.current);
        setAngle((current) => (current + elapsed * 0.045) % 360);
      }
      previousTimeRef.current = time;
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [playing, selected]);

  const chooseFamilyMode = (mode: FamilyMode) => {
    setFamilyMode(mode);
    const nextCandidates = candidates.length > 0 ? precomputedCandidatesFor(mode) : [];
    setCandidates(nextCandidates);
    setSelectedId(nextCandidates[0]?.id ?? null);
    setPlaying(false);
    setAngle(0);
    setZoom(defaultZoomFor(nextCandidates[0]?.family));
    setPan({ x: 0, y: 0 });
  };

  const loadDemo = () => {
    const nextCandidates = precomputedCandidatesFor(familyMode);
    setCandidates(nextCandidates);
    setSelectedId(nextCandidates[0]?.id ?? null);
    setAngle(0);
    setZoom(defaultZoomFor(nextCandidates[0]?.family));
    setPan({ x: 0, y: 0 });
    setPlaying(nextCandidates.length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.round(Math.min(2, Math.max(0.6, current + delta)) * 10) / 10);
  };

  const resetView = () => {
    setZoom(defaultZoomFor(selected?.family));
    setPan({ x: 0, y: 0 });
  };

  const stopPanning = (target?: SVGSVGElement, pointerId?: number) => {
    if (target && pointerId !== undefined && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    panDragRef.current = null;
    setPanning(false);
  };

  const status = candidates.length > 0 ? copy.ready : copy.waiting;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><span className={styles.brandMark} />{copy.back}</Link>
        <div className={styles.headerTrail}><span>{copy.badge}</span><span className={styles.statusDot}>{status}</span></div>
      </header>

      <section className={styles.intro}>
        <div>
          <p>{copy.badge}</p>
          <h1>{copy.title}</h1>
          <span>{copy.subtitle}</span>
        </div>
        <div className={styles.pipeline} aria-label="Cat target curve to linkage mechanism pipeline">
          <span>CAT CURVE</span><i>→</i><span>OPENLINK SOLVER</span><i>→</i><span>LINK / GEAR / CAM</span><i>→</i><span>DRAWING TRACE</span>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.targetPanel}>
          <div className={styles.panelHeading}><span>01</span><div><small>SKETCH</small><h2>{copy.target}</h2></div></div>
          <div className={styles.targetCard}>
            <svg viewBox="35 65 510 420" role="img" aria-label={copy.targetName}>
              <path d={targetPath} />
            </svg>
            <strong>{copy.targetName}</strong>
            <p>{copy.targetNote}</p>
          </div>
          <section className={familyStyles.familyPicker}>
            <strong>{copy.familyTitle}</strong>
            {([
              ["compare", copy.allFamilies],
              ["four-bar", copy.fourBar],
              ["geared-five-bar", copy.gearedFiveBar],
              ["gear-synchronized-xy", copy.xyDrawing],
              ["dual-groove-cam", copy.dualCam],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={familyMode === mode ? familyStyles.activeFamily : ""}
                aria-pressed={familyMode === mode}
                onClick={() => chooseFamilyMode(mode)}
              >{label}</button>
            ))}
          </section>
          <button className={styles.solveButton} type="button" onClick={loadDemo}>
            {candidates.length ? copy.solveAgain : copy.solve}
          </button>
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: candidates.length ? "100%" : "0%" }} /></div>
          <p className={styles.liveStatus} aria-live="polite">{status}</p>

          <div className={styles.explainer}>
            <strong>{copy.principleTitle}</strong>
            <p>{copy.principle}</p>
          </div>
          <div className={styles.limitation}>
            <strong>{copy.limitationTitle}</strong>
            <p>{copy.limitation}</p>
          </div>
        </aside>

        <section className={styles.canvasPanel}>
          <div className={styles.canvasHead}>
            <div><span>02</span><h2>{copy.canvas}</h2></div>
            <div className={styles.legend}>
              <span><i className={styles.targetSwatch} />{copy.targetLegend}</span>
              <span><i className={styles.traceSwatch} />{copy.traceLegend}</span>
              <span><i className={styles.linkSwatch} />{copy.mechanismLegend}</span>
            </div>
          </div>
          <div className={`${styles.canvas} ${familyStyles.zoomCanvas}`}>
            <div className={familyStyles.zoomControls} role="group" aria-label={copy.resetZoom}>
              <button type="button" aria-label={copy.zoomOut} disabled={zoom <= 0.6} onClick={() => changeZoom(-0.2)}>−</button>
              <button type="button" aria-label={copy.resetZoom} onClick={resetView}>{Math.round(zoom * 100)}%</button>
              <button type="button" aria-label={copy.zoomIn} disabled={zoom >= 2} onClick={() => changeZoom(0.2)}>+</button>
            </div>
            <span className={familyStyles.panHint}>{copy.panHint}</span>
            <svg
              viewBox={canvasViewBox}
              role="img"
              aria-label={copy.canvas}
              className={panning ? familyStyles.panning : undefined}
              onPointerDown={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                panDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                setPanning(true);
              }}
              onPointerMove={(event) => {
                const drag = panDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const deltaX = event.clientX - drag.x;
                const deltaY = event.clientY - drag.y;
                panDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
                setPan((current) => panSketchCanvas(
                  current,
                  { x: deltaX, y: deltaY },
                  { width: bounds.width, height: bounds.height },
                  zoom,
                ));
              }}
              onPointerUp={(event) => stopPanning(event.currentTarget, event.pointerId)}
              onPointerCancel={(event) => stopPanning(event.currentTarget, event.pointerId)}
              onLostPointerCapture={() => stopPanning()}
              onAuxClick={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
            >
              <defs>
                <pattern id="sketch-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" /></pattern>
                <marker id="sketch-motion-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" /></marker>
              </defs>
              <rect x="-2000" y="-2000" width="4000" height="4000" className={styles.grid} />
              <path d={targetPath} className={styles.targetCurve} />
              {selected && <path d={tracePath} className={styles.fittedCurve} />}
              {linkageMechanism && (
                <g className={styles.mechanism}>
                  {linkageMechanism.gears.map((gear, gearIndex) => (
                    <g
                      key={`gear-${gearIndex}`}
                      className={familyStyles.gear}
                      transform={`translate(${gear.center.x} ${gear.center.y}) rotate(${gear.rotation})`}
                    >
                      <circle r={gear.radius} />
                      {Array.from({ length: 8 }, (_, spokeIndex) => {
                        const spokeAngle = spokeIndex * Math.PI / 4;
                        return <line
                          key={spokeIndex}
                          x1={Math.cos(spokeAngle) * gear.radius * 0.24}
                          y1={Math.sin(spokeAngle) * gear.radius * 0.24}
                          x2={Math.cos(spokeAngle) * gear.radius * 0.88}
                          y2={Math.sin(spokeAngle) * gear.radius * 0.88}
                        />;
                      })}
                    </g>
                  ))}
                  <line x1={linkageMechanism.ground.start.x} y1={linkageMechanism.ground.start.y} x2={linkageMechanism.ground.end.x} y2={linkageMechanism.ground.end.y} className={styles.groundLink} />
                  {linkageMechanism.links.map((link, linkIndex) => (
                    <line
                      key={`link-${linkIndex}`}
                      x1={link.start.x}
                      y1={link.start.y}
                      x2={link.end.x}
                      y2={link.end.y}
                      className={link.kind === "coupler" ? styles.couplerLink : ""}
                    />
                  ))}
                  <line x1={linkageMechanism.tracerBase.x} y1={linkageMechanism.tracerBase.y} x2={linkageMechanism.couplerPoint.x} y2={linkageMechanism.couplerPoint.y} className={styles.tracerArm} />
                  {linkageMechanism.joints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="6" />)}
                  <circle cx={linkageMechanism.couplerPoint.x} cy={linkageMechanism.couplerPoint.y} r="8" className={styles.tracerPoint} />
                </g>
              )}
              {xyMechanism && selected?.family === "gear-synchronized-xy" && (
                <g className={familyStyles.xyMechanism}>
                  <g className={familyStyles.inputCrank} transform={`rotate(${xyMechanism.sharedInputShaft.rotationDegrees} 72 122)`}>
                    <line x1="72" y1="122" x2="93" y2="122" />
                    <circle cx="93" cy="122" r="4" />
                  </g>
                  <JointMarker x={72} y={122} label="J1" fixed active />
                  <text x="43" y="91" className={familyStyles.mechanismLabel}>INPUT θ</text>
                  <path d="M94 122H105V75M105 122V144" className={familyStyles.powerSplit} />
                  {(["x", "y"] as const).map((axis, axisIndex) => {
                    const driverY = axisIndex === 0 ? 75 : 144;
                    const exitY = axisIndex === 0 ? 119 : 188;
                    const drives = xyMechanism.harmonicDrives.filter((drive) => drive.axis === axis && drive.harmonic <= 4);
                    return (
                      <g key={axis} className={axis === "x" ? familyStyles.xDrive : familyStyles.yDrive}>
                        <text x="109" y={driverY + 3} className={familyStyles.axisBankLabel}>{axis.toUpperCase()}</text>
                        <line x1="105" y1={driverY} x2="269" y2={driverY} className={familyStyles.commonGearShaft} />
                        {drives.map((drive, driveIndex) => {
                          const centerX = 128 + driveIndex * 45;
                          const driverRadius = 11;
                          const outputRadius = Math.max(4, driverRadius / drive.harmonic);
                          const outputY = driverY + driverRadius + outputRadius;
                          const driveAngle = drive.rotationDegrees * Math.PI / 180;
                          const pinRadius = Math.max(2.5, outputRadius * 0.64);
                          const pinX = centerX + Math.cos(driveAngle) * pinRadius;
                          const pinY = outputY + Math.sin(driveAngle) * pinRadius;
                          return (
                            <g key={`${axis}-${drive.harmonic}`}>
                              <FlatGear
                                x={centerX}
                                y={driverY}
                                radius={driverRadius}
                                rotation={xyMechanism.sharedInputShaft.rotationDegrees}
                                axis={axis}
                              />
                              <FlatGear
                                x={centerX}
                                y={outputY}
                                radius={outputRadius}
                                rotation={drive.rotationDegrees}
                                axis={axis}
                              />
                              <line x1={centerX} y1={outputY} x2={pinX} y2={pinY} className={familyStyles.eccentricArm} />
                              <circle cx={pinX} cy={pinY} r="3" className={familyStyles.eccentricPin} />
                              <polyline points={`${pinX},${pinY} ${centerX},${exitY} 284,${exitY}`} className={familyStyles.harmonicLink} />
                              <text x={centerX} y={driverY - 18} textAnchor="middle">{drive.harmonic}×</text>
                            </g>
                          );
                        })}
                        <rect x="284" y={exitY - 9} width="16" height="18" rx="2" className={familyStyles.sliderBlock} />
                        <path d={`M300 ${exitY}H320`} markerEnd="url(#sketch-motion-arrow)" className={familyStyles.axisMotion} />
                      </g>
                    );
                  })}
                  <line x1={selected.parameters.targetBounds.minimum.x - 18} y1={xyMechanism.point.y} x2={selected.parameters.targetBounds.maximum.x + 18} y2={xyMechanism.point.y} className={familyStyles.yCarriage} />
                  <line x1={xyMechanism.point.x} y1={selected.parameters.targetBounds.minimum.y - 18} x2={xyMechanism.point.x} y2={selected.parameters.targetBounds.maximum.y + 18} className={familyStyles.xCarriage} />
                  <path d={`M320 119H${xyMechanism.point.x}V${xyMechanism.point.y}`} className={familyStyles.xPushrod} />
                  <path d={`M320 188V${xyMechanism.point.y}H${xyMechanism.point.x}`} className={familyStyles.yPushrod} />
                  <rect x={xyMechanism.point.x - 13} y={xyMechanism.point.y - 13} width="26" height="26" rx="2" className={familyStyles.carriageBlock} />
                  <JointMarker x={xyMechanism.point.x} y={xyMechanism.point.y} label="P" active />
                </g>
              )}
              {camMechanism && camDisplay && selected?.family === "dual-groove-cam" && (
                <g className={familyStyles.camMechanism}>
                  <path d="M105 72V83H245V72" className={familyStyles.syncShaft} />
                  {([camDisplay.x, camDisplay.y] as const).map((cam, camIndex) => (
                    <g key={camIndex} className={camIndex === 0 ? familyStyles.xDrive : familyStyles.yDrive}>
                      <circle cx={cam.center.x} cy={cam.center.y} r={cam.baseRadius} className={familyStyles.camBase} />
                      <path d={pointsPath(cam.groove)} className={familyStyles.camProfile} />
                      <JointMarker x={cam.center.x} y={cam.center.y} label={`J${camIndex + 1}`} fixed active={camIndex === 0} />
                      <JointMarker x={cam.contactPoint.x} y={cam.contactPoint.y} label={`F${camIndex + 1}`} />
                      <text x={cam.center.x} y={cam.center.y + 73} textAnchor="middle">{camIndex === 0 ? "X CAM" : "Y CAM"}</text>
                    </g>
                  ))}
                  <polyline points={`${camDisplay.x.contactPoint.x},${camDisplay.x.contactPoint.y} ${camMechanism.crossSlide.drawingPoint.x},${camDisplay.x.contactPoint.y} ${camMechanism.crossSlide.drawingPoint.x},${camMechanism.crossSlide.drawingPoint.y}`} className={`${familyStyles.xPushrod} ${familyStyles.linkBar}`} markerEnd="url(#sketch-motion-arrow)" />
                  <polyline points={`${camDisplay.y.contactPoint.x},${camDisplay.y.contactPoint.y} ${camDisplay.y.contactPoint.x},${camMechanism.crossSlide.drawingPoint.y} ${camMechanism.crossSlide.drawingPoint.x},${camMechanism.crossSlide.drawingPoint.y}`} className={`${familyStyles.yPushrod} ${familyStyles.linkBar}`} markerEnd="url(#sketch-motion-arrow)" />
                  <line x1={selected.parameters.xLaw.minimum - 18} y1={camMechanism.crossSlide.drawingPoint.y} x2={selected.parameters.xLaw.maximum + 18} y2={camMechanism.crossSlide.drawingPoint.y} className={familyStyles.yCarriage} />
                  <line x1={camMechanism.crossSlide.drawingPoint.x} y1={selected.parameters.yLaw.minimum - 18} x2={camMechanism.crossSlide.drawingPoint.x} y2={selected.parameters.yLaw.maximum + 18} className={familyStyles.xCarriage} />
                  <rect x={camMechanism.crossSlide.drawingPoint.x - 13} y={camMechanism.crossSlide.drawingPoint.y - 13} width="26" height="26" rx="2" className={familyStyles.carriageBlock} />
                  <JointMarker x={camMechanism.crossSlide.drawingPoint.x} y={camMechanism.crossSlide.drawingPoint.y} label="P" active />
                </g>
              )}
              {!selected && <text x="295" y="285" textAnchor="middle" className={styles.emptyCanvas}>CAT CURVE → SOLVE → ANIMATE</text>}
            </svg>
          </div>
          <div className={styles.transport}>
            <button type="button" disabled={!selected} onClick={() => setPlaying((current) => !current)}>{playing ? "Ⅱ" : "▶"}<span>{playing ? copy.pause : copy.play}</span></button>
            <label><span>θ</span><input type="range" min="0" max="360" step="1" value={angle} disabled={!selected} onChange={(event) => { setPlaying(false); setAngle(Number(event.target.value)); }} /><b>{Math.round(angle)}°</b></label>
          </div>
        </section>

        <aside className={styles.resultPanel}>
          <div className={styles.panelHeading}><span>03</span><div><small>LINKAGE</small><h2>{copy.candidates}</h2></div></div>
          {candidates.length === 0 ? <p className={styles.emptyResults}>{copy.empty}</p> : (
            <div className={styles.candidateList}>
              {candidates.map((candidate, index) => (
                <button key={candidate.id} type="button" className={candidate.id === selected?.id ? styles.selectedCandidate : ""} onClick={() => { setSelectedId(candidate.id); setAngle(0); setZoom(defaultZoomFor(candidate.family)); setPan({ x: 0, y: 0 }); }}>
                  <span><b>{copy.candidate} {String(index + 1).padStart(2, "0")}</b><i>{familyCode(candidate.family, copy)}{("assemblyMode" in candidate) ? ` · ${candidate.assemblyMode.toUpperCase()}` : ""}</i></span>
                  <span><small>{copy.error}</small><strong>{format(candidate.normalizedRmse * 100, 2)}%</strong></span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              <section className={styles.metrics}>
                <div><span>{copy.error}</span><strong>{format(selected.normalizedRmse * 100, 2)}<small>%</small></strong></div>
                {("minimumTransmissionAngle" in selected) && <div><span>{copy.transmission}</span><strong>{format(selected.minimumTransmissionAngle)}<small>°</small></strong></div>}
                {selected.family === "gear-synchronized-xy" && <div><span>{copy.harmonics}</span><strong>{selected.parameters.harmonicCount}<small>×2</small></strong></div>}
                {selected.family === "dual-groove-cam" && <div><span>{copy.complexity}</span><strong>{copy.kinematicExact}</strong></div>}
              </section>
              {(selected.family === "gear-synchronized-xy" || selected.family === "dual-groove-cam") && (
                <section className={familyStyles.operationChain} aria-label={copy.principleTitle}>
                  {(selected.family === "gear-synchronized-xy"
                    ? [copy.inputShaftLabel, copy.harmonicBankLabel, copy.crossSlideLabel, copy.penLabel]
                    : [copy.camPairLabel, copy.followerLabel, copy.crossSlideLabel, copy.penLabel]
                  ).map((step) => <span key={step}>{step}</span>)}
                </section>
              )}
              <section className={styles.parameters}>
                <h3>{copy.parameters}</h3>
                {selected.family === "four-bar" && ([
                  [copy.ground, "L₀", selected.parameters.ground],
                  [copy.input, "L₁", selected.parameters.input],
                  [copy.coupler, "L₂", selected.parameters.coupler],
                  [copy.output, "L₃", selected.parameters.output],
                ] as const).map(([label, code, value]) => <div key={code}><span>{label}<small>{code}</small></span><b>{format(value)} mm</b></div>)}
                {selected.family === "geared-five-bar" && ([
                  [copy.ground, "L₀", selected.parameters.ground],
                  [copy.leftInput, "L₁", selected.parameters.leftInput],
                  [copy.leftCoupler, "L₂", selected.parameters.leftCoupler],
                  [copy.rightCoupler, "L₃", selected.parameters.rightCoupler],
                  [copy.rightInput, "L₄", selected.parameters.rightInput],
                ] as const).map(([label, code, value]) => <div key={code}><span>{label}<small>{code}</small></span><b>{format(value)} mm</b></div>)}
                {selected.family === "geared-five-bar" && (
                  <>
                    <div><span>{copy.gearRatio}<small>i</small></span><b>{format(selected.parameters.gearRatio, 0)} : 1</b></div>
                    <div><span>{copy.gearPhase}<small>φ₀</small></span><b>{format(selected.parameters.gearPhase)}°</b></div>
                  </>
                )}
                {(selected.family === "four-bar" || selected.family === "geared-five-bar") && (
                  <>
                    <h3>{copy.point}</h3>
                    <div><span>{copy.ratio}<small>u</small></span><b>{format(selected.parameters.couplerPointRatio, 3)}</b></div>
                    <div><span>{copy.offset}<small>v</small></span><b>{format(selected.parameters.couplerPointOffset)} mm</b></div>
                    <p>{copy.normalized}</p>
                  </>
                )}
                {selected.family === "gear-synchronized-xy" && (
                  <>
                    <div><span>{copy.harmonics}<small>N</small></span><b>{selected.parameters.harmonicCount} × 2</b></div>
                    <div><span>{copy.camSamples}<small>S</small></span><b>{selected.parameters.sampleCount}</b></div>
                    <p>{language === "zh" ? "同一输入轴通过整数齿轮倍频驱动 X/Y 两组偏心谐波，再由十字滑台合成轨迹。" : "One input shaft drives integer-ratio X/Y eccentric harmonics, combined by a cross slide."}</p>
                  </>
                )}
                {selected.family === "dual-groove-cam" && (
                  <>
                    <div><span>{copy.camSamples}<small>S</small></span><b>{selected.parameters.sampleCount} × 2</b></div>
                    <div><span>{copy.complexity}<small>CAM</small></span><b>{copy.kinematicExact}</b></div>
                    <p>{language === "zh" ? "当前仅为槽凸轮运动学模型；尚未校核接触力、强度、根切和制造可行性。" : selected.parameters.modelNote}</p>
                  </>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

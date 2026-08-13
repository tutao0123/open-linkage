"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CAT_TARGET_CURVE,
  sampleCandidateMechanism,
  type MechanismFamily,
  type SketchLinkageCandidate,
} from "@/lib/sketch-linkage";
import { precomputedCandidatesFor } from "@/lib/sketch-linkage-demo";
import type { Point } from "@/lib/four-bar";
import { useLanguage } from "./locale-shell";
import styles from "./sketch-linkage-lab.module.css";
import familyStyles from "./sketch-linkage-family.module.css";

const COPY = {
  zh: {
    back: "OpenLinkage",
    badge: "FIRST PRINCIPLES / PHASE 1",
    title: "Sketch → Mechanism",
    subtitle: "从猫轮廓出发，比较经典四杆与齿轮同步五杆的 coupler curve。",
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
    empty: "开始求解后，这里会显示完整可转的四杆与齿轮五杆候选。",
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
    principle: "候选已在本地用完整 Solver 预计算并通过 360° 验证。页面只重放四杆闭环与齿轮同步五杆运动学，因此点击后可以立即展示和播放。",
    limitationTitle: "第一阶段边界",
    limitation: "当前只开放两个明确机构族。6–10 杆会按 Watt、Stephenson 和串联多环逐族加入，不把任意拓扑搜索伪装成已经可用。",
    familyTitle: "参与搜索的机构族",
    compare: "四杆 + 齿轮五杆",
    fourBar: "经典四杆",
    gearedFiveBar: "齿轮同步五杆",
    fourBarCode: "4-BAR",
    gearedFiveBarCode: "GEARED 5-BAR",
  },
  en: {
    back: "OpenLinkage",
    badge: "FIRST PRINCIPLES / PHASE 1",
    title: "Sketch → Mechanism",
    subtitle: "Start from a cat outline and compare classic four-bar and gear-synchronized five-bar coupler curves.",
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
    empty: "Run the solver to generate full-cycle four-bar and geared five-bar candidates.",
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
    principle: "Candidates were precomputed locally with the full solver and verified over 360°. The page only replays four-bar and gear-synchronized five-bar kinematics, so results appear immediately.",
    limitationTitle: "Phase-one boundary",
    limitation: "Only two explicit mechanism families are enabled. Watt, Stephenson, and serial multi-loop families will add 6–10 links incrementally; arbitrary topology search is not presented as solved.",
    familyTitle: "Mechanism families to search",
    compare: "Four-bar + geared five-bar",
    fourBar: "Classic four-bar",
    gearedFiveBar: "Gear-synchronized five-bar",
    fourBarCode: "4-BAR",
    gearedFiveBarCode: "GEARED 5-BAR",
  },
} as const;

function pointsPath(points: Point[], closed = true) {
  if (points.length === 0) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}${closed ? " Z" : ""}`;
}

function format(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

type FamilyMode = MechanismFamily | "compare";

export function SketchLinkageLab() {
  const language = useLanguage();
  const copy = COPY[language];
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const [candidates, setCandidates] = useState<SketchLinkageCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [angle, setAngle] = useState(0);
  const [familyMode, setFamilyMode] = useState<FamilyMode>("compare");

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  const mechanism = useMemo(() => selected ? sampleCandidateMechanism(selected, angle) : null, [angle, selected]);
  const targetPath = useMemo(() => pointsPath(CAT_TARGET_CURVE), []);
  const tracePath = useMemo(() => selected ? pointsPath(selected.trajectory) : "", [selected]);

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
  };

  const loadDemo = () => {
    const nextCandidates = precomputedCandidatesFor(familyMode);
    setCandidates(nextCandidates);
    setSelectedId(nextCandidates[0]?.id ?? null);
    setAngle(0);
    setPlaying(nextCandidates.length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
          <span>CAT CURVE</span><i>→</i><span>OPENLINK SOLVER</span><i>→</i><span>4 / 5-BAR</span><i>→</i><span>COUPLER TRACE</span>
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
              ["compare", copy.compare],
              ["four-bar", copy.fourBar],
              ["geared-five-bar", copy.gearedFiveBar],
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
          <div className={styles.canvas}>
            <svg viewBox="25 50 540 450" role="img" aria-label={copy.canvas}>
              <defs>
                <pattern id="sketch-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" /></pattern>
              </defs>
              <rect x="25" y="50" width="540" height="450" className={styles.grid} />
              <path d={targetPath} className={styles.targetCurve} />
              {selected && <path d={tracePath} className={styles.fittedCurve} />}
              {mechanism && (
                <g className={styles.mechanism}>
                  {mechanism.gears.map((gear, gearIndex) => (
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
                  <line x1={mechanism.ground.start.x} y1={mechanism.ground.start.y} x2={mechanism.ground.end.x} y2={mechanism.ground.end.y} className={styles.groundLink} />
                  {mechanism.links.map((link, linkIndex) => (
                    <line
                      key={`link-${linkIndex}`}
                      x1={link.start.x}
                      y1={link.start.y}
                      x2={link.end.x}
                      y2={link.end.y}
                      className={link.kind === "coupler" ? styles.couplerLink : ""}
                    />
                  ))}
                  <line x1={mechanism.tracerBase.x} y1={mechanism.tracerBase.y} x2={mechanism.couplerPoint.x} y2={mechanism.couplerPoint.y} className={styles.tracerArm} />
                  {mechanism.joints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="6" />)}
                  <circle cx={mechanism.couplerPoint.x} cy={mechanism.couplerPoint.y} r="8" className={styles.tracerPoint} />
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
                <button key={candidate.id} type="button" className={candidate.id === selected?.id ? styles.selectedCandidate : ""} onClick={() => { setSelectedId(candidate.id); setAngle(0); }}>
                  <span><b>{copy.candidate} {String(index + 1).padStart(2, "0")}</b><i>{candidate.family === "four-bar" ? copy.fourBarCode : copy.gearedFiveBarCode} · {candidate.assemblyMode.toUpperCase()}</i></span>
                  <span><small>{copy.error}</small><strong>{format(candidate.normalizedRmse * 100, 2)}%</strong></span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              <section className={styles.metrics}>
                <div><span>{copy.error}</span><strong>{format(selected.normalizedRmse * 100, 2)}<small>%</small></strong></div>
                <div><span>{copy.transmission}</span><strong>{format(selected.minimumTransmissionAngle)}<small>°</small></strong></div>
              </section>
              <section className={styles.parameters}>
                <h3>{copy.parameters}</h3>
                {(selected.family === "four-bar" ? ([
                  [copy.ground, "L₀", selected.parameters.ground],
                  [copy.input, "L₁", selected.parameters.input],
                  [copy.coupler, "L₂", selected.parameters.coupler],
                  [copy.output, "L₃", selected.parameters.output],
                ] as const) : ([
                  [copy.ground, "L₀", selected.parameters.ground],
                  [copy.leftInput, "L₁", selected.parameters.leftInput],
                  [copy.leftCoupler, "L₂", selected.parameters.leftCoupler],
                  [copy.rightCoupler, "L₃", selected.parameters.rightCoupler],
                  [copy.rightInput, "L₄", selected.parameters.rightInput],
                ] as const)).map(([label, code, value]) => <div key={code}><span>{label}<small>{code}</small></span><b>{format(value)} mm</b></div>)}
                {selected.family === "geared-five-bar" && (
                  <>
                    <div><span>{copy.gearRatio}<small>i</small></span><b>{format(selected.parameters.gearRatio, 0)} : 1</b></div>
                    <div><span>{copy.gearPhase}<small>φ₀</small></span><b>{format(selected.parameters.gearPhase)}°</b></div>
                  </>
                )}
                <h3>{copy.point}</h3>
                <div><span>{copy.ratio}<small>u</small></span><b>{format(selected.parameters.couplerPointRatio, 3)}</b></div>
                <div><span>{copy.offset}<small>v</small></span><b>{format(selected.parameters.couplerPointOffset)} mm</b></div>
                <p>{copy.normalized}</p>
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

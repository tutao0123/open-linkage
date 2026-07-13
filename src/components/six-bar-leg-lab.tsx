"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { analyzeSixBarLeg, solveSixBarLeg, type SixBarParameters } from "@/lib/six-bar";
import styles from "./six-bar-leg-lab.module.css";

const DEFAULT_PARAMETERS: SixBarParameters = {
  groundPivot: 260,
  rearPivotX: 120,
  rearPivotY: -100,
  crank: 55,
  firstCoupler: 220,
  firstRocker: 145,
  secondCoupler: 250,
  secondRocker: 190,
  footRatio: 1.35,
  footOffset: -28,
};

const LENGTH_FIELDS: Array<{ key: keyof SixBarParameters; label: string; code: string; step?: number }> = [
  { key: "groundPivot", label: "前固定轴距", code: "g₁" },
  { key: "crank", label: "主曲柄", code: "l₁" },
  { key: "firstCoupler", label: "一级连杆", code: "l₂" },
  { key: "firstRocker", label: "一级摇杆", code: "l₃" },
  { key: "secondCoupler", label: "腿部连杆", code: "l₄" },
  { key: "secondRocker", label: "后摇杆", code: "l₅" },
  { key: "rearPivotX", label: "后固定点 X", code: "O₃x" },
  { key: "rearPivotY", label: "后固定点 Y", code: "O₃y" },
  { key: "footRatio", label: "足端延伸比", code: "λ", step: 0.01 },
  { key: "footOffset", label: "足端法向偏移", code: "e" },
];

export function SixBarLegLab() {
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [inputAngle, setInputAngle] = useState(35);
  const [speed, setSpeed] = useState(14);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      setInputAngle((angle) => (angle + speed * 6 * elapsed) % 360);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const position = useMemo(() => solveSixBarLeg(parameters, inputAngle), [parameters, inputAngle]);
  const analysis = useMemo(() => analyzeSixBarLeg(parameters), [parameters]);
  const points = position
    ? [
        { x: 0, y: 0 },
        position.crankJoint,
        position.sharedJoint,
        { x: parameters.groundPivot, y: 0 },
        position.secondJoint,
        { x: parameters.rearPivotX, y: parameters.rearPivotY },
        position.footPoint,
      ]
    : [{ x: 0, y: 0 }, { x: parameters.groundPivot, y: 0 }, { x: parameters.rearPivotX, y: parameters.rearPivotY }];
  const minimumX = Math.min(...points.map((point) => point.x), -100);
  const maximumX = Math.max(...points.map((point) => point.x), 360);
  const minimumY = Math.min(...points.map((point) => point.y), -260);
  const maximumY = Math.max(...points.map((point) => point.y), 220);
  const padding = 80;
  const viewBox = `${minimumX - padding} ${-(maximumY + padding)} ${maximumX - minimumX + padding * 2} ${maximumY - minimumY + padding * 2}`;

  const update = (key: keyof SixBarParameters, value: number) => {
    setParameters((current) => ({
      ...current,
      [key]: key === "rearPivotY" || key === "footOffset" ? value : Math.max(key === "footRatio" ? 0.2 : 1, value || 1),
    }));
  };

  const reset = () => {
    setPlaying(false);
    setParameters(DEFAULT_PARAMETERS);
    setInputAngle(35);
    setSpeed(14);
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav><Link href="/lab">四杆实验室</Link><span>六杆腿模板 · BETA</span></nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>六杆腿参数</h1></div><button onClick={reset} type="button">恢复默认</button></div>
          <p className={styles.intro}>两个四杆闭环共享关节 B，足端固定在第二级连杆延长线上。</p>
          <div className={styles.fields}>
            {LENGTH_FIELDS.map((field) => (
              <label key={field.key}>
                <span>{field.label}<b>{field.code}</b></span>
                <input
                  type="number"
                  step={field.step ?? 1}
                  value={Number(parameters[field.key].toFixed(2))}
                  onChange={(event) => update(field.key, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        </aside>

        <main className={styles.stage}>
          <div className={styles.stageHeader}>
            <span className={position ? styles.solved : styles.invalid}>{position ? "双闭环已求解" : "当前角度无解"}</span>
            <span>输入角 {inputAngle.toFixed(1)}°</span>
            <span>WATT 6-BAR</span>
          </div>
          <div className={styles.canvas}>
            <svg viewBox={viewBox} role="img" aria-label="Watt 类六杆腿运动学画布">
              <defs><pattern id="leg-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" className={styles.grid} /></pattern></defs>
              <rect x={minimumX - padding} y={-(maximumY + padding)} width={maximumX - minimumX + padding * 2} height={maximumY - minimumY + padding * 2} fill="url(#leg-grid)" />
              <path d={`M0,0 L${parameters.groundPivot},0 L${parameters.rearPivotX},${-parameters.rearPivotY} Z`} className={styles.ground} />
              {analysis.trailPath && <path d={analysis.trailPath} className={styles.trail} />}
              {position ? (
                <>
                  <line x1="0" y1="0" x2={position.crankJoint.x} y2={-position.crankJoint.y} className={`${styles.link} ${styles.crank}`} />
                  <line x1={position.crankJoint.x} y1={-position.crankJoint.y} x2={position.sharedJoint.x} y2={-position.sharedJoint.y} className={`${styles.link} ${styles.primary}`} />
                  <line x1={parameters.groundPivot} y1="0" x2={position.sharedJoint.x} y2={-position.sharedJoint.y} className={styles.link} />
                  <line x1={position.sharedJoint.x} y1={-position.sharedJoint.y} x2={position.secondJoint.x} y2={-position.secondJoint.y} className={`${styles.link} ${styles.legLink}`} />
                  <line x1={parameters.rearPivotX} y1={-parameters.rearPivotY} x2={position.secondJoint.x} y2={-position.secondJoint.y} className={styles.link} />
                  <line x1={position.secondJoint.x} y1={-position.secondJoint.y} x2={position.footPoint.x} y2={-position.footPoint.y} className={`${styles.link} ${styles.footExtension}`} />
                  {[
                    { id: "o1", x: 0, y: 0 },
                    { id: "a", x: position.crankJoint.x, y: -position.crankJoint.y },
                    { id: "b", x: position.sharedJoint.x, y: -position.sharedJoint.y },
                    { id: "o2", x: parameters.groundPivot, y: 0 },
                    { id: "c", x: position.secondJoint.x, y: -position.secondJoint.y },
                    { id: "o3", x: parameters.rearPivotX, y: -parameters.rearPivotY },
                  ].map((joint) => <g key={joint.id}><circle cx={joint.x} cy={joint.y} r="10" className={styles.joint} /><circle cx={joint.x} cy={joint.y} r="3" className={styles.pin} /></g>)}
                  <circle cx={position.footPoint.x} cy={-position.footPoint.y} r="11" className={styles.foot} />
                </>
              ) : <text x={(minimumX + maximumX) / 2} y="0" textAnchor="middle" className={styles.invalidText}>当前参数无法完成双闭环装配</text>}
            </svg>
          </div>
          <div className={styles.transport}>
            <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "暂停六杆腿动画" : "播放六杆腿动画"}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="六杆腿输入角" type="range" min="0" max="360" step="0.1" value={inputAngle} onChange={(event) => setInputAngle(Number(event.target.value))} />
            <label>转速 <input type="number" min="1" max="120" value={speed} onChange={(event) => setSpeed(Math.max(1, Number(event.target.value) || 1))} /> rpm</label>
          </div>
        </main>

        <aside className={`${styles.panel} ${styles.analysis}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>腿部分析</h2></div></div>
          <div className={styles.topology}><span>1 DOF</span><h3>Watt 类六杆腿</h3><p>主曲柄连续旋转，两个闭环依次将旋转转换为足端周期轨迹。</p></div>
          <div className={styles.metrics}>
            <div><span>整周可装配率</span><strong>{(analysis.validRatio * 100).toFixed(1)}<small>%</small></strong></div>
            <div><span>理论步长</span><strong>{analysis.stepLength.toFixed(1)}<small>mm</small></strong></div>
            <div><span>轨迹总高度</span><strong>{analysis.liftHeight.toFixed(1)}<small>mm</small></strong></div>
            <div><span>当前足端 X</span><strong>{position ? position.footPoint.x.toFixed(1) : "—"}</strong></div>
            <div><span>当前足端 Y</span><strong>{position ? position.footPoint.y.toFixed(1) : "—"}</strong></div>
          </div>
          <div className={analysis.validRatio === 1 ? styles.healthGood : styles.healthWarn}>
            <b>{analysis.validRatio === 1 ? "连续运动通过" : "存在装配中断"}</b>
            <p>{analysis.validRatio === 1 ? "两个闭环在主曲柄整周旋转时始终存在几何解。" : "部分输入角无法闭合，请调整第二级连杆或固定点位置。"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

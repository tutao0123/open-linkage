"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Point } from "@/lib/four-bar";
import {
  synthesizeSixBarLeg,
  type SixBarCandidate,
  type SynthesisPriority,
} from "@/lib/six-bar-synthesis";
import { analyzeSixBarLeg, solveSixBarLeg, type SixBarParameters } from "@/lib/six-bar";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSvgViewport } from "./use-svg-viewport";
import editorStyles from "./four-bar-editor.module.css";
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

const STORAGE_KEY = "open-linkage:six-bar-project:v2";

type EditorMode = "inspect" | "trajectory";

type SixBarProject = {
  version: 2;
  mechanismType: "six-bar-leg";
  parameters: SixBarParameters;
  inputAngle: number;
  speed: number;
  targetPath: Point[];
  priority: SynthesisPriority;
  candidates?: SixBarCandidate[];
};

const LENGTH_FIELDS: Array<{
  key: keyof SixBarParameters;
  label: string;
  code: string;
  step?: number;
}> = [
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

const PRIORITY_OPTIONS: Array<{ value: SynthesisPriority; label: string }> = [
  { value: "balanced", label: "综合平衡" },
  { value: "accuracy", label: "轨迹精度" },
  { value: "transmission", label: "传动性能" },
];

function pathData(points: Point[], close = true) {
  if (!points.length) return "";
  const commands = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${(-point.y).toFixed(2)}`)
    .join(" ");
  return `${commands}${close && commands ? " Z" : ""}`;
}

function isValidProject(project: SixBarProject) {
  return project.version === 2
    && project.mechanismType === "six-bar-leg"
    && Object.values(project.parameters).every(Number.isFinite)
    && [
      project.parameters.groundPivot,
      project.parameters.crank,
      project.parameters.firstCoupler,
      project.parameters.firstRocker,
      project.parameters.secondCoupler,
      project.parameters.secondRocker,
    ].every((value) => value > 0);
}

export function SixBarLegLab() {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [inputAngle, setInputAngle] = useState(35);
  const [speed, setSpeed] = useState(14);
  const [playing, setPlaying] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("inspect");
  const [drawing, setDrawing] = useState(false);
  const [targetPoints, setTargetPoints] = useState<Point[]>([]);
  const [priority, setPriority] = useState<SynthesisPriority>("balanced");
  const [fitting, setFitting] = useState(false);
  const [fitProgress, setFitProgress] = useState(0);
  const [candidates, setCandidates] = useState<SixBarCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [message, setMessage] = useState("浏览器自动保存已开启");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try {
        const project = JSON.parse(saved) as SixBarProject;
        if (!isValidProject(project)) return;
        setParameters(project.parameters);
        setInputAngle(project.inputAngle);
        setSpeed(project.speed);
        setTargetPoints(Array.isArray(project.targetPath) ? project.targetPath : []);
        setPriority(project.priority ?? "balanced");
        setCandidates(Array.isArray(project.candidates) ? project.candidates : []);
        setSelectedCandidateId(project.candidates?.[0]?.id ?? null);
        setMessage("已恢复上次六杆腿项目");
      } catch {
        setMessage("自动保存数据损坏，已使用默认项目");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const project: SixBarProject = {
      version: 2,
      mechanismType: "six-bar-leg",
      parameters,
      inputAngle,
      speed,
      targetPath: targetPoints,
      priority,
      candidates,
    };
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [parameters, inputAngle, speed, targetPoints, priority, candidates]);

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

  const position = useMemo(
    () => solveSixBarLeg(parameters, inputAngle),
    [parameters, inputAngle],
  );
  const analysis = useMemo(() => analyzeSixBarLeg(parameters), [parameters]);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId],
  );
  const targetPathData = useMemo(() => pathData(targetPoints), [targetPoints]);
  const candidatePathData = useMemo(
    () => pathData(selectedCandidate?.generatedPath ?? []),
    [selectedCandidate],
  );
  const maximumLength = Math.max(
    parameters.groundPivot,
    parameters.crank,
    parameters.firstCoupler,
    parameters.firstRocker,
    parameters.secondCoupler,
    parameters.secondRocker,
    180,
  );
  const baseView = useMemo(() => ({
    x: -maximumLength * 1.25,
    y: -maximumLength * 1.45,
    width: maximumLength * 3.4,
    height: maximumLength * 2.9,
  }), [maximumLength]);
  const viewport = useSvgViewport(baseView);
  const landingSpeed = selectedCandidate
    ? selectedCandidate.landingVelocityPerRadian * speed * Math.PI * 2 / 60
    : null;
  const warnings = [
    analysis.validRatio < 1 ? "存在无法装配的主曲柄角度" : null,
    analysis.minTransmissionAngle < 30 ? "最小传动角低于 30°，高速承载风险较高" : null,
    targetPoints.length < 12 ? "请绘制或生成一条闭合足端轨迹" : null,
    selectedCandidate && selectedCandidate.maxError > selectedCandidate.rmse * 2.8
      ? "候选方案存在局部误差峰值"
      : null,
  ].filter((warning): warning is string => warning !== null);

  const update = (key: keyof SixBarParameters, value: number) => {
    setCandidates([]);
    setSelectedCandidateId(null);
    setParameters((current) => ({
      ...current,
      [key]: key === "rearPivotX" || key === "rearPivotY" || key === "footOffset"
        ? value
        : Math.max(key === "footRatio" ? 0.2 : 1, value || 1),
    }));
  };

  const pointerToMechanism = (event: { clientX: number; clientY: number }) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: -point.y };
  };

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (editorMode !== "trajectory" || fitting) return;
    const point = pointerToMechanism(event);
    if (!point) return;
    event.preventDefault();
    setPlaying(false);
    setTargetPoints([point]);
    setCandidates([]);
    setSelectedCandidateId(null);
    setDrawing(true);
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const point = pointerToMechanism(event);
    if (!point) return;
    setTargetPoints((current) => {
      const previous = current[current.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return current;
      return [...current, point];
    });
  };

  const stopDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    setDrawing(false);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    setMessage("目标足迹已记录，可以开始生成候选方案");
  };

  const createGaitPreset = () => {
    const footPoints = analysis.samples.map((sample) => sample.position.footPoint);
    const centerX = footPoints.length
      ? (Math.min(...footPoints.map((point) => point.x)) + Math.max(...footPoints.map((point) => point.x))) / 2
      : parameters.groundPivot / 2;
    const groundY = footPoints.length ? Math.min(...footPoints.map((point) => point.y)) : -180;
    const stepLength = Math.max(220, analysis.stepLength * 1.5);
    const liftHeight = Math.max(80, Math.min(160, analysis.liftHeight * 0.85));
    const stanceRatio = 0.62;
    const points = Array.from({ length: 72 }, (_, index) => {
      const progress = index / 72;
      if (progress < stanceRatio) {
        const stance = progress / stanceRatio;
        return {
          x: centerX + stepLength / 2 - stepLength * stance,
          y: groundY + Math.sin(stance * Math.PI) * 2,
        };
      }
      const swing = (progress - stanceRatio) / (1 - stanceRatio);
      return {
        x: centerX - stepLength / 2 + stepLength * swing,
        y: groundY + liftHeight * Math.sin(swing * Math.PI) ** 1.15,
      };
    });
    setPlaying(false);
    setEditorMode("trajectory");
    setTargetPoints(points);
    setCandidates([]);
    setSelectedCandidateId(null);
    setMessage("已生成 62% 支撑相的推荐马蹄轨迹");
  };

  const runSynthesis = async () => {
    if (targetPoints.length < 12 || fitting) return;
    setPlaying(false);
    setFitting(true);
    setFitProgress(0);
    setCandidates([]);
    setSelectedCandidateId(null);
    setMessage("正在进行六杆全局搜索…");
    try {
      const results = await synthesizeSixBarLeg(
        targetPoints,
        parameters,
        priority,
        setFitProgress,
        5,
      );
      setCandidates(results);
      if (results[0]) {
        setSelectedCandidateId(results[0].id);
        setParameters(results[0].parameters);
        setInputAngle(results[0].phase);
        setEditorMode("inspect");
        setMessage(`已生成 ${results.length} 套可装配候选方案`);
      } else {
        setMessage("没有找到连续装配方案，请调整轨迹尺寸后重试");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "六杆综合失败");
    } finally {
      setFitting(false);
    }
  };

  const applyCandidate = (candidate: SixBarCandidate) => {
    setPlaying(false);
    setSelectedCandidateId(candidate.id);
    setParameters(candidate.parameters);
    setInputAngle(candidate.phase);
    setEditorMode("inspect");
    setMessage(`已载入第 ${candidates.indexOf(candidate) + 1} 名：${candidate.label}`);
  };

  const reset = () => {
    setPlaying(false);
    setParameters(DEFAULT_PARAMETERS);
    setInputAngle(35);
    setSpeed(14);
    setTargetPoints([]);
    setCandidates([]);
    setSelectedCandidateId(null);
    setPriority("balanced");
    setEditorMode("inspect");
    viewport.resetView();
    setMessage("已恢复默认六杆腿");
  };

  const getProject = (): SixBarProject => ({
    version: 2,
    mechanismType: "six-bar-leg",
    parameters,
    inputAngle,
    speed,
    targetPath: targetPoints,
    priority,
    candidates,
  });

  const downloadProject = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(getProject(), null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "open-linkage-six-bar-leg.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("六杆腿项目 JSON 已导出");
  };

  const importProject = async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as SixBarProject;
      if (!isValidProject(project)) throw new Error("invalid project");
      setPlaying(false);
      setParameters(project.parameters);
      setInputAngle(project.inputAngle);
      setSpeed(project.speed);
      setTargetPoints(Array.isArray(project.targetPath) ? project.targetPath : []);
      setPriority(project.priority ?? "balanced");
      setCandidates(Array.isArray(project.candidates) ? project.candidates : []);
      setSelectedCandidateId(project.candidates?.[0]?.id ?? null);
      setMessage(`已载入 ${file.name}`);
    } catch {
      setMessage("无法载入：不是有效的六杆腿项目文件");
    }
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav><Link href="/lab">四杆设计</Link><Link href="/variable-leg">可变步行腿</Link><Link href="/straight-line">直线机构</Link><Link href="/designer">自由设计</Link><span>六杆腿轨迹综合 · BETA</span></nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}>
            <div><span>01</span><h1>设计与目标</h1></div>
            <button onClick={reset} type="button">恢复默认</button>
          </div>

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

          <div className={styles.synthesisBox}>
            <label>优化侧重
              <select value={priority} onChange={(event) => setPriority(event.target.value as SynthesisPriority)}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {fitting && <div className={styles.progress}><i style={{ width: `${fitProgress * 100}%` }} /></div>}
            <small>{targetPoints.length ? `目标轨迹 ${targetPoints.length} 点 · ${message}` : message}</small>
          </div>

          <div className={styles.projectTools}>
            <button type="button" onClick={downloadProject}>导出 JSON</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>导入项目</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importProject(file);
                event.target.value = "";
              }}
            />
          </div>
        </aside>

        <main className={styles.stage}>
          <div className={styles.stageHeader}>
            <span className={position ? styles.solved : styles.invalid}>{position ? "双闭环已求解" : "当前角度无解"}</span>
            <span>输入角 {inputAngle.toFixed(1)}°</span>
            <span>{editorMode === "trajectory" ? "按住画布绘制" : "WATT 6-BAR"}</span>
          </div>
          <div className={`${styles.canvas} ${editorMode === "trajectory" ? styles.drawingCanvas : ""}`}>
            <div className={editorStyles.canvasActions}>
              <div className={editorStyles.modeSwitch} role="group" aria-label="编辑模式">
                <button className={editorMode === "inspect" ? editorStyles.selected : ""} type="button" onClick={() => setEditorMode("inspect")}>编辑机构</button>
                <button className={editorMode === "trajectory" ? editorStyles.selected : ""} type="button" onClick={() => setEditorMode("trajectory")}>绘制轨迹</button>
              </div>
              <button type="button" onClick={createGaitPreset}>推荐马蹄轨迹</button>
              <button type="button" onClick={() => { setTargetPoints([]); setCandidates([]); setSelectedCandidateId(null); }} disabled={!targetPoints.length}>清除轨迹</button>
              <button className={editorStyles.fitButton} type="button" onClick={() => void runSynthesis()} disabled={targetPoints.length < 12 || fitting}>
                {fitting ? `搜索 ${Math.round(fitProgress * 100)}%` : "生成 5 套方案"}
              </button>
            </div>
            <SvgViewportControls
              zoom={viewport.zoom}
              onZoomIn={viewport.zoomIn}
              onZoomOut={viewport.zoomOut}
              onReset={viewport.resetView}
            />
            <svg
              ref={svgRef}
              className={viewport.isPanning ? editorStyles.panning : undefined}
              viewBox={viewport.viewBox}
              role="img"
              aria-label="Watt 类六杆机械腿运动学与目标足迹画布"
              onWheel={viewport.handleWheel}
              onPointerDown={(event) => {
                if (!viewport.startPan(event)) startDrawing(event);
              }}
              onPointerMove={(event) => {
                if (!viewport.movePan(event)) movePointer(event);
              }}
              onPointerUp={(event) => {
                if (!viewport.endPan(event)) stopDrawing(event);
              }}
              onPointerCancel={(event) => {
                if (!viewport.endPan(event)) stopDrawing(event);
              }}
            >
              <defs><pattern id="leg-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" className={styles.grid} /></pattern></defs>
              <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#leg-grid)" />
              <path d={`M0,0 L${parameters.groundPivot},0 L${parameters.rearPivotX},${-parameters.rearPivotY} Z`} className={styles.ground} />
              {analysis.trailPath && <path d={analysis.trailPath} className={styles.trail} />}
              {targetPathData && <path d={targetPathData} className={styles.targetPath} />}
              {candidatePathData && <path d={candidatePathData} className={styles.candidatePath} />}
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
                  ].map((joint) => (
                    <g key={joint.id}>
                      <circle cx={joint.x} cy={joint.y} r="10" className={styles.joint} />
                      <circle cx={joint.x} cy={joint.y} r="3" className={styles.pin} />
                    </g>
                  ))}
                  <circle cx={position.footPoint.x} cy={-position.footPoint.y} r="11" className={styles.foot} />
                </>
              ) : <text x={parameters.groundPivot / 2} y="0" textAnchor="middle" className={styles.invalidText}>当前参数无法完成双闭环装配</text>}
            </svg>
            {fitting && <div className={styles.optimizingOverlay}><strong>{Math.round(fitProgress * 100)}%</strong><span>搜索可制造的六杆方案</span></div>}
          </div>
          <div className={styles.legend}>
            <span><i className={styles.legendTarget} />目标足迹</span>
            <span><i className={styles.legendCurrent} />当前机构</span>
            <span><i className={styles.legendCandidate} />候选拟合</span>
          </div>
          <div className={styles.transport}>
            <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "暂停六杆腿动画" : "播放六杆腿动画"}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="六杆腿输入角" type="range" min="0" max="360" step="0.1" value={inputAngle} onChange={(event) => setInputAngle(Number(event.target.value))} />
            <label>转速 <input type="number" min="1" max="120" value={speed} onChange={(event) => setSpeed(Math.max(1, Number(event.target.value) || 1))} /> rpm</label>
          </div>
        </main>

        <aside className={`${styles.panel} ${styles.analysis}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>候选与排名</h2></div></div>
          {candidates.length ? (
            <div className={styles.candidateList}>
              {candidates.map((candidate, index) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={candidate.id === selectedCandidateId ? styles.selectedCandidate : ""}
                  onClick={() => applyCandidate(candidate)}
                >
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.candidateMain}><b>{candidate.label}</b><small>RMSE {candidate.rmse.toFixed(1)} mm · 最大 {candidate.maxError.toFixed(1)} mm</small></span>
                  <span className={styles.candidateScore}>{candidate.score.toFixed(0)}<small>分</small></span>
                  <span className={styles.candidateDetails}><i>最小传动角 {candidate.minTransmissionAngle.toFixed(1)}°</i><i>连续率 {(candidate.validRatio * 100).toFixed(0)}%</i></span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCandidates}><b>等待目标轨迹</b><p>绘制轨迹后，系统会返回五套尺寸不同的候选，并按轨迹、连续装配和传动性能综合排名。</p></div>
          )}

          <div className={styles.metrics}>
            <div><span>整周装配率</span><strong>{(analysis.validRatio * 100).toFixed(1)}<small>%</small></strong></div>
            <div><span>最小传动角</span><strong>{analysis.minTransmissionAngle.toFixed(1)}<small>°</small></strong></div>
            <div><span>理论步长</span><strong>{analysis.stepLength.toFixed(1)}<small>mm</small></strong></div>
            <div><span>轨迹总高度</span><strong>{analysis.liftHeight.toFixed(1)}<small>mm</small></strong></div>
            <div><span>机构性能分</span><strong>{analysis.performanceScore.toFixed(0)}<small>/100</small></strong></div>
            <div><span>估算落地垂速</span><strong>{landingSpeed === null ? "—" : landingSpeed.toFixed(1)}<small>{landingSpeed === null ? "" : "mm/s"}</small></strong></div>
          </div>

          <div className={warnings.length ? styles.healthWarn : styles.healthGood}>
            <b>{warnings.length ? `${warnings.length} 项工程提示` : "运动学检查通过"}</b>
            {warnings.length ? <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>双闭环整周连续，传动角处于当前基础阈值之上。</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

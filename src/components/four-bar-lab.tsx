"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  analyzeMotion,
  classifyFourBar,
  solveFourBar,
  type AssemblyMode,
  type FourBarParameters,
  type Point,
} from "@/lib/four-bar";
import { fitFourBarToClosedPath, type PathFitResult } from "@/lib/path-synthesis";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSvgViewport } from "./use-svg-viewport";
import styles from "./four-bar-lab.module.css";
import editorStyles from "./four-bar-editor.module.css";

const DEFAULT_PARAMETERS: FourBarParameters = {
  ground: 300,
  input: 80,
  coupler: 260,
  output: 180,
  couplerPointRatio: 0.56,
  couplerPointOffset: 42,
};

const STORAGE_KEY = "open-linkage:four-bar-project:v1";

type DragTarget = "input" | "coupler" | "outputPivot" | "tracer";
type EditorMode = "mechanism" | "trajectory";

type FourBarProject = {
  version: 1;
  mechanismType: "four-bar";
  parameters: FourBarParameters;
  assemblyMode: AssemblyMode;
  inputAngle: number;
  speed: number;
  targetPath?: Point[];
};

const LINK_FIELDS: Array<{ key: keyof Pick<FourBarParameters, "ground" | "input" | "coupler" | "output">; label: string; code: string }> = [
  { key: "ground", label: "机架", code: "r₁" },
  { key: "input", label: "主动杆", code: "r₂" },
  { key: "coupler", label: "连杆", code: "r₃" },
  { key: "output", label: "从动杆", code: "r₄" },
];

function formatNumber(value: number | null, digits = 1) {
  return value === null ? "—" : value.toFixed(digits);
}

export function FourBarLab() {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [inputAngle, setInputAngle] = useState(38);
  const [assemblyMode, setAssemblyMode] = useState<AssemblyMode>("open");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(18);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("mechanism");
  const [drawing, setDrawing] = useState(false);
  const [targetPoints, setTargetPoints] = useState<Point[]>([]);
  const [fitting, setFitting] = useState(false);
  const [fitProgress, setFitProgress] = useState(0);
  const [fitResult, setFitResult] = useState<PathFitResult | null>(null);
  const [projectMessage, setProjectMessage] = useState("浏览器自动保存已开启");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try {
        const project = JSON.parse(saved) as FourBarProject;
        if (project.version === 1 && project.mechanismType === "four-bar") {
          setParameters(project.parameters);
          setAssemblyMode(project.assemblyMode);
          setInputAngle(project.inputAngle);
          setSpeed(project.speed);
          setTargetPoints(Array.isArray(project.targetPath) ? project.targetPath : []);
          setProjectMessage("已恢复上次编辑内容");
        }
      } catch {
        setProjectMessage("自动保存数据损坏，已使用默认项目");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const project: FourBarProject = {
      version: 1,
      mechanismType: "four-bar",
      parameters,
      assemblyMode,
      inputAngle,
      speed,
      targetPath: targetPoints,
    };
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [parameters, assemblyMode, inputAngle, speed, targetPoints]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const seconds = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      setInputAngle((angle) => (angle + speed * 6 * seconds) % 360);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const position = useMemo(
    () => solveFourBar(parameters, inputAngle, assemblyMode),
    [parameters, inputAngle, assemblyMode],
  );
  const analysis = useMemo(() => analyzeMotion(parameters, assemblyMode), [parameters, assemblyMode]);
  const classification = useMemo(() => classifyFourBar(parameters), [parameters]);
  const targetPathData = useMemo(
    () => targetPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${(-point.y).toFixed(2)}`).join(" ") + (targetPoints.length > 2 ? " Z" : ""),
    [targetPoints],
  );

  const maximumLength = Math.max(parameters.ground, parameters.input, parameters.coupler, parameters.output);
  const horizontalPadding = Math.max(90, maximumLength * 0.65);
  const verticalExtent = Math.max(210, (parameters.input + parameters.couplerPointOffset) * 1.8);
  const baseView = useMemo(() => ({
    x: -horizontalPadding,
    y: -verticalExtent,
    width: parameters.ground + horizontalPadding * 2,
    height: verticalExtent * 2,
  }), [horizontalPadding, parameters.ground, verticalExtent]);
  const viewport = useSvgViewport(baseView);

  const updateLength = (key: keyof FourBarParameters, value: number) => {
    setParameters((current) => ({ ...current, [key]: Math.max(1, value || 1) }));
  };

  const updateParameter = (key: keyof FourBarParameters, value: number) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  const getProject = (): FourBarProject => ({
    version: 1,
    mechanismType: "four-bar",
    parameters,
    assemblyMode,
    inputAngle,
    speed,
    targetPath: targetPoints,
  });

  const applyProject = (project: FourBarProject) => {
    const values = Object.values(project.parameters);
    if (
      project.version !== 1 ||
      project.mechanismType !== "four-bar" ||
      !values.every(Number.isFinite) ||
      [project.parameters.ground, project.parameters.input, project.parameters.coupler, project.parameters.output].some((value) => value <= 0)
    ) {
      throw new Error("invalid project");
    }
    setPlaying(false);
    setParameters(project.parameters);
    setAssemblyMode(project.assemblyMode === "crossed" ? "crossed" : "open");
    setInputAngle(Number.isFinite(project.inputAngle) ? project.inputAngle : 0);
    setSpeed(Number.isFinite(project.speed) ? Math.max(1, project.speed) : 18);
    setTargetPoints(Array.isArray(project.targetPath) ? project.targetPath : []);
    setFitResult(null);
  };

  const downloadProject = () => {
    const blob = new Blob([JSON.stringify(getProject(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "open-linkage-four-bar.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setProjectMessage("项目 JSON 已导出");
  };

  const importProject = async (file: File) => {
    try {
      applyProject(JSON.parse(await file.text()) as FourBarProject);
      setProjectMessage(`已载入 ${file.name}`);
    } catch {
      setProjectMessage("无法载入：这不是有效的四杆项目文件");
    }
  };

  const pointerToMechanism = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: -point.y };
  };

  const startDrag = (target: DragTarget, event: ReactPointerEvent<SVGGElement | SVGCircleElement>) => {
    if (event.button === 1 || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    setDragTarget(target);
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawing) {
      const point = pointerToMechanism(event);
      if (!point) return;
      setTargetPoints((current) => {
        const previous = current[current.length - 1];
        if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 3) return current;
        return [...current, point];
      });
      return;
    }
    if (!dragTarget) return;
    const point = pointerToMechanism(event);
    if (!point) return;

    if (dragTarget === "input") {
      setParameters((current) => ({ ...current, input: Math.max(1, Math.hypot(point.x, point.y)) }));
      setInputAngle(((Math.atan2(point.y, point.x) * 180) / Math.PI + 360) % 360);
      return;
    }
    if (dragTarget === "outputPivot") {
      setParameters((current) => ({ ...current, ground: Math.max(20, point.x) }));
      return;
    }
    if (!position) return;
    const currentPosition = position;
    if (dragTarget === "coupler") {
      setParameters((current) => ({
        ...current,
        coupler: Math.max(1, Math.hypot(point.x - currentPosition.inputJoint.x, point.y - currentPosition.inputJoint.y)),
        output: Math.max(1, Math.hypot(point.x - current.ground, point.y)),
      }));
      return;
    }

    const linkX = currentPosition.couplerJoint.x - currentPosition.inputJoint.x;
    const linkY = currentPosition.couplerJoint.y - currentPosition.inputJoint.y;
    const lengthSquared = linkX * linkX + linkY * linkY;
    const relativeX = point.x - currentPosition.inputJoint.x;
    const relativeY = point.y - currentPosition.inputJoint.y;
    const ratio = (relativeX * linkX + relativeY * linkY) / lengthSquared;
    const offset = (relativeX * -linkY + relativeY * linkX) / Math.sqrt(lengthSquared);
    setParameters((current) => ({
      ...current,
      couplerPointRatio: Math.min(1, Math.max(0, ratio)),
      couplerPointOffset: Math.min(300, Math.max(-300, offset)),
    }));
  };

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (editorMode !== "trajectory" || fitting) return;
    const point = pointerToMechanism(event);
    if (!point) return;
    setPlaying(false);
    setDrawing(true);
    setFitResult(null);
    setTargetPoints([point]);
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const finishInteraction = () => {
    setDrawing(false);
    setDragTarget(null);
  };

  const runPathFit = async () => {
    if (targetPoints.length < 8 || fitting) return;
    setPlaying(false);
    setFitting(true);
    setFitProgress(0);
    setProjectMessage("正在搜索四杆尺寸…");
    try {
      const result = await fitFourBarToClosedPath(targetPoints, parameters, assemblyMode, setFitProgress);
      setParameters(result.parameters);
      setInputAngle(result.phase);
      setFitResult(result);
      setEditorMode("mechanism");
      setProjectMessage(`拟合完成，均方根误差 ${result.rmse.toFixed(1)} mm`);
    } catch {
      setProjectMessage("拟合失败：请绘制一条更完整的闭合轨迹");
    } finally {
      setFitting(false);
    }
  };

  const reset = () => {
    setPlaying(false);
    setParameters(DEFAULT_PARAMETERS);
    setInputAngle(38);
    setAssemblyMode("open");
    setSpeed(18);
    setTargetPoints([]);
    setFitResult(null);
    setEditorMode("mechanism");
    viewport.resetView();
    setProjectMessage("已恢复默认项目");
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark} />
          OpenLinkage
        </Link>
        <div className={styles.headerMeta}>
          <Link href="/straight-line">直线机构</Link>
          <Link href="/leg">六杆腿设计</Link>
          <Link href="/designer">自由设计</Link>
          <span>FOUR-BAR LAB</span>
          <span className={styles.liveDot}>LIVE SOLVER</span>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}>
            <div><span>01</span><h1>机构参数</h1></div>
            <button type="button" onClick={reset}>恢复默认</button>
          </div>

          <section className={styles.controlSection}>
            <p className={styles.sectionLabel}>杆件长度 · MM</p>
            <div className={styles.fieldGrid}>
              {LINK_FIELDS.map((field) => (
                <label className={styles.numberField} key={field.key}>
                  <span>{field.label}<b>{field.code}</b></span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={Number(parameters[field.key].toFixed(2))}
                    onChange={(event) => updateLength(field.key, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={styles.controlSection}>
            <p className={styles.sectionLabel}>连杆轨迹点</p>
            <label className={styles.sliderField}>
              <span>沿连杆位置 <b>{Math.round(parameters.couplerPointRatio * 100)}%</b></span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={parameters.couplerPointRatio}
                onChange={(event) => updateParameter("couplerPointRatio", Number(event.target.value))}
              />
            </label>
            <label className={styles.sliderField}>
              <span>法向偏移 <b>{parameters.couplerPointOffset.toFixed(0)} mm</b></span>
              <input
                type="range"
                min="-300"
                max="300"
                step="1"
                value={parameters.couplerPointOffset}
                onChange={(event) => updateParameter("couplerPointOffset", Number(event.target.value))}
              />
            </label>
          </section>

          <section className={styles.controlSection}>
            <p className={styles.sectionLabel}>装配分支</p>
            <div className={styles.segmented}>
              <button className={assemblyMode === "open" ? styles.active : ""} onClick={() => setAssemblyMode("open")} type="button">开式</button>
              <button className={assemblyMode === "crossed" ? styles.active : ""} onClick={() => setAssemblyMode("crossed")} type="button">交叉式</button>
            </div>
          </section>

          <section className={styles.controlSection}>
            <p className={styles.sectionLabel}>项目文件</p>
            <div className={editorStyles.projectActions}>
              <button type="button" onClick={downloadProject}>导出 JSON</button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>载入项目</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importProject(file);
                  event.target.value = "";
                }}
              />
            </div>
            <p className={editorStyles.saveStatus}>{projectMessage}</p>
          </section>

          <div className={styles.note}>
            <span>提示</span>
            机构模式可拖动绿色手柄；轨迹模式可徒手绘制闭合曲线。滚轮缩放，Alt 或中键拖动画布。
          </div>
        </aside>

        <main className={styles.canvasColumn}>
          <div className={styles.canvasToolbar}>
            <div>
              <span className={styles.statusChip}>{position ? "闭环已求解" : "当前位置无解"}</span>
              <span>输入角 θ₂ = {inputAngle.toFixed(1)}°</span>
            </div>
            <div className={styles.legend}>
              <span><i className={styles.targetLine} />轨迹</span>
              <span><i className={styles.linkLine} />杆件</span>
            </div>
          </div>

          <div className={`${styles.canvas} ${editorStyles.canvasSurface}`}>
            <div className={editorStyles.canvasActions}>
              <div className={editorStyles.modeSwitch}>
                <button className={editorMode === "mechanism" ? editorStyles.selected : ""} type="button" onClick={() => setEditorMode("mechanism")}>编辑机构</button>
                <button className={editorMode === "trajectory" ? editorStyles.selected : ""} type="button" onClick={() => setEditorMode("trajectory")}>绘制轨迹</button>
              </div>
              <button type="button" onClick={() => { setTargetPoints([]); setFitResult(null); }} disabled={targetPoints.length === 0}>清除轨迹</button>
              <button className={editorStyles.fitButton} type="button" onClick={() => void runPathFit()} disabled={targetPoints.length < 8 || fitting}>
                {fitting ? `拟合 ${Math.round(fitProgress * 100)}%` : "自动拟合"}
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
              className={`${editorStyles.editableSvg} ${viewport.isPanning ? editorStyles.panning : ""}`}
              viewBox={viewport.viewBox}
              role="img"
              aria-label="四杆机构运动学画布"
              onWheel={viewport.handleWheel}
              onPointerDown={(event) => {
                if (!viewport.startPan(event)) startDrawing(event);
              }}
              onPointerMove={(event) => {
                if (!viewport.movePan(event)) handlePointerMove(event);
              }}
              onPointerUp={(event) => {
                if (!viewport.endPan(event)) finishInteraction();
              }}
              onPointerCancel={(event) => {
                if (!viewport.endPan(event)) finishInteraction();
              }}
            >
              <defs>
                <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                  <path d="M 25 0 L 0 0 0 25" className={styles.gridLine} />
                </pattern>
              </defs>
              <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#grid)" />
              <line x1="0" y1="0" x2={parameters.ground} y2="0" className={styles.groundLink} />
              <g className={editorStyles.dimensions} aria-hidden="true">
                <line x1="0" y1="24" x2={parameters.ground} y2="24" />
                <line x1="0" y1="17" x2="0" y2="31" />
                <line x1={parameters.ground} y1="17" x2={parameters.ground} y2="31" />
                <text x={parameters.ground / 2} y="45" textAnchor="middle">r₁ = {parameters.ground.toFixed(1)} mm</text>
              </g>
              {targetPathData && <path d={targetPathData} className={editorStyles.targetPath} />}
              {analysis.trailPath && <path d={analysis.trailPath} className={styles.trail} />}
              {position ? (
                <>
                  <line x1="0" y1="0" x2={position.inputJoint.x} y2={-position.inputJoint.y} className={`${styles.link} ${styles.inputLink}`} />
                  <line x1={position.inputJoint.x} y1={-position.inputJoint.y} x2={position.couplerJoint.x} y2={-position.couplerJoint.y} className={`${styles.link} ${styles.couplerLink}`} />
                  <line x1={position.couplerJoint.x} y1={-position.couplerJoint.y} x2={parameters.ground} y2="0" className={`${styles.link} ${styles.outputLink}`} />
                  <line x1={position.inputJoint.x} y1={-position.inputJoint.y} x2={position.couplerPoint.x} y2={-position.couplerPoint.y} className={styles.tracerArm} />
                  {[
                    { id: "o2", x: 0, y: 0, target: null },
                    { id: "a", x: position.inputJoint.x, y: -position.inputJoint.y, target: "input" as const },
                    { id: "b", x: position.couplerJoint.x, y: -position.couplerJoint.y, target: "coupler" as const },
                    { id: "o4", x: parameters.ground, y: 0, target: "outputPivot" as const },
                  ].map((joint) => (
                    <g
                      key={joint.id}
                      className={joint.target ? editorStyles.draggableJoint : undefined}
                      onPointerDown={joint.target && editorMode === "mechanism" ? (event) => startDrag(joint.target, event) : undefined}
                    >
                      <circle cx={joint.x} cy={joint.y} r="10" className={styles.jointOuter} />
                      <circle cx={joint.x} cy={joint.y} r="3.5" className={styles.jointInner} />
                      {joint.target && <circle cx={joint.x} cy={joint.y} r="18" className={editorStyles.dragHitArea} />}
                    </g>
                  ))}
                  <circle
                    cx={position.couplerPoint.x}
                    cy={-position.couplerPoint.y}
                    r="9"
                    className={`${styles.tracerPoint} ${editorStyles.draggableJoint}`}
                    onPointerDown={editorMode === "mechanism" ? (event) => startDrag("tracer", event) : undefined}
                  />
                </>
              ) : (
                <text x={parameters.ground / 2} y="-20" textAnchor="middle" className={styles.invalidText}>该输入角下无法闭合装配</text>
              )}
            </svg>
          </div>

          <div className={styles.transport}>
            <button className={styles.playButton} onClick={() => setPlaying((current) => !current)} type="button" aria-label={playing ? "暂停动画" : "播放动画"}>
              {playing ? "Ⅱ" : "▶"}
            </button>
            <label className={styles.angleControl}>
              <span>0°</span>
              <input type="range" min="0" max="360" step="0.1" value={inputAngle} onChange={(event) => setInputAngle(Number(event.target.value))} />
              <span>360°</span>
            </label>
            <label className={styles.speedControl}>
              <span>转速</span>
              <input type="number" min="1" max="120" value={speed} onChange={(event) => setSpeed(Math.max(1, Number(event.target.value) || 1))} />
              <span>rpm</span>
            </label>
          </div>
        </main>

        <aside className={`${styles.panel} ${styles.analysisPanel}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>工程分析</h2></div></div>
          <div className={styles.classification}>
            <span className={classification.grashof ? styles.pass : styles.warn}>{classification.grashof ? "GRASHOF" : "NON-GRASHOF"}</span>
            <h3>{classification.label}</h3>
            <p>{classification.grashof ? "最短杆具备整周转动的几何条件。" : "当前杆长组合通常只能在有限角度范围内运动。"}</p>
          </div>

          <div className={styles.metrics}>
            <div><span>整周可装配率</span><strong>{(analysis.validRatio * 100).toFixed(1)}<small>%</small></strong></div>
            <div><span>输出摆角</span><strong>{formatNumber(analysis.outputSwing)}<small>°</small></strong></div>
            <div><span>最小传动角</span><strong>{formatNumber(analysis.minimumTransmissionAngle)}<small>°</small></strong></div>
            <div><span>当前传动角</span><strong>{formatNumber(position?.transmissionAngle ?? null)}<small>°</small></strong></div>
          </div>

          <div className={`${styles.healthCard} ${analysis.validRatio === 1 ? styles.healthy : styles.needsAttention}`}>
            <div><span>{analysis.validRatio === 1 ? "运动连续" : "存在无解区间"}</span><b>{analysis.validRatio === 1 ? "通过" : "检查"}</b></div>
            <p>{analysis.validRatio === 1 ? "主动杆旋转一周时，机构始终存在有效闭环位置。" : `约 ${((1 - analysis.validRatio) * 360).toFixed(0)}° 输入角范围无法完成装配。`}</p>
          </div>

          <div className={styles.coordinateCard}>
            <p className={styles.sectionLabel}>当前坐标 · MM</p>
            <div><span>轨迹点 X</span><b>{formatNumber(position?.couplerPoint.x ?? null)}</b></div>
            <div><span>轨迹点 Y</span><b>{formatNumber(position?.couplerPoint.y ?? null)}</b></div>
            <div><span>输出角 θ₄</span><b>{formatNumber(position?.outputAngle ?? null)}°</b></div>
          </div>

          {fitResult && (
            <div className={editorStyles.fitResult}>
              <p className={styles.sectionLabel}>轨迹拟合结果</p>
              <div><span>均方根误差</span><b>{fitResult.rmse.toFixed(1)} mm</b></div>
              <div><span>输入相位</span><b>{fitResult.phase.toFixed(1)}°</b></div>
              <p>蓝色为目标轨迹，绿色虚线为当前四杆机构轨迹。可继续拖动或再次拟合。</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { Point } from "@/lib/four-bar";
import {
  VARIABLE_LEG_MODE_COLORS,
  VARIABLE_LEG_OPTIONS,
  alignedTargetPath,
  analyzeVariableLegProject,
  cloneVariableLegProject,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  createGaitPath,
  getVariableLegTemplate,
  isVariableLegProject,
  materializeVariableLegMode,
  projectForFreeDesigner,
  sampleVariableLeg,
  smoothClosedPath,
  type VariableLegAdjustmentKind,
  type VariableLegCandidate,
  type VariableLegMode,
  type VariableLegProject,
  type VariableLegTopology,
} from "@/lib/variable-leg";
import { resampleClosedPath } from "@/lib/path-synthesis";
import type { VariableLegSynthesisProgress } from "@/lib/variable-leg-synthesis";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSnapshotHistory } from "./use-snapshot-history";
import { useSvgViewport } from "./use-svg-viewport";
import styles from "./variable-geometry-leg-lab.module.css";

const STORAGE_KEY = "open-linkage:variable-leg-project:v1";
const TRANSFER_KEY = "open-linkage:designer-transfer";
type CanvasMode = "inspect" | "draw" | "points";

type WorkerResponse =
  | { type: "progress"; requestId: string; progress: VariableLegSynthesisProgress }
  | { type: "result"; requestId: string; candidates: VariableLegCandidate[] }
  | { type: "cancelled"; requestId: string }
  | { type: "error"; requestId: string; message: string };

function pathData(points: Point[], close = true) {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite.length) return "";
  return `${finite.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}${close ? " Z" : ""}`;
}

function targetStats(mode: VariableLegMode) {
  const xs = mode.targetPath.map((point) => point.x);
  const ys = mode.targetPath.map((point) => point.y);
  return {
    step: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    lift: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
    centerX: xs.length ? (Math.max(...xs) + Math.min(...xs)) / 2 : -210,
    groundY: ys.length ? Math.max(...ys) : 160,
  };
}

function topologyName(topology: VariableLegTopology) {
  return VARIABLE_LEG_OPTIONS[topology].label;
}

function adjustmentName(kind: VariableLegAdjustmentKind) {
  return kind === "moving-pivot" ? "移动固定铰点" : "可锁止伸缩杆";
}

export function VariableGeometryLegLab() {
  const initialProject = useMemo(() => createDefaultVariableLegProject(), []);
  const history = useSnapshotHistory(initialProject, cloneVariableLegProject);
  const { value: project, valueRef: projectRef, replace, commit, reset: resetHistory, undo, redo, canUndo, canRedo } = history;
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("inspect");
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [message, setMessage] = useState("三个默认工况已就绪；调节值在每个周期内保持锁定。");
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<VariableLegSynthesisProgress>({ progress: 0, stage: "scan", message: "等待开始" });
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const pointDragRef = useRef<{ pointerId: number; index: number } | null>(null);
  const viewportBase = useMemo(() => ({ x: -560, y: -360, width: 1120, height: 760 }), []);
  const viewport = useSvgViewport(viewportBase);

  const activeMode = project.modes.find((mode) => mode.id === project.activeModeId) ?? project.modes[0];
  const activeModeIndex = Math.max(0, project.modes.findIndex((mode) => mode.id === activeMode.id));
  const cycleSamples = useMemo(
    () => sampleVariableLeg(project.baseProject, project.adjustment, activeMode.adjustmentValue, 72, 90),
    [activeMode.adjustmentValue, project.adjustment, project.baseProject],
  );
  const analysis = useMemo(() => analyzeVariableLegProject(project, 54, 70), [project]);
  const activeMetrics = analysis.metrics.find((metric) => metric.modeId === activeMode.id) ?? analysis.metrics[0];
  const sampleIndex = Math.floor((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * cycleSamples.length) % Math.max(1, cycleSamples.length);
  const currentFrame = cycleSamples[sampleIndex]?.project ?? materializeVariableLegMode(project.baseProject, project.adjustment, activeMode.adjustmentValue);
  const currentTracer = cycleSamples[sampleIndex]?.tracer ?? null;
  const currentJointMap = useMemo(() => new Map(currentFrame.joints.map((joint) => [joint.id, joint])), [currentFrame]);
  const activeStats = targetStats(activeMode);
  const adjustableOptions = project.adjustment.kind === "moving-pivot"
    ? VARIABLE_LEG_OPTIONS[project.topology].movingPivots
    : VARIABLE_LEG_OPTIONS[project.topology].telescopicBars;

  const stopMotion = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (!isVariableLegProject(parsed)) throw new Error("invalid");
        resetHistory(parsed);
        setPhase(parsed.inputPhase || 0);
        setMessage("已恢复上次的可变几何步行腿项目。");
      } catch {
        setMessage("自动保存数据无效，已保留默认工况。");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resetHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = { ...project, inputPhase: phase };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [phase, project]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(0.05, (time - previous) / 1000);
      previous = time;
      setPhase((current) => (current + activeMode.rpm * Math.PI * 2 / 60 * elapsed) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeMode.rpm, playing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      stopMotion();
      const restored = key === "y" || event.shiftKey ? redo() : undo();
      if (restored) setMessage(key === "y" || event.shiftKey ? "已重做一步。" : "已撤销一步。");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, stopMotion, undo]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const updateProject = (updater: (current: VariableLegProject) => VariableLegProject, status?: string) => {
    stopMotion();
    commit(updater(cloneVariableLegProject(projectRef.current)));
    if (status) setMessage(status);
  };

  const updateActiveMode = (updater: (mode: VariableLegMode) => VariableLegMode, status?: string) => {
    updateProject((current) => ({
      ...current,
      candidates: [],
      selectedCandidateId: null,
      modes: current.modes.map((mode) => mode.id === current.activeModeId ? updater(mode) : mode),
    }), status);
  };

  const selectMode = (modeId: string) => {
    stopMotion();
    replace({ ...projectRef.current, activeModeId: modeId });
    setCanvasMode("inspect");
    setMessage("主轴已暂停，已切换到新的离散锁止工况。");
  };

  const changeTopology = (topology: VariableLegTopology) => {
    const kind = project.adjustment.kind;
    updateProject((current) => ({
      ...current,
      topology,
      baseProject: getVariableLegTemplate(topology),
      adjustment: createDefaultAdjustment(topology, kind),
      modes: current.modes.map((mode, index) => ({ ...mode, adjustmentValue: index === 0 ? 0 : index === 1 ? 28 : -22 })),
      candidates: [],
      selectedCandidateId: null,
    }), `已切换为${topologyName(topology)}。`);
    viewport.resetView();
  };

  const changeAdjustmentKind = (kind: VariableLegAdjustmentKind) => {
    updateProject((current) => {
      const nextAdjustment = createDefaultAdjustment(current.topology, kind);
      return {
        ...current,
        adjustment: nextAdjustment,
        modes: current.modes.map((mode, index) => ({
          ...mode,
          adjustmentValue: nextAdjustment.kind === "moving-pivot"
            ? (index === 0 ? 0 : index === 1 ? 30 : -22)
            : nextAdjustment.baseLength,
        })),
        candidates: [],
        selectedCandidateId: null,
      };
    }, `调节结构已切换为${adjustmentName(kind)}。`);
  };

  const changeAdjustmentTarget = (targetId: string) => {
    updateProject((current) => {
      const next = createDefaultAdjustment(current.topology, current.adjustment.kind);
      if (next.kind === "moving-pivot") {
        const joint = current.baseProject.joints.find((item) => item.id === targetId)!;
        return { ...current, adjustment: { ...next, targetId, baseX: joint.x, baseY: joint.y }, candidates: [], selectedCandidateId: null };
      }
      const bar = current.baseProject.bars.find((item) => item.id === targetId)!;
      return {
        ...current,
        adjustment: { ...next, targetId, baseLength: bar.length, minimum: bar.length * 0.82, maximum: bar.length * 1.18 },
        modes: current.modes.map((mode) => ({ ...mode, adjustmentValue: bar.length })),
        candidates: [],
        selectedCandidateId: null,
      };
    }, "已更换可调对象，旧候选结果已清除。");
  };

  const regenerateActivePath = (step = activeStats.step, lift = activeStats.lift, stance = activeMode.stanceEnd - activeMode.stanceStart) => {
    updateActiveMode((mode) => ({
      ...mode,
      stanceStart: 0,
      stanceEnd: Math.min(0.82, Math.max(0.35, stance)),
      targetPath: createGaitPath(Math.max(40, step), Math.max(10, lift), stance, activeStats.centerX, activeStats.groundY),
    }), `${activeMode.name}目标足迹已重新生成。`);
  };

  const addMode = () => {
    if (project.modes.length >= 6) {
      setMessage("最多支持六个工况；请先删除不需要的工况。");
      return;
    }
    const modeNumber = project.modes.reduce((maximum, mode) => {
      const number = Number(mode.id.replace(/\D/g, ""));
      return Number.isFinite(number) ? Math.max(maximum, number) : maximum;
    }, 0) + 1;
    const id = `mode-${modeNumber}`;
    const source = cloneVariableLegProject(project).modes[activeModeIndex];
    const mode = { ...source, id, name: `工况 ${project.modes.length + 1}`, color: VARIABLE_LEG_MODE_COLORS[project.modes.length], targetPath: source.targetPath.map((point) => ({ ...point })) };
    updateProject((current) => ({ ...current, modes: [...current.modes, mode], activeModeId: id, candidates: [], selectedCandidateId: null }), "已复制当前工况。");
  };

  const deleteMode = () => {
    if (project.modes.length <= 1) {
      setMessage("项目至少需要保留一个工况。");
      return;
    }
    updateProject((current) => {
      const nextModes = current.modes.filter((mode) => mode.id !== current.activeModeId);
      return { ...current, modes: nextModes, activeModeId: nextModes[0].id, candidates: [], selectedCandidateId: null };
    }, "当前工况已删除。");
  };

  const canvasPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const bounds = svg.getBoundingClientRect();
    return {
      x: viewport.view.x + (event.clientX - bounds.left) / Math.max(1, bounds.width) * viewport.view.width,
      y: viewport.view.y + (event.clientY - bounds.top) / Math.max(1, bounds.height) * viewport.view.height,
    };
  };

  const startCanvasPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (viewport.startPan(event)) return;
    if (canvasMode !== "draw") return;
    const point = canvasPoint(event);
    if (!point) return;
    event.preventDefault();
    stopMotion();
    setDrawing(true);
    setDrawingPoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCanvasPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (viewport.movePan(event)) return;
    const drag = pointDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      if (!point) return;
      replace({
        ...projectRef.current,
        candidates: [],
        selectedCandidateId: null,
        modes: projectRef.current.modes.map((mode) => mode.id === projectRef.current.activeModeId
          ? { ...mode, targetPath: mode.targetPath.map((item, index) => index === drag.index ? point : item) }
          : mode),
      });
      return;
    }
    if (!drawing) return;
    const point = canvasPoint(event);
    if (!point) return;
    setDrawingPoints((current) => {
      const previous = current.at(-1);
      return previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 4 ? current : [...current, point];
    });
  };

  const endCanvasPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (viewport.endPan(event)) return;
    if (pointDragRef.current?.pointerId === event.pointerId) {
      pointDragRef.current = null;
      setMessage("控制点已移动；轨迹误差已重新计算。");
      return;
    }
    if (!drawing) return;
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drawingPoints.length >= 8) {
      const path = resampleClosedPath(smoothClosedPath(drawingPoints, 1), 72);
      updateActiveMode((mode) => ({ ...mode, targetPath: path }), "手绘轨迹已平滑并均匀重采样为 72 点。");
    } else {
      setMessage("轨迹过短，至少需要绘制 8 个原始点。");
    }
    setDrawingPoints([]);
  };

  const startPointDrag = (event: ReactPointerEvent<SVGCircleElement>, index: number) => {
    if (canvasMode !== "points") return;
    event.preventDefault();
    event.stopPropagation();
    commit(cloneVariableLegProject(projectRef.current));
    pointDragRef.current = { pointerId: event.pointerId, index };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const smoothActivePath = () => {
    updateActiveMode((mode) => ({ ...mode, targetPath: resampleClosedPath(smoothClosedPath(mode.targetPath, 2), 72) }), "目标足迹已平滑并重新采样。");
  };

  const resetProject = () => {
    stopMotion();
    resetHistory(createDefaultVariableLegProject());
    setPhase(0);
    setCanvasMode("inspect");
    viewport.resetView();
    setMessage("已恢复克兰腿与三个默认工况。");
  };

  const runSynthesis = () => {
    if (searching || project.modes.some((mode) => mode.targetPath.length < 12)) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `request-${Date.now()}`;
    requestIdRef.current = requestId;
    setSearching(true);
    setSearchProgress({ progress: 0, stage: "scan", message: "正在准备灵敏度扫描" });
    setMessage("正在比较克兰、简森以及两类调节结构……");
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestIdRef.current) return;
      if (response.type === "progress") {
        setSearchProgress(response.progress);
        return;
      }
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      if (response.type === "result") {
        const first = response.candidates[0];
        if (!first) {
          setMessage("没有找到整周可用的候选；请降低轨迹跨度或减少工况差异。");
          return;
        }
        commit({
          ...projectRef.current,
          topology: first.topology,
          baseProject: first.baseProject,
          adjustment: first.adjustment,
          modes: first.modes,
          candidates: response.candidates,
          selectedCandidateId: first.id,
          activeModeId: first.modes[0].id,
        });
        setMessage(`已生成 ${response.candidates.length} 套多工况候选，当前载入综合推荐。`);
      } else if (response.type === "cancelled") {
        setMessage("自动综合已取消，当前机构和目标轨迹未改变。");
      } else {
        setMessage(response.message);
      }
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("综合 Worker 运行失败，请刷新后重试。");
    };
    worker.postMessage({ type: "start", requestId, project: cloneVariableLegProject(project) });
  };

  const cancelSynthesis = () => {
    const requestId = requestIdRef.current;
    if (requestId) workerRef.current?.postMessage({ type: "cancel", requestId });
    setSearchProgress((current) => ({ ...current, message: "正在取消……" }));
  };

  const applyCandidate = (candidate: VariableLegCandidate) => {
    updateProject((current) => ({
      ...current,
      topology: candidate.topology,
      baseProject: candidate.baseProject,
      adjustment: candidate.adjustment,
      modes: candidate.modes,
      activeModeId: candidate.modes[0].id,
      candidates: current.candidates,
      selectedCandidateId: candidate.id,
    }), `已载入${candidate.label}：${topologyName(candidate.topology)} / ${adjustmentName(candidate.adjustment.kind)}。`);
  };

  const exportProject = () => {
    const payload = { ...cloneVariableLegProject(project), inputPhase: phase };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "open-linkage-variable-leg.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("可变几何步行腿项目已导出。");
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isVariableLegProject(parsed)) throw new Error("invalid");
      resetHistory(parsed);
      setPhase(parsed.inputPhase || 0);
      setMessage(`已导入 ${file.name}。`);
    } catch {
      setMessage("导入失败：文件不是有效的可变几何步行腿项目。");
    }
  };

  const openInDesigner = () => {
    const freeProject = projectForFreeDesigner(project);
    window.sessionStorage.setItem(TRANSFER_KEY, JSON.stringify(freeProject));
    window.location.href = "/designer?transfer=variable-leg";
  };

  const warnings = [
    activeMetrics.validRatio < 0.99 ? "当前工况存在不可达相位或约束误差。" : null,
    activeMetrics.branchSwitches > 0 ? "检测到装配分支变化，当前几何不适合连续运行。" : null,
    activeMetrics.singularityMargin < 8 ? "最小几何夹角低于 8°，接近奇异位置。" : null,
    activeMetrics.landingVerticalSpeed > 240 ? "按当前转速估算的落地垂直速度较高。" : null,
    activeMode.adjustmentValue < project.adjustment.minimum || activeMode.adjustmentValue > project.adjustment.maximum ? "锁止值超出调节范围。" : null,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav>
          <Link href="/lab">四杆设计</Link><Link href="/leg">六杆腿</Link><Link href="/straight-line">直线机构</Link><Link href="/designer">自由设计</Link>
          <span>可变几何步行腿 · 0.1</span>
        </nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>机构与工况</h1></div><button type="button" onClick={resetProject}>恢复默认</button></div>

          <div className={styles.historyBar}>
            <button type="button" disabled={!canUndo} onClick={() => { stopMotion(); if (undo()) setMessage("已撤销一步。"); }}>↶ 撤销</button>
            <button type="button" disabled={!canRedo} onClick={() => { stopMotion(); if (redo()) setMessage("已重做一步。"); }}>↷ 重做</button>
          </div>

          <section className={styles.configSection}>
            <label>基础拓扑
              <select value={project.topology} onChange={(event) => changeTopology(event.target.value as VariableLegTopology)}>
                <option value="klann">克兰六杆腿</option><option value="jansen">简森多杆腿</option>
              </select>
            </label>
            <label>调节结构
              <select value={project.adjustment.kind} onChange={(event) => changeAdjustmentKind(event.target.value as VariableLegAdjustmentKind)}>
                <option value="moving-pivot">移动固定铰点</option><option value="telescopic-bar">可锁止伸缩杆</option>
              </select>
            </label>
            <label>可调对象
              <select value={project.adjustment.targetId} onChange={(event) => changeAdjustmentTarget(event.target.value)}>
                {adjustableOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            {project.adjustment.kind === "moving-pivot" && (
              <label>导轨角度
                <span className={styles.unitInput}><input type="number" value={project.adjustment.railAngle} onChange={(event) => updateProject((current) => ({ ...current, adjustment: current.adjustment.kind === "moving-pivot" ? { ...current.adjustment, railAngle: Number(event.target.value) } : current.adjustment, candidates: [] }))} /><i>°</i></span>
              </label>
            )}
            <div className={styles.rangePair}>
              <label>最小值<input type="number" value={Number(project.adjustment.minimum.toFixed(1))} onChange={(event) => updateProject((current) => ({ ...current, adjustment: { ...current.adjustment, minimum: Number(event.target.value) }, candidates: [] }))} /></label>
              <label>最大值<input type="number" value={Number(project.adjustment.maximum.toFixed(1))} onChange={(event) => updateProject((current) => ({ ...current, adjustment: { ...current.adjustment, maximum: Number(event.target.value) }, candidates: [] }))} /></label>
            </div>
          </section>

          <div className={styles.modeHeader}><b>工况</b><span>{project.modes.length}/6</span></div>
          <div className={styles.modeTabs}>
            {project.modes.map((mode) => <button type="button" key={mode.id} className={mode.id === activeMode.id ? styles.activeMode : ""} style={{ borderColor: mode.color }} onClick={() => selectMode(mode.id)}>{mode.name}</button>)}
          </div>
          <div className={styles.modeActions}><button type="button" onClick={addMode}>复制工况</button><button type="button" onClick={deleteMode} disabled={project.modes.length <= 1}>删除</button></div>

          <section className={styles.modeEditor}>
            <label>工况名称<input value={activeMode.name} onChange={(event) => updateActiveMode((mode) => ({ ...mode, name: event.target.value.slice(0, 12) }))} /></label>
            <div className={styles.rangePair}>
              <label>步长 mm<input type="number" value={Math.round(activeStats.step)} onChange={(event) => regenerateActivePath(Number(event.target.value), activeStats.lift)} /></label>
              <label>抬脚 mm<input type="number" value={Math.round(activeStats.lift)} onChange={(event) => regenerateActivePath(activeStats.step, Number(event.target.value))} /></label>
              <label>支撑相 %<input type="number" min="35" max="82" value={Math.round((activeMode.stanceEnd - activeMode.stanceStart) * 100)} onChange={(event) => regenerateActivePath(activeStats.step, activeStats.lift, Number(event.target.value) / 100)} /></label>
              <label>主轴 rpm<input type="number" min="1" max="180" value={activeMode.rpm} onChange={(event) => updateActiveMode((mode) => ({ ...mode, rpm: Math.max(1, Number(event.target.value) || 1) }))} /></label>
              <label>工况权重<input type="number" min="0.1" max="5" step="0.1" value={activeMode.weight} onChange={(event) => updateActiveMode((mode) => ({ ...mode, weight: Math.max(0.1, Number(event.target.value) || 1) }))} /></label>
              <label>锁止值<input type="number" value={Number(activeMode.adjustmentValue.toFixed(2))} onChange={(event) => updateActiveMode((mode) => ({ ...mode, adjustmentValue: Number(event.target.value) }))} /></label>
            </div>
            <input className={styles.adjustmentSlider} aria-label="当前工况锁止值" type="range" min={project.adjustment.minimum} max={project.adjustment.maximum} step="0.1" value={activeMode.adjustmentValue} onChange={(event) => replace({ ...projectRef.current, modes: projectRef.current.modes.map((mode) => mode.id === activeMode.id ? { ...mode, adjustmentValue: Number(event.target.value) } : mode), candidates: [] })} onPointerUp={() => commit(cloneVariableLegProject(projectRef.current))} />
            <small>{project.adjustment.kind === "moving-pivot" ? "单位为沿导轨的位移 mm" : "单位为锁定后的有效杆长 mm"}</small>
          </section>

          <section className={styles.searchBox}>
            <button className={styles.primaryButton} type="button" onClick={runSynthesis} disabled={searching}>{searching ? `${Math.round(searchProgress.progress * 100)}% · ${searchProgress.stage}` : "自动综合 5 套方案"}</button>
            {searching && <button className={styles.cancelButton} type="button" onClick={cancelSynthesis}>取消搜索</button>}
            <div className={styles.progress}><i style={{ width: `${searchProgress.progress * 100}%` }} /></div>
            <small>{searching ? searchProgress.message : message}</small>
          </section>

          <div className={styles.projectTools}>
            <button type="button" onClick={exportProject}>导出 JSON</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>导入项目</button>
            <button type="button" onClick={openInDesigner}>在自由设计器打开</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={(event) => void importProject(event)} />
          </div>
        </aside>

        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <span className={activeMetrics.validRatio >= 0.99 ? styles.solved : styles.invalid}>{activeMetrics.validRatio >= 0.99 ? "整周可求解" : "存在不可达相位"}</span>
            <span>{topologyName(project.topology)}</span><span>{adjustmentName(project.adjustment.kind)} / {project.adjustment.targetId}</span><b>锁止 {activeMode.adjustmentValue.toFixed(1)}</b>
          </div>
          <div className={styles.canvas}>
            <div className={styles.canvasActions} role="group" aria-label="轨迹编辑工具">
              <button className={canvasMode === "inspect" ? styles.selectedTool : ""} type="button" onClick={() => setCanvasMode("inspect")}>查看机构</button>
              <button className={canvasMode === "draw" ? styles.selectedTool : ""} type="button" onClick={() => setCanvasMode("draw")}>绘制轨迹</button>
              <button className={canvasMode === "points" ? styles.selectedTool : ""} type="button" onClick={() => setCanvasMode("points")}>编辑控制点</button>
              <button type="button" onClick={smoothActivePath}>平滑</button>
              <button type="button" onClick={() => updateActiveMode((mode) => ({ ...mode, targetPath: [] }), "当前目标轨迹已清除。")}>清除</button>
            </div>
            <SvgViewportControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.resetView} />
            <svg
              ref={svgRef}
              viewBox={viewport.viewBox}
              role="img"
              aria-label="可变几何克兰或简森步行腿、导轨、锁止位置与多工况足端轨迹"
              className={viewport.isPanning ? styles.panning : canvasMode === "draw" ? styles.drawing : undefined}
              onWheel={viewport.handleWheel}
              onPointerDown={startCanvasPointer}
              onPointerMove={moveCanvasPointer}
              onPointerUp={endCanvasPointer}
              onPointerCancel={endCanvasPointer}
            >
              <defs><pattern id="variable-leg-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" className={styles.grid} /></pattern></defs>
              <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#variable-leg-grid)" />
              {analysis.metrics.map((metric) => {
                const mode = project.modes.find((item) => item.id === metric.modeId)!;
                const aligned = metric.path.length ? alignedTargetPath(mode.targetPath, metric.path) : mode.targetPath;
                return <g key={mode.id} opacity={mode.id === activeMode.id ? 1 : 0.5}>
                  <path d={pathData(aligned)} fill="none" stroke={mode.color} strokeWidth={mode.id === activeMode.id ? 4 : 2} strokeDasharray="8 6" className={styles.targetPath} />
                  <path d={pathData(metric.path)} fill="none" stroke={mode.color} strokeWidth={mode.id === activeMode.id ? 3 : 1.5} className={styles.actualPath} />
                </g>;
              })}
              {drawingPoints.length > 1 && <path d={pathData(drawingPoints, false)} className={styles.draftPath} />}

              {project.adjustment.kind === "moving-pivot" && (() => {
                const angle = project.adjustment.railAngle * Math.PI / 180;
                const pointAt = (value: number) => ({ x: project.adjustment.kind === "moving-pivot" ? project.adjustment.baseX + value * Math.cos(angle) : 0, y: project.adjustment.kind === "moving-pivot" ? project.adjustment.baseY + value * Math.sin(angle) : 0 });
                const start = pointAt(project.adjustment.minimum);
                const end = pointAt(project.adjustment.maximum);
                return <g className={styles.rail}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  {project.modes.map((mode) => { const point = pointAt(mode.adjustmentValue); return <g key={mode.id}><circle cx={point.x} cy={point.y} r={mode.id === activeMode.id ? 11 : 7} style={{ fill: mode.color }} /><text x={point.x + 9} y={point.y - 10}>{mode.name}</text></g>; })}
                </g>;
              })()}

              {currentFrame.bodies.map((body) => {
                const points = body.jointIds.map((id) => currentJointMap.get(id)).filter((joint): joint is NonNullable<typeof joint> => Boolean(joint));
                return points.length >= 3 ? <polygon key={body.id} points={points.map((joint) => `${joint.x},${joint.y}`).join(" ")} className={styles.rigidBody} /> : null;
              })}
              {currentFrame.bars.map((bar) => {
                const a = currentJointMap.get(bar.a);
                const b = currentJointMap.get(bar.b);
                if (!a || !b) return null;
                const adjustable = project.adjustment.kind === "telescopic-bar" && bar.id === project.adjustment.targetId;
                return <line key={bar.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.link} ${bar.id === currentFrame.driverId ? styles.driver : ""} ${adjustable ? styles.telescopic : ""}`} />;
              })}
              {currentFrame.joints.map((joint) => <g key={joint.id} className={joint.fixed ? styles.fixedJoint : styles.movingJoint}><circle cx={joint.x} cy={joint.y} r="9" /><circle cx={joint.x} cy={joint.y} r="3" /><text x={joint.x + 10} y={joint.y - 10}>{joint.id}</text></g>)}
              {currentTracer && <circle cx={currentTracer.x} cy={currentTracer.y} r="11" className={styles.foot} />}

              {canvasMode === "points" && activeMode.targetPath.map((point, index) => index % 6 === 0
                ? <circle key={`${activeMode.id}-${index}`} cx={point.x} cy={point.y} r="7" fill={activeMode.color} className={styles.controlPoint} onPointerDown={(event) => startPointDrag(event, index)} />
                : null)}
            </svg>
            {searching && <div className={styles.searchOverlay}><strong>{Math.round(searchProgress.progress * 100)}%</strong><span>{searchProgress.message}</span></div>}
          </div>
          <div className={styles.legend}>
            {project.modes.map((mode) => <span key={mode.id}><i style={{ background: mode.color }} />{mode.name}</span>)}
            <span><i className={styles.legendTarget} />虚线目标 / 实线实际</span>
          </div>
          <div className={styles.transport}>
            <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "暂停可变几何腿动画" : "播放可变几何腿动画"}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="主轴相位" type="range" min="0" max={Math.PI * 2} step="0.001" value={phase} onChange={(event) => { setPlaying(false); setPhase(Number(event.target.value)); }} />
            <span>{(phase * 180 / Math.PI).toFixed(1)}°</span><b>{activeMode.rpm} rpm</b>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.analysisPanel}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>候选与工程检查</h2></div></div>
          {project.candidates?.length ? <div className={styles.candidateList}>
            {project.candidates.map((candidate, index) => <button type="button" key={candidate.id} className={candidate.id === project.selectedCandidateId ? styles.selectedCandidate : ""} onClick={() => applyCandidate(candidate)}>
              <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
              <span><b>{candidate.label}</b><small>{topologyName(candidate.topology)} · {adjustmentName(candidate.adjustment.kind)} · {candidate.adjustment.targetId}</small></span>
              <strong>{candidate.score.toFixed(0)}</strong>
              <em>平均 RMSE {candidate.familyRmse.toFixed(1)} mm · 调节行程 {candidate.adjustmentStroke.toFixed(1)} mm</em>
            </button>)}
          </div> : <div className={styles.emptyState}><b>等待多轨迹综合</b><p>系统会先比较适合移动的固定铰点或伸缩杆，再精修各工况锁止值，并返回五套差异化方案。</p></div>}

          <div className={styles.modeSummary}>
            <div><span>{activeMode.name}轨迹 RMSE</span><strong>{Number.isFinite(activeMetrics.rmse) ? activeMetrics.rmse.toFixed(1) : "—"}<small>mm</small></strong></div>
            <div><span>最大误差</span><strong>{Number.isFinite(activeMetrics.maxError) ? activeMetrics.maxError.toFixed(1) : "—"}<small>mm</small></strong></div>
            <div><span>整周求解率</span><strong>{(activeMetrics.validRatio * 100).toFixed(1)}<small>%</small></strong></div>
            <div><span>实际步长 / 抬脚</span><strong>{activeMetrics.stepLength.toFixed(0)}<small> / {activeMetrics.liftHeight.toFixed(0)} mm</small></strong></div>
            <div><span>支撑段平直度</span><strong>{activeMetrics.stanceStraightness.toFixed(2)}<small>mm RMS</small></strong></div>
            <div><span>最小几何夹角</span><strong>{activeMetrics.singularityMargin.toFixed(1)}<small>°</small></strong></div>
            <div><span>峰值足速</span><strong>{activeMetrics.peakFootSpeed.toFixed(0)}<small>mm/s</small></strong></div>
            <div><span>峰值足端加速度</span><strong>{activeMetrics.peakFootAcceleration.toFixed(0)}<small>mm/s²</small></strong></div>
            <div><span>落地垂直速度</span><strong>{activeMetrics.landingVerticalSpeed.toFixed(0)}<small>mm/s</small></strong></div>
            <div><span>轨迹族综合评分</span><strong>{analysis.score.toFixed(0)}<small>/100</small></strong></div>
          </div>

          <div className={styles.comparisonTable}>
            <div className={styles.tableHead}><span>工况</span><span>RMSE</span><span>可达</span><span>落地速度</span></div>
            {project.modes.map((mode) => {
              const metric = analysis.metrics.find((item) => item.modeId === mode.id)!;
              return <button type="button" key={mode.id} onClick={() => selectMode(mode.id)}><span style={{ color: mode.color }}>{mode.name}</span><span>{Number.isFinite(metric.rmse) ? metric.rmse.toFixed(1) : "—"}</span><span>{(metric.validRatio * 100).toFixed(0)}%</span><span>{metric.landingVerticalSpeed.toFixed(0)}</span></button>;
            })}
          </div>

          <div className={warnings.length ? styles.healthWarn : styles.healthGood}>
            <b>{warnings.length ? `${warnings.length} 项工程提示` : "当前运动学检查通过"}</b>
            {warnings.length ? <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>当前工况整周连续，未发现装配分支跳变或明显奇异位置。</p>}
          </div>
          <p className={styles.disclaimer}>这里的“高速、越障”仅代表目标足迹工况。当前版本不计算质量、地面接触力、弹簧储能、结构应力或整机稳定性。</p>
        </aside>
      </div>
    </main>
  );
}

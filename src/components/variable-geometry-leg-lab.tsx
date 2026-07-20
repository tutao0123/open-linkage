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
  analyzeVariableLegBarSamples,
  analyzeVariableLegProject,
  assessVariableLegCandidate,
  applyVariableLegDesignerReturn,
  applyVariableLegRecommendedRange,
  cloneVariableLegProject,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  createGaitPath,
  createVariableLegQuickDesign,
  createVariableLegDesignerTransfer,
  getVariableLegTemplate,
  isVariableLegDesignerTransfer,
  materializeVariableLegMode,
  measureGaitClearance,
  migrateVariableLegProject,
  restoreVariableLegStandardModes,
  sampleVariableLeg,
  setVariableLegBaseBarLength,
  smoothClosedPath,
  type VariableLegAdjustmentKind,
  type VariableLegAdjustmentFeasibility,
  type VariableLegBarLengthPreview,
  type VariableLegCandidate,
  type VariableLegMode,
  type VariableLegProject,
  type VariableLegQuickDesign,
  type VariableLegQuickDesignKey,
  type VariableLegTopology,
} from "@/lib/variable-leg";
import {
  analyzeVariableLegGait,
  appendVariableLegFootprints,
  changeVariableLegCount,
  changeVariableLegPhase,
  changeVariableLegPreset,
  detectVariableLegTouchdowns,
  variableLegBodyAdvance,
  variableLegMountX,
  variableLegPresetOptions,
  variableLegSampleIndex,
  type VariableLegCount,
  type VariableLegFootprint,
  type VariableLegGaitPreset,
} from "@/lib/variable-leg-gait";
import { resampleClosedPath } from "@/lib/path-synthesis";
import type { VariableLegSynthesisProgress } from "@/lib/variable-leg-synthesis";
import type { VariableLegSynthesisScope } from "@/lib/variable-leg-synthesis";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSnapshotHistory } from "./use-snapshot-history";
import { useSvgViewport } from "./use-svg-viewport";
import { VariableLegDeploymentView } from "./variable-leg-deployment-view";
import styles from "./variable-geometry-leg-lab.module.css";

const STORAGE_KEY = "open-linkage:variable-leg-project:v2";
const LEGACY_STORAGE_KEY = "open-linkage:variable-leg-project:v1";
const TRANSFER_KEY = "open-linkage:designer-transfer";
type CanvasMode = "inspect" | "draw" | "points";
type ViewMode = "mechanism" | "deployment";
type EditingMode = "guided" | "advanced";

type WorkerResponse =
  | { type: "progress"; requestId: string; progress: VariableLegSynthesisProgress }
  | { type: "result"; requestId: string; candidates: VariableLegCandidate[] }
  | { type: "quick-design-result"; requestId: string; candidates: VariableLegCandidate[] }
  | { type: "feasibility-result"; requestId: string; feasibility: VariableLegAdjustmentFeasibility }
  | { type: "bar-preview-result"; requestId: string; preview: VariableLegBarLengthPreview }
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
    lift: measureGaitClearance(mode.targetPath, mode.stanceStart, mode.stanceEnd),
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

function barRoleName(role: "driver" | "adjustment" | "tracer-carrier" | "link") {
  return { driver: "主动杆", adjustment: "调节对象", "tracer-carrier": "足端关联杆", link: "传动连杆" }[role];
}

function feasibilityProjectKey(project: VariableLegProject) {
  return JSON.stringify({
    baseProject: project.baseProject,
    adjustment: project.adjustment,
    modes: project.modes.map((mode) => ({ id: mode.id, adjustmentValue: mode.adjustmentValue })),
  });
}

export function VariableGeometryLegLab() {
  const initialProject = useMemo(() => createDefaultVariableLegProject(), []);
  const history = useSnapshotHistory(initialProject, cloneVariableLegProject);
  const { value: project, valueRef: projectRef, replace, commit, reset: resetHistory, undo, redo, canUndo, canRedo } = history;
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("mechanism");
  const [editingMode, setEditingMode] = useState<EditingMode>("guided");
  const [quickDesign, setQuickDesign] = useState<VariableLegQuickDesign>(() => createVariableLegQuickDesign(initialProject));
  const [bodyWorldX, setBodyWorldX] = useState(0);
  const [footprints, setFootprints] = useState<VariableLegFootprint[]>([]);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("inspect");
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [message, setMessage] = useState("三个默认工况已就绪；调节值在每个周期内保持锁定。");
  const [searching, setSearching] = useState(false);
  const [workerTask, setWorkerTask] = useState<"synthesis" | "quick-design" | "feasibility" | "bar-preview">("synthesis");
  const [feasibility, setFeasibility] = useState<VariableLegAdjustmentFeasibility | null>(null);
  const [feasibilitySourceKey, setFeasibilitySourceKey] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [barLengthPreview, setBarLengthPreview] = useState<VariableLegBarLengthPreview | null>(null);
  const [searchProgress, setSearchProgress] = useState<VariableLegSynthesisProgress>({ progress: 0, stage: "scan", message: "等待开始" });
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const phaseRef = useRef(0);
  const bodyWorldXRef = useRef(0);
  const footprintSequenceRef = useRef(0);
  const pointDragRef = useRef<{ pointerId: number; index: number } | null>(null);
  const viewportBase = useMemo(() => ({ x: -560, y: -360, width: 1120, height: 760 }), []);
  const viewport = useSvgViewport(viewportBase, svgRef);

  const activeMode = project.modes.find((mode) => mode.id === project.activeModeId) ?? project.modes[0];
  const missingStandardModeCount = ["cruise", "sprint", "obstacle"].filter((id) => !project.modes.some((mode) => mode.id === id)).length;
  const activeModeIndex = Math.max(0, project.modes.findIndex((mode) => mode.id === activeMode.id));
  const cycleSamples = useMemo(
    () => sampleVariableLeg(project.baseProject, project.adjustment, activeMode.adjustmentValue, 72, 90),
    [activeMode.adjustmentValue, project.adjustment, project.baseProject],
  );
  const analysis = useMemo(() => analyzeVariableLegProject(project, 54, 70), [project]);
  const activeMetrics = analysis.metrics.find((metric) => metric.modeId === activeMode.id) ?? analysis.metrics[0];
  const gaitMetrics = useMemo(
    () => analyzeVariableLegGait(project.deployment, activeMode, activeMetrics),
    [activeMetrics, activeMode, project.deployment],
  );
  const sampleIndex = Math.floor((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * cycleSamples.length) % Math.max(1, cycleSamples.length);
  const currentFrame = cycleSamples[sampleIndex]?.project ?? materializeVariableLegMode(project.baseProject, project.adjustment, activeMode.adjustmentValue);
  const currentTracer = cycleSamples[sampleIndex]?.tracer ?? null;
  const currentJointMap = useMemo(() => new Map(currentFrame.joints.map((joint) => [joint.id, joint])), [currentFrame]);
  const activeStats = targetStats(activeMode);
  const recommendedTelescopicIds = useMemo(
    () => new Set(VARIABLE_LEG_OPTIONS[project.topology].telescopicBars.map((option) => option.id)),
    [project.topology],
  );
  const adjustableOptions = project.adjustment.kind === "moving-pivot"
    ? VARIABLE_LEG_OPTIONS[project.topology].movingPivots
    : project.baseProject.bars
      .filter((bar) => bar.id !== project.baseProject.driverId)
      .map((bar) => ({ id: bar.id, label: `${bar.id} · ${bar.a}–${bar.b}${recommendedTelescopicIds.has(bar.id) ? "（推荐）" : "（实验对象）"}` }));
  const selectedBar = project.baseProject.bars.find((bar) => bar.id === selectedBarId) ?? null;
  const selectedBarMetrics = useMemo(
    () => {
      const metrics = selectedBarId ? analyzeVariableLegBarSamples(project.baseProject, project.adjustment, cycleSamples, selectedBarId) : null;
      return metrics ? { ...metrics, peakAngularSpeedDegrees: metrics.peakAngularSpeedDegrees * activeMode.rpm / 60 } : null;
    },
    [activeMode.rpm, cycleSamples, project.adjustment, project.baseProject, selectedBarId],
  );
  const feasibilityKey = useMemo(
    () => feasibilityProjectKey(project),
    [project],
  );
  const visibleFeasibility = feasibilitySourceKey === feasibilityKey ? feasibility : null;
  const previewPath = useMemo(() => {
    const previewProject = barLengthPreview?.previewProject;
    if (!previewProject) return [] as Point[];
    const previewMode = previewProject.modes.find((mode) => mode.id === activeMode.id) ?? previewProject.modes[0];
    return previewMode ? analyzeVariableLegProject({ ...previewProject, activeModeId: previewMode.id }, 36, 60).metrics.find((metric) => metric.modeId === previewMode.id)?.path ?? [] : [];
  }, [activeMode.id, barLengthPreview]);

  const resetGaitTrail = useCallback(() => {
    bodyWorldXRef.current = 0;
    footprintSequenceRef.current = 0;
    setBodyWorldX(0);
    setFootprints([]);
  }, []);

  const setMotionPhase = useCallback((nextPhase: number) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const stopMotion = useCallback(() => setPlaying(false), []);

  const selectBarForInspection = useCallback((barId: string) => {
    setSelectedBarId(barId);
    setBarLengthPreview((current) => current?.barId === barId ? current : null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const transferValue = window.sessionStorage.getItem(TRANSFER_KEY);
      if (transferValue) {
        try {
          const transfer = JSON.parse(transferValue) as unknown;
          if (isVariableLegDesignerTransfer(transfer) && transfer.direction === "to-variable-leg") {
            const returned = applyVariableLegDesignerReturn(transfer);
            window.sessionStorage.removeItem(TRANSFER_KEY);
            if (returned.validation.valid) {
              resetHistory(returned.project);
              setMotionPhase(returned.project.inputPhase || 0);
              setMessage("已接收自由设计器修改；工况和整机部署已保留，旧候选已清空。");
            } else {
              setMessage(`设计器返回失败：${returned.validation.reasons.join("；")}`);
            }
            window.history.replaceState(null, "", "/variable-leg");
            return;
          }
        } catch {
          window.sessionStorage.removeItem(TRANSFER_KEY);
        }
      }
      const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as unknown;
        const migrated = migrateVariableLegProject(parsed);
        if (!migrated) throw new Error("invalid");
        resetHistory(migrated);
        setMotionPhase(migrated.inputPhase || 0);
        const missingStandardModes = ["cruise", "sprint", "obstacle"].filter((id) => !migrated.modes.some((mode) => mode.id === id));
        setMessage(missingStandardModes.length
          ? "已恢复旧本地项目；检测到标准工况缺失，可点击“补齐标准工况”恢复。"
          : "已恢复上次的可变几何步行腿项目。");
      } catch {
        setMessage("自动保存数据无效，已保留默认工况。");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resetHistory, setMotionPhase]);

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
      const current = phaseRef.current;
      const next = (current + activeMode.rpm * Math.PI * 2 / 60 * elapsed) % (Math.PI * 2);
      if (viewMode === "deployment") {
        const advance = variableLegBodyAdvance(current, next, project.deployment, activeMode, activeMetrics);
        bodyWorldXRef.current += advance;
        setBodyWorldX(bodyWorldXRef.current);
        const touchdownLegs = detectVariableLegTouchdowns(current, next, project.deployment, activeMode, activeMetrics);
        if (touchdownLegs.length) {
          const additions = touchdownLegs.flatMap((leg) => {
            const sample = cycleSamples[variableLegSampleIndex(next, leg.phaseOffset, cycleSamples.length)];
            if (!sample?.tracer) return [];
            footprintSequenceRef.current += 1;
            return [{
              id: `${leg.id}-${footprintSequenceRef.current}`,
              legId: leg.id,
              label: leg.label,
              side: leg.side,
              sequence: footprintSequenceRef.current,
              worldX: bodyWorldXRef.current + variableLegMountX(leg, project.deployment) + sample.tracer.x,
              worldY: sample.tracer.y,
            } satisfies VariableLegFootprint];
          });
          if (additions.length) setFootprints((currentFootprints) => appendVariableLegFootprints(currentFootprints, additions));
        }
      }
      setMotionPhase(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeMetrics, activeMode, cycleSamples, playing, project.deployment, setMotionPhase, viewMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      stopMotion();
      const restored = key === "y" || event.shiftKey ? redo() : undo();
      if (restored) {
        resetGaitTrail();
        setMessage(key === "y" || event.shiftKey ? "已重做一步。" : "已撤销一步。");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, resetGaitTrail, stopMotion, undo]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    setQuickDesign(createVariableLegQuickDesign(projectRef.current));
    setBarLengthPreview(null);
  }, [project.topology, projectRef]);

  const updateProject = (updater: (current: VariableLegProject) => VariableLegProject, status?: string) => {
    stopMotion();
    resetGaitTrail();
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
    resetGaitTrail();
    replace({ ...projectRef.current, activeModeId: modeId });
    setCanvasMode("inspect");
    setMessage("主轴已暂停，已切换到新的离散锁止工况。");
  };

  const changeTopology = (topology: VariableLegTopology) => {
    const kind = project.adjustment.kind;
    updateProject((current) => {
      const adjustment = createDefaultAdjustment(topology, kind);
      return {
        ...current,
        topology,
        baseProject: getVariableLegTemplate(topology),
        adjustment,
        modes: current.modes.map((mode, index) => ({
          ...mode,
          adjustmentValue: adjustment.kind === "moving-pivot" ? (index === 0 ? 0 : index === 1 ? 28 : -22) : adjustment.baseLength,
        })),
        candidates: [],
        selectedCandidateId: null,
      };
    }, `已切换为${topologyName(topology)}。`);
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

  const restoreStandardModes = () => {
    updateProject(
      (current) => restoreVariableLegStandardModes(current),
      "已补齐巡航、高速和越障标准工况；现有同名工况、机构与整机部署均已保留。",
    );
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
    setMotionPhase(0);
    resetGaitTrail();
    setCanvasMode("inspect");
    viewport.resetView();
    setMessage("已恢复克兰腿与三个默认工况。");
  };

  const commitBarLength = (nextLength: number) => {
    if (!selectedBar) return;
    if (!Number.isFinite(nextLength) || nextLength <= 0) {
      setMessage("杆长必须是大于 0 的有限数字，项目未被修改。");
      return;
    }
    if (Math.abs(nextLength - selectedBar.length) < 1e-8) return;
    const barId = selectedBar.id;
    updateProject((current) => setVariableLegBaseBarLength(current, barId, nextLength), `已将 ${barId} 基础长度改为 ${nextLength.toFixed(2)} mm；旧候选已清空。`);
    setFeasibility(null);
    setBarLengthPreview(null);
  };

  const restoreSelectedTemplateLength = () => {
    if (!selectedBar) return;
    const templateBar = getVariableLegTemplate(project.topology).bars.find((bar) => bar.id === selectedBar.id);
    if (!templateBar) return;
    if (editingMode === "guided") runBarLengthPreview(selectedBar.id, templateBar.length);
    else commitBarLength(templateBar.length);
  };

  const runSynthesis = (scope: VariableLegSynthesisScope = "global") => {
    if (searching || project.modes.some((mode) => mode.targetPath.length < 12)) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `request-${Date.now()}`;
    requestIdRef.current = requestId;
    setSearching(true);
    setWorkerTask("synthesis");
    setSearchProgress({ progress: 0, stage: "scan", message: "正在准备灵敏度扫描" });
    setMessage(scope === "global" ? `正在保持${topologyName(project.topology)}拓扑，比较不同调节对象与尺度……` : `正在精修 ${project.adjustment.targetId} 与各工况锁止值……`);
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
        resetGaitTrail();
        setMessage(scope === "global" ? `已生成 ${response.candidates.length} 套多工况候选，当前载入综合推荐。` : "当前杆件精修完成，已载入结果。");
      } else if (response.type === "cancelled") {
        setMessage("自动综合已取消，当前机构和目标轨迹未改变。");
      } else if (response.type === "error") {
        setMessage(response.message);
      }
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("综合 Worker 运行失败，请刷新后重试。");
    };
    worker.postMessage({ type: "start", requestId, project: cloneVariableLegProject(project), scope });
  };

  const runQuickDesign = () => {
    if (searching || project.modes.some((mode) => mode.targetPath.length < 12)) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `quick-design-${Date.now()}`;
    requestIdRef.current = requestId;
    setSearching(true);
    setWorkerTask("quick-design");
    setSearchProgress({ progress: 0, stage: "scan", message: "正在从标准拓扑构造三个可行起点" });
    setMessage(`正在为${topologyName(project.topology)}生成稳健、大步幅和高抬腿三个基础方案……`);
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
      if (response.type === "quick-design-result") {
        commit({ ...cloneVariableLegProject(projectRef.current), candidates: response.candidates, selectedCandidateId: null });
        const usableCount = response.candidates.filter((candidate) => assessVariableLegCandidate(candidate.metrics, candidate.modes).level === "usable").length;
        setMessage(`已生成 ${response.candidates.length} 个基础方案，其中 ${usableCount} 个同时达到整周连续和步态可用标准；请在右侧预览并选择。`);
      } else if (response.type === "cancelled") setMessage("引导设计已取消，当前机构未改变。");
      else if (response.type === "error") setMessage(response.message);
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("引导设计 Worker 运行失败，请刷新后重试。");
    };
    worker.postMessage({ type: "quick-design", requestId, project: cloneVariableLegProject(project), design: quickDesign });
  };

  const runBarLengthPreview = (barId: string, requestedLength: number) => {
    if (!Number.isFinite(requestedLength) || requestedLength <= 0) {
      setMessage("杆长必须是大于 0 的有限数字，当前机构未改变。");
      return;
    }
    if (Math.abs(requestedLength - (project.baseProject.bars.find((bar) => bar.id === barId)?.length ?? requestedLength)) < 1e-8) {
      setBarLengthPreview(null);
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `bar-preview-${barId}-${requestedLength}`;
    requestIdRef.current = requestId;
    setSearching(true);
    setWorkerTask("bar-preview");
    setSearchProgress({ progress: 0.35, stage: "scan", message: `正在检查 ${barId} 草稿与附近可行值` });
    setMessage(`正在检查 ${barId} = ${requestedLength.toFixed(2)} mm；当前机构暂不修改。`);
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestIdRef.current) return;
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      if (response.type === "bar-preview-result") {
        setBarLengthPreview(response.preview);
        setMessage(response.preview.requestedValid
          ? "草稿整周可达，可以应用；当前机构仍未修改。"
          : response.preview.nearestFeasibleLength !== null
            ? `输入值不可达；已找到最近可行值 ${response.preview.nearestFeasibleLength.toFixed(2)} mm。`
            : "输入值不可达，附近也未找到整周可行值；当前机构保持不变。");
      } else if (response.type === "error") setMessage(response.message);
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("杆长草稿检查失败，当前机构未改变。");
    };
    worker.postMessage({ type: "bar-preview", requestId, project: cloneVariableLegProject(project), barId, requestedLength });
  };

  const applyBarLengthPreview = () => {
    if (!barLengthPreview?.previewProject || barLengthPreview.nearestFeasibleLength === null) return;
    commit(cloneVariableLegProject(barLengthPreview.previewProject));
    setMessage(`已应用 ${barLengthPreview.barId} = ${barLengthPreview.nearestFeasibleLength.toFixed(2)} mm，并保留为新的可行版本。`);
    setBarLengthPreview(null);
    setFeasibility(null);
  };

  const updateQuickDesignValue = (key: VariableLegQuickDesignKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setQuickDesign((current) => ({ ...current, [key]: value }));
  };

  const toggleQuickDesignLock = (key: VariableLegQuickDesignKey) => {
    setQuickDesign((current) => ({ ...current, locked: { ...current.locked, [key]: !current.locked[key] } }));
  };

  const checkFeasibleRange = () => {
    if (searching) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `feasibility-${Date.now()}`;
    requestIdRef.current = requestId;
    const scannedKey = feasibilityKey;
    setSearching(true);
    setWorkerTask("feasibility");
    setSearchProgress({ progress: 0, stage: "scan", message: "正在扫描 41 个调节值 × 全部工况 36 相位" });
    setMessage("正在检查整周可解、分支连续、闭环误差与 5° 最小夹角……");
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestIdRef.current) return;
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      if (response.type === "feasibility-result") {
        if (scannedKey === feasibilityProjectKey(projectRef.current)) {
          setFeasibility(response.feasibility);
          setFeasibilitySourceKey(scannedKey);
        }
        setMessage(response.feasibility.recommendedInterval ? "可行范围检查完成，已找到包含当前锁止值的推荐区间。" : "检查完成，但当前锁止值不在任何连续可行区间内。");
      } else if (response.type === "error") setMessage(response.message);
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("可行范围 Worker 运行失败，请刷新后重试。");
    };
    worker.postMessage({ type: "feasibility", requestId, project: cloneVariableLegProject(project) });
  };

  const applyRecommendedRange = () => {
    if (!visibleFeasibility?.recommendedInterval) return;
    const result = applyVariableLegRecommendedRange(projectRef.current, visibleFeasibility);
    commit(result.project);
    setFeasibility(null);
    setFeasibilitySourceKey(null);
    const names = result.clampedModeIds.map((id) => project.modes.find((mode) => mode.id === id)?.name ?? id);
    setMessage(names.length ? `已应用推荐范围；${names.join("、")}的锁止值已吸附到最近边界。` : "已应用推荐范围；所有工况锁止值均无需调整。");
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
      const migrated = migrateVariableLegProject(parsed);
      if (!migrated) throw new Error("invalid");
      resetHistory(migrated);
      setMotionPhase(migrated.inputPhase || 0);
      resetGaitTrail();
      setMessage(`已导入 ${file.name}。`);
    } catch {
      setMessage("导入失败：文件不是有效的可变几何步行腿项目。");
    }
  };

  const openInDesigner = () => {
    const transfer = createVariableLegDesignerTransfer(project);
    window.sessionStorage.setItem(TRANSFER_KEY, JSON.stringify(transfer));
    window.location.href = "/designer?transfer=variable-leg";
  };

  const setDeploymentLegCount = (legCount: VariableLegCount) => {
    updateProject((current) => ({ ...current, deployment: changeVariableLegCount(current.deployment, legCount) }), `已切换为 ${legCount} 腿整机部署。`);
    setViewMode("deployment");
  };

  const setDeploymentPreset = (preset: Exclude<VariableLegGaitPreset, "custom">) => {
    updateProject((current) => ({ ...current, deployment: changeVariableLegPreset(current.deployment, preset) }), "已应用步态预设并重新分配各腿相位。" );
    setViewMode("deployment");
  };

  const setDeploymentPhase = (legId: string, degrees: number) => {
    stopMotion();
    resetGaitTrail();
    replace({
      ...projectRef.current,
      deployment: changeVariableLegPhase(projectRef.current.deployment, legId, degrees / 360),
    });
  };

  const gaitWarnings = viewMode === "deployment" ? [
    gaitMetrics.minimumSupport === 0 ? "当前步态存在全部腿同时离地的腾空阶段。" : null,
    gaitMetrics.maximumTouchdownCluster > project.deployment.legCount / 2 ? "多条腿在同一时刻集中触地，建议改用波步或错开相位。" : null,
    gaitMetrics.stanceSlip > Math.max(5, activeMetrics.stepLength * 0.03) ? "支撑相足端滑移较大，机身匀速运动时可能出现拖脚。" : null,
    gaitMetrics.smoothnessScore < 70 ? "当前相位组合的步态平滑分较低。" : null,
  ].filter((warning): warning is string => Boolean(warning)) : [];

  const warnings = [
    activeMetrics.validRatio < 0.99 ? "当前工况存在不可达相位或约束误差。" : null,
    activeMetrics.branchSwitches > 0 ? "检测到装配分支变化，当前几何不适合连续运行。" : null,
    activeMetrics.singularityMargin < 8 ? "最小几何夹角低于 8°，接近奇异位置。" : null,
    activeMetrics.landingVerticalSpeed > 240 ? "按当前转速估算的落地垂直速度较高。" : null,
    activeMetrics.liftHeight < activeStats.lift * 0.8 ? `摆动相净离地仅达到目标的 ${Math.round(activeMetrics.liftHeight / Math.max(1, activeStats.lift) * 100)}%。` : null,
    activeMode.adjustmentValue < project.adjustment.minimum || activeMode.adjustmentValue > project.adjustment.maximum ? "锁止值超出调节范围。" : null,
    ...gaitWarnings,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav>
          <Link href="/lab">四杆设计</Link><Link href="/leg">六杆腿</Link><Link href="/straight-line">直线机构</Link><Link href="/designer">自由设计</Link>
          <span>可变几何步行腿 · 0.4</span>
        </nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>机构与工况</h1></div><button type="button" onClick={resetProject}>恢复默认</button></div>

          <div className={styles.historyBar}>
            <button type="button" disabled={!canUndo} onClick={() => { stopMotion(); if (undo()) { resetGaitTrail(); setMessage("已撤销一步。"); } }}>↶ 撤销</button>
            <button type="button" disabled={!canRedo} onClick={() => { stopMotion(); if (redo()) { resetGaitTrail(); setMessage("已重做一步。"); } }}>↷ 重做</button>
          </div>

          <div className={styles.workflowTabs} role="group" aria-label="机构编辑流程">
            <button type="button" className={editingMode === "guided" ? styles.activeWorkflow : ""} onClick={() => setEditingMode("guided")}>引导设计</button>
            <button type="button" className={editingMode === "advanced" ? styles.activeWorkflow : ""} onClick={() => setEditingMode("advanced")}>高级编辑</button>
          </div>

          {editingMode === "guided" && <section className={styles.quickDesignSection}>
            <div className={styles.quickDesignHeader}><span><b>先定目标，再找可行机构</b><small>锁定 = 必须保持；未锁定 = 允许方案方向微调</small></span><button type="button" onClick={() => setQuickDesign(createVariableLegQuickDesign(projectRef.current))}>从当前读取</button></div>
            <label>基础拓扑
              <select value={project.topology} onChange={(event) => changeTopology(event.target.value as VariableLegTopology)}>
                <option value="klann">克兰六杆腿</option><option value="jansen">简森多杆腿</option>
              </select>
            </label>
            <div className={styles.quickDesignGrid}>
              <label><span>整体尺度</span><span className={styles.quickInput}><input aria-label="快速设计整体尺度" type="number" min="0.65" max="1.5" step="0.01" value={Number(quickDesign.scale.toFixed(2))} onChange={(event) => updateQuickDesignValue("scale", Number(event.target.value))} /><i>×</i><button type="button" className={quickDesign.locked.scale ? styles.lockedParameter : ""} aria-label="锁定整体尺度" aria-pressed={quickDesign.locked.scale} onClick={() => toggleQuickDesignLock("scale")}>{quickDesign.locked.scale ? "锁" : "活"}</button></span></label>
              <label><span>曲柄半径</span><span className={styles.quickInput}><input aria-label="快速设计曲柄半径" type="number" min="5" step="1" value={Number(quickDesign.crankRadius.toFixed(1))} onChange={(event) => updateQuickDesignValue("crankRadius", Number(event.target.value))} /><i>mm</i><button type="button" className={quickDesign.locked.crankRadius ? styles.lockedParameter : ""} aria-label="锁定曲柄半径" aria-pressed={quickDesign.locked.crankRadius} onClick={() => toggleQuickDesignLock("crankRadius")}>{quickDesign.locked.crankRadius ? "锁" : "活"}</button></span></label>
              <label><span>期望步长</span><span className={styles.quickInput}><input aria-label="快速设计期望步长" type="number" min="40" step="5" value={Math.round(quickDesign.stepLength)} onChange={(event) => updateQuickDesignValue("stepLength", Number(event.target.value))} /><i>mm</i><button type="button" className={quickDesign.locked.stepLength ? styles.lockedParameter : ""} aria-label="锁定期望步长" aria-pressed={quickDesign.locked.stepLength} onClick={() => toggleQuickDesignLock("stepLength")}>{quickDesign.locked.stepLength ? "锁" : "活"}</button></span></label>
              <label><span>期望抬脚</span><span className={styles.quickInput}><input aria-label="快速设计期望抬脚" type="number" min="10" step="5" value={Math.round(quickDesign.liftHeight)} onChange={(event) => updateQuickDesignValue("liftHeight", Number(event.target.value))} /><i>mm</i><button type="button" className={quickDesign.locked.liftHeight ? styles.lockedParameter : ""} aria-label="锁定期望抬脚" aria-pressed={quickDesign.locked.liftHeight} onClick={() => toggleQuickDesignLock("liftHeight")}>{quickDesign.locked.liftHeight ? "锁" : "活"}</button></span></label>
              <label><span>支撑相比例</span><span className={styles.quickInput}><input aria-label="快速设计支撑相比例" type="number" min="35" max="82" step="1" value={Math.round(quickDesign.stanceRatio * 100)} onChange={(event) => updateQuickDesignValue("stanceRatio", Number(event.target.value) / 100)} /><i>%</i><button type="button" className={quickDesign.locked.stanceRatio ? styles.lockedParameter : ""} aria-label="锁定支撑相比例" aria-pressed={quickDesign.locked.stanceRatio} onClick={() => toggleQuickDesignLock("stanceRatio")}>{quickDesign.locked.stanceRatio ? "锁" : "活"}</button></span></label>
            </div>
            <small className={styles.quickDesignHint}>三个方向都从标准{topologyName(project.topology)}重新起步。未锁定参数是软目标，不会把预填值当成几何硬约束。</small>
          </section>}

          {editingMode === "advanced" && <section className={styles.configSection}>
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
            <div className={styles.feasibilityBox}>
              <div className={styles.feasibilityActions}>
                <button type="button" onClick={checkFeasibleRange} disabled={searching}>检查可行范围</button>
                <button type="button" onClick={applyRecommendedRange} disabled={!visibleFeasibility?.recommendedInterval}>应用推荐范围</button>
              </div>
              {visibleFeasibility ? <>
                <div className={styles.feasibilityTrack} aria-label="调节可行范围">
                  {visibleFeasibility.samples.map((sample) => <i key={sample.value} className={sample.feasible ? styles.feasibleCell : styles.infeasibleCell} title={`${sample.value.toFixed(1)}：${sample.feasible ? "可行" : `不可行（${sample.failedModeIds.join("、")}）`}`} />)}
                  <span
                    className={styles.baseRangeMarker}
                    title={`基础值 ${project.adjustment.kind === "telescopic-bar" ? project.adjustment.baseLength.toFixed(1) : "0.0"}`}
                    style={{ left: `${Math.max(0, Math.min(100, ((project.adjustment.kind === "telescopic-bar" ? project.adjustment.baseLength : 0) - visibleFeasibility.minimum) / Math.max(1e-9, visibleFeasibility.maximum - visibleFeasibility.minimum) * 100))}%` }}
                  />
                  {project.modes.map((mode) => <span
                    key={mode.id}
                    className={styles.modeRangeMarker}
                    title={`${mode.name} ${mode.adjustmentValue.toFixed(1)}`}
                    style={{ left: `${Math.max(0, Math.min(100, (mode.adjustmentValue - visibleFeasibility.minimum) / Math.max(1e-9, visibleFeasibility.maximum - visibleFeasibility.minimum) * 100))}%`, background: mode.color }}
                  />)}
                </div>
                <small>{visibleFeasibility.recommendedInterval
                  ? `推荐 ${visibleFeasibility.recommendedInterval.minimum.toFixed(1)} – ${visibleFeasibility.recommendedInterval.maximum.toFixed(1)}`
                  : "当前锁止值不在连续可行区间内"}</small>
              </> : <small>扫描 41 个调节值；每个值检查全部工况的 36 个相位。</small>}
            </div>
          </section>}

          <div className={styles.modeHeader}><b>工况</b><span>{missingStandardModeCount > 0 && <button type="button" onClick={restoreStandardModes}>补齐标准工况</button>}{project.modes.length}/6</span></div>
          <div className={styles.modeTabs}>
            {project.modes.map((mode) => <button type="button" key={mode.id} className={mode.id === activeMode.id ? styles.activeMode : ""} style={{ borderColor: mode.color }} onClick={() => selectMode(mode.id)}>{mode.name}</button>)}
          </div>
          {editingMode === "advanced" && <div className={styles.modeActions}><button type="button" onClick={addMode}>复制工况</button><button type="button" onClick={deleteMode} disabled={project.modes.length <= 1}>删除</button></div>}

          {editingMode === "advanced" && <section className={styles.modeEditor}>
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
          </section>}

          <div className={styles.deploymentHeader}><b>整机部署</b><span>{project.deployment.legCount} 条腿</span></div>
          <section className={styles.deploymentEditor}>
            <div className={styles.legCountTabs} role="group" aria-label="整机腿数">
              {([2, 4, 6, 8] as const).map((legCount) => <button
                type="button"
                key={legCount}
                className={project.deployment.legCount === legCount ? styles.activeLegCount : ""}
                onClick={() => setDeploymentLegCount(legCount)}
              >{legCount} 腿</button>)}
            </div>
            <label>步态预设
              <select
                value={project.deployment.preset}
                onChange={(event) => event.target.value !== "custom" && setDeploymentPreset(event.target.value as Exclude<VariableLegGaitPreset, "custom">)}
              >
                {variableLegPresetOptions(project.deployment.legCount).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                {project.deployment.preset === "custom" && <option value="custom">自定义相位</option>}
              </select>
            </label>
            <label>安装跨度
              <span className={styles.unitInput}><input
                type="number"
                min="0"
                max="900"
                step="10"
                value={Math.round(project.deployment.mountSpan)}
                onChange={(event) => updateProject((current) => ({ ...current, deployment: { ...current.deployment, mountSpan: Math.max(0, Math.min(900, Number(event.target.value) || 0)) } }))}
              /><i>mm</i></span>
            </label>
            <div className={styles.phaseList}>
              {project.deployment.legs.map((leg) => <label key={leg.id}>
                <span>{leg.label}<b>{Math.round(leg.phaseOffset * 360)}°</b></span>
                <input
                  aria-label={`${leg.label}相位`}
                  type="range"
                  min="0"
                  max="359"
                  step="1"
                  value={Math.round(leg.phaseOffset * 360)}
                  onChange={(event) => setDeploymentPhase(leg.id, Number(event.target.value))}
                  onPointerUp={() => commit(cloneVariableLegProject(projectRef.current))}
                />
              </label>)}
            </div>
          </section>

          <section className={styles.searchBox}>
            {editingMode === "guided"
              ? <button className={styles.primaryButton} type="button" onClick={runQuickDesign} disabled={searching}>{searching && workerTask === "quick-design" ? `${Math.round(searchProgress.progress * 100)}% · ${searchProgress.stage}` : "生成 3 个基础方案"}</button>
              : <button className={styles.primaryButton} type="button" onClick={() => runSynthesis("global")} disabled={searching}>{searching && workerTask === "synthesis" ? `${Math.round(searchProgress.progress * 100)}% · ${searchProgress.stage}` : "自动综合 5 套方案"}</button>}
            <button type="button" onClick={() => runSynthesis("current-target")} disabled={searching}>精修当前杆件</button>
            {searching && (workerTask === "synthesis" || workerTask === "quick-design") && <button className={styles.cancelButton} type="button" onClick={cancelSynthesis}>取消搜索</button>}
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
            <span>{topologyName(project.topology)}</span><span>{adjustmentName(project.adjustment.kind)} / {project.adjustment.targetId}</span>
            {barLengthPreview && <span className={barLengthPreview.requestedValid ? styles.draftValid : styles.draftInvalid}>{barLengthPreview.requestedValid ? "草稿可行" : "草稿未写入"}</span>}
            <b>锁止 {activeMode.adjustmentValue.toFixed(1)}</b>
          </div>
          <div className={styles.canvas}>
            <div className={styles.canvasActions} role="group" aria-label="画布显示与编辑工具">
              <button className={viewMode === "mechanism" ? styles.selectedTool : ""} type="button" onClick={() => setViewMode("mechanism")}>单腿机构</button>
              <button className={viewMode === "deployment" ? styles.selectedTool : ""} type="button" onClick={() => { setViewMode("deployment"); setCanvasMode("inspect"); }}>整机步态</button>
              {viewMode === "mechanism" ? <>
                <span className={styles.canvasActionDivider} />
                <button className={canvasMode === "draw" ? styles.selectedTool : ""} type="button" onClick={() => setCanvasMode("draw")}>绘制轨迹</button>
                <button className={canvasMode === "points" ? styles.selectedTool : ""} type="button" onClick={() => setCanvasMode("points")}>编辑控制点</button>
                <button type="button" onClick={smoothActivePath}>平滑</button>
                <button type="button" onClick={() => updateActiveMode((mode) => ({ ...mode, targetPath: [] }), "当前目标轨迹已清除。")}>清除</button>
              </> : <>
                <span className={styles.canvasActionDivider} />
                <button type="button" onClick={() => commit({ ...cloneVariableLegProject(projectRef.current), deployment: { ...projectRef.current.deployment, showFootprints: !projectRef.current.deployment.showFootprints } })}>{project.deployment.showFootprints ? "隐藏足迹" : "显示足迹"}</button>
                <button type="button" onClick={resetGaitTrail}>清除足迹</button>
              </>}
            </div>
            <SvgViewportControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.resetView} />
            <svg
              ref={svgRef}
              viewBox={viewport.viewBox}
              role="img"
              aria-label={viewMode === "mechanism" ? "可变几何克兰或简森步行腿、导轨、锁止位置与多工况足端轨迹" : `${project.deployment.legCount} 条可变几何步行腿整机步态与落足记录`}
              className={viewport.isPanning ? styles.panning : viewMode === "mechanism" && canvasMode === "draw" ? styles.drawing : undefined}
              onPointerDown={startCanvasPointer}
              onPointerMove={moveCanvasPointer}
              onPointerUp={endCanvasPointer}
              onPointerCancel={endCanvasPointer}
            >
              {viewMode === "mechanism" ? <>
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
                {previewPath.length > 2 && <path d={pathData(previewPath)} className={styles.previewPath} />}
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
                const selected = bar.id === selectedBarId;
                return <g key={bar.id} role="button" tabIndex={0} aria-label={`检查杆件 ${bar.id}`} className={styles.selectableBar} onPointerDown={(event) => { event.stopPropagation(); selectBarForInspection(bar.id); setCanvasMode("inspect"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectBarForInspection(bar.id); setCanvasMode("inspect"); } }}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.barHitArea} />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.link} ${bar.id === currentFrame.driverId ? styles.driver : ""} ${adjustable ? styles.telescopic : ""} ${selected ? styles.selectedBar : ""}`} />
                </g>;
                })}
                {currentFrame.joints.map((joint) => <g key={joint.id} className={joint.fixed ? styles.fixedJoint : styles.movingJoint}><circle cx={joint.x} cy={joint.y} r="9" /><circle cx={joint.x} cy={joint.y} r="3" /><text x={joint.x + 10} y={joint.y - 10}>{joint.id}</text></g>)}
                {currentTracer && <circle cx={currentTracer.x} cy={currentTracer.y} r="11" className={styles.foot} />}

                {canvasMode === "points" && activeMode.targetPath.map((point, index) => index % 6 === 0
                  ? <circle key={`${activeMode.id}-${index}`} cx={point.x} cy={point.y} r="7" fill={activeMode.color} className={styles.controlPoint} onPointerDown={(event) => startPointDrag(event, index)} />
                  : null)}
              </> : <VariableLegDeploymentView
                samples={cycleSamples}
                deployment={project.deployment}
                mode={activeMode}
                metrics={activeMetrics}
                phase={phase}
                bodyWorldX={bodyWorldX}
                footprints={footprints}
                selectedBarId={selectedBarId}
                onSelectBar={selectBarForInspection}
              />}
            </svg>
            {searching && <div className={styles.searchOverlay}><strong>{Math.round(searchProgress.progress * 100)}%</strong><span>{searchProgress.message}</span></div>}
          </div>
          <div className={styles.legend}>
            {viewMode === "mechanism" ? <>
              {project.modes.map((mode) => <span key={mode.id}><i style={{ background: mode.color }} />{mode.name}</span>)}
              <span><i className={styles.legendTarget} />虚线目标 / 实线实际</span>
            </> : <>
              <span><i className={styles.legendStance} />支撑相</span><span><i className={styles.legendSwing} />摆动相</span><span>足迹 {footprints.length}/80</span>
            </>}
          </div>
          <div className={styles.transport}>
            <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "暂停可变几何腿动画" : "播放可变几何腿动画"}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="主轴相位" type="range" min="0" max={Math.PI * 2} step="0.001" value={phase} onChange={(event) => { setPlaying(false); setMotionPhase(Number(event.target.value)); }} />
            <span>{(phase * 180 / Math.PI).toFixed(1)}°</span><b>{activeMode.rpm} rpm</b>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.analysisPanel}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>候选与工程检查</h2></div></div>
          {project.candidates?.length ? <div className={styles.candidateList}>
            {project.candidates.map((candidate, index) => {
              const quality = assessVariableLegCandidate(candidate.metrics, candidate.modes);
              const usable = quality.level === "usable";
              return <button type="button" key={candidate.id} className={candidate.id === project.selectedCandidateId ? styles.selectedCandidate : ""} onClick={() => applyCandidate(candidate)}>
              <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
              <span><b>{candidate.label} <i className={usable ? styles.candidateFeasible : styles.candidateNear}>{usable ? "步态可用" : quality.level === "continuous" ? "连续·待精修" : "存在不可达"}</i></b><small>{topologyName(candidate.topology)} · {adjustmentName(candidate.adjustment.kind)} · {candidate.adjustment.targetId}{quality.issues.length ? ` · ${quality.issues[0]}` : ""}</small></span>
              <strong>{candidate.score.toFixed(0)}</strong>
              <em>平均 RMSE {candidate.familyRmse.toFixed(1)} mm · 调节行程 {candidate.adjustmentStroke.toFixed(1)} mm</em>
            </button>;
            })}
          </div> : <div className={styles.emptyState}><b>{editingMode === "guided" ? "等待基础方案" : "等待多轨迹综合"}</b><p>{editingMode === "guided" ? "先填写五个宏观目标并决定哪些必须锁定，再生成稳健、大步幅和高抬腿三个当前拓扑方案。生成前不会改动当前机构。" : "系统会保持当前基础拓扑，比较适合移动的固定铰点或伸缩杆，再精修各工况锁止值并返回五套候选。"}</p></div>}

          {viewMode === "deployment" && <>
            <div className={styles.analysisSectionTitle}><span>整机步态</span><b>{project.deployment.legCount} 腿 · {project.deployment.preset === "custom" ? "自定义" : "预设"}</b></div>
            <div className={`${styles.modeSummary} ${styles.gaitSummary}`}>
              <div><span>步态平滑分</span><strong>{gaitMetrics.smoothnessScore}<small>/100</small></strong></div>
              <div><span>同时支撑腿数</span><strong>{gaitMetrics.minimumSupport}<small>–{gaitMetrics.maximumSupport} 条</small></strong></div>
              <div><span>支撑覆盖率</span><strong>{(gaitMetrics.supportCoverage * 100).toFixed(0)}<small>%</small></strong></div>
              <div><span>触地间隔均匀度</span><strong>{(gaitMetrics.touchdownUniformity * 100).toFixed(0)}<small>%</small></strong></div>
              <div><span>支撑数量稳定性</span><strong>{(gaitMetrics.supportUniformity * 100).toFixed(0)}<small>%</small></strong></div>
              <div><span>支撑相滑移</span><strong>{gaitMetrics.stanceSlip.toFixed(2)}<small>mm RMS</small></strong></div>
            </div>
          </>}

          <div className={styles.analysisSectionTitle}><span>杆件检查</span><b>{selectedBar?.id ?? "点击画布杆件"}</b></div>
          {selectedBar && selectedBarMetrics ? <div className={styles.barInspector}>
            <div className={styles.barIdentity}>
              <span><b>{selectedBar.id}</b><small>{selectedBar.a} → {selectedBar.b}</small></span>
              <em>{barRoleName(selectedBarMetrics.role)}{project.adjustment.targetId === selectedBar.id ? " · 当前调节对象" : ""}</em>
            </div>
            <label>基础杆长
              <span className={styles.barLengthEditor}>
                <input
                  aria-label={`${selectedBar.id}基础杆长`}
                  inputMode="decimal"
                  key={`${selectedBar.id}-${selectedBar.length}`}
                  defaultValue={String(Number(selectedBar.length.toFixed(4)))}
                  onBlur={(event) => {
                    const value = Number(event.currentTarget.value);
                    if (editingMode === "guided") runBarLengthPreview(selectedBar.id, value);
                    else commitBarLength(value);
                    if (!Number.isFinite(value) || value <= 0) event.currentTarget.value = String(Number(selectedBar.length.toFixed(4)));
                  }}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") event.currentTarget.value = String(Number(selectedBar.length.toFixed(4))); }}
                />
                <i>mm</i>
              </span>
            </label>
            {editingMode === "guided" && barLengthPreview?.barId === selectedBar.id && <div className={barLengthPreview.requestedValid ? styles.draftPreviewGood : styles.draftPreviewWarn}>
              <b>{barLengthPreview.requestedValid ? "草稿可行" : "草稿未写入当前机构"}</b>
              <p>{barLengthPreview.requestedValid
                ? `${barLengthPreview.requestedLength.toFixed(2)} mm 已通过全部工况整周检查。`
                : barLengthPreview.nearestFeasibleLength !== null
                  ? `输入 ${barLengthPreview.requestedLength.toFixed(2)} mm 不可达；最近可行值为 ${barLengthPreview.nearestFeasibleLength.toFixed(2)} mm。画布紫色虚线显示可应用预览。`
                  : `输入 ${barLengthPreview.requestedLength.toFixed(2)} mm 不可达，附近未找到可行值。`}</p>
              <div><button type="button" onClick={applyBarLengthPreview} disabled={!barLengthPreview.previewProject}>{barLengthPreview.requestedValid ? "应用草稿" : "应用最近可行值"}</button><button type="button" onClick={() => setBarLengthPreview(null)}>取消草稿</button></div>
            </div>}
            <button type="button" onClick={restoreSelectedTemplateLength}>恢复模板长度</button>
            <div className={styles.barMetricGrid}>
              <span>当前有效长度<b>{selectedBarMetrics.effectiveLength.toFixed(2)} mm</b></span>
              <span>整周转角范围<b>{selectedBarMetrics.angleRangeDegrees.toFixed(1)}°</b></span>
              <span>峰值角速度<b>{selectedBarMetrics.peakAngularSpeedDegrees.toFixed(0)} °/s</b></span>
              <span>最大约束残差<b>{selectedBarMetrics.maxConstraintResidual.toFixed(3)} mm</b></span>
              <span>相邻铰点最小夹角<b>{selectedBarMetrics.minimumJointAngle.toFixed(1)}°</b></span>
              <span>不可达相位<b>{selectedBarMetrics.invalidPhases.length ? selectedBarMetrics.invalidPhases.map((value) => `${Math.round(value * 180 / Math.PI)}°`).join("、") : "无"}</b></span>
            </div>
          </div> : <div className={styles.emptyState}><b>尚未选择杆件</b><p>在单腿或整机画布中点击任意杆件，同编号杆件会同步高亮并显示整周检查结果。</p></div>}

          <div className={styles.analysisSectionTitle}><span>单腿机构</span><b>{activeMode.name}</b></div>
          <div className={styles.modeSummary}>
            <div><span>{activeMode.name}轨迹 RMSE</span><strong>{Number.isFinite(activeMetrics.rmse) ? activeMetrics.rmse.toFixed(1) : "—"}<small>mm</small></strong></div>
            <div><span>最大误差</span><strong>{Number.isFinite(activeMetrics.maxError) ? activeMetrics.maxError.toFixed(1) : "—"}<small>mm</small></strong></div>
            <div><span>整周求解率</span><strong>{(activeMetrics.validRatio * 100).toFixed(1)}<small>%</small></strong></div>
            <div><span>实际步长 / 摆动净离地</span><strong>{activeMetrics.stepLength.toFixed(0)}<small> / {activeMetrics.liftHeight.toFixed(0)} mm</small></strong></div>
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

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
  analyzeVariableLegMode,
  analyzeVariableLegProject,
  advanceVariableLegProjectRevision,
  assessVariableLegCandidate,
  assessGuidedHardGate,
  applyVariableLegDesignerReturn,
  applyVariableLegRecommendedRange,
  cloneVariableLegProject,
  createDefaultAdjustment,
  createDefaultVariableLegProject,
  createGaitPath,
  createVariableLegDesignerTransfer,
  getVariableLegTemplate,
  isVariableLegDesignerTransfer,
  materializeVariableLegMode,
  measureGaitClearance,
  migrateVariableLegProject,
  restoreVariableLegStandardModes,
  sampleVariableLeg,
  smoothClosedPath,
  type VariableLegAdjustmentKind,
  type VariableLegAdjustmentFeasibility,
  type VariableLegBarLengthPreview,
  type VariableLegCandidate,
  type VariableLegConstraintMetric,
  type VariableLegMode,
  type VariableLegProject,
  type VariableLegTopology,
} from "@/lib/variable-leg";
import { getVariableLegBaselineBounds } from "@/lib/variable-leg-baselines";
import { getVariableLegDynamicLengthEnvelope } from "@/lib/variable-leg-dynamic-envelopes";
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
import {
  variableLegBarLengthParameterId,
  variableLegJointParameterId,
  variableLegModeAdjustmentParameterId,
  type RefinementRequest,
  type VariableLegGenerationRequest,
  type VariableLegRefinementParameterId,
  type VariableLegSynthesisProgress,
  type VariableLegSynthesisScope,
  type VariableLegWorkerResponse,
} from "@/lib/variable-leg-synthesis";
import {
  VariableLegSessionError,
  applyCandidate as applySessionCandidate,
  clearCandidatePreview,
  createMajorCheckpoint,
  createVariableLegSession,
  markDesignRunsStaleByRevision,
  pinComparisonCandidate,
  recordDesignRun,
  restoreMajorCheckpoint,
  setCandidatePreview,
  unpinComparisonCandidate,
  type CandidateReference,
  type VariableLegSession,
} from "@/lib/variable-leg-session";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSnapshotHistory } from "./use-snapshot-history";
import { useSvgViewport } from "./use-svg-viewport";
import { VariableLegDeploymentView } from "./variable-leg-deployment-view";
import styles from "./variable-geometry-leg-lab.module.css";

const STORAGE_KEY = "open-linkage:variable-leg-project:v3";
const V2_STORAGE_KEY = "open-linkage:variable-leg-project:v2";
const LEGACY_STORAGE_KEY = "open-linkage:variable-leg-project:v1";
const SESSION_STORAGE_KEY = "open-linkage:variable-leg-session:v3";
const TRANSFER_KEY = "open-linkage:designer-transfer";
type CanvasMode = "inspect" | "draw" | "points";
type ViewMode = "mechanism" | "deployment";
type WorkspaceStep = 1 | 2 | 3 | 4;
type LegSession = VariableLegSession<VariableLegProject, VariableLegCandidate, RefinementRequest | VariableLegGenerationRequest>;

const REQUIREMENT_METRICS: Array<{
  key: VariableLegConstraintMetric;
  label: string;
  unit: string;
  step: number;
}> = [
  { key: "stepLength", label: "步长", unit: "mm", step: 1 },
  { key: "liftHeight", label: "抬脚", unit: "mm", step: 1 },
  { key: "stanceRatio", label: "支撑相", unit: "%", step: 1 },
  { key: "landingVerticalSpeed", label: "落地速度", unit: "mm/s", step: 1 },
];

const WORKSPACE_STEPS: Array<{ id: WorkspaceStep; label: string }> = [
  { id: 1, label: "工况目标" },
  { id: 2, label: "机构与调节" },
  { id: 3, label: "生成与比较" },
  { id: 4, label: "精修与定版" },
];

let sessionEventSequence = 0;

function createSessionEvent(prefix: string) {
  sessionEventSequence += 1;
  return {
    id: `${prefix}-${sessionEventSequence.toString(36)}`,
    timestamp: Date.now(),
  };
}

function initializeLegSession(project: VariableLegProject, persisted: unknown = null): LegSession {
  const workingProject = cloneVariableLegProject(project);
  const legacyCandidates = workingProject.candidates ?? [];
  workingProject.candidates = [];
  workingProject.selectedCandidateId = null;
  const session = createVariableLegSession<VariableLegProject, VariableLegCandidate, RefinementRequest | VariableLegGenerationRequest>(
    workingProject,
    { id: "initial", timestamp: Date.now() },
    { initialCheckpointName: "初始项目" },
  );
  const initialCheckpoint = session.versionHistory[0];
  const restoredHistory = persisted && typeof persisted === "object" && Array.isArray((persisted as { versionHistory?: unknown }).versionHistory)
    ? (persisted as { versionHistory: unknown[] }).versionHistory.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const checkpoint = value as Record<string, unknown>;
      const restoredProject = migrateVariableLegProject(checkpoint.project);
      if (!restoredProject || typeof checkpoint.checkpointId !== "string" || typeof checkpoint.name !== "string" || typeof checkpoint.createdAt !== "number") return [];
      return [{
        checkpointId: checkpoint.checkpointId,
        revisionId: typeof checkpoint.revisionId === "string" ? checkpoint.revisionId : restoredProject.revisionId,
        name: checkpoint.name,
        createdAt: checkpoint.createdAt,
        project: restoredProject,
        reason: (checkpoint.reason === "manual" || checkpoint.reason === "candidate-application" || checkpoint.reason === "restore"
          ? checkpoint.reason
          : "initial") as LegSession["versionHistory"][number]["reason"],
        candidate: checkpoint.candidate && typeof checkpoint.candidate === "object"
          ? checkpoint.candidate as CandidateReference
          : undefined,
        restoredFromCheckpointId: typeof checkpoint.restoredFromCheckpointId === "string" ? checkpoint.restoredFromCheckpointId : undefined,
      }];
    }).slice(-20)
    : [];
  return {
    ...session,
    revisionId: workingProject.revisionId,
    workingProject,
    designRuns: legacyCandidates.length ? [{
      runId: "legacy-candidates",
      sourceRevisionId: "legacy-unvalidated",
      kind: "legacy",
      status: "completed",
      candidates: legacyCandidates,
      createdAt: Date.now(),
      completedAt: Date.now(),
      stale: true,
    }] : [],
    versionHistory: restoredHistory.length ? restoredHistory : [{
      ...initialCheckpoint,
      revisionId: workingProject.revisionId,
      project: cloneVariableLegProject(workingProject),
    }],
  };
}

function materializeCandidateProject(
  candidate: VariableLegCandidate,
  workingProject: VariableLegProject,
) {
  const next = cloneVariableLegProject(workingProject);
  next.topology = candidate.topology;
  next.baseProject = structuredClone(candidate.baseProject);
  next.adjustment = structuredClone(candidate.adjustment);
  next.modes = candidate.modes.map((mode) => ({ ...mode, targetPath: mode.targetPath.map((point) => ({ ...point })) }));
  next.activeModeId = next.modes.some((mode) => mode.id === workingProject.activeModeId)
    ? workingProject.activeModeId
    : next.modes[0]?.id ?? workingProject.activeModeId;
  next.requirements = workingProject.requirements
    .filter((requirement) => next.modes.some((mode) => mode.id === requirement.modeId))
    .map((requirement) => ({ ...requirement, constraints: structuredClone(requirement.constraints) }));
  next.candidates = [];
  next.selectedCandidateId = null;
  return next;
}

function withSessionProjectMetadata(session: LegSession) {
  const checkpoint = session.versionHistory.at(-1);
  const workingProject = {
    ...cloneVariableLegProject(session.workingProject),
    revisionId: session.revisionId,
    currentVersionId: checkpoint?.checkpointId ?? session.workingProject.currentVersionId,
  };
  return {
    ...session,
    workingProject,
    versionHistory: session.versionHistory.map((item, index) => index === session.versionHistory.length - 1
      ? { ...item, revisionId: session.revisionId, project: cloneVariableLegProject(workingProject) }
      : item),
  };
}

function sameCandidateReference(first: CandidateReference | null, second: CandidateReference) {
  return first?.runId === second.runId && first.candidateId === second.candidateId;
}

function describeCandidateBatchFailure(candidates: VariableLegCandidate[], project: VariableLegProject) {
  const evaluations = candidates.flatMap((candidate) => candidate.constraintEvaluation?.conditions ?? []);
  const safetyFailure = evaluations.flatMap((condition) => condition.safety
    .filter((item) => !item.passed)
    .map((item) => ({ condition, item })))[0];
  if (safetyFailure) {
    const modeName = project.modes.find((mode) => mode.id === safetyFailure.condition.modeId)?.name ?? safetyFailure.condition.modeId;
    const metricName = {
      validRatio: "整周求解率",
      branchSwitches: "分支连续性",
      closureError: "闭环误差",
      singularityMargin: "奇异裕度",
    }[safetyFailure.item.metric];
    const threshold = safetyFailure.item.threshold === null ? "" : `（门槛 ${safetyFailure.item.threshold}）`;
    return `搜索完成，但候选均未越过安全门槛：${modeName} / ${metricName}${threshold}。这些候选仅供诊断，不能应用。`;
  }

  const metricFailures = evaluations.flatMap((condition) => Object.values(condition.metrics)
    .filter((item) => item.level === "hard" && !item.passed && item.actual !== null)
    .map((item) => {
      const amount = item.rule === "range"
        ? Math.max(0, Math.abs(item.difference ?? 0) - item.tolerance)
        : item.rule === "minimum"
          ? Math.max(0, item.target - (item.actual ?? item.target))
          : Math.max(0, (item.actual ?? item.target) - item.target);
      return { condition, item, amount };
    }))
    .sort((first, second) => first.amount - second.amount);
  const nearest = metricFailures[0];
  if (nearest) {
    const modeName = project.modes.find((mode) => mode.id === nearest.condition.modeId)?.name ?? nearest.condition.modeId;
    const definition = REQUIREMENT_METRICS.find((item) => item.key === nearest.item.metric);
    const scale = nearest.item.metric === "stanceRatio" ? 100 : 1;
    return `约束本身没有被判定为矛盾，但搜索预算内未找到全硬约束候选。最接近的放宽项：${modeName} / ${definition?.label ?? nearest.item.metric} 至少 ${Math.ceil(nearest.amount * scale * 10) / 10} ${definition?.unit ?? ""}。`;
  }
  return "搜索预算内未找到通过全部硬约束的候选；当前项目保持不变。";
}

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

function removeUnsafeLegacyRecommendations(project: VariableLegProject) {
  const next = cloneVariableLegProject(project);
  next.candidates = next.candidates?.filter((candidate) => candidate.guidedScenario
    ? assessGuidedHardGate(candidate.metrics, candidate.guidedScenario).passed
    : false) ?? [];
  if (!next.candidates.some((candidate) => candidate.id === next.selectedCandidateId)) next.selectedCandidateId = null;
  return next;
}

export function VariableGeometryLegLab() {
  const initialProject = useMemo(() => createDefaultVariableLegProject(), []);
  const history = useSnapshotHistory(initialProject, cloneVariableLegProject);
  const {
    value: project,
    valueRef: projectRef,
    replace,
    commit,
    beginTransaction,
    commitTransaction,
    reset: resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = history;
  const [session, setSession] = useState<LegSession>(() => initializeLegSession(initialProject));
  const sessionRef = useRef(session);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("mechanism");
  const [workspaceStep, setWorkspaceStep] = useState<WorkspaceStep>(1);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [seedSource, setSeedSource] = useState<"current" | "template">("current");
  const [bodyWorldX, setBodyWorldX] = useState(0);
  const [footprints, setFootprints] = useState<VariableLegFootprint[]>([]);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("inspect");
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [message, setMessage] = useState("三个默认工况已就绪；调节值在每个周期内保持锁定。");
  const [searching, setSearching] = useState(false);
  const [feasibility, setFeasibility] = useState<VariableLegAdjustmentFeasibility | null>(null);
  const [feasibilitySourceKey, setFeasibilitySourceKey] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [barLengthPreview, setBarLengthPreview] = useState<VariableLegBarLengthPreview | null>(null);
  const [allowedRefinementIds, setAllowedRefinementIds] = useState<VariableLegRefinementParameterId[]>([]);
  const [refinementModeIds, setRefinementModeIds] = useState<string[]>(() => initialProject.requirements.filter((item) => item.enabled).map((item) => item.modeId));
  const [searchProgress, setSearchProgress] = useState<VariableLegSynthesisProgress>({ progress: 0, stage: "scan", message: "等待开始" });
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsToggleRef = useRef<HTMLButtonElement>(null);
  const resultsCloseRef = useRef<HTMLButtonElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const phaseRef = useRef(0);
  const bodyWorldXRef = useRef(0);
  const footprintSequenceRef = useRef(0);
  const pointDragRef = useRef<{ pointerId: number; index: number } | null>(null);
  const viewportBase = useMemo(() => ({ x: -560, y: -360, width: 1120, height: 760 }), []);
  const viewport = useSvgViewport(viewportBase, svgRef);

  const displayProject = session.draftProject ?? project;
  const activeMode = displayProject.modes.find((mode) => mode.id === project.activeModeId)
    ?? displayProject.modes.find((mode) => mode.id === displayProject.activeModeId)
    ?? displayProject.modes[0];
  const missingStandardModeCount = ["cruise", "sprint", "obstacle"].filter((id) => !project.modes.some((mode) => mode.id === id)).length;
  const activeModeIndex = Math.max(0, project.modes.findIndex((mode) => mode.id === project.activeModeId));
  const cycleSamples = useMemo(
    () => sampleVariableLeg(displayProject.baseProject, displayProject.adjustment, activeMode.adjustmentValue, 72, 90),
    [activeMode.adjustmentValue, displayProject.adjustment, displayProject.baseProject],
  );
  const analysis = useMemo(() => analyzeVariableLegProject(displayProject, 54, 70), [displayProject]);
  const workingAnalysis = useMemo(() => analyzeVariableLegProject(project, 54, 70), [project]);
  const activeMetrics = analysis.metrics.find((metric) => metric.modeId === activeMode.id) ?? analysis.metrics[0];
  const advancedStaticBounds = useMemo(() => project.adjustment.kind === "telescopic-bar"
    ? getVariableLegBaselineBounds(project, { kind: "bar-length", targetId: project.adjustment.targetId })
    : [], [project]);
  const advancedDynamicEnvelope = useMemo(() => project.adjustment.kind === "telescopic-bar"
    ? getVariableLegDynamicLengthEnvelope(project, project.adjustment.targetId, phase, activeMode.id)
    : null, [activeMode.id, phase, project]);
  const adjustmentImpact = useMemo(() => {
    const span = Math.max(1e-6, project.adjustment.maximum - project.adjustment.minimum);
    const nextValue = Math.min(project.adjustment.maximum, activeMode.adjustmentValue + span * 0.03);
    if (Math.abs(nextValue - activeMode.adjustmentValue) < 1e-6 || !activeMetrics) return [];
    const metric = analyzeVariableLegMode(project.baseProject, project.adjustment, { ...activeMode, adjustmentValue: nextValue }, 24, 56);
    const describe = (label: string, delta: number, unit: string, higherIsBetter = true) => ({
      label,
      delta,
      unit,
      favorable: higherIsBetter ? delta >= 0 : delta <= 0,
    });
    return [
      describe("步长", metric.stepLength - activeMetrics.stepLength, "mm"),
      describe("抬脚", metric.liftHeight - activeMetrics.liftHeight, "mm"),
      describe("奇异裕度", metric.singularityMargin - activeMetrics.singularityMargin, "°"),
      describe("落地速度", metric.landingVerticalSpeed - activeMetrics.landingVerticalSpeed, "mm/s", false),
    ];
  }, [activeMetrics, activeMode, project.adjustment, project.baseProject]);
  const gaitMetrics = useMemo(
    () => analyzeVariableLegGait(displayProject.deployment, activeMode, activeMetrics),
    [activeMetrics, activeMode, displayProject.deployment],
  );
  const sampleIndex = Math.floor((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * cycleSamples.length) % Math.max(1, cycleSamples.length);
  const currentFrame = cycleSamples[sampleIndex]?.project ?? materializeVariableLegMode(displayProject.baseProject, displayProject.adjustment, activeMode.adjustmentValue);
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
  const selectedBar = displayProject.baseProject.bars.find((bar) => bar.id === selectedBarId) ?? null;
  const selectedBarMetrics = useMemo(
    () => {
      const metrics = selectedBarId ? analyzeVariableLegBarSamples(displayProject.baseProject, displayProject.adjustment, cycleSamples, selectedBarId) : null;
      return metrics ? { ...metrics, peakAngularSpeedDegrees: metrics.peakAngularSpeedDegrees * activeMode.rpm / 60 } : null;
    },
    [activeMode.rpm, cycleSamples, displayProject.adjustment, displayProject.baseProject, selectedBarId],
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
  const barPreviewEvaluation = useMemo(
    () => barLengthPreview?.previewProject ? analyzeVariableLegProject(barLengthPreview.previewProject, 54, 70).evaluation : null,
    [barLengthPreview],
  );
  const latestRun = session.designRuns.at(-1) ?? null;
  const latestCandidates = latestRun?.candidates ?? [];
  const previewReference = session.draftSource;
  const previewRun = previewReference ? session.designRuns.find((run) => run.runId === previewReference.runId) ?? null : null;
  const previewCandidate = previewReference && previewRun
    ? previewRun.candidates.find((candidate) => candidate.id === previewReference.candidateId) ?? null
    : null;
  const comparisonCandidates = session.comparisonSelection.flatMap((reference) => {
    const run = session.designRuns.find((item) => item.runId === reference.runId);
    const candidate = run?.candidates.find((item) => item.id === reference.candidateId);
    return run && candidate ? [{ reference, run, candidate }] : [];
  });
  const activeConditionEvaluation = analysis.evaluation.conditions.find((condition) => condition.modeId === activeMode.id);

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

  const synchronizeRestoredProject = useCallback((restored: VariableLegProject) => {
    setSession((current) => markDesignRunsStaleByRevision({
      ...current,
      revisionId: restored.revisionId,
      workingProject: cloneVariableLegProject(restored),
      draftProject: null,
      draftSource: null,
    }, restored.revisionId));
  }, []);

  const selectBarForInspection = useCallback((barId: string) => {
    setSelectedBarId(barId);
    setAllowedRefinementIds([variableLegBarLengthParameterId(barId)]);
    setBarLengthPreview((current) => current?.barId === barId ? current : null);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
              setSession(createMajorCheckpoint(
                initializeLegSession(returned.project),
                "自由设计器返回",
                createSessionEvent("designer-return"),
              ));
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
      const saved = window.localStorage.getItem(STORAGE_KEY)
        ?? window.localStorage.getItem(V2_STORAGE_KEY)
        ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as unknown;
        const migrated = migrateVariableLegProject(parsed);
        if (!migrated) throw new Error("invalid");
        const restored = removeUnsafeLegacyRecommendations(migrated);
        const persistedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
        const restoredSession = initializeLegSession(restored, persistedSession ? JSON.parse(persistedSession) as unknown : null);
        resetHistory(restoredSession.workingProject);
        setSession(restoredSession);
        setMotionPhase(migrated.inputPhase || 0);
        const missingStandardModes = ["cruise", "sprint", "obstacle"].filter((id) => !restored.modes.some((mode) => mode.id === id));
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
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ versionHistory: session.versionHistory }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [phase, project, session.versionHistory]);

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
        synchronizeRestoredProject(restored);
        resetGaitTrail();
        setMessage(key === "y" || event.shiftKey ? "已重做一步。" : "已撤销一步。");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, resetGaitTrail, stopMotion, synchronizeRestoredProject, undo]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const updateProject = (updater: (current: VariableLegProject) => VariableLegProject, status?: string) => {
    stopMotion();
    resetGaitTrail();
    const revised = advanceVariableLegProjectRevision(updater(cloneVariableLegProject(projectRef.current)));
    revised.candidates = [];
    revised.selectedCandidateId = null;
    commit(revised);
    setSession((current) => markDesignRunsStaleByRevision({
      ...current,
      revisionId: revised.revisionId,
      workingProject: cloneVariableLegProject(revised),
      draftProject: null,
      draftSource: null,
    }, revised.revisionId));
    if (status) setMessage(status);
  };

  const updateActiveMode = (updater: (mode: VariableLegMode) => VariableLegMode, status?: string) => {
    updateProject((current) => {
      const nextMode = updater(current.modes.find((mode) => mode.id === current.activeModeId) ?? current.modes[0]);
      const stats = targetStats(nextMode);
      return {
        ...current,
        modes: current.modes.map((mode) => mode.id === nextMode.id ? nextMode : mode),
        requirements: current.requirements.map((requirement) => requirement.modeId === nextMode.id ? {
          ...requirement,
          rpm: nextMode.rpm,
          constraints: {
            ...requirement.constraints,
            stepLength: { ...requirement.constraints.stepLength, target: stats.step },
            liftHeight: { ...requirement.constraints.liftHeight, target: stats.lift },
            stanceRatio: { ...requirement.constraints.stanceRatio, target: nextMode.stanceEnd - nextMode.stanceStart },
          },
        } : requirement),
      };
    }, status);
  };

  const selectMode = (modeId: string) => {
    stopMotion();
    resetGaitTrail();
    replace({ ...projectRef.current, activeModeId: modeId });
    setSession((current) => ({
      ...current,
      workingProject: { ...current.workingProject, activeModeId: modeId },
      draftProject: current.draftProject ? { ...current.draftProject, activeModeId: modeId } : null,
    }));
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
    setBarLengthPreview(null);
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
    updateProject((current) => {
      const sourceRequirement = current.requirements.find((requirement) => requirement.modeId === source.id) ?? current.requirements[0];
      return {
        ...current,
        modes: [...current.modes, mode],
        requirements: [...current.requirements, {
          ...sourceRequirement,
          modeId: id,
          role: "supporting",
          constraints: Object.fromEntries(Object.entries(sourceRequirement.constraints).map(([key, constraint]) => [key, { ...constraint, level: "soft" }])) as typeof sourceRequirement.constraints,
        }],
        activeModeId: id,
        candidates: [],
        selectedCandidateId: null,
      };
    }, "已复制当前工况，并创建默认软目标要求。");
  };

  const deleteMode = () => {
    if (project.modes.length <= 1) {
      setMessage("项目至少需要保留一个工况。");
      return;
    }
    updateProject((current) => {
      const nextModes = current.modes.filter((mode) => mode.id !== current.activeModeId);
      const remainingRequirements = current.requirements.filter((requirement) => requirement.modeId !== current.activeModeId);
      const nextRequirements = remainingRequirements.some((requirement) => requirement.role === "primary")
        ? remainingRequirements
        : remainingRequirements.map((requirement, index) => ({ ...requirement, role: index === 0 ? "primary" as const : "supporting" as const }));
      return {
        ...current,
        modes: nextModes,
        requirements: nextRequirements,
        activeModeId: nextModes[0].id,
        candidates: [],
        selectedCandidateId: null,
      };
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
      const moved = cloneVariableLegProject(projectRef.current);
      const movedMode = moved.modes.find((mode) => mode.id === moved.activeModeId);
      if (movedMode) {
        const stats = targetStats(movedMode);
        moved.requirements = moved.requirements.map((requirement) => requirement.modeId === movedMode.id ? {
          ...requirement,
          constraints: {
            ...requirement.constraints,
            stepLength: { ...requirement.constraints.stepLength, target: stats.step },
            liftHeight: { ...requirement.constraints.liftHeight, target: stats.lift },
            stanceRatio: { ...requirement.constraints.stanceRatio, target: movedMode.stanceEnd - movedMode.stanceStart },
          },
        } : requirement);
      }
      const revised = advanceVariableLegProjectRevision(moved);
      replace(revised);
      setSession((current) => markDesignRunsStaleByRevision({
        ...current,
        revisionId: revised.revisionId,
        workingProject: cloneVariableLegProject(revised),
        draftProject: null,
        draftSource: null,
      }, revised.revisionId));
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
    const restored = createDefaultVariableLegProject();
    resetHistory(restored);
    setSession(initializeLegSession(restored));
    setMotionPhase(0);
    resetGaitTrail();
    setCanvasMode("inspect");
    viewport.resetView();
    setMessage("已恢复克兰腿与三个默认工况。");
  };

  const restoreSelectedTemplateLength = () => {
    if (!selectedBar) return;
    const templateBar = getVariableLegTemplate(project.topology).bars.find((bar) => bar.id === selectedBar.id);
    if (!templateBar) return;
    runBarLengthPreview(selectedBar.id, templateBar.length);
  };

  const runSynthesis = (scope: VariableLegSynthesisScope = "global") => {
    if (searching || project.modes.some((mode) => mode.targetPath.length < 12)) return;
    if (scope === "current-target" && (!selectedBarId || allowedRefinementIds.length === 0)) {
      setMessage("请先在画布中选择杆件，并明确至少一个允许修改的参数。");
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../workers/variable-leg-synthesis.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const requestId = `request-${Date.now()}`;
    const runId = `${scope === "current-target" ? "refinement" : "generation"}-${Date.now()}`;
    const sourceProject = cloneVariableLegProject(
      scope === "current-target" && sessionRef.current.draftProject
        ? sessionRef.current.draftProject
        : projectRef.current,
    );
    sourceProject.revisionId = projectRef.current.revisionId;
    const sourceRevisionId = sourceProject.revisionId;
    const refinementRequest: RefinementRequest | undefined = scope === "current-target" ? {
      allowedParameterIds: allowedRefinementIds,
      selectedBarId: selectedBarId ?? undefined,
      modeIds: refinementModeIds,
      iterations: 32,
      parentRunId: sessionRef.current.draftSource?.runId,
    } : undefined;
    requestIdRef.current = requestId;
    setSearching(true);
    setSearchProgress({ progress: 0, stage: "scan", message: "正在准备灵敏度扫描" });
    setMessage(scope === "global"
      ? `正在克隆当前${topologyName(project.topology)}机构并比较调节对象与尺度；不会改动当前项目……`
      : `正在受控精修 ${selectedBarId}；只允许修改界面中列出的参数……`);
    worker.onmessage = (event: MessageEvent<VariableLegWorkerResponse>) => {
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
        const stale = response.sourceRevisionId !== projectRef.current.revisionId;
        setSession((current) => recordDesignRun(current, {
          runId: response.runId,
          requestId,
          sourceRevisionId: response.sourceRevisionId,
          kind: scope === "global" ? "generation" : "refinement",
          status: "completed",
          request: refinementRequest ?? { seedSource },
          candidates: response.candidates,
          parentRunId: refinementRequest?.parentRunId,
          createdAt: Date.now(),
          completedAt: Date.now(),
          stale,
        }));
        setWorkspaceStep(scope === "global" ? 3 : 4);
        setResultsOpen(true);
        if (!response.candidates.length) {
          const currentSafetyFailed = analysis.evaluation.conditions.some((condition) => condition.enabled && condition.safety.some((item) => !item.passed));
          setMessage(currentSafetyFailed
            ? "当前机构未通过安全运动学门槛，且搜索预算内没有找到可用候选。请先查看具体安全项或显式改用模板种子。"
            : "约束定义有效，但本次搜索预算内未找到候选；当前项目保持不变，可增加预算或调整具体软目标。");
          return;
        }
        const applicableCount = response.candidates.filter((candidate) => candidate.constraintEvaluation?.hardPassed).length;
        setMessage(stale
          ? `已返回 ${response.candidates.length} 个候选，但源项目在计算期间发生变化；该批次只读，不能应用。`
          : applicableCount === 0
            ? describeCandidateBatchFailure(response.candidates, projectRef.current)
          : scope === "global"
            ? `已生成 ${response.candidates.length} 套候选，其中 ${applicableCount} 套通过全部硬约束；请选择卡片真实预览，再决定是否应用。`
            : `已生成 ${response.candidates.length} 套受控精修候选，其中 ${applicableCount} 套可应用；结果尚未写入项目。`);
      } else if (response.type === "cancelled") {
        setSession((current) => recordDesignRun(current, {
          runId: response.runId,
          requestId,
          sourceRevisionId: response.sourceRevisionId,
          kind: scope === "global" ? "generation" : "refinement",
          status: "cancelled",
          request: refinementRequest ?? { seedSource },
          candidates: [],
          parentRunId: refinementRequest?.parentRunId,
          createdAt: Date.now(),
          completedAt: Date.now(),
        }));
        setMessage("自动综合已取消，当前机构和目标轨迹未改变。");
      } else if (response.type === "error") {
        setSession((current) => recordDesignRun(current, {
          runId: response.runId,
          requestId,
          sourceRevisionId: response.sourceRevisionId,
          kind: scope === "global" ? "generation" : "refinement",
          status: "failed",
          request: refinementRequest ?? { seedSource },
          candidates: [],
          parentRunId: refinementRequest?.parentRunId,
          createdAt: Date.now(),
          completedAt: Date.now(),
          error: response.message,
        }));
        setMessage(response.message);
      }
    };
    worker.onerror = () => {
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
      setMessage("综合 Worker 运行失败，请刷新后重试。");
    };
    worker.postMessage({
      type: "start",
      requestId,
      runId,
      sourceRevisionId,
      project: sourceProject,
      scope,
      refinementRequest,
      generationRequest: { seedSource },
    });
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
    setSearchProgress({ progress: 0.35, stage: "scan", message: `正在检查 ${barId} 草稿与附近可行值` });
    setMessage(`正在检查 ${barId} = ${requestedLength.toFixed(2)} mm；当前机构暂不修改。`);
    worker.onmessage = (event: MessageEvent<VariableLegWorkerResponse>) => {
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
    if (!barPreviewEvaluation?.hardPassed) {
      setMessage(`杆长草稿未通过统一硬约束：${barPreviewEvaluation?.issues[0] ?? "未知约束失败"}。`);
      return;
    }
    const preview = cloneVariableLegProject(barLengthPreview.previewProject);
    updateProject(() => preview, `已应用 ${barLengthPreview.barId} = ${barLengthPreview.nearestFeasibleLength.toFixed(2)} mm；全部工况检查已通过。`);
    setBarLengthPreview(null);
    setFeasibility(null);
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
    setSearchProgress({ progress: 0, stage: "scan", message: "正在扫描 41 个调节值 × 全部工况 36 相位" });
    setMessage("正在检查整周可解、分支连续、闭环误差与 5° 最小夹角……");
    worker.onmessage = (event: MessageEvent<VariableLegWorkerResponse>) => {
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
    updateProject(() => result.project);
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

  const previewDesignCandidate = (reference: CandidateReference) => {
    stopMotion();
    resetGaitTrail();
    try {
      setSession(setCandidatePreview(sessionRef.current, reference, materializeCandidateProject));
      setWorkspaceStep(3);
      setResultsOpen(true);
      setMessage("已切换为候选草稿：画布、结构标签、工况指标和警告均来自该候选；当前项目尚未修改。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "候选预览失败。");
    }
  };

  const discardCandidatePreview = () => {
    setSession((current) => clearCandidatePreview(current));
    resetGaitTrail();
    setMessage("已退出候选预览，画布恢复当前项目。");
  };

  const applyDesignCandidate = (reference: CandidateReference) => {
    const selected = sessionRef.current.designRuns
      .find((run) => run.runId === reference.runId)
      ?.candidates.find((candidate) => candidate.id === reference.candidateId);
    if (!selected?.constraintEvaluation?.hardPassed) {
      setMessage("该候选未通过全部硬约束和安全门槛，不能应用。");
      return;
    }
    try {
      const next = withSessionProjectMetadata(applySessionCandidate(
        sessionRef.current,
        reference,
        materializeCandidateProject,
        createSessionEvent("apply"),
        { checkpointName: `应用：${selected.label}` },
      ));
      commit(cloneVariableLegProject(next.workingProject));
      setSession(next);
      resetGaitTrail();
      setWorkspaceStep(4);
      setMessage(`已应用${selected.label}并创建版本检查点；其余候选因源版本变化已标记为过期。`);
    } catch (error) {
      setMessage(error instanceof VariableLegSessionError && error.code === "STALE_CANDIDATE"
        ? "该候选来自旧项目版本，只能查看和比较，不能应用。请基于当前版本重新生成。"
        : error instanceof Error ? error.message : "候选应用失败。");
    }
  };

  const toggleComparisonCandidate = (reference: CandidateReference) => {
    const pinned = session.comparisonSelection.some((item) => sameCandidateReference(item, reference));
    try {
      setSession(pinned
        ? unpinComparisonCandidate(sessionRef.current, reference)
        : pinComparisonCandidate(sessionRef.current, reference));
      setMessage(pinned ? "已从固定比较中移除。" : "已固定到比较区。");
    } catch (error) {
      setMessage(error instanceof VariableLegSessionError && error.code === "COMPARISON_LIMIT"
        ? "最多固定 3 个候选；请先移除一个。"
        : error instanceof Error ? error.message : "无法更新比较选择。");
    }
  };

  const createVersionCheckpoint = () => {
    const event = createSessionEvent("checkpoint");
    const checkpointed = createMajorCheckpoint(sessionRef.current, `手动定版 ${sessionRef.current.versionHistory.length + 1}`, event);
    const checkpoint = checkpointed.versionHistory.at(-1);
    const workingProject = {
      ...cloneVariableLegProject(checkpointed.workingProject),
      currentVersionId: checkpoint?.checkpointId ?? checkpointed.workingProject.currentVersionId,
    };
    const next = {
      ...checkpointed,
      workingProject,
      versionHistory: checkpointed.versionHistory.map((item, index) => index === checkpointed.versionHistory.length - 1
        ? { ...item, project: cloneVariableLegProject(workingProject) }
        : item),
    };
    replace(workingProject);
    setSession(next);
    setMessage("已保存持久化版本检查点。");
  };

  const restoreVersionCheckpoint = (checkpointId: string) => {
    try {
      const next = withSessionProjectMetadata(restoreMajorCheckpoint(
        sessionRef.current,
        checkpointId,
        createSessionEvent("restore"),
        { checkpointName: "版本恢复" },
      ));
      commit(cloneVariableLegProject(next.workingProject));
      setSession(next);
      resetGaitTrail();
      setMessage("已恢复所选版本，并将恢复结果保存为新的检查点。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "版本恢复失败。");
    }
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
      const restored = removeUnsafeLegacyRecommendations(migrated);
      const importedSession = initializeLegSession(restored);
      const checkpointed = createMajorCheckpoint(importedSession, `导入：${file.name}`, createSessionEvent("import"));
      resetHistory(checkpointed.workingProject);
      setSession(checkpointed);
      setMotionPhase(migrated.inputPhase || 0);
      resetGaitTrail();
      setMessage(`已导入 ${file.name}；未通过新硬门槛的旧推荐已隐藏，原机构参数未改动。`);
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

  const toggleFootprintVisibility = () => {
    const next = {
      ...cloneVariableLegProject(projectRef.current),
      deployment: {
        ...projectRef.current.deployment,
        showFootprints: !projectRef.current.deployment.showFootprints,
      },
    };
    commit(next);
    setSession((current) => ({
      ...current,
      workingProject: cloneVariableLegProject(next),
      draftProject: current.draftProject
        ? { ...current.draftProject, deployment: { ...current.draftProject.deployment, showFootprints: next.deployment.showFootprints } }
        : null,
    }));
  };

  const changeWorkspaceStep = (step: WorkspaceStep) => {
    if (step <= 2 && sessionRef.current.draftProject) {
      setSession(clearCandidatePreview(sessionRef.current));
      setMessage("已退出候选草稿，正在编辑当前项目。");
    }
    setWorkspaceStep(step);
  };

  const toggleResultsDrawer = () => {
    if (resultsOpen) {
      setResultsOpen(false);
      window.requestAnimationFrame(() => resultsToggleRef.current?.focus());
      return;
    }
    setResultsOpen(true);
    window.requestAnimationFrame(() => resultsCloseRef.current?.focus());
  };

  const updateConditionRequirement = (
    modeId: string,
    updater: (requirement: VariableLegProject["requirements"][number]) => VariableLegProject["requirements"][number],
    status?: string,
  ) => {
    updateProject((current) => ({
      ...current,
      requirements: current.requirements.map((requirement) => requirement.modeId === modeId ? updater(requirement) : requirement),
    }), status);
  };

  const setPrimaryCondition = (modeId: string) => {
    updateProject((current) => ({
      ...current,
      activeModeId: modeId,
      requirements: current.requirements.map((requirement) => ({
        ...requirement,
        role: requirement.modeId === modeId ? "primary" : "supporting",
      })),
    }), "已更新主工况；每项指标的硬/软级别保持用户当前设置。");
  };

  const updateRequirementRpm = (modeId: string, rpm: number) => {
    if (!Number.isFinite(rpm)) return;
    const nextRpm = Math.max(1, Math.min(180, rpm));
    updateProject((current) => ({
      ...current,
      modes: current.modes.map((mode) => mode.id === modeId ? { ...mode, rpm: nextRpm } : mode),
      requirements: current.requirements.map((requirement) => requirement.modeId === modeId
        ? { ...requirement, rpm: nextRpm }
        : requirement),
    }), "RPM 已作为固定工况输入更新。");
  };

  const updateRequirementConstraint = (
    modeId: string,
    metric: VariableLegConstraintMetric,
    patch: Partial<VariableLegProject["requirements"][number]["constraints"][VariableLegConstraintMetric]>,
  ) => {
    updateProject((current) => {
      const requirement = current.requirements.find((item) => item.modeId === modeId);
      const mode = current.modes.find((item) => item.id === modeId);
      if (!requirement || !mode) return current;
      const nextConstraint = { ...requirement.constraints[metric], ...patch };
      const constraints = { ...requirement.constraints, [metric]: nextConstraint };
      const nextModes = current.modes.map((item) => {
        if (item.id !== modeId || patch.target === undefined || metric === "landingVerticalSpeed") return item;
        const stats = targetStats(item);
        const step = metric === "stepLength" ? nextConstraint.target : constraints.stepLength.target;
        const lift = metric === "liftHeight" ? nextConstraint.target : constraints.liftHeight.target;
        const stance = metric === "stanceRatio" ? nextConstraint.target : constraints.stanceRatio.target;
        return {
          ...item,
          stanceStart: 0,
          stanceEnd: Math.min(0.82, Math.max(0.35, stance)),
          targetPath: createGaitPath(
            Math.max(40, step),
            Math.max(10, lift),
            Math.min(0.82, Math.max(0.35, stance)),
            stats.centerX,
            stats.groundY,
          ),
        };
      });
      return {
        ...current,
        modes: nextModes,
        requirements: current.requirements.map((item) => item.modeId === modeId ? { ...item, constraints } : item),
      };
    }, `${project.modes.find((mode) => mode.id === modeId)?.name ?? modeId}目标已更新；数值与目标轨迹保持同步。`);
  };

  const toggleRefinementParameter = (parameterId: VariableLegRefinementParameterId) => {
    setAllowedRefinementIds((current) => current.includes(parameterId)
      ? current.filter((item) => item !== parameterId)
      : [...current, parameterId]);
  };

  const finalizeSliderTransaction = () => {
    const revised = advanceVariableLegProjectRevision(projectRef.current);
    commitTransaction(revised);
    setSession((current) => markDesignRunsStaleByRevision({
      ...current,
      revisionId: revised.revisionId,
      workingProject: cloneVariableLegProject(revised),
      draftProject: null,
      draftSource: null,
    }, revised.revisionId));
  };

  const gaitWarnings = viewMode === "deployment" ? [
    gaitMetrics.minimumSupport === 0 ? "当前步态存在全部腿同时离地的腾空阶段。" : null,
    gaitMetrics.maximumTouchdownCluster > project.deployment.legCount / 2 ? "多条腿在同一时刻集中触地，建议改用波步或错开相位。" : null,
    gaitMetrics.stanceSlip > Math.max(5, activeMetrics.stepLength * 0.03) ? "支撑相足端滑移较大，机身匀速运动时可能出现拖脚。" : null,
    gaitMetrics.smoothnessScore < 70 ? "当前相位组合的步态平滑分较低。" : null,
  ].filter((warning): warning is string => Boolean(warning)) : [];

  const warnings = [
    ...(activeConditionEvaluation?.issues ?? []),
    ...(activeConditionEvaluation?.warnings ?? []),
    activeMode.adjustmentValue < displayProject.adjustment.minimum || activeMode.adjustmentValue > displayProject.adjustment.maximum ? "锁止值超出调节范围。" : null,
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
      <p className={styles.srOnly} role="status" aria-live="polite">{message}</p>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>机构与工况</h1></div><button type="button" onClick={resetProject}>恢复默认</button></div>

          <div className={styles.historyBar}>
            <button type="button" disabled={!canUndo} onClick={() => { stopMotion(); const restored = undo(); if (restored) { synchronizeRestoredProject(restored); resetGaitTrail(); setMessage("已撤销一步。"); } }}>↶ 撤销</button>
            <button type="button" disabled={!canRedo} onClick={() => { stopMotion(); const restored = redo(); if (restored) { synchronizeRestoredProject(restored); resetGaitTrail(); setMessage("已重做一步。"); } }}>↷ 重做</button>
          </div>

          <div className={styles.workflowStepper} aria-label="目标驱动设计四步流程">
            {WORKSPACE_STEPS.map((step) => <button
              type="button"
              key={step.id}
              className={workspaceStep === step.id ? styles.activeStep : ""}
              aria-current={workspaceStep === step.id ? "step" : undefined}
              onClick={() => changeWorkspaceStep(step.id)}
            ><span>{step.id}</span><b>{step.label}</b></button>)}
          </div>

          {workspaceStep === 1 && <section className={styles.stepPanel}>
            <p className={styles.stepLead}>工况表是目标、画布与约束的唯一状态源。默认主工况目标为硬约束，辅助工况为软目标；所有启用工况始终执行安全门槛。</p>
            <div className={styles.conditionToolbar}>
              <b>工况要求</b>
              <span>{missingStandardModeCount > 0 && <button type="button" onClick={restoreStandardModes}>补齐标准工况</button>}</span>
            </div>
            <div className={styles.requirementList}>
              {project.requirements.map((requirement) => {
                const mode = project.modes.find((item) => item.id === requirement.modeId);
                if (!mode) return null;
                const evaluation = analysis.evaluation.conditions.find((item) => item.modeId === requirement.modeId);
                const active = project.activeModeId === requirement.modeId;
                return <article key={requirement.modeId} className={`${styles.requirementCard} ${active ? styles.requirementCardActive : ""}`}>
                  <div className={styles.requirementHeader}>
                    <button type="button" className={styles.requirementIdentity} onClick={() => selectMode(requirement.modeId)}>
                      <i style={{ background: mode.color }} />
                      <span><b>{mode.name}</b><small>{requirement.role === "primary" ? "主工况" : "辅助工况"} · {requirement.rpm} rpm</small></span>
                    </button>
                    <label className={styles.requirementRole}><input type="checkbox" checked={requirement.enabled} onChange={(event) => updateConditionRequirement(requirement.modeId, (current) => ({ ...current, enabled: event.target.checked }), event.target.checked ? "已启用工况。" : "已停用工况。")} /> 启用</label>
                  </div>
                  <div className={styles.constraintGrid}>
                    {REQUIREMENT_METRICS.map((definition) => {
                      const constraint = requirement.constraints[definition.key];
                      const result = evaluation?.metrics[definition.key];
                      const scale = definition.key === "stanceRatio" ? 100 : 1;
                      return <div key={definition.key} className={styles.constraintItem}>
                        <span>{definition.label}<i className={`${styles.constraintStatus} ${result?.status === "passed" ? styles.statusPass : result?.status === "soft-failed" ? styles.statusSoft : styles.statusFail}`}>{result ? result.status === "passed" ? "通过" : result.status === "soft-failed" ? "软目标偏差" : "硬约束失败" : "未评估"}</i></span>
                        <span className={styles.constraintControls}>
                          <input aria-label={`${mode.name}${definition.label}目标`} type="number" step={definition.step} value={Number((constraint.target * scale).toFixed(1))} onChange={(event) => updateRequirementConstraint(requirement.modeId, definition.key, { target: Number(event.target.value) / scale })} />
                          <select aria-label={`${mode.name}${definition.label}约束级别`} value={constraint.level} onChange={(event) => updateRequirementConstraint(requirement.modeId, definition.key, { level: event.target.value as "hard" | "soft" })}>
                            <option value="hard">硬约束</option><option value="soft">软目标</option>
                          </select>
                        </span>
                        <span className={styles.constraintControls}>
                          <input aria-label={`${mode.name}${definition.label}容差`} title="容差" type="number" min="0" step={definition.step} disabled={constraint.rule !== "range"} value={Number((constraint.tolerance * scale).toFixed(1))} onChange={(event) => updateRequirementConstraint(requirement.modeId, definition.key, { tolerance: Math.max(0, Number(event.target.value) / scale) })} />
                          <input aria-label={`${mode.name}${definition.label}软目标权重`} title="软目标权重" type="number" min="0.1" max="10" step="0.1" disabled={constraint.level === "hard"} value={constraint.weight} onChange={(event) => updateRequirementConstraint(requirement.modeId, definition.key, { weight: Math.max(0.1, Number(event.target.value) || 1) })} />
                        </span>
                        <small>{constraint.rule === "range" ? `允许 ±${(constraint.tolerance * scale).toFixed(1)} ${definition.unit}` : constraint.rule === "minimum" ? `最低 ${definition.unit}` : `上限 ${definition.unit}`} · 实际 {result?.actual === null || result?.actual === undefined ? "—" : (result.actual * scale).toFixed(1)}</small>
                      </div>;
                    })}
                  </div>
                  <div className={styles.candidateActions}>
                    <button type="button" className={requirement.role === "primary" ? styles.pinButtonActive : ""} onClick={() => setPrimaryCondition(requirement.modeId)}>设为主工况</button>
                    <label>固定 RPM <input aria-label={`${mode.name}固定 RPM`} type="number" min="1" max="180" value={requirement.rpm} onChange={(event) => updateRequirementRpm(requirement.modeId, Number(event.target.value))} /></label>
                  </div>
                </article>;
              })}
            </div>
          </section>}

          {workspaceStep === 2 && <section className={styles.configSection}>
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

          {(workspaceStep === 1 || workspaceStep === 2) && <><div className={styles.modeHeader}><b>当前工况</b><span>{project.modes.length}/6</span></div>
          <div className={styles.modeTabs}>
            {project.modes.map((mode) => <button type="button" key={mode.id} className={mode.id === activeMode.id ? styles.activeMode : ""} style={{ borderColor: mode.color }} onClick={() => selectMode(mode.id)}>{mode.name}</button>)}
          </div></>}
          {workspaceStep === 1 && <div className={styles.modeActions}><button type="button" onClick={addMode}>复制工况</button><button type="button" onClick={deleteMode} disabled={project.modes.length <= 1}>删除</button></div>}

          {workspaceStep === 1 && <section className={styles.modeEditor}>
            <label>工况名称<input value={activeMode.name} onChange={(event) => updateActiveMode((mode) => ({ ...mode, name: event.target.value.slice(0, 12) }))} /></label>
            <div className={styles.rangePair}>
              <label>步长 mm<input type="number" value={Math.round(activeStats.step)} onChange={(event) => regenerateActivePath(Number(event.target.value), activeStats.lift)} /></label>
              <label>抬脚 mm<input type="number" value={Math.round(activeStats.lift)} onChange={(event) => regenerateActivePath(activeStats.step, Number(event.target.value))} /></label>
              <label>支撑相 %<input type="number" min="35" max="82" value={Math.round((activeMode.stanceEnd - activeMode.stanceStart) * 100)} onChange={(event) => regenerateActivePath(activeStats.step, activeStats.lift, Number(event.target.value) / 100)} /></label>
              <label>主轴 rpm<input type="number" min="1" max="180" value={activeMode.rpm} onChange={(event) => updateActiveMode((mode) => ({ ...mode, rpm: Math.max(1, Number(event.target.value) || 1) }))} /></label>
              <label>工况权重<input type="number" min="0.1" max="5" step="0.1" value={activeMode.weight} onChange={(event) => updateActiveMode((mode) => ({ ...mode, weight: Math.max(0.1, Number(event.target.value) || 1) }))} /></label>
              <label>锁止值<input type="number" value={Number(activeMode.adjustmentValue.toFixed(2))} onChange={(event) => updateActiveMode((mode) => ({ ...mode, adjustmentValue: Number(event.target.value) }))} /></label>
            </div>
            <input className={styles.adjustmentSlider} aria-label="当前工况锁止值" type="range" min={project.adjustment.minimum} max={project.adjustment.maximum} step="0.1" value={activeMode.adjustmentValue} onPointerDown={beginTransaction} onKeyDown={beginTransaction} onChange={(event) => replace({ ...projectRef.current, modes: projectRef.current.modes.map((mode) => mode.id === activeMode.id ? { ...mode, adjustmentValue: Number(event.target.value) } : mode), candidates: [] })} onPointerUp={finalizeSliderTransaction} onKeyUp={finalizeSliderTransaction} />
            <div className={styles.advancedRangeOverlay} aria-label="离线安全区、当前可行区和动态相位包络">
              {advancedStaticBounds.map((interval, index) => <i key={`static-${index}`} className={styles.staticSafeRange} style={{ left: `${Math.max(0, Math.min(100, (interval.minimum - project.adjustment.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%`, width: `${Math.max(0, Math.min(100, (interval.maximum - interval.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%` }} />)}
              {visibleFeasibility?.intervals.map((interval, index) => <i key={`feasible-${index}`} className={styles.currentSafeRange} style={{ left: `${Math.max(0, Math.min(100, (interval.minimum - project.adjustment.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%`, width: `${Math.max(0, Math.min(100, (interval.maximum - interval.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%` }} />)}
              {advancedDynamicEnvelope?.intervals.map((interval, index) => <i key={`dynamic-${index}`} className={styles.dynamicSafeRange} style={{ left: `${Math.max(0, Math.min(100, (interval.minimum - project.adjustment.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%`, width: `${Math.max(0, Math.min(100, (interval.maximum - interval.minimum) / Math.max(1e-9, project.adjustment.maximum - project.adjustment.minimum) * 100))}%` }} />)}
            </div>
            <div className={styles.advancedLegend}><span><i />离线基线</span><span><i />当前工况可行</span><span><i />动态相位包络</span></div>
            <div className={styles.impactSummary}><b>继续增大锁止值，预计：</b>{adjustmentImpact.map((impact) => <span key={impact.label} className={impact.favorable ? styles.impactGood : styles.impactBad}>{impact.label} {impact.delta >= 0 ? "+" : ""}{impact.delta.toFixed(1)} {impact.unit}</span>)}</div>
            <small>{project.adjustment.kind === "moving-pivot" ? "单位为沿导轨的位移 mm" : "单位为锁定后的有效杆长 mm"}</small>
          </section>}

          {workspaceStep === 2 && <><div className={styles.deploymentHeader}><b>整机部署</b><span>{project.deployment.legCount} 条腿</span></div>
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
                  onPointerDown={beginTransaction}
                  onKeyDown={beginTransaction}
                  onChange={(event) => setDeploymentPhase(leg.id, Number(event.target.value))}
                  onPointerUp={finalizeSliderTransaction}
                  onKeyUp={finalizeSliderTransaction}
                />
              </label>)}
            </div>
          </section></>}

          {workspaceStep === 3 && <section className={`${styles.stepPanel} ${styles.searchBox}`}>
            <p className={styles.stepLead}>生成只创建候选批次。选中候选后，画布和全部工程指标会切换到草稿；只有“应用”才会修改当前项目。</p>
            <div className={styles.sourceChoice} role="radiogroup" aria-label="生成起点">
              <label><input type="radio" name="seed-source" checked={seedSource === "current"} onChange={() => setSeedSource("current")} /><span><b>克隆当前机构</b><br />保持当前拓扑与几何作为真实搜索起点</span></label>
              <label><input type="radio" name="seed-source" checked={seedSource === "template"} onChange={() => setSeedSource("template")} /><span><b>显式模板种子</b><br />当前机构不健康时由你主动选择</span></label>
            </div>
            <button className={styles.primaryButton} type="button" onClick={() => runSynthesis("global")} disabled={searching}>{searching ? `${Math.round(searchProgress.progress * 100)}% · ${searchProgress.stage}` : "生成并比较候选"}</button>
            {searching && <button className={styles.cancelButton} type="button" onClick={cancelSynthesis}>取消搜索</button>}
            <div className={styles.progress}><i style={{ width: `${searchProgress.progress * 100}%` }} /></div>
            <small role="status" aria-live="polite">{searching ? searchProgress.message : message}</small>
            {latestRun && <div className={`${styles.runBadge} ${latestRun.stale ? styles.runStale : ""}`}>最近批次 {latestRun.runId} · {latestRun.candidates.length} 个候选 · {latestRun.stale ? "源版本已过期" : latestRun.status}</div>}
          </section>}

          {workspaceStep === 4 && <section className={`${styles.stepPanel} ${styles.searchBox}`}>
            <p className={styles.stepLead}>精修起点为{session.draftProject ? "当前候选草稿" : "当前已应用项目"}。拓扑及未勾选参数保持锁定，结果作为子批次返回。</p>
            <div className={styles.refinementScope}>
              <div className={styles.refinementHeader}><b>允许修改的对象</b><span>{allowedRefinementIds.length} 项已解锁</span></div>
              <fieldset>
                <legend>杆件长度</legend>
                <div className={styles.unlockList}>
                  {project.baseProject.bars.filter((bar) => bar.id !== project.baseProject.driverId).map((bar) => {
                    const parameterId = variableLegBarLengthParameterId(bar.id);
                    return <label key={parameterId}><input type="checkbox" checked={allowedRefinementIds.includes(parameterId)} onChange={() => toggleRefinementParameter(parameterId)} />{bar.id}{bar.id === selectedBarId ? " · 当前选择" : ""}</label>;
                  })}
                </div>
              </fieldset>
              <details className={styles.advancedDisclosure}>
                <summary>铰点、导轨与多工况锁止值</summary>
                <fieldset>
                  <legend>固定铰点坐标</legend>
                  <div className={styles.unlockList}>
                    {project.baseProject.joints.filter((joint) => joint.fixed).flatMap((joint) => (["x", "y"] as const).map((axis) => {
                      const parameterId = variableLegJointParameterId(joint.id, axis);
                      return <label key={parameterId}><input type="checkbox" checked={allowedRefinementIds.includes(parameterId)} onChange={() => toggleRefinementParameter(parameterId)} />{joint.id}.{axis}</label>;
                    }))}
                  </div>
                </fieldset>
                {project.adjustment.kind === "moving-pivot" && <fieldset>
                  <legend>导轨</legend>
                  <label><input type="checkbox" checked={allowedRefinementIds.includes("adjustment:rail-angle")} onChange={() => toggleRefinementParameter("adjustment:rail-angle")} />导轨角度</label>
                </fieldset>}
                <fieldset>
                  <legend>工况锁止值</legend>
                  <div className={styles.unlockList}>
                    {project.modes.map((mode) => {
                      const parameterId = variableLegModeAdjustmentParameterId(mode.id);
                      return <label key={parameterId}><input type="checkbox" checked={allowedRefinementIds.includes(parameterId)} onChange={() => toggleRefinementParameter(parameterId)} />{mode.name}锁止值</label>;
                    })}
                  </div>
                </fieldset>
              </details>
              <fieldset>
                <legend>精修评估工况</legend>
                <div className={styles.unlockList}>
                  {project.requirements.filter((requirement) => requirement.enabled).map((requirement) => {
                    const mode = project.modes.find((item) => item.id === requirement.modeId);
                    return <label key={requirement.modeId}><input type="checkbox" checked={refinementModeIds.includes(requirement.modeId)} onChange={() => setRefinementModeIds((current) => current.includes(requirement.modeId) ? current.filter((id) => id !== requirement.modeId) : [...current, requirement.modeId])} />{mode?.name ?? requirement.modeId}</label>;
                  })}
                </div>
              </fieldset>
            </div>
            <button className={styles.primaryButton} type="button" onClick={() => runSynthesis("current-target")} disabled={searching || !selectedBarId || allowedRefinementIds.length === 0}>{selectedBarId ? `精修当前杆件 ${selectedBarId}` : "请先在画布选择杆件"}</button>
            {searching && <button className={styles.cancelButton} type="button" onClick={cancelSynthesis}>取消精修</button>}
            <div className={styles.progress}><i style={{ width: `${searchProgress.progress * 100}%` }} /></div>
            <small role="status" aria-live="polite">{searching ? searchProgress.message : message}</small>

            <div className={styles.versionHeader}><b>持久化版本</b><button type="button" onClick={createVersionCheckpoint}>保存当前检查点</button></div>
            <div className={styles.versionList}>
              {[...session.versionHistory].reverse().map((checkpoint) => <div className={styles.versionItem} key={checkpoint.checkpointId}>
                <span><b>{checkpoint.name}</b><small>{new Date(checkpoint.createdAt).toLocaleString("zh-CN")} · {checkpoint.reason}</small></span>
                <button type="button" onClick={() => restoreVersionCheckpoint(checkpoint.checkpointId)} disabled={checkpoint.revisionId === session.revisionId}>恢复</button>
              </div>)}
            </div>
          </section>}

          {workspaceStep === 4 && <div className={styles.projectTools}>
            <button type="button" onClick={exportProject}>导出 JSON</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>导入项目</button>
            <button type="button" onClick={openInDesigner}>在自由设计器打开</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={(event) => void importProject(event)} />
          </div>}
        </aside>

        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <span className={activeConditionEvaluation?.hardPassed ? styles.solved : styles.invalid}>{activeConditionEvaluation?.hardPassed ? "硬约束通过" : "硬约束未通过"}</span>
            <span>{topologyName(displayProject.topology)}</span><span>{adjustmentName(displayProject.adjustment.kind)} / {displayProject.adjustment.targetId}</span>
            {previewCandidate && <><span className={styles.runBadge}>候选草稿 · {previewCandidate.label}{previewRun?.stale ? " · 已过期" : ""}</span><button type="button" onClick={discardCandidatePreview}>退出预览</button></>}
            {barLengthPreview && <span className={barLengthPreview.requestedValid && barPreviewEvaluation?.hardPassed ? styles.draftValid : styles.draftInvalid}>{barLengthPreview.requestedValid && barPreviewEvaluation?.hardPassed ? "草稿可行" : "草稿未写入"}</span>}
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
                <button type="button" onClick={toggleFootprintVisibility}>{project.deployment.showFootprints ? "隐藏足迹" : "显示足迹"}</button>
                <button type="button" onClick={resetGaitTrail}>清除足迹</button>
              </>}
            </div>
            <SvgViewportControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.resetView} />
            <svg
              ref={svgRef}
              viewBox={viewport.viewBox}
              role="img"
              aria-label={viewMode === "mechanism" ? "可变几何克兰或简森步行腿、导轨、锁止位置与多工况足端轨迹" : `${displayProject.deployment.legCount} 条可变几何步行腿整机步态与落足记录`}
              className={viewport.isPanning ? styles.panning : viewMode === "mechanism" && canvasMode === "draw" ? styles.drawing : undefined}
              onPointerDown={startCanvasPointer}
              onPointerMove={moveCanvasPointer}
              onPointerUp={endCanvasPointer}
              onPointerCancel={endCanvasPointer}
            >
              {viewMode === "mechanism" ? <>
                <defs><pattern id="variable-leg-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" className={styles.grid} /></pattern></defs>
                <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#variable-leg-grid)" />
                <g>
                  <path d={pathData(activeMetrics.path.length ? alignedTargetPath(activeMode.targetPath, activeMetrics.path) : activeMode.targetPath)} fill="none" stroke={activeMode.color} strokeWidth="4" strokeDasharray="8 6" className={styles.targetPath} />
                  <path d={pathData(activeMetrics.path)} fill="none" stroke={activeMode.color} strokeWidth="3" className={styles.actualPath} />
                </g>
                {previewPath.length > 2 && <path d={pathData(previewPath)} className={styles.previewPath} />}
                {drawingPoints.length > 1 && <path d={pathData(drawingPoints, false)} className={styles.draftPath} />}

                {displayProject.adjustment.kind === "moving-pivot" && (() => {
                const angle = displayProject.adjustment.railAngle * Math.PI / 180;
                const pointAt = (value: number) => ({ x: displayProject.adjustment.kind === "moving-pivot" ? displayProject.adjustment.baseX + value * Math.cos(angle) : 0, y: displayProject.adjustment.kind === "moving-pivot" ? displayProject.adjustment.baseY + value * Math.sin(angle) : 0 });
                const start = pointAt(displayProject.adjustment.minimum);
                const end = pointAt(displayProject.adjustment.maximum);
                return <g className={styles.rail}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  {displayProject.modes.map((mode) => { const point = pointAt(mode.adjustmentValue); return <g key={mode.id}><circle cx={point.x} cy={point.y} r={mode.id === activeMode.id ? 11 : 7} style={{ fill: mode.color }} /><text x={point.x + 9} y={point.y - 10}>{mode.name}</text></g>; })}
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
                const adjustable = displayProject.adjustment.kind === "telescopic-bar" && bar.id === displayProject.adjustment.targetId;
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
                deployment={displayProject.deployment}
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
              <span><i style={{ background: activeMode.color }} />当前工况 · {activeMode.name}</span>
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

        <aside id="variable-leg-results" className={`${styles.panel} ${styles.analysisPanel} ${resultsOpen ? styles.analysisPanelOpen : ""}`} aria-label="候选与工程检查" onKeyDown={(event) => { if (event.key === "Escape" && resultsOpen) toggleResultsDrawer(); }}>
          <div className={styles.panelTitle}><div><span>02</span><h2>候选与工程检查</h2></div><button ref={resultsCloseRef} type="button" onClick={toggleResultsDrawer}>关闭</button></div>
          {latestCandidates.length && latestRun ? <div className={styles.candidateList}>
            {latestCandidates.slice(0, 5).map((candidate, index) => {
              const quality = assessVariableLegCandidate(candidate.metrics, candidate.modes);
              const usable = candidate.constraintEvaluation?.hardPassed ?? quality.level === "usable";
              const selectedMetric = candidate.metrics.find((metric) => metric.modeId === project.activeModeId) ?? candidate.metrics[0];
              const reference = { runId: latestRun.runId, candidateId: candidate.id };
              const previewed = sameCandidateReference(previewReference, reference);
              const pinned = session.comparisonSelection.some((item) => sameCandidateReference(item, reference));
              return <div key={`${latestRun.runId}-${candidate.id}`} className={`${styles.candidateCard} ${previewed ? styles.selectedCandidate : ""}`}>
                <button type="button" aria-label={`真实预览${candidate.label}`} onClick={() => previewDesignCandidate(reference)}>
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                  <span><b>{candidate.label} <i className={usable ? styles.candidateFeasible : styles.candidateNear}>{usable ? "硬约束通过" : "不可应用"}</i></b><small>{topologyName(candidate.topology)} · {adjustmentName(candidate.adjustment.kind)} · {candidate.adjustment.targetId}</small></span>
                  <strong>{candidate.score.toFixed(0)}</strong>
                  <em>实际：步长 {selectedMetric?.stepLength.toFixed(0)} mm · 抬脚 {selectedMetric?.liftHeight.toFixed(0)} mm · 落地 {selectedMetric?.landingVerticalSpeed.toFixed(0)} mm/s</em>
                  <em>{latestRun.stale ? "源版本已过期，仅可查看" : candidate.constraintEvaluation?.issues[0] ?? "全部启用工况已统一评估"}</em>
                </button>
                <div className={styles.candidateActions}>
                  <button type="button" className={pinned ? styles.pinButtonActive : ""} onClick={() => toggleComparisonCandidate(reference)}>{pinned ? "取消固定" : "固定比较"}</button>
                  <button type="button" className={styles.candidatePrimaryAction} onClick={() => applyDesignCandidate(reference)} disabled={!usable || latestRun.stale}>应用此方案</button>
                </div>
              </div>;
            })}
          </div> : <div className={styles.emptyState}><b>{latestRun?.status === "failed" ? "生成失败" : "等待候选批次"}</b><p>{latestRun?.error ?? "在第 3 步创建候选。生成和精修不会覆盖当前项目；结果会先进入真实草稿预览。"}</p></div>}

          {comparisonCandidates.length > 0 && <div className={styles.comparisonMatrix}>
            <table>
              <thead><tr><th>工况 / 指标</th><th>当前基线</th>{comparisonCandidates.map(({ reference, candidate }) => <th key={`${reference.runId}-${reference.candidateId}`}>{candidate.label}</th>)}</tr></thead>
              <tbody>
                {project.requirements.filter((requirement) => requirement.enabled).flatMap((requirement) => REQUIREMENT_METRICS.map((definition) => {
                  const mode = project.modes.find((item) => item.id === requirement.modeId);
                  const base = workingAnalysis.evaluation.conditions.find((item) => item.modeId === requirement.modeId)?.metrics[definition.key];
                  const scale = definition.key === "stanceRatio" ? 100 : 1;
                  return <tr key={`${requirement.modeId}-${definition.key}`}>
                    <td>{mode?.name ?? requirement.modeId} · {definition.label}<br />目标 {(requirement.constraints[definition.key].target * scale).toFixed(1)} {definition.unit} · {requirement.constraints[definition.key].level === "hard" ? "硬" : "软"}</td>
                    <td>{base?.actual === null || base?.actual === undefined ? "—" : (base.actual * scale).toFixed(1)}<br />Δ {base?.difference === null || base?.difference === undefined ? "—" : (base.difference * scale).toFixed(1)}</td>
                    {comparisonCandidates.map(({ reference, candidate }) => {
                      const result = candidate.constraintEvaluation?.conditions.find((item) => item.modeId === requirement.modeId)?.metrics[definition.key];
                      return <td key={`${reference.runId}-${reference.candidateId}`} className={result?.passed ? undefined : styles.comparisonDiff}>{result?.actual === null || result?.actual === undefined ? "—" : (result.actual * scale).toFixed(1)}<br />Δ {result?.difference === null || result?.difference === undefined ? "—" : (result.difference * scale).toFixed(1)}</td>;
                    })}
                  </tr>;
                }))}
              </tbody>
            </table>
          </div>}

          {viewMode === "deployment" && <>
            <div className={styles.analysisSectionTitle}><span>整机步态</span><b>{displayProject.deployment.legCount} 腿 · {displayProject.deployment.preset === "custom" ? "自定义" : "预设"}</b></div>
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
              <em>{barRoleName(selectedBarMetrics.role)}{displayProject.adjustment.targetId === selectedBar.id ? " · 当前调节对象" : ""}</em>
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
                    runBarLengthPreview(selectedBar.id, value);
                    if (!Number.isFinite(value) || value <= 0) event.currentTarget.value = String(Number(selectedBar.length.toFixed(4)));
                  }}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") event.currentTarget.value = String(Number(selectedBar.length.toFixed(4))); }}
                />
                <i>mm</i>
              </span>
            </label>
            {barLengthPreview?.barId === selectedBar.id && <div className={barLengthPreview.requestedValid && barPreviewEvaluation?.hardPassed ? styles.draftPreviewGood : styles.draftPreviewWarn}>
              <b>{barLengthPreview.requestedValid && barPreviewEvaluation?.hardPassed ? "草稿可行" : "草稿未写入当前机构"}</b>
              <p>{barLengthPreview.requestedValid
                ? `${barLengthPreview.requestedLength.toFixed(2)} mm ${barPreviewEvaluation?.hardPassed ? "已通过统一硬约束检查。" : `仍有硬约束失败：${barPreviewEvaluation?.issues[0] ?? "请查看工程提示"}。`}`
                : barLengthPreview.nearestFeasibleLength !== null
                  ? `输入 ${barLengthPreview.requestedLength.toFixed(2)} mm 不可达；最近可行值为 ${barLengthPreview.nearestFeasibleLength.toFixed(2)} mm。画布紫色虚线显示可应用预览。`
                  : `输入 ${barLengthPreview.requestedLength.toFixed(2)} mm 不可达，附近未找到可行值。`}</p>
              <div><button type="button" onClick={applyBarLengthPreview} disabled={!barLengthPreview.previewProject || !barPreviewEvaluation?.hardPassed}>{barLengthPreview.requestedValid ? "应用草稿" : "应用最近可行值"}</button><button type="button" onClick={() => setBarLengthPreview(null)}>取消草稿</button></div>
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
            {displayProject.modes.map((mode) => {
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
        <button ref={resultsToggleRef} type="button" className={styles.resultDrawerButton} aria-controls="variable-leg-results" aria-expanded={resultsOpen} onClick={toggleResultsDrawer}>{resultsOpen ? "关闭结果" : latestCandidates.length ? `查看 ${latestCandidates.length} 个候选` : "查看结果"}</button>
      </div>
    </main>
  );
}

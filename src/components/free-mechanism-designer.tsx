"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DEMO_PROJECT,
  MECHANISM_TEMPLATES,
  analyzeMechanismCycle,
  bodyPointToLocal,
  cloneProject,
  createRigidBody,
  distance,
  estimateDof,
  getLengthDriver,
  getRotationDriver,
  hasValidDriver,
  maximumConstraintError,
  migrateProject,
  predictJointPositions,
  resolveSliderGuide,
  resolveTracerPoint,
  solveFreeMechanism,
  type DimensionType,
  type DriverMode,
  type FreeBar,
  type FreeDimension,
  type FreeJoint,
  type FreeMechanismProject,
  type FreeRigidBody,
  type FreeTracer,
  type CycleAnalysis,
} from "@/lib/free-mechanism";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useMechanismHistory } from "./use-mechanism-history";
import { useSvgViewport } from "./use-svg-viewport";
import styles from "./free-mechanism-designer.module.css";

type Tool = "select" | "fixed" | "moving" | "slider" | "bar" | "body" | "tracer" | "dimension";
type Selection = { kind: "joint" | "bar" | "body" | "tracer" | "dimension"; id: string } | null;

const TOOL_LABELS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: "select", label: "选择 / 拖动", hint: "编辑已有铰点、杆件与尺寸" },
  { id: "fixed", label: "固定转动副", hint: "在机架上添加固定铰点" },
  { id: "moving", label: "活动转动副", hint: "添加可自由运动的铰点" },
  { id: "slider", label: "移动副", hint: "添加沿导轨运动的滑块铰点" },
  { id: "bar", label: "连接杆件", hint: "依次选择两个铰点建立杆件" },
  { id: "body", label: "多铰点刚体", hint: "选择三个或更多铰点后完成刚体" },
  { id: "tracer", label: "刚体轨迹点", hint: "选中刚体后，在画布放置任意轨迹点" },
  { id: "dimension", label: "尺寸约束", hint: "依次选择两个铰点建立距离或对齐约束" },
];

const DIMENSION_LABELS: Record<DimensionType, string> = {
  distance: "中心距",
  horizontal: "水平对齐",
  vertical: "垂直对齐",
};

function nextId(prefix: string, ids: string[]) {
  const highest = ids.reduce((maximum, id) => {
    const value = Number(id.replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(maximum, value) : maximum;
  }, 0);
  return `${prefix}${highest + 1}`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function driverPhase(project: FreeMechanismProject) {
  if (project.driverMode === "length") {
    const bar = getLengthDriver(project.bars, project.driverId);
    if (!bar) return 0;
    const minimum = Math.max(1, bar.minLength ?? bar.length * 0.7);
    const maximum = Math.max(minimum, bar.maxLength ?? bar.length * 1.3);
    const ratio = Math.min(1, Math.max(0, (bar.length - minimum) / Math.max(0.0001, maximum - minimum)));
    return Math.acos(1 - 2 * ratio);
  }
  if (project.driverMode === "oscillation") return 0;
  const driver = getRotationDriver(project.joints, project.bars, project.driverId);
  return driver ? Math.atan2(driver.driven.y - driver.pivot.y, driver.driven.x - driver.pivot.x) : 0;
}

export function FreeMechanismDesigner() {
  const history = useMechanismHistory(DEMO_PROJECT);
  const { project, projectRef, replace, checkpoint, commit, undo, redo, canUndo, canRedo } = history;
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>({ kind: "joint", id: "J3" });
  const [pairStart, setPairStart] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string[]>([]);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(42);
  const [phase, setPhase] = useState(() => driverPhase(project));
  const [solveResult, setSolveResult] = useState<"idle" | "success" | "warning">("idle");
  const [cycleReport, setCycleReport] = useState<CycleAnalysis | null>(null);
  const [message, setMessage] = useState("四杆模板已就绪。可直接播放，或继续添加移动副、杆件和尺寸约束。");
  const viewportBase = useMemo(() => ({ x: -420, y: -300, width: 840, height: 600 }), []);
  const viewport = useSvgViewport(viewportBase);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const phaseRef = useRef(driverPhase(project));
  const previousMotionJointsRef = useRef<FreeJoint[] | null>(null);

  const syncPhase = useCallback((nextProject: FreeMechanismProject) => {
    const nextPhase = driverPhase(nextProject);
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const selectedJoint = selection?.kind === "joint" ? project.joints.find((joint) => joint.id === selection.id) ?? null : null;
  const selectedBar = selection?.kind === "bar" ? project.bars.find((bar) => bar.id === selection.id) ?? null : null;
  const selectedDimension = selection?.kind === "dimension" ? project.dimensions.find((dimension) => dimension.id === selection.id) ?? null : null;
  const selectedBody = selection?.kind === "body" ? project.bodies.find((body) => body.id === selection.id) ?? null : null;
  const selectedTracer = selection?.kind === "tracer" ? project.tracers.find((tracer) => tracer.id === selection.id) ?? null : null;
  const sliderReferenceBars = selectedJoint
    ? project.bars.filter((bar) => bar.a !== selectedJoint.id && bar.b !== selectedJoint.id)
    : [];
  const activeTracer = project.tracers.find((tracer) => tracer.id === project.activeTracerId) ?? null;
  const driverReady = hasValidDriver(project);
  const dof = estimateDof(project.joints, project.bars, project.dimensions, project.bodies);
  const constraintError = maximumConstraintError(project, phase);

  const stopMotion = useCallback(() => {
    setPlaying(false);
    setTrail([]);
    setSolveResult("idle");
    setCycleReport(null);
    previousMotionJointsRef.current = null;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        stopMotion();
        const restored = event.shiftKey ? redo() : undo();
        if (restored) {
          syncPhase(restored);
          setSelection(null);
          setPairStart(null);
          setBodyDraft([]);
          setMessage(event.shiftKey ? "已重做一步。" : "已撤销一步。");
        }
      } else if (key === "y") {
        event.preventDefault();
        stopMotion();
        const restored = redo();
        if (restored) {
          syncPhase(restored);
          setSelection(null);
          setPairStart(null);
          setBodyDraft([]);
          setMessage("已重做一步。");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, stopMotion, syncPhase, undo]);

  useEffect(() => {
    if (!playing) return;
    if (!hasValidDriver(projectRef.current)) {
      setPlaying(false);
      return;
    }
    phaseRef.current = driverPhase(projectRef.current);
    let animationFrame = 0;
    let previousTime = 0;
    const tick = (time: number) => {
      const elapsed = previousTime === 0 ? 0 : Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      phaseRef.current += elapsed * speed * Math.PI / 180;
      setPhase(phaseRef.current);
      const current = projectRef.current;
      const seeded = { ...current, joints: predictJointPositions(current.joints, previousMotionJointsRef.current) };
      const solvedJoints = solveFreeMechanism(seeded, phaseRef.current);
      const next = { ...current, joints: solvedJoints };
      previousMotionJointsRef.current = current.joints.map((joint) => ({ ...joint, slider: joint.slider ? { ...joint.slider } : undefined }));
      replace(next);
      const tracerPoint = resolveTracerPoint(next);
      if (tracerPoint) setTrail((points) => [...points.slice(-699), tracerPoint]);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [playing, projectRef, replace, speed]);

  const canvasPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const bounds = svg.getBoundingClientRect();
    return {
      x: viewport.view.x + (clientX - bounds.left) / bounds.width * viewport.view.width,
      y: viewport.view.y + (clientY - bounds.top) / bounds.height * viewport.view.height,
    };
  };

  const changeTool = (nextTool: Tool) => {
    stopMotion();
    setTool(nextTool);
    setPairStart(null);
    setBodyDraft([]);
    setMessage(TOOL_LABELS.find((item) => item.id === nextTool)?.hint ?? "");
  };

  const loadProject = (nextProject: FreeMechanismProject, label: string) => {
    stopMotion();
    commit(cloneProject(nextProject));
    syncPhase(nextProject);
    setSelection(null);
    setPairStart(null);
    setBodyDraft([]);
    setTool("select");
    viewport.resetView();
    setMessage(`${label}已载入，可直接播放或修改拓扑。`);
  };

  const addJoint = (x: number, y: number, kind: "fixed" | "moving" | "slider") => {
    const joint: FreeJoint = {
      id: nextId("J", project.joints.map((item) => item.id)),
      x,
      y,
      fixed: kind === "fixed",
      slider: kind === "slider" ? { originX: x, originY: y, angle: 0 } : undefined,
    };
    commit({ ...project, joints: [...project.joints, joint] });
    setSelection({ kind: "joint", id: joint.id });
    setMessage(`${joint.id} 已添加。${kind === "slider" ? "可在右侧修改导轨角度。" : "可继续添加或连接杆件。"}`);
  };

  const handleCanvasClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (playing || event.altKey || tool === "select" || tool === "bar" || tool === "body" || tool === "dimension") return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    if (tool === "tracer") {
      if (!selectedBody) {
        setMessage("请先选中一个多铰点刚体，再使用“刚体轨迹点”工具。");
        return;
      }
      const local = bodyPointToLocal(selectedBody, project.joints, point.x, point.y);
      if (!local) {
        setMessage("刚体局部坐标系无效，无法放置轨迹点。");
        return;
      }
      const tracer: FreeTracer = {
        id: nextId("T", project.tracers.map((item) => item.id)),
        kind: "body",
        bodyId: selectedBody.id,
        ...local,
      };
      commit({ ...project, tracers: [...project.tracers, tracer], activeTracerId: tracer.id });
      setSelection({ kind: "tracer", id: tracer.id });
      setTool("select");
      setTrail([]);
      setMessage(`${tracer.id} 已固定在 ${selectedBody.id} 的局部坐标 (${round(local.localX)}, ${round(local.localY)})。`);
      return;
    }
    addJoint(point.x, point.y, tool);
  };

  const toggleBodyDraftJoint = (jointId: string) => {
    const next = bodyDraft.includes(jointId) ? bodyDraft.filter((id) => id !== jointId) : [...bodyDraft, jointId];
    setBodyDraft(next);
    setMessage(next.length < 3
      ? `已选择 ${next.length} 个铰点；多铰点刚体至少需要 3 个非共线铰点。`
      : `已选择 ${next.length} 个铰点；点击“完成刚体”建立刚性构件。`);
  };

  const finishRigidBody = () => {
    if (bodyDraft.length < 3) {
      setMessage("多铰点刚体至少需要 3 个非共线铰点。");
      return;
    }
    const selectedJoints = bodyDraft
      .map((id) => project.joints.find((joint) => joint.id === id))
      .filter((joint): joint is FreeJoint => Boolean(joint));
    const center = selectedJoints.reduce((sum, joint) => ({ x: sum.x + joint.x, y: sum.y + joint.y }), { x: 0, y: 0 });
    center.x /= selectedJoints.length;
    center.y /= selectedJoints.length;
    const orderedIds = [...selectedJoints]
      .sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x))
      .map((joint) => joint.id);
    const polygonArea = orderedIds.reduce((area, id, index) => {
      const a = project.joints.find((joint) => joint.id === id)!;
      const b = project.joints.find((joint) => joint.id === orderedIds[(index + 1) % orderedIds.length])!;
      return area + a.x * b.y - b.x * a.y;
    }, 0) * 0.5;
    if (Math.abs(polygonArea) < 1) {
      setMessage("所选铰点接近共线，无法定义稳定的二维刚体。请调整点位后重试。");
      return;
    }
    const body = createRigidBody(nextId("B", project.bodies.map((item) => item.id)), orderedIds, project.joints);
    commit({ ...project, bodies: [...project.bodies, body] });
    setSelection({ kind: "body", id: body.id });
    setBodyDraft([]);
    setTool("select");
    setMessage(`${body.id} 已建立，${body.jointIds.length} 个铰点现在保持为同一刚体。`);
  };

  const addPairObject = (endId: string) => {
    if (!pairStart) {
      setPairStart(endId);
      setMessage(`已选择 ${endId}，请再选择一个铰点。`);
      return;
    }
    if (pairStart === endId) return;
    const start = project.joints.find((joint) => joint.id === pairStart);
    const end = project.joints.find((joint) => joint.id === endId);
    if (!start || !end) return;
    if (tool === "bar") {
      const duplicate = project.bars.some((bar) =>
        (bar.a === start.id && bar.b === end.id) || (bar.a === end.id && bar.b === start.id));
      if (duplicate) {
        setMessage("这两个铰点之间已经存在杆件。");
        setPairStart(null);
        return;
      }
      const bar: FreeBar = {
        id: nextId("L", project.bars.map((item) => item.id)),
        a: start.id,
        b: end.id,
        length: distance(start, end),
        type: "rigid",
      };
      commit({ ...project, bars: [...project.bars, bar] });
      setSelection({ kind: "bar", id: bar.id });
      setMessage(`${bar.id} 已建立，默认为刚性定长杆。`);
    } else {
      const dimension: FreeDimension = {
        id: nextId("D", project.dimensions.map((item) => item.id)),
        type: "distance",
        a: start.id,
        b: end.id,
        value: distance(start, end),
      };
      commit({ ...project, dimensions: [...project.dimensions, dimension] });
      setSelection({ kind: "dimension", id: dimension.id });
      setMessage(`${dimension.id} 已建立，可在右侧切换为水平或垂直约束。`);
    }
    setPairStart(null);
  };

  const handleJointClick = (joint: FreeJoint) => {
    if (playing) return;
    if (tool === "body") toggleBodyDraftJoint(joint.id);
    else if (tool === "bar" || tool === "dimension") addPairObject(joint.id);
    else setSelection({ kind: "joint", id: joint.id });
  };

  const moveJoint = (id: string, x: number, y: number) => {
    const current = projectRef.current;
    const joints = current.joints.map((joint) => joint.id === id ? {
      ...joint,
      x,
      y,
      slider: joint.slider
        ? joint.slider.referenceBarId
          ? { ...joint.slider }
          : { ...joint.slider, originX: x, originY: y }
        : undefined,
    } : joint);
    const byId = new Map(joints.map((joint) => [joint.id, joint]));
    const bars = current.bars.map((bar) => {
      if (bar.a !== id && bar.b !== id) return bar;
      const a = byId.get(bar.a);
      const b = byId.get(bar.b);
      const length = a && b ? distance(a, b) : bar.length;
      return {
        ...bar,
        length,
        minLength: bar.type === "telescopic" ? Math.min(bar.minLength ?? length, length) : bar.minLength,
        maxLength: bar.type === "telescopic" ? Math.max(bar.maxLength ?? length, length) : bar.maxLength,
      };
    });
    const bodies = current.bodies.map((body) => body.jointIds.includes(id)
      ? createRigidBody(body.id, body.jointIds, joints)
      : body);
    const next = { ...current, joints, bars, bodies };
    replace(next);
    syncPhase(next);
    setTrail([]);
    setCycleReport(null);
  };

  const startJointDrag = (event: ReactPointerEvent<SVGGElement>, joint: FreeJoint) => {
    event.stopPropagation();
    if (playing || tool !== "select") return;
    checkpoint();
    dragRef.current = { id: joint.id, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveJointDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (point) moveJoint(drag.id, point.x, point.y);
  };

  const endJointDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const updateProject = (updater: (current: FreeMechanismProject) => FreeMechanismProject) => {
    stopMotion();
    const next = updater(project);
    commit(next);
    syncPhase(next);
    setTrail([]);
    setCycleReport(null);
    setSolveResult("idle");
    setMessage("设计参数已更新；请重新求解或执行整周检查。");
  };

  const updateSelectedJoint = (updates: Partial<FreeJoint>) => {
    if (!selectedJoint) return;
    updateProject((current) => {
      const joints = current.joints.map((joint) => joint.id === selectedJoint.id ? { ...joint, ...updates } : joint);
      const bodies = current.bodies.map((body) => body.jointIds.includes(selectedJoint.id)
        ? createRigidBody(body.id, body.jointIds, joints)
        : body);
      return { ...current, joints, bodies };
    });
  };

  const updateSelectedBody = (updates: Partial<FreeRigidBody>) => {
    if (!selectedBody) return;
    updateProject((current) => ({
      ...current,
      bodies: current.bodies.map((body) => body.id === selectedBody.id ? { ...body, ...updates } : body),
    }));
  };

  const updateSelectedTracer = (updates: Partial<FreeTracer>) => {
    if (!selectedTracer) return;
    updateProject((current) => ({
      ...current,
      tracers: current.tracers.map((tracer) => tracer.id === selectedTracer.id ? { ...tracer, ...updates } as FreeTracer : tracer),
    }));
    setTrail([]);
  };

  const trackJoint = (jointId: string) => {
    const existing = project.tracers.find((tracer) => tracer.kind === "joint" && tracer.jointId === jointId);
    const tracer: FreeTracer = existing ?? {
      id: nextId("T", project.tracers.map((item) => item.id)),
      kind: "joint",
      jointId,
    };
    updateProject((current) => ({
      ...current,
      tracers: existing ? current.tracers : [...current.tracers, tracer],
      activeTracerId: tracer.id,
    }));
    setTrail([]);
    setMessage(`${tracer.id} 已设为当前轨迹点。`);
  };

  const updateSelectedBar = (updates: Partial<FreeBar>) => {
    if (!selectedBar) return;
    updateProject((current) => ({
      ...current,
      bars: current.bars.map((bar) => bar.id === selectedBar.id ? { ...bar, ...updates } : bar),
    }));
  };

  const updateSelectedDimension = (updates: Partial<FreeDimension>) => {
    if (!selectedDimension) return;
    updateProject((current) => ({
      ...current,
      dimensions: current.dimensions.map((dimension) => dimension.id === selectedDimension.id ? { ...dimension, ...updates } : dimension),
    }));
  };

  const deleteSelection = () => {
    if (!selection) return;
    updateProject((current) => {
      if (selection.kind === "joint") {
        const removedBars = current.bars.filter((bar) => bar.a === selection.id || bar.b === selection.id).map((bar) => bar.id);
        const removedBodies = current.bodies.filter((body) => body.jointIds.includes(selection.id)).map((body) => body.id);
        const tracers = current.tracers.filter((tracer) =>
          !(tracer.kind === "joint" && tracer.jointId === selection.id)
          && !(tracer.kind === "body" && removedBodies.includes(tracer.bodyId)));
        const joints = current.joints
          .filter((joint) => joint.id !== selection.id)
          .map((joint) => joint.slider?.referenceBarId && removedBars.includes(joint.slider.referenceBarId)
            ? { ...joint, slider: { ...joint.slider, referenceBarId: undefined, offset: undefined, originX: joint.x, originY: joint.y } }
            : joint);
        return {
          ...current,
          joints,
          bars: current.bars.filter((bar) => !removedBars.includes(bar.id)),
          dimensions: current.dimensions.filter((dimension) => dimension.a !== selection.id && dimension.b !== selection.id),
          bodies: current.bodies.filter((body) => !removedBodies.includes(body.id)),
          tracers,
          activeTracerId: tracers.some((tracer) => tracer.id === current.activeTracerId) ? current.activeTracerId : tracers[0]?.id ?? null,
          driverId: removedBars.includes(current.driverId ?? "") ? null : current.driverId,
        };
      }
      if (selection.kind === "bar") return {
        ...current,
        joints: current.joints.map((joint) => joint.slider?.referenceBarId === selection.id
          ? { ...joint, slider: { ...joint.slider, referenceBarId: undefined, offset: undefined, originX: joint.x, originY: joint.y } }
          : joint),
        bars: current.bars.filter((bar) => bar.id !== selection.id),
        driverId: current.driverId === selection.id ? null : current.driverId,
      };
      if (selection.kind === "body") {
        const tracers = current.tracers.filter((tracer) => !(tracer.kind === "body" && tracer.bodyId === selection.id));
        return {
          ...current,
          bodies: current.bodies.filter((body) => body.id !== selection.id),
          tracers,
          activeTracerId: tracers.some((tracer) => tracer.id === current.activeTracerId) ? current.activeTracerId : tracers[0]?.id ?? null,
        };
      }
      if (selection.kind === "tracer") {
        const tracers = current.tracers.filter((tracer) => tracer.id !== selection.id);
        return {
          ...current,
          tracers,
          activeTracerId: current.activeTracerId === selection.id ? tracers[0]?.id ?? null : current.activeTracerId,
        };
      }
      return { ...current, dimensions: current.dimensions.filter((dimension) => dimension.id !== selection.id) };
    });
    setSelection(null);
    setMessage("已删除所选对象。");
  };

  const clearProject = () => {
    const blank: FreeMechanismProject = {
      version: 3,
      joints: [],
      bars: [],
      dimensions: [],
      bodies: [],
      tracers: [],
      activeTracerId: null,
      driverId: null,
      driverMode: "rotation",
    };
    stopMotion();
    commit(blank);
    syncPhase(blank);
    setSelection(null);
    setPairStart(null);
    setBodyDraft([]);
    setTool("fixed");
    setMessage("空白项目已创建。先放置固定转动副或移动副。 ");
  };

  const exportProject = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "open-linkage-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = migrateProject(JSON.parse(await file.text()));
      if (!imported) throw new Error("invalid project");
      loadProject(imported, "项目");
      setMessage(`已导入 ${imported.joints.length} 个铰点、${imported.bars.length} 根杆件、${imported.bodies.length} 个刚体和 ${imported.dimensions.length} 个尺寸。`);
    } catch {
      setMessage("项目文件无法读取，请确认它是 OpenLinkage 导出的 JSON。");
    }
  };

  const solveOnce = () => {
    const wasPlaying = playing;
    stopMotion();
    checkpoint();
    const next = { ...project, joints: solveFreeMechanism(project, phaseRef.current, 160) };
    replace(next);
    setTrail([]);
    const error = maximumConstraintError(next, phaseRef.current);
    setPhase(phaseRef.current);
    setSolveResult(error < 0.1 ? "success" : "warning");
    setMessage(error < 0.1
      ? `${wasPlaying ? "已暂停运动并完成求解。" : "自由拓扑已自动收敛。"} 最大约束误差 ${error.toFixed(3)} mm。`
      : `求解已执行，剩余最大约束误差 ${error.toFixed(2)} mm；请检查是否过约束或无法装配。`);
  };

  const checkFullCycle = () => {
    stopMotion();
    if (!driverReady) {
      setMessage("整周检查需要先指定有效的旋转主动杆或周期伸缩驱动。");
      return;
    }
    const report = analyzeMechanismCycle(project, 144, 400, 0.1, phaseRef.current);
    setCycleReport(report);
    setMessage(report.valid
      ? `整周 144 点检查通过：无不可达相位、无装配分支跳变，首尾误差 ${report.closureError.toFixed(3)} mm。`
      : `整周检查需要关注：${report.failedPhases.length} 个不可达采样、${report.branchSwitches} 次分支变化、首尾误差 ${report.closureError.toFixed(3)} mm。`);
  };

  const togglePlaying = () => {
    if (!driverReady) {
      setMessage("请先选择可用的旋转主动杆，或一根伸缩活动杆作为长度驱动。");
      return;
    }
    setPlaying((current) => !current);
    setTool("select");
  };

  const setDriver = (barId: string, mode: DriverMode) => {
    const driver = getRotationDriver(project.joints, project.bars, barId);
    const currentAngle = driver ? Math.atan2(driver.driven.y - driver.pivot.y, driver.driven.x - driver.pivot.x) : 0;
    const nextProject = {
      ...project,
      driverId: barId,
      driverMode: mode,
      bars: mode === "oscillation"
        ? project.bars.map((bar) => bar.id === barId ? { ...bar, minAngle: currentAngle - Math.PI * 2 / 3, maxAngle: currentAngle } : bar)
        : project.bars,
    };
    updateProject(() => nextProject);
    phaseRef.current = driverPhase(nextProject);
    setPhase(phaseRef.current);
    setMessage(mode === "rotation" ? "已设为连续旋转主动杆。" : mode === "oscillation" ? "已设为往复摆动主动杆，可调整角度范围。" : "已设为周期伸缩驱动。 ");
  };

  const tracePath = trail.length > 1 ? `M ${trail.map((point) => `${point.x} ${point.y}`).join(" L ")}` : "";

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav><Link href="/lab">四杆设计</Link><Link href="/leg">六杆腿设计</Link><span>自由机构设计器 · 0.6</span></nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>建模工具</h1></div><button type="button" onClick={() => loadProject(DEMO_PROJECT, "四杆模板")}>恢复示例</button></div>
          <div className={styles.historyBar}>
            <button type="button" disabled={!canUndo} onClick={() => { stopMotion(); const restored = undo(); if (restored) { syncPhase(restored); setSelection(null); setPairStart(null); setMessage("已撤销一步。"); } }}>↶ 撤销</button>
            <button type="button" disabled={!canRedo} onClick={() => { stopMotion(); const restored = redo(); if (restored) { syncPhase(restored); setSelection(null); setPairStart(null); setMessage("已重做一步。"); } }}>↷ 重做</button>
          </div>
          <div className={styles.toolList}>
            {TOOL_LABELS.map((item) => (
              <button className={tool === item.id ? styles.activeTool : ""} type="button" key={item.id} onClick={() => changeTool(item.id)}>
                <span>{item.label}</span><small>{item.hint}</small>
              </button>
            ))}
          </div>
          <section className={styles.templateSection}>
            <div className={styles.sectionLabel}><span>机构模板</span><small>一键载入后可自由修改</small></div>
            <div className={styles.templateGrid}>
              {MECHANISM_TEMPLATES.map((template) => (
                <button type="button" key={template.id} onClick={() => loadProject(template.project, `${template.name}模板`)}>
                  <b>{template.name}</b><small>{template.description}</small>
                </button>
              ))}
            </div>
          </section>
          <div className={styles.workflowHint}>
            <b>经典机构与自由拓扑</b>
            <p>移动副既可固定在机架，也可绑定运动杆件；剪叉模板展示了随平台移动的相对导轨。</p>
          </div>
          <div className={styles.projectTools}>
            <button type="button" onClick={clearProject}>新建空白项目</button>
            <button type="button" onClick={exportProject}>导出 JSON</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>导入 JSON</button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={importProject} />
          </div>
        </aside>

        <section className={styles.stage}>
          <div className={styles.stageHeader}>
            <span>FREE TOPOLOGY / XY PLANE</span><span>{project.joints.length} J / {project.bars.length} L / {project.bodies.length} B / {project.tracers.length} T / {project.dimensions.length} D</span>
            <b className={constraintError < 0.25 ? styles.ready : styles.warning}>{constraintError < 0.25 ? "CONSTRAINTS SOLVED" : "NEEDS SOLVE"}</b>
          </div>
          <div className={styles.canvas}>
            <div className={styles.canvasActions} role="group" aria-label="自由机构画布操作">
              <button type="button" className={tool === "select" ? styles.canvasActive : ""} onClick={() => changeTool("select")}>编辑</button>
              <button type="button" className={tool === "fixed" ? styles.canvasActive : ""} onClick={() => changeTool("fixed")}>固定副</button>
              <button type="button" className={tool === "moving" ? styles.canvasActive : ""} onClick={() => changeTool("moving")}>转动副</button>
              <button type="button" className={tool === "slider" ? styles.canvasActive : ""} onClick={() => changeTool("slider")}>移动副</button>
              <button type="button" className={tool === "bar" ? styles.canvasActive : ""} onClick={() => changeTool("bar")}>杆件</button>
              <button type="button" className={tool === "body" ? styles.canvasActive : ""} onClick={() => changeTool("body")}>刚体</button>
              {tool === "body" && <button type="button" className={styles.finishBodyButton} disabled={bodyDraft.length < 3} onClick={finishRigidBody}>完成刚体 {bodyDraft.length}</button>}
              <button type="button" className={tool === "tracer" ? styles.canvasActive : ""} onClick={() => changeTool("tracer")}>轨迹点</button>
              <button type="button" className={tool === "dimension" ? styles.canvasActive : ""} onClick={() => changeTool("dimension")}>尺寸</button>
              <button
                type="button"
                aria-live="polite"
                className={`${styles.solveButton} ${solveResult === "success" ? styles.solveSuccess : ""} ${solveResult === "warning" ? styles.solveWarning : ""}`}
                onClick={solveOnce}
              >
                {solveResult === "success" ? "已求解 ✓" : solveResult === "warning" ? "检查残差 !" : "自动求解"}
              </button>
              <button type="button" className={styles.cycleButton} onClick={checkFullCycle}>整周检查</button>
            </div>
            <SvgViewportControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.resetView} />
            <svg
              ref={svgRef}
              className={`${tool !== "select" ? styles.creationCursor : ""} ${viewport.isPanning ? styles.panning : ""}`}
              viewBox={viewport.viewBox}
              onClick={handleCanvasClick}
              onWheel={viewport.handleWheel}
              onPointerDown={(event) => viewport.startPan(event)}
              onPointerMove={(event) => viewport.movePan(event)}
              onPointerUp={(event) => viewport.endPan(event)}
              onPointerCancel={(event) => viewport.endPan(event)}
              aria-label="自由平面机构设计画布"
            >
              <defs><pattern id="designer-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" className={styles.gridLine} /></pattern></defs>
              <rect x={viewport.view.x} y={viewport.view.y} width={viewport.view.width} height={viewport.view.height} fill="url(#designer-grid)" />
              <line x1={viewport.view.x} y1="0" x2={viewport.view.x + viewport.view.width} y2="0" className={styles.axis} />
              <line x1="0" y1={viewport.view.y} x2="0" y2={viewport.view.y + viewport.view.height} className={styles.axis} />
              {tracePath && <path d={tracePath} className={styles.trail} />}

              {bodyDraft.length > 1 && <polyline
                points={bodyDraft.map((id) => project.joints.find((joint) => joint.id === id)).filter(Boolean).map((joint) => `${joint!.x},${joint!.y}`).join(" ")}
                className={styles.bodyDraft}
              />}

              {project.joints.filter((joint) => joint.slider).map((joint) => {
                const guide = resolveSliderGuide(joint, project.joints, project.bars);
                if (!guide) return null;
                const dx = Math.cos(guide.angle) * 240;
                const dy = Math.sin(guide.angle) * 240;
                return <g key={`guide-${joint.id}`} className={`${styles.sliderGuide} ${guide.referenceBarId ? styles.relativeSliderGuide : ""}`}>
                  <line x1={guide.originX - dx} y1={guide.originY - dy} x2={guide.originX + dx} y2={guide.originY + dy} />
                  <line x1={guide.originX - dx} y1={guide.originY - dy + 8} x2={guide.originX + dx} y2={guide.originY + dy + 8} />
                  {guide.referenceBarId && <text x={guide.originX + 12} y={guide.originY - 12}>REL · {guide.referenceBarId}</text>}
                </g>;
              })}

              {project.bodies.map((body) => {
                const points = body.jointIds
                  .map((id) => project.joints.find((joint) => joint.id === id))
                  .filter((joint): joint is FreeJoint => Boolean(joint));
                if (points.length < 3) return null;
                const selected = selection?.kind === "body" && selection.id === body.id;
                const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
                center.x /= points.length;
                center.y /= points.length;
                return <g key={body.id} data-testid={`body-${body.id}`} className={`${styles.rigidBodyGroup} ${selected ? styles.selectedBody : ""}`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "body", id: body.id }); }}>
                  <polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
                  <text x={center.x} y={center.y}>{body.id}</text>
                </g>;
              })}

              {project.dimensions.map((dimension) => {
                const a = project.joints.find((joint) => joint.id === dimension.a);
                const b = project.joints.find((joint) => joint.id === dimension.b);
                if (!a || !b) return null;
                const selected = selection?.kind === "dimension" && selection.id === dimension.id;
                const label = dimension.type === "distance" ? `${round(dimension.value)} mm` : DIMENSION_LABELS[dimension.type];
                return <g key={dimension.id} data-testid={`dimension-${dimension.id}`} className={`${styles.dimensionGroup} ${selected ? styles.selectedDimension : ""}`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "dimension", id: dimension.id }); }}>
                  <line x1={a.x} y1={a.y - 28} x2={b.x} y2={b.y - 28} />
                  <line x1={a.x} y1={a.y - 35} x2={a.x} y2={a.y - 21} />
                  <line x1={b.x} y1={b.y - 35} x2={b.x} y2={b.y - 21} />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 36}>{dimension.id} · {label}</text>
                </g>;
              })}

              {project.bars.map((bar) => {
                const a = project.joints.find((joint) => joint.id === bar.a);
                const b = project.joints.find((joint) => joint.id === bar.b);
                if (!a || !b) return null;
                const selected = selection?.kind === "bar" && selection.id === bar.id;
                return (
                  <g key={bar.id} data-testid={`bar-${bar.id}`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "bar", id: bar.id }); }}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.linkHit} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.link} ${project.driverId === bar.id ? styles.driverLink : ""} ${selected ? styles.selectedLink : ""} ${bar.type === "telescopic" ? styles.telescopicLink : ""}`} />
                    {bar.type === "telescopic" && <line x1={a.x + (b.x - a.x) * 0.37} y1={a.y + (b.y - a.y) * 0.37} x2={a.x + (b.x - a.x) * 0.67} y2={a.y + (b.y - a.y) * 0.67} className={styles.telescopicSleeve} />}
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 12} className={styles.linkLabel}>{bar.id}</text>
                  </g>
                );
              })}

              {project.joints.map((joint) => {
                const selected = selection?.kind === "joint" && selection.id === joint.id;
                const sliderGuide = resolveSliderGuide(joint, project.joints, project.bars);
                return (
                  <g
                    className={styles.jointGroup}
                    key={joint.id}
                    data-testid={`joint-${joint.id}`}
                    onPointerDown={(event) => startJointDrag(event, joint)}
                    onPointerMove={moveJointDrag}
                    onPointerUp={endJointDrag}
                    onPointerCancel={endJointDrag}
                    onClick={(event) => { event.stopPropagation(); handleJointClick(joint); }}
                  >
                    {joint.fixed && <path d={`M ${joint.x - 20} ${joint.y + 19} L ${joint.x + 20} ${joint.y + 19} M ${joint.x - 15} ${joint.y + 19} l -8 12 M ${joint.x} ${joint.y + 19} l -8 12 M ${joint.x + 15} ${joint.y + 19} l -8 12`} className={styles.groundMark} />}
                    {joint.slider && <rect x={joint.x - 18} y={joint.y - 13} width="36" height="26" rx="4" className={`${styles.sliderBlock} ${selected ? styles.selectedJoint : ""}`} transform={`rotate(${(sliderGuide?.angle ?? joint.slider.angle) * 180 / Math.PI} ${joint.x} ${joint.y})`} />}
                    {!joint.slider && <circle cx={joint.x} cy={joint.y} r={selected || pairStart === joint.id || bodyDraft.includes(joint.id) ? 16 : 13} className={`${styles.joint} ${joint.fixed ? styles.fixedJoint : ""} ${selected ? styles.selectedJoint : ""} ${bodyDraft.includes(joint.id) ? styles.bodyDraftJoint : ""}`} />}
                    <circle cx={joint.x} cy={joint.y} r="4" className={styles.pin} />
                    <text x={joint.x + 16} y={joint.y - 15} className={styles.jointLabel}>{joint.id}</text>
                  </g>
                );
              })}

              {project.tracers.map((tracer) => {
                const point = resolveTracerPoint(project, tracer.id);
                if (!point) return null;
                const selected = selection?.kind === "tracer" && selection.id === tracer.id;
                const active = project.activeTracerId === tracer.id;
                return <g
                  key={tracer.id}
                  data-testid={`tracer-${tracer.id}`}
                  className={`${styles.tracerPoint} ${active ? styles.activeTracer : ""} ${selected ? styles.selectedTracer : ""}`}
                  onClick={(event) => { event.stopPropagation(); setSelection({ kind: "tracer", id: tracer.id }); }}
                >
                  <path d={`M ${point.x} ${point.y - 11} L ${point.x + 11} ${point.y} L ${point.x} ${point.y + 11} L ${point.x - 11} ${point.y} Z`} />
                  <circle cx={point.x} cy={point.y} r="3" />
                  <text x={point.x + 14} y={point.y + 4}>{tracer.id}</text>
                </g>;
              })}
            </svg>
            {project.joints.length === 0 && <div className={styles.emptyCanvas}><b>空白机构</b><span>选择“固定转动副”，然后在画布上单击。</span></div>}
          </div>
          <div className={styles.messageBar}><span>{message}</span><span>滚轮缩放 · Alt / 中键平移 · Ctrl+Z 撤销</span></div>
          <div className={styles.transport}>
            <button type="button" onClick={togglePlaying} aria-label={playing ? "暂停运动" : "播放运动"}>{playing ? "Ⅱ" : "▶"}</button>
            <div><span>{project.driverMode === "length" ? "伸缩驱动" : project.driverMode === "oscillation" ? "摆动驱动" : "旋转驱动"}</span><b>{project.driverId ?? "未设置"}</b></div>
            <label>速度 <input type="range" min="5" max="160" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><b>{speed}°/s</b></label>
            <button className={styles.clearTrail} type="button" onClick={() => setTrail([])}>清除轨迹</button>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.inspector}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>对象与约束</h2></div>{selection && <button type="button" onClick={deleteSelection}>删除所选</button>}</div>
          {selectedJoint && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>{selectedJoint.slider?.referenceBarId ? "RELATIVE PRISMATIC" : selectedJoint.slider ? "PRISMATIC" : "JOINT"}</span><b>{selectedJoint.id}</b></div>
              <label>X 坐标 <input type="number" value={round(selectedJoint.x)} onChange={(event) => updateSelectedJoint({ x: Number(event.target.value) })} /></label>
              <label>Y 坐标 <input type="number" value={round(selectedJoint.y)} onChange={(event) => updateSelectedJoint({ y: Number(event.target.value) })} /></label>
              {selectedJoint.slider && <>
                <label>导轨参考 <select value={selectedJoint.slider.referenceBarId ?? ""} onChange={(event) => {
                  const referenceBarId = event.target.value || undefined;
                  updateSelectedJoint({
                    slider: referenceBarId
                      ? { ...selectedJoint.slider!, referenceBarId, angle: 0, offset: 0 }
                      : { ...selectedJoint.slider!, referenceBarId: undefined, offset: undefined, originX: selectedJoint.x, originY: selectedJoint.y, angle: 0 },
                  });
                }}>
                  <option value="">机架固定导轨</option>
                  {sliderReferenceBars.map((bar) => <option key={bar.id} value={bar.id}>跟随 {bar.id}（{bar.a}–{bar.b}）</option>)}
                </select></label>
                <label>{selectedJoint.slider.referenceBarId ? "相对角度" : "导轨角度"} <input type="number" value={round(selectedJoint.slider.angle * 180 / Math.PI)} onChange={(event) => updateSelectedJoint({ slider: { ...selectedJoint.slider!, angle: Number(event.target.value) * Math.PI / 180 } })} /></label>
                {selectedJoint.slider.referenceBarId && <label>法向偏置 <input type="number" value={round(selectedJoint.slider.offset ?? 0)} onChange={(event) => updateSelectedJoint({ slider: { ...selectedJoint.slider!, offset: Number(event.target.value) } })} /></label>}
                <small>{selectedJoint.slider.referenceBarId
                  ? `导轨随 ${selectedJoint.slider.referenceBarId} 平移和转动；相对角度与偏置在参考杆件局部坐标系中定义。`
                  : "导轨固定在机架坐标系中；可输入绝对角度。"}</small>
              </>}
              <button type="button" onClick={() => updateSelectedJoint(selectedJoint.slider
                ? { slider: undefined, fixed: false }
                : selectedJoint.fixed
                  ? { fixed: false, slider: undefined }
                  : { fixed: false, slider: { originX: selectedJoint.x, originY: selectedJoint.y, angle: 0 } })}>
                {selectedJoint.slider ? "改为活动转动副" : selectedJoint.fixed ? "改为活动转动副" : "改为移动副"}
              </button>
              {!selectedJoint.slider && <button type="button" onClick={() => updateSelectedJoint({ fixed: !selectedJoint.fixed, slider: undefined })}>{selectedJoint.fixed ? "解除机架固定" : "固定到机架"}</button>}
              <button type="button" className={activeTracer?.kind === "joint" && activeTracer.jointId === selectedJoint.id ? styles.selectedAction : ""} onClick={() => trackJoint(selectedJoint.id)}>
                {activeTracer?.kind === "joint" && activeTracer.jointId === selectedJoint.id ? "当前轨迹点" : "跟踪此铰点轨迹"}
              </button>
            </section>
          )}

          {selectedBody && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>RIGID BODY</span><b>{selectedBody.id}</b></div>
              <p>{selectedBody.jointIds.join(" · ")}</p>
              <div className={styles.bodyStats}>
                <span><b>{selectedBody.jointIds.length}</b> 个铰点</span>
                <span><b>{selectedBody.pairs.length}</b> 个内部距离</span>
              </div>
              <button type="button" onClick={() => updateSelectedBody(createRigidBody(selectedBody.id, selectedBody.jointIds, project.joints))}>以当前点位重定义刚体</button>
              <button type="button" onClick={() => { setTool("tracer"); setMessage(`请在画布上单击，为 ${selectedBody.id} 放置任意局部轨迹点。`); }}>在刚体上放置轨迹点</button>
              <small>刚体内部所有铰点距离会同时参与求解；删除刚体只解除刚性关系，不会删除铰点。</small>
            </section>
          )}

          {selectedTracer && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>TRACER</span><b>{selectedTracer.id}</b></div>
              <p>{selectedTracer.kind === "joint" ? `铰点 ${selectedTracer.jointId}` : `刚体 ${selectedTracer.bodyId}`}</p>
              {selectedTracer.kind === "body" && <>
                <label>局部 X <input type="number" value={round(selectedTracer.localX)} onChange={(event) => updateSelectedTracer({ localX: Number(event.target.value) })} /></label>
                <label>局部 Y <input type="number" value={round(selectedTracer.localY)} onChange={(event) => updateSelectedTracer({ localY: Number(event.target.value) })} /></label>
              </>}
              <button type="button" className={project.activeTracerId === selectedTracer.id ? styles.selectedAction : ""} onClick={() => updateProject((current) => ({ ...current, activeTracerId: selectedTracer.id }))}>
                {project.activeTracerId === selectedTracer.id ? "当前轨迹点" : "设为当前轨迹点"}
              </button>
              <small>{selectedTracer.kind === "body" ? "局部坐标随刚体平移和旋转，可位于刚体轮廓内部或外部。" : "该轨迹点与铰点位置完全重合。"}</small>
            </section>
          )}

          {selectedBar && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>LINK</span><b>{selectedBar.id}</b></div>
              <p>{selectedBar.a} → {selectedBar.b}</p>
              <label>杆件类型 <select value={selectedBar.type ?? "rigid"} onChange={(event) => {
                const type = event.target.value as "rigid" | "telescopic";
                updateSelectedBar(type === "telescopic" ? { type, minLength: selectedBar.length * 0.7, maxLength: selectedBar.length * 1.3 } : { type, minLength: undefined, maxLength: undefined });
              }}><option value="rigid">刚性定长杆</option><option value="telescopic">伸缩活动杆</option></select></label>
              <label>中心距 <input type="number" min="1" value={round(selectedBar.length)} onChange={(event) => updateSelectedBar({ length: Number(event.target.value) })} /></label>
              {selectedBar.type === "telescopic" && <>
                <label>最短长度 <input type="number" min="1" value={round(selectedBar.minLength ?? selectedBar.length * 0.7)} onChange={(event) => updateSelectedBar({ minLength: Number(event.target.value) })} /></label>
                <label>最长长度 <input type="number" min="1" value={round(selectedBar.maxLength ?? selectedBar.length * 1.3)} onChange={(event) => updateSelectedBar({ maxLength: Number(event.target.value) })} /></label>
                <button type="button" className={project.driverId === selectedBar.id && project.driverMode === "length" ? styles.selectedAction : ""} onClick={() => setDriver(selectedBar.id, "length")}>设为周期伸缩驱动</button>
              </>}
              <button type="button" disabled={!getRotationDriver(project.joints, project.bars, selectedBar.id)} className={project.driverId === selectedBar.id && project.driverMode === "rotation" ? styles.selectedAction : ""} onClick={() => setDriver(selectedBar.id, "rotation")}>
                {project.driverId === selectedBar.id && project.driverMode === "rotation" ? "当前旋转主动杆" : "设为旋转主动杆"}
              </button>
              <button type="button" disabled={!getRotationDriver(project.joints, project.bars, selectedBar.id)} className={project.driverId === selectedBar.id && project.driverMode === "oscillation" ? styles.selectedAction : ""} onClick={() => setDriver(selectedBar.id, "oscillation")}>
                {project.driverId === selectedBar.id && project.driverMode === "oscillation" ? "当前摆动主动杆" : "设为摆动主动杆"}
              </button>
              {project.driverId === selectedBar.id && project.driverMode === "oscillation" && <>
                <label>最小角度 <input type="number" value={round((selectedBar.minAngle ?? -Math.PI / 3) * 180 / Math.PI)} onChange={(event) => updateSelectedBar({ minAngle: Number(event.target.value) * Math.PI / 180 })} /></label>
                <label>最大角度 <input type="number" value={round((selectedBar.maxAngle ?? Math.PI / 3) * 180 / Math.PI)} onChange={(event) => updateSelectedBar({ maxAngle: Number(event.target.value) * Math.PI / 180 })} /></label>
              </>}
              {!getRotationDriver(project.joints, project.bars, selectedBar.id) && <small>旋转主动杆必须连接一个固定铰点与一个活动铰点。</small>}
            </section>
          )}

          {selectedDimension && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>DIMENSION</span><b>{selectedDimension.id}</b></div>
              <p>{selectedDimension.a} → {selectedDimension.b}</p>
              <label>约束类型 <select value={selectedDimension.type} onChange={(event) => updateSelectedDimension({ type: event.target.value as DimensionType, value: event.target.value === "distance" ? selectedDimension.value : 0 })}>
                <option value="distance">中心距尺寸</option><option value="horizontal">水平对齐</option><option value="vertical">垂直对齐</option>
              </select></label>
              {selectedDimension.type === "distance" && <label>尺寸值 <input type="number" min="1" value={round(selectedDimension.value)} onChange={(event) => updateSelectedDimension({ value: Number(event.target.value) })} /></label>}
              <button type="button" onClick={solveOnce}>应用约束并自动求解</button>
            </section>
          )}

          {!selection && <div className={styles.noSelection}><b>尚未选择对象</b><p>单击铰点、杆件或尺寸，可编辑运动副类型、长度、驱动和几何约束。</p></div>}

          <section className={styles.metrics}>
            <h3>机构状态</h3>
            <div><span>自由度估算</span><strong>{dof}</strong></div>
            <div><span>移动副</span><strong>{project.joints.filter((joint) => joint.slider).length}</strong></div>
            <div><span>相对移动副</span><strong>{project.joints.filter((joint) => joint.slider?.referenceBarId).length}</strong></div>
            <div><span>多铰点刚体</span><strong>{project.bodies.length}</strong></div>
            <div><span>轨迹点</span><strong>{project.tracers.length}</strong></div>
            <div><span>最大约束误差</span><strong>{constraintError.toFixed(2)}<small> mm</small></strong></div>
            <div><span>轨迹采样</span><strong>{trail.length}</strong></div>
          </section>
          {cycleReport && (
            <section className={`${styles.cycleReport} ${cycleReport.valid ? styles.cyclePass : styles.cycleFail}`} aria-live="polite">
              <div className={styles.cycleReportTitle}>
                <span>FULL CYCLE · {cycleReport.samples} SAMPLES</span>
                <b>{cycleReport.valid ? "整周连续" : "需要检查"}</b>
              </div>
              <div className={styles.cycleReportGrid}>
                <span>不可达采样<strong>{cycleReport.failedPhases.length}</strong></span>
                <span>分支变化<strong>{cycleReport.branchSwitches}</strong></span>
                <span>首尾误差<strong>{cycleReport.closureError.toFixed(3)} mm</strong></span>
                <span>峰值残差<strong>{cycleReport.maxConstraintError.toFixed(3)} mm</strong></span>
              </div>
              <p>{cycleReport.failedPhases.length > 0
                ? `首个异常输入相位约 ${cycleReport.failedPhases[0].toFixed(1)}°；请调整杆长、固定铰点或装配初态。`
                : `相邻采样最大铰点位移 ${cycleReport.maxJointStep.toFixed(2)} mm，闭环首尾姿态已复核。`}</p>
            </section>
          )}
          <div className={driverReady ? styles.healthGood : styles.healthWarn}>
            <b>{driverReady ? "驱动已就绪" : "还需要指定有效驱动"}</b>
            <p>{driverReady ? "通用投影求解器会同时保持杆长、尺寸与导轨约束，并连续跟踪当前装配分支。" : "旋转驱动需要机架铰点；长度驱动需要一根伸缩活动杆。"}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

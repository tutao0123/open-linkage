"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DEMO_PROJECT,
  distance,
  estimateDof,
  getDriverEndpoints,
  maximumConstraintError,
  solveFreeMechanism,
  type FreeBar,
  type FreeJoint,
  type FreeMechanismProject,
} from "@/lib/free-mechanism";
import { SvgViewportControls } from "./svg-viewport-controls";
import { useSvgViewport } from "./use-svg-viewport";
import styles from "./free-mechanism-designer.module.css";

type Tool = "select" | "fixed" | "moving" | "bar";
type Selection = { kind: "joint" | "bar"; id: string } | null;

const TOOL_LABELS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: "select", label: "选择 / 拖动", hint: "编辑已有铰点和杆件" },
  { id: "fixed", label: "固定铰点", hint: "在机架上添加固定转动副" },
  { id: "moving", label: "活动铰点", hint: "添加可运动的转动副" },
  { id: "bar", label: "连接杆件", hint: "依次选择两个铰点" },
];

function cloneDemo() {
  return {
    joints: DEMO_PROJECT.joints.map((joint) => ({ ...joint })),
    bars: DEMO_PROJECT.bars.map((bar) => ({ ...bar })),
  };
}

function nextId(prefix: string, ids: string[]) {
  const highest = ids.reduce((maximum, id) => {
    const value = Number(id.replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(maximum, value) : maximum;
  }, 0);
  return `${prefix}${highest + 1}`;
}

function isProject(value: unknown): value is FreeMechanismProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<FreeMechanismProject>;
  return project.version === 1 && Array.isArray(project.joints) && Array.isArray(project.bars);
}

export function FreeMechanismDesigner() {
  const demo = useMemo(() => cloneDemo(), []);
  const [joints, setJoints] = useState<FreeJoint[]>(demo.joints);
  const [bars, setBars] = useState<FreeBar[]>(demo.bars);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>({ kind: "joint", id: "J3" });
  const [linkStart, setLinkStart] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(DEMO_PROJECT.driverId);
  const [tracerId, setTracerId] = useState<string | null>(DEMO_PROJECT.tracerId);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(42);
  const [message, setMessage] = useState("示例四杆机构已就绪，可直接播放或继续编辑。");
  const viewportBase = useMemo(() => ({ x: -420, y: -300, width: 840, height: 600 }), []);
  const viewport = useSvgViewport(viewportBase);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const angleRef = useRef(0);
  const jointsRef = useRef(joints);
  const barsRef = useRef(bars);

  useEffect(() => { jointsRef.current = joints; }, [joints]);
  useEffect(() => { barsRef.current = bars; }, [bars]);

  const selectedJoint = selection?.kind === "joint" ? joints.find((joint) => joint.id === selection.id) ?? null : null;
  const selectedBar = selection?.kind === "bar" ? bars.find((bar) => bar.id === selection.id) ?? null : null;
  const driver = getDriverEndpoints(joints, bars, driverId);
  const dof = estimateDof(joints, bars);
  const constraintError = maximumConstraintError(joints, bars);

  useEffect(() => {
    if (!playing) return;
    const currentDriver = getDriverEndpoints(jointsRef.current, barsRef.current, driverId);
    if (!currentDriver) return;
    angleRef.current = Math.atan2(
      currentDriver.driven.y - currentDriver.pivot.y,
      currentDriver.driven.x - currentDriver.pivot.x,
    );
    let animationFrame = 0;
    let previousTime = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      angleRef.current += elapsed * speed * Math.PI / 180;
      const next = solveFreeMechanism(jointsRef.current, barsRef.current, driverId, angleRef.current);
      jointsRef.current = next;
      setJoints(next);
      if (tracerId) {
        const tracer = next.find((joint) => joint.id === tracerId);
        if (tracer) setTrail((current) => [...current.slice(-699), { x: tracer.x, y: tracer.y }]);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [driverId, playing, speed, tracerId]);

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
    setPlaying(false);
    setTool(nextTool);
    setLinkStart(null);
    setMessage(TOOL_LABELS.find((item) => item.id === nextTool)?.hint ?? "");
  };

  const addJoint = (x: number, y: number, fixed: boolean) => {
    const joint: FreeJoint = { id: nextId("J", joints.map((item) => item.id)), x, y, fixed };
    setJoints((current) => [...current, joint]);
    setSelection({ kind: "joint", id: joint.id });
    setMessage(`${joint.id} 已添加。继续添加铰点，或选择“连接杆件”。`);
  };

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (playing || event.altKey || tool === "select" || tool === "bar") return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (point) addJoint(point.x, point.y, tool === "fixed");
  };

  const handleJointClick = (joint: FreeJoint) => {
    if (playing) return;
    if (tool !== "bar") {
      setSelection({ kind: "joint", id: joint.id });
      return;
    }
    if (!linkStart) {
      setLinkStart(joint.id);
      setMessage(`已选择 ${joint.id}，请再选择一个铰点完成杆件。`);
      return;
    }
    if (linkStart === joint.id) return;
    const duplicate = bars.some((bar) =>
      (bar.a === linkStart && bar.b === joint.id) || (bar.a === joint.id && bar.b === linkStart));
    if (duplicate) {
      setMessage("这两个铰点之间已经存在杆件。");
      setLinkStart(null);
      return;
    }
    const start = joints.find((item) => item.id === linkStart);
    if (!start) return;
    const bar: FreeBar = {
      id: nextId("L", bars.map((item) => item.id)),
      a: start.id,
      b: joint.id,
      length: distance(start, joint),
    };
    setBars((current) => [...current, bar]);
    setSelection({ kind: "bar", id: bar.id });
    setLinkStart(null);
    setMessage(`${bar.id} 已连接，可继续连接其他铰点。`);
  };

  const moveJoint = (id: string, x: number, y: number) => {
    const next = jointsRef.current.map((joint) => joint.id === id ? { ...joint, x, y } : joint);
    const byId = new Map(next.map((joint) => [joint.id, joint]));
    jointsRef.current = next;
    setJoints(next);
    setBars((current) => current.map((bar) => {
      if (bar.a !== id && bar.b !== id) return bar;
      const a = byId.get(bar.a);
      const b = byId.get(bar.b);
      return a && b ? { ...bar, length: distance(a, b) } : bar;
    }));
    setTrail([]);
  };

  const startJointDrag = (event: ReactPointerEvent<SVGGElement>, joint: FreeJoint) => {
    event.stopPropagation();
    if (playing || tool !== "select") return;
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

  const setSelectedJointValue = (key: "x" | "y", value: number) => {
    if (!selectedJoint || !Number.isFinite(value)) return;
    moveJoint(selectedJoint.id, key === "x" ? value : selectedJoint.x, key === "y" ? value : selectedJoint.y);
  };

  const setSelectedBarLength = (length: number) => {
    if (!selectedBar || !Number.isFinite(length) || length <= 0) return;
    setBars((current) => current.map((bar) => bar.id === selectedBar.id ? { ...bar, length } : bar));
    setTrail([]);
  };

  const deleteSelection = () => {
    if (!selection) return;
    setPlaying(false);
    if (selection.kind === "joint") {
      const connected = bars.filter((bar) => bar.a === selection.id || bar.b === selection.id).map((bar) => bar.id);
      setJoints((current) => current.filter((joint) => joint.id !== selection.id));
      setBars((current) => current.filter((bar) => !connected.includes(bar.id)));
      if (connected.includes(driverId ?? "")) setDriverId(null);
      if (tracerId === selection.id) setTracerId(null);
    } else {
      setBars((current) => current.filter((bar) => bar.id !== selection.id));
      if (driverId === selection.id) setDriverId(null);
    }
    setSelection(null);
    setTrail([]);
    setMessage("已删除所选对象。");
  };

  const loadDemo = () => {
    const next = cloneDemo();
    setPlaying(false);
    setJoints(next.joints);
    setBars(next.bars);
    setDriverId(DEMO_PROJECT.driverId);
    setTracerId(DEMO_PROJECT.tracerId);
    setTrail([]);
    setSelection({ kind: "joint", id: "J3" });
    setTool("select");
    viewport.resetView();
    setMessage("示例四杆机构已恢复。");
  };

  const clearProject = () => {
    setPlaying(false);
    setJoints([]);
    setBars([]);
    setDriverId(null);
    setTracerId(null);
    setTrail([]);
    setSelection(null);
    setTool("fixed");
    setMessage("空白项目已创建。先在画布上放置固定铰点。");
  };

  const exportProject = () => {
    const project: FreeMechanismProject = { version: 1, joints, bars, driverId, tracerId };
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
      const project: unknown = JSON.parse(await file.text());
      if (!isProject(project)) throw new Error("invalid project");
      setPlaying(false);
      setJoints(project.joints);
      setBars(project.bars);
      setDriverId(project.driverId ?? null);
      setTracerId(project.tracerId ?? null);
      setTrail([]);
      setSelection(null);
      setTool("select");
      setMessage(`已导入 ${project.joints.length} 个铰点和 ${project.bars.length} 根杆件。`);
    } catch {
      setMessage("项目文件无法读取，请确认它是 OpenLinkage 导出的 JSON。");
    }
  };

  const togglePlaying = () => {
    if (!driver) {
      setMessage("请先选择一根连接固定铰点的杆件，并将它设为主动杆。");
      return;
    }
    setPlaying((current) => !current);
    setTool("select");
  };

  const tracePath = trail.length > 1 ? `M ${trail.map((point) => `${point.x} ${point.y}`).join(" L ")}` : "";

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark} />OpenLinkage</Link>
        <nav><Link href="/lab">四杆设计</Link><Link href="/leg">六杆腿设计</Link><span>自由机构设计器 · BETA</span></nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTitle}><div><span>01</span><h1>建模工具</h1></div><button type="button" onClick={loadDemo}>载入示例</button></div>
          <div className={styles.toolList}>
            {TOOL_LABELS.map((item) => (
              <button className={tool === item.id ? styles.activeTool : ""} type="button" key={item.id} onClick={() => changeTool(item.id)}>
                <span>{item.label}</span><small>{item.hint}</small>
              </button>
            ))}
          </div>
          <div className={styles.workflowHint}>
            <b>自由搭建流程</b>
            <ol><li>放置固定与活动铰点</li><li>依次连接两个铰点</li><li>选择连着固定点的杆件并设为主动杆</li><li>选择轨迹点并播放</li></ol>
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
            <span>FREE TOPOLOGY / XY PLANE</span><span>{joints.length} JOINTS</span><span>{bars.length} LINKS</span>
            <b className={driver ? styles.ready : styles.warning}>{driver ? "DRIVER READY" : "NO DRIVER"}</b>
          </div>
          <div className={styles.canvas}>
            <div className={styles.canvasActions} role="group" aria-label="自由机构画布操作">
              <button type="button" className={tool === "select" ? styles.canvasActive : ""} onClick={() => changeTool("select")}>编辑机构</button>
              <button type="button" className={tool === "fixed" ? styles.canvasActive : ""} onClick={() => changeTool("fixed")}>添加固定点</button>
              <button type="button" className={tool === "moving" ? styles.canvasActive : ""} onClick={() => changeTool("moving")}>添加活动点</button>
              <button type="button" className={tool === "bar" ? styles.canvasActive : ""} onClick={() => changeTool("bar")}>连接杆件</button>
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
              {bars.map((bar) => {
                const a = joints.find((joint) => joint.id === bar.a);
                const b = joints.find((joint) => joint.id === bar.b);
                if (!a || !b) return null;
                const selected = selection?.kind === "bar" && selection.id === bar.id;
                return (
                  <g key={bar.id} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "bar", id: bar.id }); }}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.linkHit} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${styles.link} ${driverId === bar.id ? styles.driverLink : ""} ${selected ? styles.selectedLink : ""}`} />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 12} className={styles.linkLabel}>{bar.id}</text>
                  </g>
                );
              })}
              {joints.map((joint) => {
                const selected = selection?.kind === "joint" && selection.id === joint.id;
                return (
                  <g
                    className={styles.jointGroup}
                    key={joint.id}
                    onPointerDown={(event) => startJointDrag(event, joint)}
                    onPointerMove={moveJointDrag}
                    onPointerUp={endJointDrag}
                    onPointerCancel={endJointDrag}
                    onClick={(event) => { event.stopPropagation(); handleJointClick(joint); }}
                  >
                    {joint.fixed && <path d={`M ${joint.x - 20} ${joint.y + 19} L ${joint.x + 20} ${joint.y + 19} M ${joint.x - 15} ${joint.y + 19} l -8 12 M ${joint.x} ${joint.y + 19} l -8 12 M ${joint.x + 15} ${joint.y + 19} l -8 12`} className={styles.groundMark} />}
                    <circle cx={joint.x} cy={joint.y} r={selected || linkStart === joint.id ? 16 : 13} className={`${styles.joint} ${joint.fixed ? styles.fixedJoint : ""} ${selected ? styles.selectedJoint : ""}`} />
                    <circle cx={joint.x} cy={joint.y} r="4" className={styles.pin} />
                    <text x={joint.x + 16} y={joint.y - 15} className={styles.jointLabel}>{joint.id}</text>
                  </g>
                );
              })}
            </svg>
            {joints.length === 0 && <div className={styles.emptyCanvas}><b>空白机构</b><span>选择“添加固定点”，然后在画布上单击。</span></div>}
          </div>
          <div className={styles.messageBar}><span>{message}</span><span>滚轮缩放 · Alt / 中键平移</span></div>
          <div className={styles.transport}>
            <button type="button" onClick={togglePlaying} aria-label={playing ? "暂停运动" : "播放运动"}>{playing ? "Ⅱ" : "▶"}</button>
            <div><span>主动杆</span><b>{driverId ?? "未设置"}</b></div>
            <label>速度 <input type="range" min="5" max="160" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><b>{speed}°/s</b></label>
            <button className={styles.clearTrail} type="button" onClick={() => setTrail([])}>清除轨迹</button>
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.inspector}`}>
          <div className={styles.panelTitle}><div><span>02</span><h2>对象与求解</h2></div>{selection && <button type="button" onClick={deleteSelection}>删除所选</button>}</div>
          {selectedJoint && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>JOINT</span><b>{selectedJoint.id}</b></div>
              <label>X 坐标 <input type="number" value={Math.round(selectedJoint.x * 10) / 10} onChange={(event) => setSelectedJointValue("x", Number(event.target.value))} /></label>
              <label>Y 坐标 <input type="number" value={Math.round(selectedJoint.y * 10) / 10} onChange={(event) => setSelectedJointValue("y", Number(event.target.value))} /></label>
              <button type="button" onClick={() => setJoints((current) => current.map((joint) => joint.id === selectedJoint.id ? { ...joint, fixed: !joint.fixed } : joint))}>
                {selectedJoint.fixed ? "改为活动铰点" : "固定到机架"}
              </button>
              <button type="button" className={tracerId === selectedJoint.id ? styles.selectedAction : ""} onClick={() => { setTracerId(selectedJoint.id); setTrail([]); }}>
                {tracerId === selectedJoint.id ? "当前轨迹点" : "跟踪此铰点轨迹"}
              </button>
            </section>
          )}
          {selectedBar && (
            <section className={styles.selectionCard}>
              <div className={styles.selectionTitle}><span>LINK</span><b>{selectedBar.id}</b></div>
              <p>{selectedBar.a} ↔ {selectedBar.b}</p>
              <label>中心距 <input type="number" min="1" value={Math.round(selectedBar.length * 10) / 10} onChange={(event) => setSelectedBarLength(Number(event.target.value))} /></label>
              <button type="button" disabled={!getDriverEndpoints(joints, bars, selectedBar.id)} className={driverId === selectedBar.id ? styles.selectedAction : ""} onClick={() => { setPlaying(false); setDriverId(selectedBar.id); setTrail([]); }}>
                {driverId === selectedBar.id ? "当前主动杆" : "设为主动杆"}
              </button>
              {!getDriverEndpoints(joints, bars, selectedBar.id) && <small>主动杆必须连接一个固定铰点和一个活动铰点。</small>}
            </section>
          )}
          {!selection && <div className={styles.noSelection}><b>尚未选择对象</b><p>单击铰点或杆件，可编辑坐标、长度、驱动和轨迹设置。</p></div>}

          <section className={styles.metrics}>
            <h3>机构状态</h3>
            <div><span>自由度估算</span><strong>{dof}</strong></div>
            <div><span>固定铰点</span><strong>{joints.filter((joint) => joint.fixed).length}</strong></div>
            <div><span>最大约束误差</span><strong>{constraintError.toFixed(2)}<small> mm</small></strong></div>
            <div><span>轨迹采样</span><strong>{trail.length}</strong></div>
          </section>
          <div className={driver ? styles.healthGood : styles.healthWarn}>
            <b>{driver ? "可以开始运动" : "还需要指定主动杆"}</b>
            <p>{driver ? "求解器将保持所有杆件中心距，并连续跟踪当前装配分支。" : "选择一根连接固定点的杆件，然后点击“设为主动杆”。"}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

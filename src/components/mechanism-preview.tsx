"use client";

import { useEffect, useState } from "react";

import type { Language } from "@/lib/i18n";

type Point = { x: number; y: number };

type MechanismLayout = {
  input: Point;
  coupler: Point;
  output: Point;
  traceAnchor: Point;
  trace: Point;
  phase: number;
};

const groundA = { x: 126, y: 310 };
const groundB = { x: 492, y: 310 };
const initialInput = { x: 230, y: 190 };
const initialOutput = { x: 438, y: 150 };
const crankLength = Math.hypot(initialInput.x - groundA.x, initialInput.y - groundA.y);
const couplerLength = Math.hypot(initialOutput.x - initialInput.x, initialOutput.y - initialInput.y);
const rockerLength = Math.hypot(groundB.x - initialOutput.x, groundB.y - initialOutput.y);
const initialPhase = Math.atan2(initialInput.y - groundA.y, initialInput.x - groundA.x);
const groundLength = Math.hypot(groundB.x - groundA.x, groundB.y - groundA.y);
const phaseLimit = Math.acos(
  Math.max(
    -1,
    Math.min(
      1,
      (groundLength ** 2 + crankLength ** 2 - (couplerLength + rockerLength) ** 2) /
        (2 * groundLength * crankLength),
    ),
  ),
);
const motionMinPhase = -phaseLimit + 0.015;
const motionMaxPhase = phaseLimit - 0.015;

function solveLayout(phase: number): MechanismLayout {
  const input = {
    x: groundA.x + crankLength * Math.cos(phase),
    y: groundA.y + crankLength * Math.sin(phase),
  };
  const dx = groundB.x - input.x;
  const dy = groundB.y - input.y;
  const distance = Math.hypot(dx, dy);
  const baseDistance = (couplerLength ** 2 - rockerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, couplerLength ** 2 - baseDistance ** 2));
  const base = {
    x: input.x + (baseDistance * dx) / distance,
    y: input.y + (baseDistance * dy) / distance,
  };
  const perpendicular = { x: -dy / distance, y: dx / distance };
  const upper = {
    x: base.x - height * perpendicular.x,
    y: base.y - height * perpendicular.y,
  };
  const lower = {
    x: base.x + height * perpendicular.x,
    y: base.y + height * perpendicular.y,
  };
  const output = upper.y < lower.y ? upper : lower;
  const couplerVector = { x: output.x - input.x, y: output.y - input.y };
  const couplerDistance = Math.hypot(couplerVector.x, couplerVector.y);
  const normal = { x: -couplerVector.y / couplerDistance, y: couplerVector.x / couplerDistance };
  const traceAnchor = {
    x: input.x + couplerVector.x * 0.65,
    y: input.y + couplerVector.y * 0.65,
  };
  const trace = {
    x: traceAnchor.x + normal.x * 98,
    y: traceAnchor.y + normal.y * 98,
  };

  return { input, coupler: output, output: groundB, traceAnchor, trace, phase };
}

const initialLayout = solveLayout(initialPhase);

function buildMotionPath(selectPoint: (layout: MechanismLayout) => Point) {
  const samples = 96;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const phase = motionMinPhase + ((motionMaxPhase - motionMinPhase) * index) / samples;
    const point = selectPoint(solveLayout(phase));
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

const trajectoryPath = buildMotionPath((layout) => layout.trace);
const couplerTrajectoryPath = buildMotionPath((layout) => layout.coupler);
const driveSweepPath = (() => {
  const start = {
    x: groundA.x + crankLength * Math.cos(motionMinPhase),
    y: groundA.y + crankLength * Math.sin(motionMinPhase),
  };
  const end = {
    x: groundA.x + crankLength * Math.cos(motionMaxPhase),
    y: groundA.y + crankLength * Math.sin(motionMaxPhase),
  };
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${crankLength.toFixed(2)} ${crankLength.toFixed(2)} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
})();

function degrees(radians: number) {
  return ((radians * 180) / Math.PI + 360) % 360;
}

export function MechanismPreview({ language }: { language: Language }) {
  const [layout, setLayout] = useState(initialLayout);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const startedAt = performance.now();
    const motionSpan = motionMaxPhase - motionMinPhase;
    const cycleSpan = motionSpan * 2;
    const motionRate = 0.48;
    const startingProgress = initialPhase - motionMinPhase;
    const animate = (now: number) => {
      const progress = (startingProgress + ((now - startedAt) / 1000) * motionRate) % cycleSpan;
      const phase = progress <= motionSpan
        ? motionMinPhase + progress
        : motionMaxPhase - (progress - motionSpan);
      setLayout(solveLayout(phase));
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const labels = language === "zh"
    ? { card: "平面连杆机构概念示意", image: "运动中的四杆机构" }
    : { card: "Conceptual diagram of planar linkage mechanism", image: "Four-bar mechanism in motion" };

  return (
    <div className="mechanism-card" aria-label={labels.card}>
      <div className="card-head"><span>LINKAGE / LIVE PREVIEW</span><span>θ {degrees(layout.phase).toFixed(1)}°</span></div>
      <svg viewBox="-60 40 720 500" role="img" aria-label={labels.image}>
        <path className="drive-sweep" d={driveSweepPath} />
        <path className="coupler-trajectory" d={couplerTrajectoryPath} />
        <path className="trajectory" d={trajectoryPath} />
        <line className="ground" x1={groundA.x} y1={groundA.y} x2={groundB.x} y2={groundB.y} />
        <line className="link link-a" x1={groundA.x} y1={groundA.y} x2={layout.input.x} y2={layout.input.y} />
        <line className="link link-b" x1={layout.input.x} y1={layout.input.y} x2={layout.coupler.x} y2={layout.coupler.y} />
        <line className="link link-c" x1={layout.coupler.x} y1={layout.coupler.y} x2={layout.output.x} y2={layout.output.y} />
        <line className="coupler" x1={layout.input.x} y1={layout.input.y} x2={layout.trace.x} y2={layout.trace.y} />
        <line className="coupler-offset" x1={layout.coupler.x} y1={layout.coupler.y} x2={layout.trace.x} y2={layout.trace.y} />
        <circle className="trace-anchor" cx={layout.traceAnchor.x} cy={layout.traceAnchor.y} r="4" />
        {[groundA, layout.input, layout.coupler, groundB].map((point, index) => (
          <g key={`${index}-${point.x.toFixed(2)}`}>
            <circle className="joint-ring" cx={point.x} cy={point.y} r="13" />
            <circle className="joint" cx={point.x} cy={point.y} r="5" />
          </g>
        ))}
        <g className="joint-labels" aria-hidden="true">
          <text x={groundA.x - 28} y={groundA.y + 28}>J1</text>
          <text x={layout.input.x - 24} y={layout.input.y - 20}>J2</text>
          <text x={layout.coupler.x + 14} y={layout.coupler.y - 16}>J3</text>
          <text x={layout.trace.x + 12} y={layout.trace.y - 12}>P</text>
        </g>
        <circle className="trace-point" cx={layout.trace.x} cy={layout.trace.y} r="7" />
      </svg>
      <div className="card-stats"><span>PLANE <b>XY</b></span><span>LINKS <b>4</b></span><span>TRACE <b>P</b></span><span>SOLVER <b>READY</b></span></div>
    </div>
  );
}

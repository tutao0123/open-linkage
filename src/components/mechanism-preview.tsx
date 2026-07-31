"use client";

import { useEffect, useState } from "react";

import type { Language } from "@/lib/i18n";

type Point = { x: number; y: number };

type MechanismLayout = {
  input: Point;
  coupler: Point;
  output: Point;
  secondary: Point;
  traceAnchor: Point;
  trace: Point;
  phase: number;
};

const groundA = { x: 126, y: 310 };
const groundB = { x: 492, y: 310 };
const groundC = { x: 610, y: 310 };
const initialInput = { x: 176, y: 223 };
const initialOutput = { x: 380, y: 98 };
const initialSecondary = { x: 560, y: 80 };
const crankLength = Math.hypot(initialInput.x - groundA.x, initialInput.y - groundA.y);
const couplerLength = Math.hypot(initialOutput.x - initialInput.x, initialOutput.y - initialInput.y);
const rockerLength = Math.hypot(groundB.x - initialOutput.x, groundB.y - initialOutput.y);
const secondaryCouplerLength = Math.hypot(initialSecondary.x - initialOutput.x, initialSecondary.y - initialOutput.y);
const secondaryRockerLength = Math.hypot(groundC.x - initialSecondary.x, groundC.y - initialSecondary.y);
const initialPhase = Math.atan2(initialInput.y - groundA.y, initialInput.x - groundA.x);
const motionMinPhase = 0;
const motionMaxPhase = Math.PI * 2;

function solveCirclePair(
  centerA: Point,
  radiusA: number,
  centerB: Point,
  radiusB: number,
  preferred: Point,
) {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distance = Math.max(Math.hypot(dx, dy), Number.EPSILON);
  const baseDistance = (radiusA ** 2 - radiusB ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, radiusA ** 2 - baseDistance ** 2));
  const base = {
    x: centerA.x + (baseDistance * dx) / distance,
    y: centerA.y + (baseDistance * dy) / distance,
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
  const preferredSide = Math.sign(dx * (preferred.y - centerA.y) - dy * (preferred.x - centerA.x)) || 1;
  const upperSide = Math.sign(dx * (upper.y - centerA.y) - dy * (upper.x - centerA.x)) || preferredSide;
  return preferredSide * upperSide > 0 ? upper : lower;
}

function solveLayout(phase: number): MechanismLayout {
  const input = {
    x: groundA.x + crankLength * Math.cos(phase),
    y: groundA.y + crankLength * Math.sin(phase),
  };
  const coupler = solveCirclePair(input, couplerLength, groundB, rockerLength, initialOutput);
  const secondary = solveCirclePair(coupler, secondaryCouplerLength, groundC, secondaryRockerLength, initialSecondary);
  const secondaryVector = { x: secondary.x - coupler.x, y: secondary.y - coupler.y };
  const secondaryDistance = Math.hypot(secondaryVector.x, secondaryVector.y);
  const normal = { x: -secondaryVector.y / secondaryDistance, y: secondaryVector.x / secondaryDistance };
  const traceAnchor = {
    x: coupler.x + secondaryVector.x * 0.62,
    y: coupler.y + secondaryVector.y * 0.62,
  };
  const trace = {
    x: traceAnchor.x + normal.x * 75,
    y: traceAnchor.y + normal.y * 75,
  };

  return { input, coupler, output: groundB, secondary, traceAnchor, trace, phase };
}

const initialLayout = solveLayout(initialPhase);

function buildMotionPath(selectPoint: (layout: MechanismLayout) => Point) {
  const samples = 160;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const phase = motionMinPhase + ((motionMaxPhase - motionMinPhase) * index) / samples;
    const point = selectPoint(solveLayout(phase));
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

const trajectoryPath = buildMotionPath((layout) => layout.trace);
const couplerTrajectoryPath = buildMotionPath((layout) => layout.coupler);
const secondaryTrajectoryPath = buildMotionPath((layout) => layout.secondary);
const driveSweepPath = (() => {
  const right = { x: groundA.x + crankLength, y: groundA.y };
  const left = { x: groundA.x - crankLength, y: groundA.y };
  return `M ${right.x.toFixed(2)} ${right.y.toFixed(2)} A ${crankLength.toFixed(2)} ${crankLength.toFixed(2)} 0 1 1 ${left.x.toFixed(2)} ${left.y.toFixed(2)} A ${crankLength.toFixed(2)} ${crankLength.toFixed(2)} 0 1 1 ${right.x.toFixed(2)} ${right.y.toFixed(2)}`;
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
    const motionRate = 0.58;
    const animate = (now: number) => {
      const phase = initialPhase + ((now - startedAt) / 1000) * motionRate;
      setLayout(solveLayout(phase));
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const labels = language === "zh"
    ? { card: "平面连杆机构概念示意", image: "运动中的四杆机构" }
    : { card: "Conceptual diagram of a double-loop six-bar mechanism", image: "Animated double-loop six-bar mechanism" };

  return (
    <div className="mechanism-card" aria-label={labels.card}>
      <div className="card-head"><span>LINKAGE / SIX-BAR PREVIEW</span><span>θ {degrees(layout.phase).toFixed(1)}°</span></div>
      <svg viewBox="-60 40 720 500" role="img" aria-label={labels.image}>
        <path className="drive-sweep" d={driveSweepPath} />
        <path className="coupler-trajectory" d={couplerTrajectoryPath} />
        <path className="secondary-trajectory" d={secondaryTrajectoryPath} />
        <path className="trajectory" d={trajectoryPath} />
        <line className="ground" x1={groundA.x} y1={groundA.y} x2={groundB.x} y2={groundB.y} />
        <line className="ground secondary-ground" x1={groundB.x} y1={groundB.y} x2={groundC.x} y2={groundC.y} />
        <line className="link link-a" x1={groundA.x} y1={groundA.y} x2={layout.input.x} y2={layout.input.y} />
        <line className="link link-b" x1={layout.input.x} y1={layout.input.y} x2={layout.coupler.x} y2={layout.coupler.y} />
        <line className="link link-c" x1={layout.coupler.x} y1={layout.coupler.y} x2={layout.output.x} y2={layout.output.y} />
        <line className="link link-d" x1={layout.coupler.x} y1={layout.coupler.y} x2={layout.secondary.x} y2={layout.secondary.y} />
        <line className="link link-e" x1={layout.secondary.x} y1={layout.secondary.y} x2={groundC.x} y2={groundC.y} />
        <line className="coupler" x1={layout.coupler.x} y1={layout.coupler.y} x2={layout.trace.x} y2={layout.trace.y} />
        <line className="coupler-offset" x1={layout.secondary.x} y1={layout.secondary.y} x2={layout.trace.x} y2={layout.trace.y} />
        <circle className="trace-anchor" cx={layout.traceAnchor.x} cy={layout.traceAnchor.y} r="4" />
        {[groundA, layout.input, layout.coupler, groundB, layout.secondary, groundC].map((point, index) => (
          <g key={`${index}-${point.x.toFixed(2)}`}>
            <circle className="joint-ring" cx={point.x} cy={point.y} r="13" />
            <circle className="joint" cx={point.x} cy={point.y} r="5" />
          </g>
        ))}
        <g className="joint-labels" aria-hidden="true">
          <text x={groundA.x - 28} y={groundA.y + 28}>A</text>
          <text x={layout.input.x - 24} y={layout.input.y - 20}>J2</text>
          <text x={layout.coupler.x + 14} y={layout.coupler.y - 16}>J3</text>
          <text x={groundB.x + 14} y={groundB.y + 28}>B</text>
          <text x={layout.secondary.x + 14} y={layout.secondary.y - 16}>J5</text>
          <text x={groundC.x + 12} y={groundC.y + 28}>C</text>
          <text x={layout.trace.x + 12} y={layout.trace.y - 12}>P</text>
        </g>
        <circle className="trace-point" cx={layout.trace.x} cy={layout.trace.y} r="7" />
      </svg>
      <div className="card-stats"><span>PLANE <b>XY</b></span><span>LINKS <b>6</b></span><span>LOOPS <b>2</b></span><span>TRACE <b>P</b></span><span>SOLVER <b>READY</b></span></div>
    </div>
  );
}

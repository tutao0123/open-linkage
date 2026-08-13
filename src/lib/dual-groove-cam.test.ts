import { describe, expect, it } from "vitest";

import {
  createDualGrooveCam,
  resampleClosedTargetCurve,
  solveDualGrooveCam,
} from "./dual-groove-cam";
import type { Point } from "./four-bar";

const TARGET: Point[] = [
  { x: -36, y: 4 },
  { x: -22, y: -25 },
  { x: -5, y: -12 },
  { x: 12, y: -34 },
  { x: 34, y: 2 },
  { x: 23, y: 29 },
  { x: -8, y: 37 },
  { x: -31, y: 22 },
];

function expectFinitePoint(point: Point) {
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
}

describe("dual-groove cam kinematics", () => {
  it("reproduces the equal-arc target samples over one complete cycle", () => {
    const sampleCount = 180;
    const target = resampleClosedTargetCurve(TARGET, sampleCount);
    const parameters = createDualGrooveCam(TARGET, { sampleCount });
    let squaredError = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      const solved = solveDualGrooveCam(parameters, (index / sampleCount) * 360);
      const dx = solved.crossSlide.drawingPoint.x - target[index].x;
      const dy = solved.crossSlide.drawingPoint.y - target[index].y;
      squaredError += dx * dx + dy * dy;
    }

    expect(Math.sqrt(squaredError / sampleCount)).toBeLessThan(1e-9);
  });

  it("is continuous at the 0/360-degree seam", () => {
    const parameters = createDualGrooveCam(TARGET, { sampleCount: 240 });
    const atZero = solveDualGrooveCam(parameters, 0);
    const atFullCycle = solveDualGrooveCam(parameters, 360);
    const beforeSeam = solveDualGrooveCam(parameters, 359.999);
    const afterSeam = solveDualGrooveCam(parameters, 0.001);

    expect(atFullCycle.crossSlide.drawingPoint.x).toBeCloseTo(atZero.crossSlide.drawingPoint.x, 12);
    expect(atFullCycle.crossSlide.drawingPoint.y).toBeCloseTo(atZero.crossSlide.drawingPoint.y, 12);
    expect(distance(beforeSeam.crossSlide.drawingPoint, afterSeam.crossSlide.drawingPoint)).toBeLessThan(0.01);
  });

  it("keeps both groove radii positive throughout the generated profiles", () => {
    const parameters = createDualGrooveCam(TARGET, { xBaseRadius: 16, yBaseRadius: 19 });
    const solved = solveDualGrooveCam(parameters, 127);

    for (const [law, cam] of [[parameters.xLaw, solved.cams.x], [parameters.yLaw, solved.cams.y]] as const) {
      for (const point of cam.groove) {
        expect(distance(point, cam.center)).toBeGreaterThanOrEqual(law.baseRadius - 1e-8);
      }
    }
  });

  it("returns finite follower, cross-slide, and SVG geometry across the cycle", () => {
    const parameters = createDualGrooveCam(TARGET, { sampleCount: 72 });
    expect(parameters.modelNote).toContain("not evaluated");

    for (let angle = 0; angle <= 360; angle += 7.5) {
      const solved = solveDualGrooveCam(parameters, angle);
      expectFinitePoint(solved.crossSlide.drawingPoint);
      expectFinitePoint(solved.xFollower.contactPoint);
      expectFinitePoint(solved.yFollower.contactPoint);
      solved.cams.x.groove.forEach(expectFinitePoint);
      solved.cams.y.groove.forEach(expectFinitePoint);
    }
  });
});

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

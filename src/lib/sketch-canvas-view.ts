import type { Point } from "./four-bar";

export function panSketchCanvas(
  current: Point,
  deltaPixels: Point,
  viewportPixels: { width: number; height: number },
  zoom: number,
): Point {
  const viewWidth = 540 / zoom;
  const viewHeight = 450 / zoom;
  return {
    x: current.x - deltaPixels.x * viewWidth / Math.max(1, viewportPixels.width),
    y: current.y - deltaPixels.y * viewHeight / Math.max(1, viewportPixels.height),
  };
}

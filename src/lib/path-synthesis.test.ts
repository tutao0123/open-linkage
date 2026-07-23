import { describe, expect, it } from "vitest";
import { resampleOpenPath } from "./path-synthesis";

describe("resampleOpenPath", () => {
  it("preserves both endpoints without adding a closing segment", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];

    const sampled = resampleOpenPath(points, 5);

    expect(sampled).toHaveLength(5);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled[4]).toEqual(points[2]);
    expect(sampled[1]).toEqual({ x: 5, y: 0 });
    expect(sampled[3]).toEqual({ x: 10, y: 5 });
  });
});

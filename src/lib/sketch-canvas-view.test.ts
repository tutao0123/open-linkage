import { describe, expect, it } from "vitest";

import { panSketchCanvas } from "./sketch-canvas-view";

describe("sketch canvas pan", () => {
  it("moves the view opposite to a middle-button drag", () => {
    expect(panSketchCanvas({ x: 0, y: 0 }, { x: 54, y: 45 }, { width: 540, height: 450 }, 1))
      .toEqual({ x: -54, y: -45 });
  });

  it("preserves the same screen-space drag feel at higher zoom", () => {
    expect(panSketchCanvas({ x: 10, y: -5 }, { x: 54, y: 45 }, { width: 540, height: 450 }, 2))
      .toEqual({ x: -17, y: -27.5 });
  });
});

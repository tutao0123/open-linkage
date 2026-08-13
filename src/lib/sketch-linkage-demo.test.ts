import { describe, expect, it } from "vitest";

import { PRECOMPUTED_SKETCH_CANDIDATES, precomputedCandidatesFor } from "./sketch-linkage-demo";

describe("precomputed sketch mechanism demo", () => {
  it("ships full-cycle four-bar and geared five-bar candidates without running the search", () => {
    expect(PRECOMPUTED_SKETCH_CANDIDATES).toHaveLength(4);
    expect(new Set(PRECOMPUTED_SKETCH_CANDIDATES.map((candidate) => candidate.family)))
      .toEqual(new Set(["four-bar", "geared-five-bar"]));
    for (const candidate of PRECOMPUTED_SKETCH_CANDIDATES) {
      expect(candidate.trajectory).toHaveLength(64);
      expect(candidate.trajectory.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
  });

  it("filters the fixed demo by mechanism family", () => {
    expect(precomputedCandidatesFor("four-bar").every((candidate) => candidate.family === "four-bar")).toBe(true);
    expect(precomputedCandidatesFor("geared-five-bar").every((candidate) => candidate.family === "geared-five-bar")).toBe(true);
  });
});

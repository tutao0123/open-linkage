/// <reference lib="webworker" />

import {
  fitMechanismFamiliesToSketch,
  type MechanismFamily,
  type SketchLinkageCandidate,
  type SketchLinkageProgress,
} from "@/lib/sketch-linkage";
import type { Point } from "@/lib/four-bar";

export type SketchLinkageWorkerRequest = {
  requestId: string;
  target: Point[];
  iterations?: number;
  families?: MechanismFamily[];
};

export type SketchLinkageWorkerResponse =
  | { type: "progress"; requestId: string; progress: SketchLinkageProgress }
  | { type: "result"; requestId: string; candidates: SketchLinkageCandidate[] }
  | { type: "error"; requestId: string; message: string };

self.onmessage = (event: MessageEvent<SketchLinkageWorkerRequest>) => {
  const request = event.data;
  try {
    const candidates = fitMechanismFamiliesToSketch(request.target, {
      iterations: request.iterations,
      families: request.families,
      onProgress: (progress) => self.postMessage({ type: "progress", requestId: request.requestId, progress } satisfies SketchLinkageWorkerResponse),
    });
    self.postMessage({ type: "result", requestId: request.requestId, candidates } satisfies SketchLinkageWorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "solver failed",
    } satisfies SketchLinkageWorkerResponse);
  }
};

export {};

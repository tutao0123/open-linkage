/// <reference lib="webworker" />

import {
  VariableLegSynthesisCancelled,
  synthesizeVariableLeg,
  type VariableLegSynthesisScope,
} from "@/lib/variable-leg-synthesis";
import { scanVariableLegAdjustmentFeasibility, type VariableLegProject } from "@/lib/variable-leg";

type StartMessage = { type: "start"; requestId: string; project: VariableLegProject; scope?: VariableLegSynthesisScope };
type FeasibilityMessage = { type: "feasibility"; requestId: string; project: VariableLegProject };
type CancelMessage = { type: "cancel"; requestId: string };

const cancelled = new Set<string>();

self.addEventListener("message", (event: MessageEvent<StartMessage | FeasibilityMessage | CancelMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  if (message.type === "feasibility") {
    const { requestId, project } = message;
    try {
      const feasibility = scanVariableLegAdjustmentFeasibility(project, 41, 36, 70);
      self.postMessage({ type: "feasibility-result", requestId, feasibility });
    } catch (error: unknown) {
      self.postMessage({ type: "error", requestId, message: error instanceof Error ? error.message : "可行范围检查失败" });
    }
    return;
  }
  const { requestId, project, scope } = message;
  cancelled.delete(requestId);
  void synthesizeVariableLeg(
    project,
    (progress) => self.postMessage({ type: "progress", requestId, progress }),
    () => cancelled.has(requestId),
    scope,
  ).then((candidates) => {
    self.postMessage({ type: "result", requestId, candidates });
  }).catch((error: unknown) => {
    if (error instanceof VariableLegSynthesisCancelled) {
      self.postMessage({ type: "cancelled", requestId });
    } else {
      self.postMessage({ type: "error", requestId, message: error instanceof Error ? error.message : "可变几何综合失败" });
    }
  }).finally(() => cancelled.delete(requestId));
});

export {};

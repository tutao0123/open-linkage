/// <reference lib="webworker" />

import {
  VariableLegSynthesisCancelled,
  synthesizeVariableLeg,
} from "@/lib/variable-leg-synthesis";
import type { VariableLegProject } from "@/lib/variable-leg";

type StartMessage = { type: "start"; requestId: string; project: VariableLegProject };
type CancelMessage = { type: "cancel"; requestId: string };

const cancelled = new Set<string>();

self.addEventListener("message", (event: MessageEvent<StartMessage | CancelMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  const { requestId, project } = message;
  cancelled.delete(requestId);
  void synthesizeVariableLeg(
    project,
    (progress) => self.postMessage({ type: "progress", requestId, progress }),
    () => cancelled.has(requestId),
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

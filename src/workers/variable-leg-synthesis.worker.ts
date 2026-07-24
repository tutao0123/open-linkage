/// <reference lib="webworker" />

import {
  VariableLegSynthesisCancelled,
  preflightGuidedDesign,
  synthesizeVariableLeg,
  synthesizeVariableLegGuidedDesign,
  type VariableLegWorkerRequest,
  type VariableLegWorkerResponse,
} from "../lib/variable-leg-synthesis";
import {
  previewVariableLegBarLength,
  previewVariableLegEditableParameter,
  scanVariableLegAdjustmentFeasibility,
  validateVariableLegKinematics,
} from "../lib/variable-leg";

type WorkerResponsePayload<T = VariableLegWorkerResponse> = T extends VariableLegWorkerResponse
  ? Omit<T, "requestId" | "runId" | "sourceRevisionId">
  : never;

const cancelled = new Set<string>();

function correlationFor(message: VariableLegWorkerRequest) {
  const projectRevisionId = "project" in message ? message.project.revisionId : undefined;
  return {
    requestId: message.requestId,
    runId: message.runId ?? message.requestId,
    sourceRevisionId: message.sourceRevisionId ?? projectRevisionId ?? "legacy",
  };
}

function postWorkerResponse(
  correlation: ReturnType<typeof correlationFor>,
  payload: WorkerResponsePayload,
) {
  self.postMessage({ ...correlation, ...payload } satisfies VariableLegWorkerResponse);
}

self.addEventListener("message", (event: MessageEvent<VariableLegWorkerRequest>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  const correlation = correlationFor(message);
  if (message.sourceRevisionId && message.project.revisionId
    && message.sourceRevisionId !== message.project.revisionId) {
    postWorkerResponse(correlation, {
      type: "error",
      message: "求解请求的源版本与项目快照不一致，结果已拒绝。",
    });
    return;
  }
  if (message.type === "feasibility") {
    const { project } = message;
    try {
      const feasibility = scanVariableLegAdjustmentFeasibility(project, 41, 36, 70);
      postWorkerResponse(correlation, { type: "feasibility-result", feasibility });
    } catch (error: unknown) {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "可行范围检查失败" });
    }
    return;
  }
  if (message.type === "bar-preview") {
    const { project, barId, requestedLength } = message;
    try {
      const preview = previewVariableLegBarLength(project, barId, requestedLength);
      postWorkerResponse(correlation, { type: "bar-preview-result", preview });
    } catch (error: unknown) {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "杆长草稿检查失败" });
    }
    return;
  }
  if (message.type === "parameter-preview") {
    const { project, parameter, requestedValue, bounds } = message;
    try {
      const preview = previewVariableLegEditableParameter(project, parameter, requestedValue, bounds);
      postWorkerResponse(correlation, { type: "parameter-preview-result", preview });
    } catch (error: unknown) {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "参数可行范围检查失败" });
    }
    return;
  }
  if (message.type === "project-check") {
    const { project, baselineProject } = message;
    try {
      postWorkerResponse(correlation, {
        type: "project-check-result",
        validation: validateVariableLegKinematics(project, 54, 80, baselineProject),
      });
    } catch (error: unknown) {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "整周可行性检查失败" });
    }
    return;
  }
  if (message.type === "guided-preflight") {
    const { project, request } = message;
    try {
      postWorkerResponse(correlation, {
        type: "guided-preflight-result",
        preflight: preflightGuidedDesign(project, request, {
          allowOfflineBaselineFallback: message.allowOfflineBaselineFallback,
        }),
      });
    } catch (error: unknown) {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "引导预检失败" });
    }
    return;
  }
  if (message.type === "guided-design") {
    const { requestId, project, request } = message;
    cancelled.delete(requestId);
    void synthesizeVariableLegGuidedDesign(
      project,
      request,
      (progress) => postWorkerResponse(correlation, { type: "progress", progress }),
      () => cancelled.has(requestId),
      { allowOfflineBaselineFallback: message.allowOfflineBaselineFallback },
    ).then((result) => {
      postWorkerResponse(correlation, { type: "guided-design-result", result });
    }).catch((error: unknown) => {
      if (error instanceof VariableLegSynthesisCancelled) postWorkerResponse(correlation, { type: "cancelled" });
      else postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "引导设计失败" });
    }).finally(() => cancelled.delete(requestId));
    return;
  }
  const { requestId, project, scope, refinementRequest, generationRequest } = message;
  cancelled.delete(requestId);
  void synthesizeVariableLeg(
    project,
    (progress) => postWorkerResponse(correlation, { type: "progress", progress }),
    () => cancelled.has(requestId),
    scope,
    refinementRequest,
    generationRequest,
  ).then((candidates) => {
    postWorkerResponse(correlation, { type: "result", candidates });
  }).catch((error: unknown) => {
    if (error instanceof VariableLegSynthesisCancelled) {
      postWorkerResponse(correlation, { type: "cancelled" });
    } else {
      postWorkerResponse(correlation, { type: "error", message: error instanceof Error ? error.message : "可变几何综合失败" });
    }
  }).finally(() => cancelled.delete(requestId));
});

export {};

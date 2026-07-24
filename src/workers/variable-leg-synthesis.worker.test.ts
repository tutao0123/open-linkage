import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneVariableLegProject, createDefaultVariableLegProject } from "../lib/variable-leg";
import type {
  VariableLegWorkerRequest,
  VariableLegWorkerResponse,
} from "../lib/variable-leg-synthesis";

let messageHandler: ((event: MessageEvent<VariableLegWorkerRequest>) => void) | undefined;
const postMessage = vi.fn<(message: VariableLegWorkerResponse) => void>();

beforeAll(async () => {
  vi.stubGlobal("self", {
    addEventListener: (
      type: string,
      handler: (event: MessageEvent<VariableLegWorkerRequest>) => void,
    ) => {
      if (type === "message") messageHandler = handler;
    },
    postMessage,
  });
  await import("./variable-leg-synthesis.worker");
});

beforeEach(() => {
  postMessage.mockClear();
});

function dispatch(message: VariableLegWorkerRequest) {
  if (!messageHandler) throw new Error("worker message handler was not registered");
  messageHandler({ data: message } as MessageEvent<VariableLegWorkerRequest>);
}

describe("variable-leg synthesis worker", () => {
  it("rejects a source-version mismatch with the complete correlation envelope", () => {
    const project = createDefaultVariableLegProject();
    dispatch({
      type: "start",
      requestId: "request-mismatch",
      runId: "run-mismatch",
      sourceRevisionId: "stale-revision",
      project,
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      requestId: "request-mismatch",
      runId: "run-mismatch",
      sourceRevisionId: "stale-revision",
      message: "求解请求的源版本与项目快照不一致，结果已拒绝。",
    });
  });

  it("returns an actionable error for an invalid refinement whitelist", async () => {
    const project = createDefaultVariableLegProject();
    dispatch({
      type: "start",
      requestId: "request-invalid",
      runId: "run-invalid",
      sourceRevisionId: project.revisionId,
      project,
      scope: "current-target",
      refinementRequest: {
        allowedParameterIds: [],
        selectedBarId: "missing-bar",
        modeIds: [],
      },
    });

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "error",
        requestId: "request-invalid",
        runId: "run-invalid",
        sourceRevisionId: project.revisionId,
        message: "精修杆件不存在：missing-bar",
      }));
    });
  });

  it("cancels a running refinement without mutating its project snapshot", async () => {
    const project = createDefaultVariableLegProject();
    const sourceSnapshot = cloneVariableLegProject(project);
    const selectedBar = project.baseProject.bars.find((bar) => bar.id !== project.baseProject.driverId)!;
    const requestId = "request-cancel";

    dispatch({
      type: "start",
      requestId,
      runId: "run-cancel",
      sourceRevisionId: project.revisionId,
      project,
      scope: "current-target",
      refinementRequest: {
        allowedParameterIds: [`bar-length:${selectedBar.id}`],
        selectedBarId: selectedBar.id,
        modeIds: [],
        iterations: 120,
      },
    });
    dispatch({ type: "cancel", requestId, runId: "run-cancel", sourceRevisionId: project.revisionId });

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "cancelled",
        requestId,
        runId: "run-cancel",
        sourceRevisionId: project.revisionId,
      });
    });
    expect(project).toEqual(sourceSnapshot);
    expect(postMessage.mock.calls.some(([message]) => message.type === "result")).toBe(false);
  });
});

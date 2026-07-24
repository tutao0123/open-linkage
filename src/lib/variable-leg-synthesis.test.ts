import { describe, expect, it } from "vitest";
import {
  cloneVariableLegProject,
  createDefaultVariableLegProject,
  createGuidedDesignRequest,
} from "./variable-leg";
import {
  createGuidedDesignSearchSeed,
  preflightGuidedDesign,
  refineVariableLeg,
  synthesizeVariableLeg,
  variableLegBarLengthParameterId,
  type VariableLegWorkerRequest,
  type VariableLegWorkerResponse,
} from "./variable-leg-synthesis";

describe("variable-leg synthesis protocol", () => {
  it("returns an unchanged candidate when refinement has no unlocked parameters", async () => {
    const project = createDefaultVariableLegProject();
    const sourceSnapshot = cloneVariableLegProject(project);
    const progressMessages: string[] = [];

    const candidates = await refineVariableLeg(
      project,
      { allowedParameterIds: [], modeIds: [], iterations: 2 },
      (progress) => progressMessages.push(progress.message),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].label).toBe("未修改候选");
    expect(candidates[0].baseProject).toEqual(sourceSnapshot.baseProject);
    expect(candidates[0].adjustment).toEqual(sourceSnapshot.adjustment);
    expect(candidates[0].modes).toEqual(sourceSnapshot.modes);
    expect(progressMessages.join(" ")).not.toContain("当前杆件");
    expect(project).toEqual(sourceSnapshot);
  });

  it("keeps topology and every locked parameter unchanged during selected-bar refinement", async () => {
    const project = createDefaultVariableLegProject();
    const sourceSnapshot = cloneVariableLegProject(project);
    const selectedBar = project.baseProject.bars.find((bar) => bar.id !== project.adjustment.targetId)!;

    const [candidate] = await refineVariableLeg(project, {
      allowedParameterIds: [variableLegBarLengthParameterId(selectedBar.id)],
      selectedBarId: selectedBar.id,
      modeIds: [],
      iterations: 6,
    });

    expect(candidate.topology).toBe(sourceSnapshot.topology);
    expect(candidate.baseProject.joints).toEqual(sourceSnapshot.baseProject.joints);
    expect(candidate.baseProject.bars.filter((bar) => bar.id !== selectedBar.id))
      .toEqual(sourceSnapshot.baseProject.bars.filter((bar) => bar.id !== selectedBar.id));
    expect(candidate.adjustment).toEqual(sourceSnapshot.adjustment);
    expect(candidate.modes).toEqual(sourceSnapshot.modes);
    expect(candidate.constraintEvaluation).toBeDefined();
    expect(project).toEqual(sourceSnapshot);
  });

  it("limits lock-value refinement to the requested modes", async () => {
    const project = createDefaultVariableLegProject();
    const sourceSnapshot = cloneVariableLegProject(project);
    const selectedModeId = project.modes[0].id;

    const [candidate] = await refineVariableLeg(project, {
      allowedParameterIds: [],
      modeIds: [selectedModeId],
      iterations: 6,
    });

    expect(candidate.baseProject).toEqual(sourceSnapshot.baseProject);
    expect(candidate.adjustment).toEqual(sourceSnapshot.adjustment);
    expect(candidate.modes.filter((mode) => mode.id !== selectedModeId))
      .toEqual(sourceSnapshot.modes.filter((mode) => mode.id !== selectedModeId));
    expect(project).toEqual(sourceSnapshot);
  });

  it("does not silently select an offline guided seed", () => {
    const project = createDefaultVariableLegProject();
    project.baseProject.joints = [];
    project.baseProject.bars = [];
    project.baseProject.tracers = [];
    const request = createGuidedDesignRequest(project, "cruise");

    const currentOnly = preflightGuidedDesign(project, request);
    const explicitFallback = preflightGuidedDesign(project, request, {
      allowOfflineBaselineFallback: true,
    });

    expect(currentOnly.currentGate.passed).toBe(false);
    expect(currentOnly.source).toBe("current");
    expect(currentOnly.message).toContain("回退未启用");
    expect(explicitFallback.source).toBe("safe-baseline");
  });

  it("builds guided seeds from the current mechanism geometry", () => {
    const project = createDefaultVariableLegProject();
    const editedBar = project.baseProject.bars.find((bar) => (
      bar.id !== project.baseProject.driverId && bar.id !== project.adjustment.targetId
    ))!;
    editedBar.length += 17.25;
    const sourceSnapshot = cloneVariableLegProject(project);
    const request = createGuidedDesignRequest(project, "cruise");

    const seed = createGuidedDesignSearchSeed(project, request, "recommended");

    expect(seed.baseProject.bars.find((bar) => bar.id === editedBar.id)?.length)
      .toBeCloseTo(editedBar.length, 8);
    expect(seed.topology).toBe(project.topology);
    expect(project).toEqual(sourceSnapshot);
  });

  it("keeps legacy synthesis calls non-mutating and attaches constraint evaluations", async () => {
    const project = createDefaultVariableLegProject();
    const sourceSnapshot = cloneVariableLegProject(project);

    const candidates = await synthesizeVariableLeg(project, undefined, () => false, "current-target");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].constraintEvaluation).toBeDefined();
    expect(project).toEqual(sourceSnapshot);
  });

  it("exports a correlated worker protocol for design runs", () => {
    const project = createDefaultVariableLegProject();
    const request = {
      type: "start",
      requestId: "request-1",
      runId: "run-1",
      sourceRevisionId: project.revisionId,
      project,
      scope: "current-target",
      refinementRequest: {
        allowedParameterIds: [],
        modeIds: [],
      },
    } satisfies VariableLegWorkerRequest;
    const response = {
      type: "result",
      requestId: request.requestId,
      runId: request.runId,
      sourceRevisionId: request.sourceRevisionId,
      candidates: [],
    } satisfies VariableLegWorkerResponse;

    expect(response).toMatchObject({
      requestId: "request-1",
      runId: "run-1",
      sourceRevisionId: project.revisionId,
    });
  });
});

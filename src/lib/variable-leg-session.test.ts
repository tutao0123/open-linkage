import { describe, expect, it } from "vitest";

import {
  MAX_VARIABLE_LEG_MAJOR_CHECKPOINTS,
  VariableLegSessionError,
  applyCandidate,
  clearCandidatePreview,
  createMajorCheckpoint,
  createSessionCheckpointId,
  createSessionRevisionId,
  createVariableLegSession,
  pinComparisonCandidate,
  recordDesignRun,
  renameMajorCheckpoint,
  replaceWorkingProject,
  restoreMajorCheckpoint,
  setCandidatePreview,
  unpinComparisonCandidate,
  type CandidateProjectMaterializer,
  type DesignRunInput,
  type SessionEvent,
  type VariableLegSession,
} from "./variable-leg-session";

type TestProject = {
  name: string;
  value: number;
  nested: { mode: string };
};

type TestCandidate = {
  id: string;
  project: TestProject;
};

type TestRequest = {
  target: number;
};

const materialize: CandidateProjectMaterializer<TestProject, TestCandidate, TestRequest> = (
  candidate,
) => candidate.project;

function event(sequence: number): SessionEvent {
  return { id: `event-${sequence}`, timestamp: 1_000 + sequence };
}

function createTestSession() {
  return createVariableLegSession<TestProject, TestCandidate, TestRequest>(
    { name: "baseline", value: 1, nested: { mode: "cruise" } },
    event(0),
    { initialCheckpointName: "Baseline" },
  );
}

function completedRun(
  session: VariableLegSession<TestProject, TestCandidate, TestRequest>,
  candidates: TestCandidate[],
  runId = "run-1",
): DesignRunInput<TestCandidate, TestRequest> {
  return {
    runId,
    requestId: `request-${runId}`,
    sourceRevisionId: session.revisionId,
    kind: "generation",
    status: "completed",
    request: { target: 10 },
    candidates,
    createdAt: 2_000,
    completedAt: 2_010,
  };
}

describe("variable leg design session", () => {
  it("records a generated run without changing the working baseline", () => {
    const session = createTestSession();
    const baseline = structuredClone(session.workingProject);
    const candidate: TestCandidate = {
      id: "candidate-1",
      project: { name: "candidate", value: 2, nested: { mode: "sprint" } },
    };

    const withRun = recordDesignRun(session, completedRun(session, [candidate]));
    candidate.project.value = 99;

    expect(withRun.workingProject).toEqual(baseline);
    expect(withRun.revisionId).toBe(session.revisionId);
    expect(withRun.versionHistory).toEqual(session.versionHistory);
    expect(withRun.designRuns[0].candidates[0].project.value).toBe(2);
    expect(session.designRuns).toEqual([]);
  });

  it("previews and clears a candidate without mutating or versioning the working project", () => {
    const session = createTestSession();
    const withRun = recordDesignRun(session, completedRun(session, [{
      id: "candidate-1",
      project: { name: "preview", value: 3, nested: { mode: "obstacle" } },
    }]));
    const preview = setCandidatePreview(
      withRun,
      { runId: "run-1", candidateId: "candidate-1" },
      materialize,
    );

    expect(preview.draftProject?.name).toBe("preview");
    expect(preview.workingProject).toEqual(withRun.workingProject);
    expect(preview.revisionId).toBe(withRun.revisionId);
    expect(preview.versionHistory).toEqual(withRun.versionHistory);
    expect(withRun.draftProject).toBeNull();
    expect(clearCandidatePreview(preview).draftProject).toBeNull();
  });

  it("applies a candidate as one revision and one major checkpoint transaction", () => {
    const session = createTestSession();
    const withRun = recordDesignRun(session, completedRun(session, [{
      id: "candidate-1",
      project: { name: "applied", value: 4, nested: { mode: "sprint" } },
    }]));
    const preview = setCandidatePreview(
      withRun,
      { runId: "run-1", candidateId: "candidate-1" },
      materialize,
    );
    const applied = applyCandidate(
      preview,
      { runId: "run-1", candidateId: "candidate-1" },
      materialize,
      event(1),
      { checkpointName: "Candidate 1" },
    );

    expect(applied.workingProject.name).toBe("applied");
    expect(applied.revisionId).toBe(createSessionRevisionId(event(1)));
    expect(applied.versionHistory).toHaveLength(preview.versionHistory.length + 1);
    expect(applied.versionHistory.at(-1)).toMatchObject({
      checkpointId: createSessionCheckpointId(event(1)),
      revisionId: createSessionRevisionId(event(1)),
      name: "Candidate 1",
      reason: "candidate-application",
    });
    expect(applied.draftProject).toBeNull();
    expect(applied.designRuns[0].stale).toBe(true);
    expect(preview.workingProject.name).toBe("baseline");
  });

  it("marks runs stale after a revision change and rejects stale application", () => {
    const session = createTestSession();
    const withRun = recordDesignRun(session, completedRun(session, [{
      id: "candidate-1",
      project: { name: "old result", value: 5, nested: { mode: "cruise" } },
    }]));
    const revised = replaceWorkingProject(
      withRun,
      { name: "edited", value: 6, nested: { mode: "obstacle" } },
      event(2),
    );

    expect(revised.designRuns[0].stale).toBe(true);
    expect(() => applyCandidate(
      revised,
      { runId: "run-1", candidateId: "candidate-1" },
      materialize,
      event(3),
    )).toThrowError(expect.objectContaining<Partial<VariableLegSessionError>>({
      code: "STALE_CANDIDATE",
    }));
    expect(revised.workingProject.name).toBe("edited");
    expect(withRun.designRuns[0].stale).toBe(false);
  });

  it("restores a checkpoint into a new revision and retains the restoration in history", () => {
    const initial = createTestSession();
    const withFirstRun = recordDesignRun(initial, completedRun(initial, [{
      id: "candidate-1",
      project: { name: "first", value: 7, nested: { mode: "sprint" } },
    }]));
    const first = applyCandidate(
      withFirstRun,
      { runId: "run-1", candidateId: "candidate-1" },
      materialize,
      event(4),
      { checkpointName: "First design" },
    );
    const withSecondRun = recordDesignRun(first, completedRun(first, [{
      id: "candidate-2",
      project: { name: "second", value: 8, nested: { mode: "obstacle" } },
    }], "run-2"));
    const second = applyCandidate(
      withSecondRun,
      { runId: "run-2", candidateId: "candidate-2" },
      materialize,
      event(5),
      { checkpointName: "Second design" },
    );
    const firstCheckpoint = first.versionHistory.at(-1)!;
    const restored = restoreMajorCheckpoint(
      second,
      firstCheckpoint.checkpointId,
      event(6),
    );

    expect(restored.workingProject).toEqual(first.workingProject);
    expect(restored.revisionId).toBe(createSessionRevisionId(event(6)));
    expect(restored.versionHistory).toHaveLength(second.versionHistory.length + 1);
    expect(restored.versionHistory.at(-1)).toMatchObject({
      reason: "restore",
      restoredFromCheckpointId: firstCheckpoint.checkpointId,
    });
    expect(second.workingProject.name).toBe("second");
  });

  it("pins no more than three candidates and allows a slot to be reused", () => {
    const session = createTestSession();
    const withRun = recordDesignRun(session, completedRun(
      session,
      [1, 2, 3, 4].map((value) => ({
        id: `candidate-${value}`,
        project: { name: `candidate ${value}`, value, nested: { mode: "cruise" } },
      })),
    ));
    const firstThree = [1, 2, 3].reduce(
      (current, value) => pinComparisonCandidate(current, {
        runId: "run-1",
        candidateId: `candidate-${value}`,
      }),
      withRun,
    );

    expect(firstThree.comparisonSelection).toHaveLength(3);
    expect(pinComparisonCandidate(firstThree, firstThree.comparisonSelection[0])).toBe(firstThree);
    expect(() => pinComparisonCandidate(firstThree, {
      runId: "run-1",
      candidateId: "candidate-4",
    })).toThrowError(expect.objectContaining<Partial<VariableLegSessionError>>({
      code: "COMPARISON_LIMIT",
    }));

    const withOpenSlot = unpinComparisonCandidate(firstThree, {
      runId: "run-1",
      candidateId: "candidate-2",
    });
    const repinned = pinComparisonCandidate(withOpenSlot, {
      runId: "run-1",
      candidateId: "candidate-4",
    });
    expect(repinned.comparisonSelection.map((item) => item.candidateId))
      .toEqual(["candidate-1", "candidate-3", "candidate-4"]);
  });

  it("keeps the newest twenty named major checkpoints", () => {
    let session = createTestSession();
    for (let index = 1; index <= 22; index += 1) {
      session = createMajorCheckpoint(session, `Checkpoint ${index}`, event(100 + index));
    }

    expect(session.versionHistory).toHaveLength(MAX_VARIABLE_LEG_MAJOR_CHECKPOINTS);
    expect(session.versionHistory[0].name).toBe("Checkpoint 3");
    const latest = session.versionHistory.at(-1)!;
    const renamed = renameMajorCheckpoint(session, latest.checkpointId, "  Final design  ");
    expect(renamed.versionHistory.at(-1)?.name).toBe("Final design");
    expect(session.versionHistory.at(-1)?.name).toBe("Checkpoint 22");
  });
});

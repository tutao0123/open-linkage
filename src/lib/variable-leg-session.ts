export const MAX_VARIABLE_LEG_COMPARISON_CANDIDATES = 3;
export const MAX_VARIABLE_LEG_MAJOR_CHECKPOINTS = 20;

export type SessionEvent = Readonly<{
  id: string;
  timestamp: number;
}>;

export type CandidateReference = Readonly<{
  runId: string;
  candidateId: string;
}>;

export type IdentifiedCandidate = {
  id: string;
};

export type DesignRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type DesignRunKind = "generation" | "refinement" | "legacy";

export type DesignRun<TCandidate extends IdentifiedCandidate, TRequest = unknown> = {
  runId: string;
  requestId?: string;
  sourceRevisionId: string;
  kind: DesignRunKind;
  status: DesignRunStatus;
  request?: TRequest;
  candidates: TCandidate[];
  parentRunId?: string;
  createdAt: number;
  completedAt?: number;
  stale: boolean;
  error?: string;
};

export type DesignRunInput<TCandidate extends IdentifiedCandidate, TRequest = unknown> =
  Omit<DesignRun<TCandidate, TRequest>, "stale"> & { stale?: boolean };

export type MajorCheckpointReason = "initial" | "manual" | "candidate-application" | "restore";

export type MajorCheckpoint<TProject> = {
  checkpointId: string;
  revisionId: string;
  name: string;
  createdAt: number;
  project: TProject;
  reason: MajorCheckpointReason;
  candidate?: CandidateReference;
  restoredFromCheckpointId?: string;
};

export type VariableLegSession<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
> = {
  revisionId: string;
  workingProject: TProject;
  draftProject: TProject | null;
  draftSource: CandidateReference | null;
  designRuns: Array<DesignRun<TCandidate, TRequest>>;
  comparisonSelection: CandidateReference[];
  versionHistory: Array<MajorCheckpoint<TProject>>;
};

export type CandidateProjectMaterializer<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
> = (
  candidate: TCandidate,
  workingProject: TProject,
  run: DesignRun<TCandidate, TRequest>,
) => TProject;

export type VariableLegSessionErrorCode =
  | "INVALID_EVENT"
  | "DUPLICATE_REVISION"
  | "DUPLICATE_RUN"
  | "DUPLICATE_CANDIDATE"
  | "RUN_NOT_FOUND"
  | "RUN_NOT_APPLICABLE"
  | "CANDIDATE_NOT_FOUND"
  | "STALE_CANDIDATE"
  | "COMPARISON_LIMIT"
  | "CHECKPOINT_NOT_FOUND"
  | "DUPLICATE_CHECKPOINT"
  | "INVALID_CHECKPOINT_NAME";

export class VariableLegSessionError extends Error {
  constructor(
    public readonly code: VariableLegSessionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VariableLegSessionError";
  }
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function validateEvent(event: SessionEvent) {
  if (!event.id.trim() || !Number.isFinite(event.timestamp)) {
    throw new VariableLegSessionError(
      "INVALID_EVENT",
      "A session event requires a non-empty id and a finite timestamp.",
    );
  }
}

function normalizeCheckpointName(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    throw new VariableLegSessionError(
      "INVALID_CHECKPOINT_NAME",
      "A major checkpoint requires a non-empty name.",
    );
  }
  return normalized;
}

export function createSessionRevisionId(event: SessionEvent) {
  validateEvent(event);
  return `revision:${event.timestamp}:${event.id}`;
}

export function createSessionCheckpointId(event: SessionEvent) {
  validateEvent(event);
  return `checkpoint:${event.timestamp}:${event.id}`;
}

function sameCandidateReference(first: CandidateReference, second: CandidateReference) {
  return first.runId === second.runId && first.candidateId === second.candidateId;
}

function appendCheckpoint<TProject>(
  history: Array<MajorCheckpoint<TProject>>,
  checkpoint: MajorCheckpoint<TProject>,
) {
  if (history.some((item) => item.checkpointId === checkpoint.checkpointId)) {
    throw new VariableLegSessionError(
      "DUPLICATE_CHECKPOINT",
      `Checkpoint "${checkpoint.checkpointId}" already exists.`,
    );
  }
  return [...history, checkpoint].slice(-MAX_VARIABLE_LEG_MAJOR_CHECKPOINTS);
}

function findRun<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  runId: string,
) {
  const run = session.designRuns.find((item) => item.runId === runId);
  if (!run) {
    throw new VariableLegSessionError("RUN_NOT_FOUND", `Design run "${runId}" was not found.`);
  }
  return run;
}

function findCandidate<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  reference: CandidateReference,
) {
  const run = findRun(session, reference.runId);
  const candidate = run.candidates.find((item) => item.id === reference.candidateId);
  if (!candidate) {
    throw new VariableLegSessionError(
      "CANDIDATE_NOT_FOUND",
      `Candidate "${reference.candidateId}" was not found in run "${reference.runId}".`,
    );
  }
  return { run, candidate };
}

function assertNewRevision<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  event: SessionEvent,
) {
  const revisionId = createSessionRevisionId(event);
  if (revisionId === session.revisionId) {
    throw new VariableLegSessionError(
      "DUPLICATE_REVISION",
      `Revision "${revisionId}" is already current.`,
    );
  }
  return revisionId;
}

function materializeCandidate<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  run: DesignRun<TCandidate, TRequest>,
  candidate: TCandidate,
  materializer: CandidateProjectMaterializer<TProject, TCandidate, TRequest>,
) {
  return cloneValue(materializer(
    cloneValue(candidate),
    cloneValue(session.workingProject),
    cloneValue(run),
  ));
}

export function createVariableLegSession<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  project: TProject,
  event: SessionEvent,
  options: { initialCheckpointName?: string } = {},
): VariableLegSession<TProject, TCandidate, TRequest> {
  const revisionId = createSessionRevisionId(event);
  const checkpointId = createSessionCheckpointId(event);
  const workingProject = cloneValue(project);
  const initialCheckpoint: MajorCheckpoint<TProject> = {
    checkpointId,
    revisionId,
    name: normalizeCheckpointName(options.initialCheckpointName ?? "Initial project"),
    createdAt: event.timestamp,
    project: cloneValue(workingProject),
    reason: "initial",
  };
  return {
    revisionId,
    workingProject,
    draftProject: null,
    draftSource: null,
    designRuns: [],
    comparisonSelection: [],
    versionHistory: [initialCheckpoint],
  };
}

export function recordDesignRun<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  input: DesignRunInput<TCandidate, TRequest>,
): VariableLegSession<TProject, TCandidate, TRequest> {
  if (session.designRuns.some((run) => run.runId === input.runId)) {
    throw new VariableLegSessionError("DUPLICATE_RUN", `Design run "${input.runId}" already exists.`);
  }
  const candidateIds = input.candidates.map((candidate) => candidate.id);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new VariableLegSessionError(
      "DUPLICATE_CANDIDATE",
      `Design run "${input.runId}" contains duplicate candidate ids.`,
    );
  }
  const run = cloneValue({
    ...input,
    stale: Boolean(input.stale || input.sourceRevisionId !== session.revisionId),
  }) as DesignRun<TCandidate, TRequest>;
  return {
    ...session,
    designRuns: [...session.designRuns, run],
  };
}

export function markDesignRunsStaleByRevision<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  currentRevisionId = session.revisionId,
): VariableLegSession<TProject, TCandidate, TRequest> {
  let changed = false;
  const designRuns = session.designRuns.map((run) => {
    const stale = run.stale || run.sourceRevisionId !== currentRevisionId;
    if (stale === run.stale) return run;
    changed = true;
    return { ...run, stale };
  });
  return changed ? { ...session, designRuns } : session;
}

export function replaceWorkingProject<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  project: TProject,
  event: SessionEvent,
): VariableLegSession<TProject, TCandidate, TRequest> {
  const revisionId = assertNewRevision(session, event);
  return markDesignRunsStaleByRevision({
    ...session,
    revisionId,
    workingProject: cloneValue(project),
    draftProject: null,
    draftSource: null,
  }, revisionId);
}

export function setCandidatePreview<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  reference: CandidateReference,
  materializer: CandidateProjectMaterializer<TProject, TCandidate, TRequest>,
): VariableLegSession<TProject, TCandidate, TRequest> {
  const { run, candidate } = findCandidate(session, reference);
  return {
    ...session,
    draftProject: materializeCandidate(session, run, candidate, materializer),
    draftSource: { ...reference },
  };
}

export function clearCandidatePreview<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
): VariableLegSession<TProject, TCandidate, TRequest> {
  if (!session.draftProject && !session.draftSource) return session;
  return {
    ...session,
    draftProject: null,
    draftSource: null,
  };
}

export function applyCandidate<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  reference: CandidateReference,
  materializer: CandidateProjectMaterializer<TProject, TCandidate, TRequest>,
  event: SessionEvent,
  options: { checkpointName?: string } = {},
): VariableLegSession<TProject, TCandidate, TRequest> {
  const { run, candidate } = findCandidate(session, reference);
  if (run.stale || run.sourceRevisionId !== session.revisionId) {
    throw new VariableLegSessionError(
      "STALE_CANDIDATE",
      `Candidate "${reference.candidateId}" was generated from an outdated project revision.`,
    );
  }
  if (run.status !== "completed") {
    throw new VariableLegSessionError(
      "RUN_NOT_APPLICABLE",
      `Design run "${run.runId}" is "${run.status}" and cannot be applied.`,
    );
  }

  const revisionId = assertNewRevision(session, event);
  const checkpointId = createSessionCheckpointId(event);
  const usesCurrentDraft = Boolean(
    session.draftProject
    && session.draftSource
    && sameCandidateReference(session.draftSource, reference),
  );
  const workingProject = usesCurrentDraft
    ? cloneValue(session.draftProject as TProject)
    : materializeCandidate(session, run, candidate, materializer);
  const checkpoint: MajorCheckpoint<TProject> = {
    checkpointId,
    revisionId,
    name: normalizeCheckpointName(options.checkpointName ?? `Applied ${candidate.id}`),
    createdAt: event.timestamp,
    project: cloneValue(workingProject),
    reason: "candidate-application",
    candidate: { ...reference },
  };
  const applied = {
    ...session,
    revisionId,
    workingProject,
    draftProject: null,
    draftSource: null,
    versionHistory: appendCheckpoint(session.versionHistory, checkpoint),
  };
  return markDesignRunsStaleByRevision(applied, revisionId);
}

export function pinComparisonCandidate<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  reference: CandidateReference,
): VariableLegSession<TProject, TCandidate, TRequest> {
  findCandidate(session, reference);
  if (session.comparisonSelection.some((item) => sameCandidateReference(item, reference))) {
    return session;
  }
  if (session.comparisonSelection.length >= MAX_VARIABLE_LEG_COMPARISON_CANDIDATES) {
    throw new VariableLegSessionError(
      "COMPARISON_LIMIT",
      `At most ${MAX_VARIABLE_LEG_COMPARISON_CANDIDATES} candidates can be pinned for comparison.`,
    );
  }
  return {
    ...session,
    comparisonSelection: [...session.comparisonSelection, { ...reference }],
  };
}

export function unpinComparisonCandidate<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  reference: CandidateReference,
): VariableLegSession<TProject, TCandidate, TRequest> {
  const comparisonSelection = session.comparisonSelection.filter(
    (item) => !sameCandidateReference(item, reference),
  );
  return comparisonSelection.length === session.comparisonSelection.length
    ? session
    : { ...session, comparisonSelection };
}

export function createMajorCheckpoint<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  name: string,
  event: SessionEvent,
): VariableLegSession<TProject, TCandidate, TRequest> {
  const checkpoint: MajorCheckpoint<TProject> = {
    checkpointId: createSessionCheckpointId(event),
    revisionId: session.revisionId,
    name: normalizeCheckpointName(name),
    createdAt: event.timestamp,
    project: cloneValue(session.workingProject),
    reason: "manual",
  };
  return {
    ...session,
    versionHistory: appendCheckpoint(session.versionHistory, checkpoint),
  };
}

export function renameMajorCheckpoint<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  checkpointId: string,
  name: string,
): VariableLegSession<TProject, TCandidate, TRequest> {
  const checkpointIndex = session.versionHistory.findIndex(
    (checkpoint) => checkpoint.checkpointId === checkpointId,
  );
  if (checkpointIndex < 0) {
    throw new VariableLegSessionError(
      "CHECKPOINT_NOT_FOUND",
      `Checkpoint "${checkpointId}" was not found.`,
    );
  }
  const versionHistory = [...session.versionHistory];
  versionHistory[checkpointIndex] = {
    ...versionHistory[checkpointIndex],
    name: normalizeCheckpointName(name),
  };
  return { ...session, versionHistory };
}

export function restoreMajorCheckpoint<
  TProject,
  TCandidate extends IdentifiedCandidate,
  TRequest = unknown,
>(
  session: VariableLegSession<TProject, TCandidate, TRequest>,
  checkpointId: string,
  event: SessionEvent,
  options: { checkpointName?: string } = {},
): VariableLegSession<TProject, TCandidate, TRequest> {
  const source = session.versionHistory.find(
    (checkpoint) => checkpoint.checkpointId === checkpointId,
  );
  if (!source) {
    throw new VariableLegSessionError(
      "CHECKPOINT_NOT_FOUND",
      `Checkpoint "${checkpointId}" was not found.`,
    );
  }
  const revisionId = assertNewRevision(session, event);
  const workingProject = cloneValue(source.project);
  const restoredCheckpoint: MajorCheckpoint<TProject> = {
    checkpointId: createSessionCheckpointId(event),
    revisionId,
    name: normalizeCheckpointName(options.checkpointName ?? `Restored ${source.name}`),
    createdAt: event.timestamp,
    project: cloneValue(workingProject),
    reason: "restore",
    restoredFromCheckpointId: source.checkpointId,
  };
  const restored = {
    ...session,
    revisionId,
    workingProject,
    draftProject: null,
    draftSource: null,
    versionHistory: appendCheckpoint(session.versionHistory, restoredCheckpoint),
  };
  return markDesignRunsStaleByRevision(restored, revisionId);
}

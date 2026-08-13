import type { VariableLegProject } from "./variable-leg";
import type {
  DesignRun,
  IdentifiedCandidate,
  MajorCheckpoint,
} from "./variable-leg-session";
import { getAuthenticatedSupabaseClient } from "./supabase/auth";

export const VARIABLE_LEG_CLOUD_PROJECT_KEY = "open-linkage:variable-leg-cloud-project:v1";
export const VARIABLE_LEG_CLOUD_REVISION_KEY = "open-linkage:variable-leg-cloud-revision:v2";
export const VARIABLE_LEG_CLOUD_OWNER_KEY = "open-linkage:variable-leg-cloud-owner:v1";

/** Project syncing is intentionally opt-in while entitlements are designed. */
export function isVariableLegProjectCloudSyncEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_VARIABLE_LEG_CLOUD_SYNC === "true";
}

export type VariableLegCloudStatus =
  | "local-only"
  | "connecting"
  | "synced"
  | "saving"
  | "conflict"
  | "unavailable";

export type VariableLegCloudSnapshot = {
  projectId: string;
  name: string;
  document: unknown;
  revisionId: string;
  currentVersionId: string | null;
  updatedAt: string;
  versionHistory: unknown[];
  designRuns: unknown[];
};

export type CloudBootstrapAction =
  | "create"
  | "aligned"
  | "upload-local"
  | "load-remote"
  | "conflict";

type StorageLike = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

function randomProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (digit) => (
    Number(digit) ^ Math.floor(Math.random() * 16) >> Number(digit) / 4
  ).toString(16));
}

export function getOrCreateVariableLegCloudProjectId(
  storage: StorageLike,
  createId: () => string = randomProjectId,
) {
  const existing = storage.getItem(VARIABLE_LEG_CLOUD_PROJECT_KEY)?.trim();
  if (existing) return existing;
  const projectId = createId();
  storage.setItem(VARIABLE_LEG_CLOUD_PROJECT_KEY, projectId);
  return projectId;
}

export function getLastSyncedVariableLegRevision(storage: StorageLike) {
  return storage.getItem(VARIABLE_LEG_CLOUD_REVISION_KEY)?.trim() || null;
}

export function rememberSyncedVariableLegRevision(storage: StorageLike, revisionId: string) {
  storage.setItem(VARIABLE_LEG_CLOUD_REVISION_KEY, revisionId);
}

function clearSyncedVariableLegRevision(storage: StorageLike) {
  if (storage.removeItem) storage.removeItem(VARIABLE_LEG_CLOUD_REVISION_KEY);
  else storage.setItem(VARIABLE_LEG_CLOUD_REVISION_KEY, "");
}

export function resolveVariableLegCloudBootstrap(
  localRevisionId: string,
  lastSyncedRevisionId: string | null,
  remoteRevisionId: string | null,
): CloudBootstrapAction {
  if (!remoteRevisionId) return "create";
  if (localRevisionId === remoteRevisionId) return "aligned";
  if (lastSyncedRevisionId === remoteRevisionId) return "upload-local";
  // A missing tab-local baseline is not proof that the local project is empty.
  // Keep both versions and require an explicit choice in the UI instead of
  // silently replacing a project after storage was cleared or a new tab opened.
  if (!lastSyncedRevisionId) return "conflict";
  if (lastSyncedRevisionId === localRevisionId) return "load-remote";
  return "conflict";
}

async function requireCloudClient() {
  return getAuthenticatedSupabaseClient();
}

export async function prepareVariableLegCloudIdentity(storage: StorageLike) {
  const supabase = await requireCloudClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("cloud_user_missing");

  const previousOwnerId = storage.getItem(VARIABLE_LEG_CLOUD_OWNER_KEY)?.trim() || null;
  let projectId = storage.getItem(VARIABLE_LEG_CLOUD_PROJECT_KEY)?.trim() || null;
  if (previousOwnerId && previousOwnerId !== userId) {
    projectId = null;
    clearSyncedVariableLegRevision(storage);
  }
  if (!projectId) {
    projectId = randomProjectId();
    storage.setItem(VARIABLE_LEG_CLOUD_PROJECT_KEY, projectId);
  }
  storage.setItem(VARIABLE_LEG_CLOUD_OWNER_KEY, userId);
  return { supabase, userId, projectId };
}

export async function loadVariableLegCloudSnapshot(projectId: string) {
  const supabase = await requireCloudClient();
  const { data, error } = await supabase.rpc("get_variable_leg_snapshot", {
    p_project_id: projectId,
  });

  if (error) throw error;
  const project = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (!project) return null;
  const versionHistory = Array.isArray(project.version_history) ? project.version_history : [];
  const designRuns = Array.isArray(project.design_runs) ? project.design_runs : [];
  return {
    projectId: project.project_id as string,
    name: project.name as string,
    document: project.document,
    revisionId: project.revision_id as string,
    currentVersionId: project.current_version_id as string | null,
    updatedAt: project.updated_at as string,
    versionHistory,
    designRuns,
  } satisfies VariableLegCloudSnapshot;
}

function serializableRuns<TCandidate extends IdentifiedCandidate, TRequest>(
  designRuns: Array<DesignRun<TCandidate, TRequest>>,
) {
  return designRuns.map((value) => {
    const { stale, ...run } = value;
    void stale;
    return run;
  });
}

export async function saveVariableLegCloudSnapshot<
  TCandidate extends IdentifiedCandidate,
  TRequest,
>(input: {
  projectId: string;
  expectedRevisionId: string | null;
  name?: string;
  project: VariableLegProject;
  versionHistory: Array<MajorCheckpoint<VariableLegProject>>;
  designRuns: Array<DesignRun<TCandidate, TRequest>>;
}) {
  const supabase = await requireCloudClient();
  const { data, error } = await supabase.rpc("save_variable_leg_snapshot", {
    p_project_id: input.projectId,
    p_expected_revision_id: input.expectedRevisionId,
    p_name: input.name ?? "可变几何步行腿",
    p_document: input.project,
    p_revision_id: input.project.revisionId,
    p_current_version_id: input.project.currentVersionId,
    p_versions: input.versionHistory,
    p_design_runs: serializableRuns(input.designRuns),
  });

  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : null;
  return {
    projectId: (saved?.project_id as string | undefined) ?? input.projectId,
    revisionId: (saved?.revision_id as string | undefined) ?? input.project.revisionId,
    updatedAt: (saved?.updated_at as string | undefined) ?? new Date().toISOString(),
  };
}

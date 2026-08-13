import { describe, expect, it } from "vitest";

import {
  getOrCreateVariableLegCloudProjectId,
  resolveVariableLegCloudBootstrap,
} from "./variable-leg-cloud";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("variable leg cloud binding", () => {
  it("creates one stable project id per browser storage", () => {
    const storage = memoryStorage();
    expect(getOrCreateVariableLegCloudProjectId(storage, () => "project-a")).toBe("project-a");
    expect(getOrCreateVariableLegCloudProjectId(storage, () => "project-b")).toBe("project-a");
  });

  it("resolves local-first bootstrap without silently overwriting conflicts", () => {
    expect(resolveVariableLegCloudBootstrap("local", null, null)).toBe("create");
    expect(resolveVariableLegCloudBootstrap("same", "same", "same")).toBe("aligned");
    expect(resolveVariableLegCloudBootstrap("local-new", "remote", "remote")).toBe("upload-local");
    expect(resolveVariableLegCloudBootstrap("local", "local", "remote-new")).toBe("load-remote");
    expect(resolveVariableLegCloudBootstrap("local", null, "remote")).toBe("conflict");
    expect(resolveVariableLegCloudBootstrap("local-new", "common", "remote-new")).toBe("conflict");
  });
});

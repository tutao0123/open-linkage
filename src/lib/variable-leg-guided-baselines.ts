import baselineData from "../data/variable-leg-guided-baselines.json";

import {
  createDefaultAdjustment,
  createDefaultModes,
  createDefaultVariableLegProject,
  getVariableLegTemplate,
  type GuidedDesignScenario,
  type VariableLegProject,
  type VariableLegTopology,
} from "./variable-leg";

type BaselineSeed = {
  topology: VariableLegTopology;
  scenario: GuidedDesignScenario;
  adjustmentKind: "moving-pivot";
  adjustmentTarget: string;
  adjustmentValue: number;
};

const data = baselineData as unknown as {
  version: number;
  phaseCount: number;
  seeds: Record<string, BaselineSeed>;
};

export function createGuidedSafeBaseline(topology: VariableLegTopology, scenario: GuidedDesignScenario): VariableLegProject {
  const seed = data.seeds[`${topology}:${scenario}`];
  if (!seed) throw new Error(`缺少 ${topology}/${scenario} 离线安全基线`);
  const project = createDefaultVariableLegProject();
  project.topology = topology;
  project.baseProject = getVariableLegTemplate(topology);
  project.adjustment = { ...createDefaultAdjustment(topology, seed.adjustmentKind), targetId: seed.adjustmentTarget };
  project.modes = createDefaultModes().map((mode) => mode.id === scenario ? { ...mode, adjustmentValue: seed.adjustmentValue } : mode);
  project.activeModeId = scenario;
  project.candidates = [];
  project.selectedCandidateId = null;
  return project;
}

export function guidedSafeBaselineMetadata() {
  return { version: data.version, phaseCount: data.phaseCount, seedCount: Object.keys(data.seeds).length };
}

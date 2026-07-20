import baselineData from "../data/variable-leg-baselines.json";

import type {
  VariableLegEditableParameter,
  VariableLegFeasibleInterval,
  VariableLegProject,
} from "./variable-leg";

type BaselineParameter = {
  kind: VariableLegEditableParameter["kind"];
  targetId: string;
  axis?: "x" | "y" | null;
  baseline: number;
  intervals: VariableLegFeasibleInterval[];
};

type BaselineTopology = {
  referenceLength: number;
  parameters: Record<string, BaselineParameter>;
};

const data = baselineData as unknown as {
  version: number;
  generatedAt: string;
  topologies: Record<string, BaselineTopology>;
};

function parameterKey(parameter: VariableLegEditableParameter) {
  return parameter.kind === "bar-length"
    ? `bar:${parameter.targetId}`
    : `joint:${parameter.targetId}:${parameter.axis}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function getVariableLegBaselineBounds(
  project: VariableLegProject,
  parameter: VariableLegEditableParameter,
): VariableLegFeasibleInterval[] {
  const topology = data.topologies[project.topology];
  const baseline = topology?.parameters[parameterKey(parameter)];
  if (!topology || !baseline?.intervals.length) return [];
  if (parameter.kind === "bar-length") {
    const current = project.baseProject.bars.find((bar) => bar.id === parameter.targetId)?.length;
    if (!current) return [];
    return baseline.intervals.map((interval) => ({
      minimum: Math.max(1, current * interval.minimum),
      maximum: Math.max(1, current * interval.maximum),
    }));
  }
  const current = project.baseProject.joints.find((joint) => joint.id === parameter.targetId)?.[parameter.axis];
  if (current === undefined) return [];
  const currentReference = median(project.baseProject.bars
    .filter((bar) => bar.id !== project.baseProject.driverId)
    .map((bar) => bar.length));
  return baseline.intervals.map((interval) => ({
    minimum: current + interval.minimum * currentReference,
    maximum: current + interval.maximum * currentReference,
  }));
}

export function variableLegBaselineMetadata() {
  return { version: data.version, generatedAt: data.generatedAt };
}

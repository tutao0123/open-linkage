import { describe, expect, it } from "vitest";

import {
  DEFAULT_VARIABLE_LEG_LIMITS,
  isVariableLegUsageLimitsEnabled,
  usageMessage,
  type VariableLegUsageDecision,
} from "./variable-leg-entitlements";

describe("variable leg entitlements", () => {
  it("keeps plan-based usage limits disabled by default", () => {
    expect(isVariableLegUsageLimitsEnabled()).toBe(false);
  });

  it("starts with small free-tier daily limits", () => {
    expect(DEFAULT_VARIABLE_LEG_LIMITS).toEqual({ generation: 3, refinement: 1 });
  });

  it("explains blocked free usage", () => {
    const decision: VariableLegUsageDecision = {
      allowed: false,
      plan: "free",
      used: 3,
      limit: 3,
      remaining: 0,
    };
    expect(usageMessage("generation", decision)).toContain("今日免费生成额度已用完");
  });

  it("does not show a finite limit for paid users", () => {
    const decision: VariableLegUsageDecision = {
      allowed: true,
      plan: "paid",
      used: 10,
      limit: null,
      remaining: null,
    };
    expect(usageMessage("refinement", decision)).toContain("付费档不限次数");
  });
});

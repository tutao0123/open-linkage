import { getAuthenticatedSupabaseClient } from "./supabase/auth";

export type VariableLegUsageFeature = "generation" | "refinement";
export type VariableLegPlan = "free" | "paid";

export type VariableLegUsageDecision = {
  allowed: boolean;
  plan: VariableLegPlan;
  used: number;
  limit: number | null;
  remaining: number | null;
};

export const DEFAULT_VARIABLE_LEG_LIMITS: Record<VariableLegUsageFeature, number> = {
  generation: 3,
  refinement: 1,
};

/**
 * Plan-based usage limits are intentionally dormant for the current public
 * release. Keeping this as an explicit flag lets us restore metering later
 * without changing the design workflow again.
 */
export function isVariableLegUsageLimitsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_VARIABLE_LEG_USAGE_LIMITS === "true";
}

export function usageMessage(
  feature: VariableLegUsageFeature,
  decision: VariableLegUsageDecision,
) {
  const label = feature === "generation" ? "生成" : "精修";
  if (decision.plan === "paid" || decision.limit === null) {
    return `${label}额度已验证：付费档不限次数。`;
  }
  if (!decision.allowed) {
    return `今日免费${label}额度已用完（${decision.limit} 次）；升级后可继续使用。`;
  }
  return `本次${label}已计入免费额度，今日还可使用 ${decision.remaining ?? 0} 次。`;
}

/**
 * Atomically consumes one server-side daily quota unit. If Supabase is not
 * configured (for example, a local offline build), the design tool remains
 * usable and the caller can treat the result as an unmetered local session.
 */
export async function consumeVariableLegUsage(feature: VariableLegUsageFeature): Promise<VariableLegUsageDecision> {
  const supabase = await getAuthenticatedSupabaseClient();
  const { data, error } = await supabase.rpc("consume_variable_leg_usage", {
    p_feature: feature,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (!row) throw new Error("usage_decision_missing");
  return {
    allowed: row.allowed === true,
    plan: row.plan === "paid" ? "paid" : "free",
    used: typeof row.used === "number" ? row.used : 0,
    limit: typeof row.limit === "number" ? row.limit : null,
    remaining: typeof row.remaining === "number" ? row.remaining : null,
  };
}

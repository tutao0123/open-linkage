import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "./client";

let authenticatedClientPromise: Promise<SupabaseClient> | null = null;

/**
 * Establishes the invisible anonymous identity used for free-tier quotas.
 * The promise is shared so simultaneous synthesis/refinement actions cannot
 * create multiple anonymous users in the same browser tab.
 */
export function getAuthenticatedSupabaseClient() {
  if (authenticatedClientPromise) return authenticatedClientPromise;

  authenticatedClientPromise = (async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("cloud_not_configured");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) return supabase;

    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return supabase;
  })().catch((error: unknown) => {
    authenticatedClientPromise = null;
    throw error;
  });

  return authenticatedClientPromise;
}

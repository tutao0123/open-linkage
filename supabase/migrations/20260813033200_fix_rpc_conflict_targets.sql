-- PL/pgSQL output columns named project_id can make conflict targets
-- ambiguous. Use the concrete primary-key constraints in the deployed body.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'save_variable_leg_snapshot'
    and pg_get_function_identity_arguments(p.oid) = 'p_project_id uuid, p_expected_revision_id text, p_name text, p_document jsonb, p_revision_id text, p_current_version_id text, p_versions jsonb, p_design_runs jsonb';
  if v_definition is null then raise exception 'function_not_found'; end if;
  v_definition := replace(v_definition, 'on conflict (project_id, checkpoint_id) do nothing', 'on conflict on constraint variable_leg_versions_pkey do nothing');
  v_definition := replace(v_definition, 'on conflict (project_id, run_id) do nothing', 'on conflict on constraint variable_leg_design_runs_pkey do nothing');
  execute v_definition;
end;
$$;

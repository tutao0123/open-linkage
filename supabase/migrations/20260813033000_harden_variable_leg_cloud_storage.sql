-- Keep cloud project tables read-only from the browser. All writes go through
-- the authenticated, expected-revision RPC below.
revoke all on table public.variable_leg_projects from public, anon, authenticated;
revoke all on table public.variable_leg_versions from public, anon, authenticated;
revoke all on table public.variable_leg_design_runs from public, anon, authenticated;
grant select on table public.variable_leg_projects to authenticated;
grant select on table public.variable_leg_versions to authenticated;
grant select on table public.variable_leg_design_runs to authenticated;

create index if not exists variable_leg_versions_project_owner_idx
  on public.variable_leg_versions (project_id, owner_id);

create index if not exists variable_leg_design_runs_project_owner_idx
  on public.variable_leg_design_runs (project_id, owner_id);

create or replace function public.save_variable_leg_snapshot(
  p_project_id uuid,
  p_expected_revision_id text,
  p_name text,
  p_document jsonb,
  p_revision_id text,
  p_current_version_id text,
  p_versions jsonb default '[]'::jsonb,
  p_design_runs jsonb default '[]'::jsonb
)
returns table (
  project_id uuid,
  revision_id text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_existing_revision_id text;
  v_existing_name text;
  v_updated_at timestamptz;
  v_name text := left(coalesce(nullif(btrim(coalesce(p_name, '')), ''), '可变几何步行腿'), 120);
begin
  if v_owner_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_project_id is null
    or nullif(btrim(coalesce(p_revision_id, '')), '') is null
    or nullif(btrim(coalesce(p_current_version_id, '')), '') is null
    or p_document is null
    or jsonb_typeof(p_document) is distinct from 'object'
    or p_document ->> 'version' is distinct from '3'
    or p_document ->> 'mechanismType' is distinct from 'variable-geometry-leg'
    or p_document ->> 'revisionId' is distinct from p_revision_id
    or p_document ->> 'currentVersionId' is distinct from p_current_version_id then
    raise exception 'invalid_variable_leg_document' using errcode = '22023';
  end if;

  if jsonb_typeof(p_versions) is distinct from 'array'
    or jsonb_typeof(p_design_runs) is distinct from 'array' then
    raise exception 'invalid_variable_leg_history' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_versions) as version_items (item)
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'checkpointId') is distinct from 'string'
      or nullif(btrim(item ->> 'checkpointId'), '') is null
      or jsonb_typeof(item -> 'revisionId') is distinct from 'string'
      or nullif(btrim(item ->> 'revisionId'), '') is null
      or jsonb_typeof(item -> 'name') is distinct from 'string'
      or nullif(btrim(item ->> 'name'), '') is null
      or item ->> 'reason' not in ('initial', 'manual', 'candidate-application', 'restore')
      or jsonb_typeof(item -> 'project') is distinct from 'object'
      or item -> 'project' ->> 'version' is distinct from '3'
      or item -> 'project' ->> 'mechanismType' is distinct from 'variable-geometry-leg'
      or item -> 'project' ->> 'revisionId' is distinct from item ->> 'revisionId'
      or jsonb_typeof(item -> 'createdAt') is distinct from 'number'
  ) then
    raise exception 'invalid_variable_leg_version_item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_design_runs) as run_items (item)
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'runId') is distinct from 'string'
      or nullif(btrim(item ->> 'runId'), '') is null
      or jsonb_typeof(item -> 'sourceRevisionId') is distinct from 'string'
      or nullif(btrim(item ->> 'sourceRevisionId'), '') is null
      or item ->> 'kind' not in ('generation', 'refinement', 'legacy')
      or item ->> 'status' not in ('pending', 'running', 'completed', 'failed', 'cancelled')
      or jsonb_typeof(item -> 'candidates') is distinct from 'array'
      or jsonb_typeof(item -> 'createdAt') is distinct from 'number'
      or (item ? 'completedAt' and item -> 'completedAt' is not null
        and jsonb_typeof(item -> 'completedAt') is distinct from 'number')
  ) then
    raise exception 'invalid_variable_leg_design_run_item' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(p_versions) as version_items (item)
    where item ->> 'checkpointId' = p_current_version_id
  ) and not exists (
    select 1
    from public.variable_leg_versions as version
    where version.project_id = p_project_id
      and version.owner_id = v_owner_id
      and version.checkpoint_id = p_current_version_id
  ) then
    raise exception 'invalid_current_version' using errcode = '22023';
  end if;

  if p_expected_revision_id is null then
    insert into public.variable_leg_projects (
      id, owner_id, name, document_version, document, revision_id,
      current_version_id, updated_at
    ) values (
      p_project_id, v_owner_id, v_name, 3, p_document, p_revision_id,
      p_current_version_id, now()
    ) on conflict (id) do nothing;

    if not found then
      select project.revision_id, project.name, project.updated_at
      into v_existing_revision_id, v_existing_name, v_updated_at
      from public.variable_leg_projects as project
      where project.id = p_project_id and project.owner_id = v_owner_id;

      if v_existing_revision_id is distinct from p_revision_id
        or v_existing_name is distinct from v_name
        or not exists (
          select 1 from public.variable_leg_projects as project
          where project.id = p_project_id and project.owner_id = v_owner_id
            and project.document = p_document
            and project.current_version_id is not distinct from p_current_version_id
        ) then
        raise exception 'cloud_revision_conflict' using errcode = '40001';
      end if;
    end if;
  elsif p_expected_revision_id = p_revision_id then
    select project.updated_at
    into v_updated_at
    from public.variable_leg_projects as project
    where project.id = p_project_id and project.owner_id = v_owner_id
      and project.revision_id = p_revision_id
      and project.name = v_name
      and project.document = p_document
      and project.current_version_id is not distinct from p_current_version_id
    for update;

    if not found then
      raise exception 'cloud_revision_conflict' using errcode = '40001';
    end if;
  else
    update public.variable_leg_projects as project
    set name = v_name,
        document_version = 3,
        document = p_document,
        revision_id = p_revision_id,
        current_version_id = p_current_version_id,
        updated_at = now()
    where project.id = p_project_id
      and project.owner_id = v_owner_id
      and project.revision_id = p_expected_revision_id;

    if not found then
      select project.revision_id, project.name, project.updated_at
      into v_existing_revision_id, v_existing_name, v_updated_at
      from public.variable_leg_projects as project
      where project.id = p_project_id and project.owner_id = v_owner_id;

      if v_existing_revision_id is distinct from p_revision_id
        or v_existing_name is distinct from v_name
        or not exists (
          select 1 from public.variable_leg_projects as project
          where project.id = p_project_id and project.owner_id = v_owner_id
            and project.document = p_document
            and project.current_version_id is not distinct from p_current_version_id
        ) then
        raise exception 'cloud_revision_conflict' using errcode = '40001';
      end if;
    end if;
  end if;

  insert into public.variable_leg_versions (
    project_id, owner_id, checkpoint_id, revision_id, name, reason,
    snapshot, candidate_ref, restored_from_checkpoint_id, created_at
  )
  select
    p_project_id, v_owner_id, item ->> 'checkpointId', item ->> 'revisionId',
    left(item ->> 'name', 120), item ->> 'reason', item -> 'project',
    case when jsonb_typeof(item -> 'candidate') = 'object' then item -> 'candidate' else null end,
    nullif(item ->> 'restoredFromCheckpointId', ''),
    to_timestamp((item ->> 'createdAt')::double precision / 1000.0)
  from jsonb_array_elements(p_versions) as version_items (item)
  on conflict on constraint variable_leg_versions_pkey do nothing;

  if exists (
    select 1
    from jsonb_array_elements(p_versions) as version_items (item)
    join public.variable_leg_versions as version
      on version.project_id = p_project_id
     and version.owner_id = v_owner_id
     and version.checkpoint_id = item ->> 'checkpointId'
    where version.revision_id is distinct from item ->> 'revisionId'
      or version.name is distinct from left(item ->> 'name', 120)
      or version.reason is distinct from item ->> 'reason'
      or version.snapshot is distinct from item -> 'project'
      or version.candidate_ref is distinct from case
        when jsonb_typeof(item -> 'candidate') = 'object' then item -> 'candidate' else null end
      or version.restored_from_checkpoint_id is distinct from nullif(item ->> 'restoredFromCheckpointId', '')
      or version.created_at is distinct from to_timestamp((item ->> 'createdAt')::double precision / 1000.0)
  ) then
    raise exception 'cloud_version_conflict' using errcode = '40001';
  end if;

  if not exists (
    select 1 from public.variable_leg_versions as version
    where version.project_id = p_project_id
      and version.owner_id = v_owner_id
      and version.checkpoint_id = p_current_version_id
  ) then
    raise exception 'invalid_current_version' using errcode = '22023';
  end if;

  insert into public.variable_leg_design_runs (
    project_id, owner_id, run_id, request_id, source_revision_id, kind,
    status, request, candidates, parent_run_id, created_at, completed_at, error
  )
  select
    p_project_id, v_owner_id, item ->> 'runId', nullif(item ->> 'requestId', ''),
    item ->> 'sourceRevisionId', item ->> 'kind', item ->> 'status',
    case when item ? 'request' then item -> 'request' else null end,
    item -> 'candidates', nullif(item ->> 'parentRunId', ''),
    to_timestamp((item ->> 'createdAt')::double precision / 1000.0),
    case when item ? 'completedAt' and item -> 'completedAt' is not null
      then to_timestamp((item ->> 'completedAt')::double precision / 1000.0) else null end,
    nullif(item ->> 'error', '')
  from jsonb_array_elements(p_design_runs) as run_items (item)
  on conflict on constraint variable_leg_design_runs_pkey do nothing;

  if exists (
    select 1
    from jsonb_array_elements(p_design_runs) as run_items (item)
    join public.variable_leg_design_runs as run
      on run.project_id = p_project_id
     and run.owner_id = v_owner_id
     and run.run_id = item ->> 'runId'
    where run.request_id is distinct from nullif(item ->> 'requestId', '')
      or run.source_revision_id is distinct from item ->> 'sourceRevisionId'
      or run.kind is distinct from item ->> 'kind'
      or run.status is distinct from item ->> 'status'
      or run.request is distinct from case when item ? 'request' then item -> 'request' else null end
      or run.candidates is distinct from item -> 'candidates'
      or run.parent_run_id is distinct from nullif(item ->> 'parentRunId', '')
      or run.created_at is distinct from to_timestamp((item ->> 'createdAt')::double precision / 1000.0)
      or run.completed_at is distinct from case
        when item ? 'completedAt' and item -> 'completedAt' is not null
          then to_timestamp((item ->> 'completedAt')::double precision / 1000.0) else null end
      or run.error is distinct from nullif(item ->> 'error', '')
  ) then
    raise exception 'cloud_design_run_conflict' using errcode = '40001';
  end if;

  select project.updated_at
  into v_updated_at
  from public.variable_leg_projects as project
  where project.id = p_project_id and project.owner_id = v_owner_id;

  return query select p_project_id, p_revision_id, v_updated_at;
end;
$$;

revoke all on function public.save_variable_leg_snapshot(
  uuid, text, text, jsonb, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_variable_leg_snapshot(
  uuid, text, text, jsonb, text, text, jsonb, jsonb
) to authenticated;

create or replace function public.get_variable_leg_snapshot(p_project_id uuid)
returns table (
  project_id uuid,
  name text,
  document jsonb,
  revision_id text,
  current_version_id text,
  updated_at timestamptz,
  version_history jsonb,
  design_runs jsonb
)
language sql
security definer
set search_path = ''
as $$
select
  project.id,
  project.name,
  project.document,
  project.revision_id,
  project.current_version_id,
  project.updated_at,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'checkpointId', version.checkpoint_id,
      'revisionId', version.revision_id,
      'name', version.name,
      'reason', version.reason,
      'project', version.snapshot,
      'candidate', version.candidate_ref,
      'restoredFromCheckpointId', version.restored_from_checkpoint_id,
      'createdAt', (extract(epoch from version.created_at) * 1000)::bigint
    ) order by version.created_at asc), '[]'::jsonb),
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'runId', run.run_id,
      'requestId', run.request_id,
      'sourceRevisionId', run.source_revision_id,
      'kind', run.kind,
      'status', run.status,
      'request', run.request,
      'candidates', run.candidates,
      'parentRunId', run.parent_run_id,
      'createdAt', (extract(epoch from run.created_at) * 1000)::bigint,
      'completedAt', case when run.completed_at is null then null else (extract(epoch from run.completed_at) * 1000)::bigint end,
      'error', run.error
    ) order by run.created_at asc), '[]'::jsonb)
from public.variable_leg_projects as project
where project.id = p_project_id
  and project.owner_id = auth.uid();
$$;

revoke all on function public.get_variable_leg_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_variable_leg_snapshot(uuid) to authenticated;

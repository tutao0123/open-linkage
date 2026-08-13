create table public.variable_leg_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '可变几何步行腿',
  document_version smallint not null default 3,
  document jsonb not null,
  revision_id text not null,
  current_version_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variable_leg_projects_owner_key unique (id, owner_id),
  constraint variable_leg_projects_name_length check (char_length(name) between 1 and 120),
  constraint variable_leg_projects_document_version check (document_version = 3),
  constraint variable_leg_projects_document_shape check (
    jsonb_typeof(document) = 'object'
    and document ->> 'version' = '3'
    and document ->> 'mechanismType' = 'variable-geometry-leg'
  )
);

create table public.variable_leg_versions (
  project_id uuid not null,
  owner_id uuid not null,
  checkpoint_id text not null,
  revision_id text not null,
  name text not null,
  reason text not null,
  snapshot jsonb not null,
  candidate_ref jsonb,
  restored_from_checkpoint_id text,
  created_at timestamptz not null,
  primary key (project_id, checkpoint_id),
  constraint variable_leg_versions_project_owner_fkey
    foreign key (project_id, owner_id)
    references public.variable_leg_projects (id, owner_id)
    on delete cascade,
  constraint variable_leg_versions_reason check (
    reason in ('initial', 'manual', 'candidate-application', 'restore')
  ),
  constraint variable_leg_versions_snapshot_shape check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'version' = '3'
    and snapshot ->> 'mechanismType' = 'variable-geometry-leg'
  )
);

create table public.variable_leg_design_runs (
  project_id uuid not null,
  owner_id uuid not null,
  run_id text not null,
  request_id text,
  source_revision_id text not null,
  kind text not null,
  status text not null,
  request jsonb,
  candidates jsonb not null default '[]'::jsonb,
  parent_run_id text,
  created_at timestamptz not null,
  completed_at timestamptz,
  error text,
  primary key (project_id, run_id),
  constraint variable_leg_design_runs_project_owner_fkey
    foreign key (project_id, owner_id)
    references public.variable_leg_projects (id, owner_id)
    on delete cascade,
  constraint variable_leg_design_runs_kind check (
    kind in ('generation', 'refinement', 'legacy')
  ),
  constraint variable_leg_design_runs_status check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  constraint variable_leg_design_runs_candidates_array check (
    jsonb_typeof(candidates) = 'array'
  )
);

create index variable_leg_projects_owner_updated_idx
  on public.variable_leg_projects (owner_id, updated_at desc);

create index variable_leg_versions_owner_project_created_idx
  on public.variable_leg_versions (owner_id, project_id, created_at desc);

create index variable_leg_design_runs_owner_project_created_idx
  on public.variable_leg_design_runs (owner_id, project_id, created_at desc);

alter table public.variable_leg_projects enable row level security;
alter table public.variable_leg_versions enable row level security;
alter table public.variable_leg_design_runs enable row level security;

create policy variable_leg_projects_select_own
  on public.variable_leg_projects
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy variable_leg_versions_select_own
  on public.variable_leg_versions
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy variable_leg_design_runs_select_own
  on public.variable_leg_design_runs
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select on public.variable_leg_projects to authenticated;
grant select on public.variable_leg_versions to authenticated;
grant select on public.variable_leg_design_runs to authenticated;

revoke all on public.variable_leg_projects from anon;
revoke all on public.variable_leg_versions from anon;
revoke all on public.variable_leg_design_runs from anon;

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
  v_updated_at timestamptz := now();
begin
  if v_owner_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_document) <> 'object'
    or p_document ->> 'version' <> '3'
    or p_document ->> 'mechanismType' <> 'variable-geometry-leg'
    or p_document ->> 'revisionId' <> p_revision_id
    or p_document ->> 'currentVersionId' is distinct from p_current_version_id then
    raise exception 'invalid_variable_leg_document' using errcode = '22023';
  end if;

  if jsonb_typeof(p_versions) <> 'array'
    or jsonb_typeof(p_design_runs) <> 'array' then
    raise exception 'invalid_variable_leg_history' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_versions) as version_items (item)
    where jsonb_typeof(item) <> 'object'
      or not (item ?& array['checkpointId', 'revisionId', 'name', 'reason', 'project', 'createdAt'])
      or item ->> 'reason' not in ('initial', 'manual', 'candidate-application', 'restore')
      or jsonb_typeof(item -> 'project') <> 'object'
      or item -> 'project' ->> 'version' <> '3'
      or item -> 'project' ->> 'mechanismType' <> 'variable-geometry-leg'
      or (item ->> 'createdAt') !~ '^[0-9]+(?:\\.[0-9]+)?$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_design_runs) as run_items (item)
    where jsonb_typeof(item) <> 'object'
      or not (item ?& array['runId', 'sourceRevisionId', 'kind', 'status', 'candidates', 'createdAt'])
      or item ->> 'kind' not in ('generation', 'refinement', 'legacy')
      or item ->> 'status' not in ('pending', 'running', 'completed', 'failed', 'cancelled')
      or jsonb_typeof(item -> 'candidates') <> 'array'
      or (item ->> 'createdAt') !~ '^[0-9]+(?:\\.[0-9]+)?$'
      or (item ? 'completedAt' and (item ->> 'completedAt') !~ '^[0-9]+(?:\\.[0-9]+)?$')
  ) then
    raise exception 'invalid_variable_leg_history_item' using errcode = '22023';
  end if;

  if p_expected_revision_id is null then
    insert into public.variable_leg_projects (
      id,
      owner_id,
      name,
      document_version,
      document,
      revision_id,
      current_version_id,
      updated_at
    ) values (
      p_project_id,
      v_owner_id,
      left(coalesce(nullif(btrim(p_name), ''), '可变几何步行腿'), 120),
      3,
      p_document,
      p_revision_id,
      p_current_version_id,
      v_updated_at
    )
    on conflict (id) do nothing;

    if not found then
      select project.revision_id, project.updated_at
      into v_existing_revision_id, v_updated_at
      from public.variable_leg_projects as project
      where project.id = p_project_id
        and project.owner_id = v_owner_id;

      if v_existing_revision_id is distinct from p_revision_id
        or not exists (
          select 1
          from public.variable_leg_projects as project
          where project.id = p_project_id
            and project.owner_id = v_owner_id
            and project.document = p_document
            and project.current_version_id is not distinct from p_current_version_id
        ) then
        raise exception 'cloud_revision_conflict' using errcode = '40001';
      end if;
    end if;
  else
    if p_expected_revision_id = p_revision_id then
      select project.updated_at
      into v_updated_at
      from public.variable_leg_projects as project
      where project.id = p_project_id
        and project.owner_id = v_owner_id
        and project.revision_id = p_revision_id
        and project.document = p_document
        and project.current_version_id is not distinct from p_current_version_id;

      if not found then
        raise exception 'cloud_revision_conflict' using errcode = '40001';
      end if;
    else
      update public.variable_leg_projects as project
      set name = left(coalesce(nullif(btrim(p_name), ''), project.name), 120),
          document_version = 3,
          document = p_document,
          revision_id = p_revision_id,
          current_version_id = p_current_version_id,
          updated_at = v_updated_at
      where project.id = p_project_id
        and project.owner_id = v_owner_id
        and project.revision_id = p_expected_revision_id;

      if not found then
        select project.revision_id, project.updated_at
        into v_existing_revision_id, v_updated_at
        from public.variable_leg_projects as project
        where project.id = p_project_id
          and project.owner_id = v_owner_id;

        if v_existing_revision_id is distinct from p_revision_id
          or not exists (
            select 1
            from public.variable_leg_projects as project
            where project.id = p_project_id
              and project.owner_id = v_owner_id
              and project.document = p_document
              and project.current_version_id is not distinct from p_current_version_id
          ) then
          raise exception 'cloud_revision_conflict' using errcode = '40001';
        end if;
      end if;
    end if;
  end if;

  insert into public.variable_leg_versions (
    project_id,
    owner_id,
    checkpoint_id,
    revision_id,
    name,
    reason,
    snapshot,
    candidate_ref,
    restored_from_checkpoint_id,
    created_at
  )
  select
    p_project_id,
    v_owner_id,
    item ->> 'checkpointId',
    item ->> 'revisionId',
    left(coalesce(nullif(item ->> 'name', ''), '版本'), 120),
    item ->> 'reason',
    item -> 'project',
    case when jsonb_typeof(item -> 'candidate') = 'object' then item -> 'candidate' else null end,
    nullif(item ->> 'restoredFromCheckpointId', ''),
    to_timestamp((item ->> 'createdAt')::double precision / 1000.0)
  from jsonb_array_elements(p_versions) as version_items (item)
  on conflict (project_id, checkpoint_id) do nothing;

  if exists (
    select 1
    from jsonb_array_elements(p_versions) as version_items (item)
    join public.variable_leg_versions as version
      on version.project_id = p_project_id
      and version.owner_id = v_owner_id
      and version.checkpoint_id = version_items.item ->> 'checkpointId'
    where version.revision_id is distinct from version_items.item ->> 'revisionId'
      or version.name is distinct from left(coalesce(nullif(version_items.item ->> 'name', ''), '版本'), 120)
      or version.reason is distinct from version_items.item ->> 'reason'
      or version.snapshot is distinct from version_items.item -> 'project'
      or version.candidate_ref is distinct from case
        when jsonb_typeof(version_items.item -> 'candidate') = 'object' then version_items.item -> 'candidate'
        else null
      end
      or version.restored_from_checkpoint_id is distinct from nullif(version_items.item ->> 'restoredFromCheckpointId', '')
  ) then
    raise exception 'cloud_version_conflict' using errcode = '40001';
  end if;

  insert into public.variable_leg_design_runs (
    project_id,
    owner_id,
    run_id,
    request_id,
    source_revision_id,
    kind,
    status,
    request,
    candidates,
    parent_run_id,
    created_at,
    completed_at,
    error
  )
  select
    p_project_id,
    v_owner_id,
    item ->> 'runId',
    nullif(item ->> 'requestId', ''),
    item ->> 'sourceRevisionId',
    item ->> 'kind',
    item ->> 'status',
    case when item ? 'request' then item -> 'request' else null end,
    case when jsonb_typeof(item -> 'candidates') = 'array' then item -> 'candidates' else '[]'::jsonb end,
    nullif(item ->> 'parentRunId', ''),
    to_timestamp((item ->> 'createdAt')::double precision / 1000.0),
    case
      when item ? 'completedAt'
        then to_timestamp((item ->> 'completedAt')::double precision / 1000.0)
      else null
    end,
    nullif(item ->> 'error', '')
  from jsonb_array_elements(p_design_runs) as run_items (item)
  on conflict (project_id, run_id) do update
  set request_id = excluded.request_id,
      source_revision_id = excluded.source_revision_id,
      kind = excluded.kind,
      status = excluded.status,
      request = excluded.request,
      candidates = excluded.candidates,
      parent_run_id = excluded.parent_run_id,
      completed_at = excluded.completed_at,
      error = excluded.error;

  return query
  select p_project_id, p_revision_id, v_updated_at;
end;
$$;

revoke all on function public.save_variable_leg_snapshot(
  uuid,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb
) from public;

revoke all on function public.save_variable_leg_snapshot(
  uuid,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb
) from anon;

grant execute on function public.save_variable_leg_snapshot(
  uuid,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;

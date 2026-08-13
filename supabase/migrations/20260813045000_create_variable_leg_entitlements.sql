-- User-level access and daily usage. Anonymous Auth users are intentional:
-- they receive the free tier without a login screen and can later be linked
-- to a real account without changing user_id.
create table public.variable_leg_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  feature_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint variable_leg_entitlements_plan check (plan in ('free', 'paid')),
  constraint variable_leg_entitlements_status check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  constraint variable_leg_entitlements_overrides_object check (jsonb_typeof(feature_overrides) = 'object')
);

create table public.variable_leg_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  generation_count integer not null default 0,
  refinement_count integer not null default 0,
  primary key (user_id, usage_date),
  constraint variable_leg_usage_generation_nonnegative check (generation_count >= 0),
  constraint variable_leg_usage_refinement_nonnegative check (refinement_count >= 0)
);

alter table public.variable_leg_entitlements enable row level security;
alter table public.variable_leg_usage_daily enable row level security;

create policy variable_leg_entitlements_select_own
  on public.variable_leg_entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy variable_leg_usage_daily_select_own
  on public.variable_leg_usage_daily
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.variable_leg_entitlements from public, anon, authenticated;
revoke all on table public.variable_leg_usage_daily from public, anon, authenticated;
grant select on table public.variable_leg_entitlements to authenticated;
grant select on table public.variable_leg_usage_daily to authenticated;

create or replace function public.consume_variable_leg_usage(p_feature text)
returns table (
  allowed boolean,
  plan text,
  used integer,
  "limit" integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_override jsonb := '{}'::jsonb;
  v_limit integer;
  v_used integer;
  v_generation_count integer;
  v_refinement_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_feature not in ('generation', 'refinement') then
    raise exception 'invalid_usage_feature' using errcode = '22023';
  end if;

  select entitlement.plan, entitlement.feature_overrides
  into v_plan, v_override
  from public.variable_leg_entitlements as entitlement
  where entitlement.user_id = v_user_id;

  if v_plan is null then v_plan := 'free'; end if;
  if v_plan = 'paid' then
    return query select true, 'paid'::text, 0, null::integer, null::integer;
    return;
  end if;

  v_limit := case
    when p_feature = 'generation' then 3
    else 1
  end;
  if jsonb_typeof(v_override) = 'object'
    and jsonb_typeof(v_override -> (p_feature || 'PerDay')) = 'number' then
    v_limit := greatest(0, (v_override ->> (p_feature || 'PerDay'))::integer);
  end if;

  insert into public.variable_leg_usage_daily (user_id, usage_date)
  values (v_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select usage.generation_count, usage.refinement_count
  into v_generation_count, v_refinement_count
  from public.variable_leg_usage_daily as usage
  where usage.user_id = v_user_id and usage.usage_date = current_date
  for update;

  v_used := case when p_feature = 'generation' then v_generation_count else v_refinement_count end;
  if v_used >= v_limit then
    return query select false, 'free'::text, v_used, v_limit, 0;
    return;
  end if;

  update public.variable_leg_usage_daily as usage
  set generation_count = case when p_feature = 'generation' then usage.generation_count + 1 else usage.generation_count end,
      refinement_count = case when p_feature = 'refinement' then usage.refinement_count + 1 else usage.refinement_count end
  where usage.user_id = v_user_id and usage.usage_date = current_date;

  return query select true, 'free'::text, v_used + 1, v_limit, greatest(0, v_limit - v_used - 1);
end;
$$;

revoke all on function public.consume_variable_leg_usage(text) from public, anon, authenticated;
grant execute on function public.consume_variable_leg_usage(text) to authenticated;

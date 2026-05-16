-- ============================================================================
-- user_credits: daily + bonus credit system for Deep Analysis
-- ============================================================================
-- daily_credits_remaining resets every midnight UTC (lazy via RPC + nightly job).
-- bonus_credits never expire and are consumed only after daily credits run out.
-- The caller (backend) decides daily_limit (2 for FREE, 20 for PRO).

create table if not exists public.user_credits (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  daily_credits_remaining  int not null default 2,
  daily_reset_at           timestamptz not null
                             default ((date_trunc('day', timezone('UTC', now())) + interval '1 day')
                                      at time zone 'UTC'),
  bonus_credits            int not null default 0,
  updated_at               timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.user_credits enable row level security;

drop policy if exists "Users can view own credits" on public.user_credits;
create policy "Users can view own credits"
  on public.user_credits
  for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for the anon/authenticated role.
-- All writes go through SECURITY DEFINER RPCs below or the service-role key.

-- ── RPC: consume_credit ────────────────────────────────────────────────────
-- Atomically consumes one credit (daily first, then bonus). Lazy-resets the
-- daily counter if daily_reset_at has elapsed. Returns the new balance and
-- whether the consumption was allowed.
create or replace function public.consume_credit(p_user_id uuid, p_daily_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         public.user_credits;
  v_now         timestamptz := now();
  v_next_reset  timestamptz := (date_trunc('day', timezone('UTC', v_now)) + interval '1 day')
                                at time zone 'UTC';
begin
  -- Ensure a row exists for this user
  insert into public.user_credits (user_id, daily_credits_remaining, daily_reset_at, bonus_credits)
  values (p_user_id, p_daily_limit, v_next_reset, 0)
  on conflict (user_id) do nothing;

  -- Lock the row for this transaction
  select * into v_row from public.user_credits where user_id = p_user_id for update;

  -- Lazy daily reset
  if v_row.daily_reset_at <= v_now then
    v_row.daily_credits_remaining := p_daily_limit;
    v_row.daily_reset_at          := v_next_reset;
  end if;

  -- Consume: daily first, then bonus
  if v_row.daily_credits_remaining > 0 then
    v_row.daily_credits_remaining := v_row.daily_credits_remaining - 1;
  elsif v_row.bonus_credits > 0 then
    v_row.bonus_credits := v_row.bonus_credits - 1;
  else
    return jsonb_build_object(
      'allowed', false,
      'daily_remaining', v_row.daily_credits_remaining,
      'bonus_remaining', v_row.bonus_credits
    );
  end if;

  update public.user_credits set
    daily_credits_remaining = v_row.daily_credits_remaining,
    bonus_credits           = v_row.bonus_credits,
    daily_reset_at          = v_row.daily_reset_at,
    updated_at              = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'allowed', true,
    'daily_remaining', v_row.daily_credits_remaining,
    'bonus_remaining', v_row.bonus_credits
  );
end;
$$;

-- ── RPC: refund_credit ─────────────────────────────────────────────────────
-- Used to roll back a credit when the Haiku call fails after consumption.
-- Refunds to bonus_credits if daily is already at its cap; otherwise to daily.
create or replace function public.refund_credit(p_user_id uuid, p_daily_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_credits;
  v_now timestamptz := now();
begin
  select * into v_row from public.user_credits where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('refunded', false);
  end if;

  if v_row.daily_credits_remaining < p_daily_limit then
    v_row.daily_credits_remaining := v_row.daily_credits_remaining + 1;
  else
    v_row.bonus_credits := v_row.bonus_credits + 1;
  end if;

  update public.user_credits set
    daily_credits_remaining = v_row.daily_credits_remaining,
    bonus_credits           = v_row.bonus_credits,
    updated_at              = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'refunded', true,
    'daily_remaining', v_row.daily_credits_remaining,
    'bonus_remaining', v_row.bonus_credits
  );
end;
$$;

-- ── RPC: add_bonus_credits ─────────────────────────────────────────────────
-- Called from the Stripe webhook after a successful credit-pack purchase.
create or replace function public.add_bonus_credits(p_user_id uuid, p_amount int, p_daily_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         public.user_credits;
  v_now         timestamptz := now();
  v_next_reset  timestamptz := (date_trunc('day', timezone('UTC', v_now)) + interval '1 day')
                                at time zone 'UTC';
begin
  insert into public.user_credits (user_id, daily_credits_remaining, daily_reset_at, bonus_credits)
  values (p_user_id, p_daily_limit, v_next_reset, p_amount)
  on conflict (user_id) do update set
    bonus_credits = public.user_credits.bonus_credits + p_amount,
    updated_at    = v_now;

  select * into v_row from public.user_credits where user_id = p_user_id;
  return jsonb_build_object(
    'daily_remaining', v_row.daily_credits_remaining,
    'bonus_remaining', v_row.bonus_credits
  );
end;
$$;

-- ── RPC: get_credits ───────────────────────────────────────────────────────
-- Returns current balance, creating the row + applying a lazy reset if needed.
create or replace function public.get_credits(p_user_id uuid, p_daily_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         public.user_credits;
  v_now         timestamptz := now();
  v_next_reset  timestamptz := (date_trunc('day', timezone('UTC', v_now)) + interval '1 day')
                                at time zone 'UTC';
begin
  insert into public.user_credits (user_id, daily_credits_remaining, daily_reset_at, bonus_credits)
  values (p_user_id, p_daily_limit, v_next_reset, 0)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_credits where user_id = p_user_id for update;

  if v_row.daily_reset_at <= v_now then
    update public.user_credits set
      daily_credits_remaining = p_daily_limit,
      daily_reset_at          = v_next_reset,
      updated_at              = v_now
    where user_id = p_user_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'daily_remaining', v_row.daily_credits_remaining,
    'bonus_remaining', v_row.bonus_credits,
    'daily_reset_at',  v_row.daily_reset_at
  );
end;
$$;

-- ── Function: reset_all_daily_credits ──────────────────────────────────────
-- Backstop for the APScheduler 00:00 UTC cron. The lazy reset in the RPCs
-- handles correctness; this just ensures every user_credits row reflects the
-- new day in case nobody hits an RPC immediately after midnight.
create or replace function public.reset_all_daily_credits(p_free_limit int, p_pro_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count       int;
  v_now         timestamptz := now();
  v_next_reset  timestamptz := (date_trunc('day', timezone('UTC', v_now)) + interval '1 day')
                                at time zone 'UTC';
begin
  update public.user_credits uc
    set daily_credits_remaining = case
          when exists (
            select 1 from public.subscriptions s
            where s.user_id = uc.user_id and s.status = 'active'
          ) then p_pro_limit
          else p_free_limit
        end,
        daily_reset_at = v_next_reset,
        updated_at     = v_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
grant execute on function public.consume_credit(uuid, int)        to authenticated;
grant execute on function public.refund_credit(uuid, int)         to authenticated;
grant execute on function public.get_credits(uuid, int)           to authenticated;
-- add_bonus_credits and reset_all_daily_credits are called from backend with
-- the service_role key, which bypasses RLS — no grant needed for authenticated.

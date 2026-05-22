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
  -- Only touch rows whose reset window has actually elapsed.
  -- Rows already lazily-reset today (daily_reset_at = tomorrow midnight) are left
  -- alone, so this UPDATE is small, fast, and doesn't race with consume_credit.
  --
  -- A single pre-built CTE replaces the previous correlated EXISTS so the
  -- subscriptions table is scanned once instead of once per user row.
  with pro_users as (
    select distinct user_id
    from   public.subscriptions
    where  status = 'active'
  )
  update public.user_credits uc
    set daily_credits_remaining = case
          when pro.user_id is not null then p_pro_limit
          else p_free_limit
        end,
        daily_reset_at = v_next_reset,
        updated_at     = v_now
    from public.user_credits uc2
    left join pro_users pro on pro.user_id = uc2.user_id
    where uc.user_id = uc2.user_id
      and uc.daily_reset_at <= v_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================================
-- subscriptions: enable RLS — users see their own row only, no client writes
-- ============================================================================
-- The subscriptions table was originally created via the Supabase dashboard
-- (no migration file existed in the repo).  Without RLS, the anon key shipped
-- to the browser could read every user's Stripe customer/subscription IDs and
-- — worse — flip their own status to 'active' to bypass the PRO gate.
--
-- This migration does NOT recreate the table; it assumes the existing schema
-- with at minimum:
--   user_id                 uuid references auth.users(id)
--   stripe_customer_id      text
--   stripe_subscription_id  text
--   status                  text
--   current_period_end      timestamptz
--   updated_at              timestamptz
--
-- All writes flow through the backend Stripe webhook handler using the
-- service-role key, which bypasses RLS.

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies — service_role only.

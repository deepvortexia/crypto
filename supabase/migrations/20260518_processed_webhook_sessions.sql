-- ============================================================================
-- processed_webhook_sessions: idempotency guard for Stripe webhook replays
-- ============================================================================
-- Before granting credits for a checkout.session.completed event, the backend
-- inserts the Stripe session ID here. If the insert fails (duplicate), the
-- event has already been processed and credits must not be granted again.

create table if not exists public.processed_webhook_sessions (
  session_id  text        primary key,
  created_at  timestamptz not null default now()
);

-- Service-role key bypasses RLS; no authenticated access needed.
alter table public.processed_webhook_sessions enable row level security;

-- ============================================================================
-- predictions: enable RLS — public read, no anon/authenticated writes
-- ============================================================================
-- The predictions table was previously created without RLS, so the anon key
-- shipped to the browser had full CRUD access.  Lock it down:
--   * SELECT is public (the Proof page reads accuracy stats directly).
--   * INSERT / UPDATE / DELETE are denied to anon and authenticated.
--   * The backend writes via the service-role key, which bypasses RLS.

alter table public.predictions enable row level security;

drop policy if exists "Public read predictions" on public.predictions;
create policy "Public read predictions"
  on public.predictions
  for select
  using (true);

-- No INSERT / UPDATE / DELETE policies — service_role only.

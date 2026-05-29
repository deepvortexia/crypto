-- ============================================================================
-- Drop legacy deep_analysis_usage table + try_use_deep_analysis function
-- ============================================================================
-- The live credit system uses public.user_credits + consume_credit/refund_credit
-- (see 20260516_user_credits.sql).  The older try_use_deep_analysis RPC and the
-- deep_analysis_usage table it depended on are no longer referenced anywhere in
-- the backend.  They lacked RLS and SECURITY DEFINER, leaving them as an attack
-- surface where an authenticated user could reset their own daily quota.
--
-- Remove both to eliminate the attack surface entirely.

drop function if exists public.try_use_deep_analysis(uuid, int);
drop table     if exists public.deep_analysis_usage;

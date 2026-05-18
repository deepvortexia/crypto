"""
End-to-end credit system tests against the live Supabase instance.
Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Run:  python test_credits.py
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("FAIL  env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

FREE_LIMIT = 2
PRO_LIMIT  = 20

PASS = "PASS"
FAIL = "FAIL"

results: list[tuple[str, str]] = []

# Auth Admin API headers (service-role key required)
_AUTH_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
    "Content-Type": "application/json",
}


def log(status: str, name: str, detail: str = ""):
    tag = f"  {status}  {name}"
    if detail:
        tag += f"  —  {detail}"
    print(tag)
    results.append((status, name))


# ── Auth Admin helpers ────────────────────────────────────────────────────────

def create_auth_user() -> str:
    """Create a real user in auth.users via the Supabase Admin API.
    Returns the UUID assigned by Supabase. Raises on failure."""
    email = f"test-credits-{uuid.uuid4().hex[:16]}@test.internal"
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=_AUTH_HEADERS,
        json={
            "email": email,
            "email_confirm": True,
            "password": f"Pwd-{uuid.uuid4().hex}",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def delete_auth_user(uid: str):
    """Delete a user from auth.users via the Admin API.
    The FK ON DELETE CASCADE removes the user_credits row automatically."""
    try:
        httpx.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{uid}",
            headers=_AUTH_HEADERS,
            timeout=10,
        )
    except Exception:
        pass  # best-effort cleanup


# ── Supabase RPC helpers ──────────────────────────────────────────────────────

def consume(user_id: str, daily_limit: int) -> dict:
    r = sb.rpc("consume_credit", {"p_user_id": user_id, "p_daily_limit": daily_limit}).execute()
    return r.data or {}


def get_credits(user_id: str, daily_limit: int) -> dict:
    r = sb.rpc("get_credits", {"p_user_id": user_id, "p_daily_limit": daily_limit}).execute()
    return r.data or {}


def add_bonus(user_id: str, amount: int, daily_limit: int) -> dict:
    r = sb.rpc("add_bonus_credits", {
        "p_user_id": user_id, "p_amount": amount, "p_daily_limit": daily_limit
    }).execute()
    return r.data or {}


def reset_all(free_limit: int = FREE_LIMIT, pro_limit: int = PRO_LIMIT) -> int:
    r = sb.rpc("reset_all_daily_credits", {
        "p_free_limit": free_limit, "p_pro_limit": pro_limit
    }).execute()
    return r.data or 0


def set_reset_at_to_past(user_id: str):
    """Force daily_reset_at to 25h ago so the lazy reset triggers on next RPC."""
    past = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    sb.table("user_credits").update({"daily_reset_at": past}).eq("user_id", user_id).execute()


def next_midnight_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)


# ── TEST 1: New FREE user ─────────────────────────────────────────────────────

def test_new_free_user():
    uid = None
    try:
        uid = create_auth_user()
    except Exception as e:
        log(FAIL, "T1 new-free: create auth user", str(e))
        return
    try:
        data = get_credits(uid, FREE_LIMIT)
        daily = data.get("daily_remaining")
        bonus = data.get("bonus_remaining")
        reset_str = data.get("daily_reset_at", "")

        if daily != FREE_LIMIT:
            log(FAIL, "T1 new-free: daily_remaining", f"expected {FREE_LIMIT}, got {daily}")
            return
        if bonus != 0:
            log(FAIL, "T1 new-free: bonus_remaining", f"expected 0, got {bonus}")
            return

        expected = next_midnight_utc()
        try:
            reset_dt = datetime.fromisoformat(reset_str.replace("Z", "+00:00"))
            delta = abs((reset_dt - expected).total_seconds())
            if delta > 70:
                log(FAIL, "T1 new-free: reset_at", f"expected ~{expected.isoformat()}, got {reset_str} (delta={delta:.0f}s)")
                return
        except Exception as e:
            log(FAIL, "T1 new-free: reset_at parse", str(e))
            return

        log(PASS, "T1 new-free: daily=2, bonus=0, reset=next midnight UTC")
    finally:
        if uid:
            delete_auth_user(uid)


# ── TEST 2: FREE user consumes — 2 succeed, 3rd fails ────────────────────────

def test_free_consumes():
    uid = None
    try:
        uid = create_auth_user()
    except Exception as e:
        log(FAIL, "T2 free-consume: create auth user", str(e))
        return
    try:
        r1 = consume(uid, FREE_LIMIT)
        if not r1.get("allowed"):
            log(FAIL, "T2 free-consume: 1st consume should be allowed", str(r1))
            return
        if r1.get("daily_remaining") != 1:
            log(FAIL, "T2 free-consume: after 1st, daily_remaining", f"expected 1, got {r1.get('daily_remaining')}")
            return

        r2 = consume(uid, FREE_LIMIT)
        if not r2.get("allowed"):
            log(FAIL, "T2 free-consume: 2nd consume should be allowed", str(r2))
            return
        if r2.get("daily_remaining") != 0:
            log(FAIL, "T2 free-consume: after 2nd, daily_remaining", f"expected 0, got {r2.get('daily_remaining')}")
            return

        r3 = consume(uid, FREE_LIMIT)
        if r3.get("allowed"):
            log(FAIL, "T2 free-consume: 3rd consume should be blocked", str(r3))
            return

        log(PASS, "T2 free-consume: 2 succeed, 3rd blocked (allowed=false)")
    finally:
        if uid:
            delete_auth_user(uid)


# ── TEST 3: Bonus credits consumed after daily hits 0 ────────────────────────

def test_bonus_credits():
    uid = None
    try:
        uid = create_auth_user()
    except Exception as e:
        log(FAIL, "T3 bonus: create auth user", str(e))
        return
    try:
        consume(uid, FREE_LIMIT)
        consume(uid, FREE_LIMIT)

        b = add_bonus(uid, 10, FREE_LIMIT)
        if b.get("bonus_remaining") != 10:
            log(FAIL, "T3 bonus: after add_bonus, bonus_remaining", f"expected 10, got {b.get('bonus_remaining')}")
            return

        r = consume(uid, FREE_LIMIT)
        if not r.get("allowed"):
            log(FAIL, "T3 bonus: consume from bonus should be allowed", str(r))
            return
        if r.get("daily_remaining") != 0:
            log(FAIL, "T3 bonus: daily_remaining should stay 0", f"got {r.get('daily_remaining')}")
            return
        if r.get("bonus_remaining") != 9:
            log(FAIL, "T3 bonus: bonus_remaining after consume", f"expected 9, got {r.get('bonus_remaining')}")
            return

        log(PASS, "T3 bonus: bonus consumed after daily=0, daily stays 0")
    finally:
        if uid:
            delete_auth_user(uid)


# ── TEST 4: PRO user — 20 succeed, 21st fails ────────────────────────────────

def test_pro_user():
    uid = None
    try:
        uid = create_auth_user()
    except Exception as e:
        log(FAIL, "T4 pro: create auth user", str(e))
        return
    try:
        for i in range(1, PRO_LIMIT + 1):
            r = consume(uid, PRO_LIMIT)
            if not r.get("allowed"):
                log(FAIL, f"T4 pro: consume #{i} should be allowed", str(r))
                return
            expected_remaining = PRO_LIMIT - i
            if r.get("daily_remaining") != expected_remaining:
                log(FAIL, f"T4 pro: after consume #{i}, daily_remaining",
                    f"expected {expected_remaining}, got {r.get('daily_remaining')}")
                return

        r21 = consume(uid, PRO_LIMIT)
        if r21.get("allowed"):
            log(FAIL, "T4 pro: 21st consume should be blocked", str(r21))
            return

        log(PASS, f"T4 pro: all {PRO_LIMIT} daily credits consumed, 21st blocked")
    finally:
        if uid:
            delete_auth_user(uid)


# ── TEST 5: Midnight reset — lazy reset via get_credits ──────────────────────

def test_lazy_reset():
    uid = None
    try:
        uid = create_auth_user()
    except Exception as e:
        log(FAIL, "T5 lazy-reset: create auth user", str(e))
        return
    try:
        consume(uid, FREE_LIMIT)
        consume(uid, FREE_LIMIT)

        check = get_credits(uid, FREE_LIMIT)
        if check.get("daily_remaining") != 0:
            log(FAIL, "T5 lazy-reset: setup — expected daily=0", str(check))
            return

        set_reset_at_to_past(uid)

        after = get_credits(uid, FREE_LIMIT)
        if after.get("daily_remaining") != FREE_LIMIT:
            log(FAIL, "T5 lazy-reset: expected daily back to 2 after lazy reset",
                f"got {after.get('daily_remaining')}")
            return

        reset_str = after.get("daily_reset_at", "")
        try:
            reset_dt = datetime.fromisoformat(reset_str.replace("Z", "+00:00"))
            expected = next_midnight_utc()
            delta = abs((reset_dt - expected).total_seconds())
            if delta > 70:
                log(FAIL, "T5 lazy-reset: new reset_at not next midnight", f"delta={delta:.0f}s")
                return
        except Exception as e:
            log(FAIL, "T5 lazy-reset: reset_at parse", str(e))
            return

        log(PASS, "T5 lazy-reset: daily reset to 2 after past reset_at, new reset_at=next midnight")
    finally:
        if uid:
            delete_auth_user(uid)


# ── TEST 6: Cron reset — reset_all_daily_credits ─────────────────────────────

def test_cron_reset():
    free_uid = pro_uid = None
    try:
        try:
            free_uid = create_auth_user()
            pro_uid  = create_auth_user()
        except Exception as e:
            log(FAIL, "T6 cron: create auth users", str(e))
            return

        # Drain FREE user
        consume(free_uid, FREE_LIMIT)
        consume(free_uid, FREE_LIMIT)
        before_free = get_credits(free_uid, FREE_LIMIT)
        if before_free.get("daily_remaining") != 0:
            log(FAIL, "T6 cron: setup free user to 0", str(before_free))
            return

        # Seed PRO user and mark active in subscriptions
        consume(pro_uid, PRO_LIMIT)
        try:
            sb.table("subscriptions").upsert({
                "user_id": pro_uid,
                "status": "active",
                "stripe_customer_id": "cus_test_" + pro_uid[:8],
                "stripe_subscription_id": "sub_test_" + pro_uid[:8],
            }).execute()
        except Exception as e:
            log(FAIL, "T6 cron: could not seed subscriptions table", str(e))
            return

        # Drain PRO user (1 already consumed above)
        for _ in range(PRO_LIMIT - 1):
            consume(pro_uid, PRO_LIMIT)
        before_pro = get_credits(pro_uid, PRO_LIMIT)
        if before_pro.get("daily_remaining") != 0:
            log(FAIL, "T6 cron: setup pro user to 0", str(before_pro))
            return

        # Run the cron reset
        count = reset_all(FREE_LIMIT, PRO_LIMIT)

        after_free = get_credits(free_uid, FREE_LIMIT)
        if after_free.get("daily_remaining") != FREE_LIMIT:
            log(FAIL, "T6 cron: free user after reset",
                f"expected {FREE_LIMIT}, got {after_free.get('daily_remaining')}")
            return

        after_pro = get_credits(pro_uid, PRO_LIMIT)
        if after_pro.get("daily_remaining") != PRO_LIMIT:
            log(FAIL, "T6 cron: pro user after reset",
                f"expected {PRO_LIMIT}, got {after_pro.get('daily_remaining')}")
            return

        log(PASS, f"T6 cron: reset_all updated {count} row(s) — free={FREE_LIMIT}, pro={PRO_LIMIT}")
    finally:
        if pro_uid:
            try:
                sb.table("subscriptions").delete().eq("user_id", pro_uid).execute()
            except Exception:
                pass
        if free_uid:
            delete_auth_user(free_uid)
        if pro_uid:
            delete_auth_user(pro_uid)


# ── Run all tests ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\nCredit System — End-to-End Tests")
    print("=" * 50)

    test_new_free_user()
    test_free_consumes()
    test_bonus_credits()
    test_pro_user()
    test_lazy_reset()
    test_cron_reset()

    print("=" * 50)
    passed = sum(1 for s, _ in results if s == PASS)
    failed = sum(1 for s, _ in results if s == FAIL)
    print(f"Results: {passed} passed, {failed} failed\n")
    sys.exit(0 if failed == 0 else 1)

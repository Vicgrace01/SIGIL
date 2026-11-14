"""Seed Sigil demo. Run once: python seed.py
   Local: PUBLIC_BASE_URL=http://localhost:5000
   Prod:  PUBLIC_BASE_URL=https://sigil-yu2u.onrender.com
"""
import os, sys, sqlite3, datetime
import requests
from dotenv import load_dotenv
load_dotenv()

BASE         = os.getenv("PUBLIC_BASE_URL", "http://localhost:5000").rstrip("/")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_PATH      = os.getenv("DATABASE_PATH", "sigil.db")
PASSWORD     = "demo1234"

def register_or_login(name, email):
    s = requests.Session()
    r = s.post(f"{BASE}/api/register",
               json={"name": name, "email": email, "password": PASSWORD}, timeout=15)
    if r.status_code != 200:
        r = s.post(f"{BASE}/api/login",
                   json={"email": email, "password": PASSWORD}, timeout=15)
    if r.status_code != 200:
        print(f"  ✗ auth failed for {email}: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    return s, r.json()

def get_db_conn():
    if DATABASE_URL:
        try:
            import psycopg
            return psycopg.connect(DATABASE_URL), "psycopg3"
        except ImportError:
            import psycopg2
            return psycopg2.connect(DATABASE_URL), "psycopg2"
    return sqlite3.connect(DB_PATH, timeout=20), "sqlite"

def seed_paid(estate_id, email, amount, month):
    conn, kind = get_db_conn()
    try:
        cur = conn.cursor()
        if kind in ("psycopg3", "psycopg2"):
            cur.execute("SELECT id FROM users WHERE email=%s", (email,))
            u = cur.fetchone()
            if not u:
                return False
            uid = u[0]
            cur.execute("SELECT id FROM contributions WHERE estate_id=%s AND user_id=%s AND month=%s",
                        (estate_id, uid, month))
            if cur.fetchone():
                cur.execute("UPDATE contributions SET status='paid', method='seed', paid_at=NOW() WHERE estate_id=%s AND user_id=%s AND month=%s",
                            (estate_id, uid, month))
            else:
                cur.execute("INSERT INTO contributions(estate_id,user_id,month,amount_usd,status,method,paid_at) VALUES(%s,%s,%s,%s,'paid','seed',NOW())",
                            (estate_id, uid, month, amount))
        else:
            cur.execute("SELECT id FROM users WHERE email=?", (email,))
            u = cur.fetchone()
            if not u:
                return False
            uid = u[0]
            cur.execute("SELECT id FROM contributions WHERE estate_id=? AND user_id=? AND month=?",
                        (estate_id, uid, month))
            if cur.fetchone():
                cur.execute("UPDATE contributions SET status='paid', method='seed', paid_at=CURRENT_TIMESTAMP WHERE estate_id=? AND user_id=? AND month=?",
                            (estate_id, uid, month))
            else:
                cur.execute("INSERT INTO contributions(estate_id,user_id,month,amount_usd,status,method,paid_at) VALUES(?,?,?,?,'paid','seed',CURRENT_TIMESTAMP)",
                            (estate_id, uid, month, amount))
        conn.commit()
        return True
    finally:
        conn.close()

def main():
    print(f"\n  SIGIL SEED  →  {BASE}\n")
    month = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")

    ada, _ = register_or_login("Officer Ada", "ada@sigil.demo")
    r = ada.get(f"{BASE}/api/estates", timeout=15)
    if r.status_code != 200:
        print(f"  ✗ GET /api/estates failed: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    estates = r.json().get("estates", [])
    demo = next((e for e in estates if e["name"] == "Lekki Phase 1 Residents Association"), None)

    if demo:
        eid, invite = demo["id"], demo["invite_code"]
        print(f"  • estate exists #{eid} · invite {invite}")
    else:
        r = ada.post(f"{BASE}/api/estates", json={
            "name": "Lekki Phase 1 Residents Association",
            "monthly_usd": 500, "expected_residents": 6,
        }, timeout=15)
        if r.status_code != 200:
            print(f"  ✗ create estate failed: {r.status_code} {r.text[:300]}")
            sys.exit(1)
        d = r.json()
        eid = d["estate_id"]; invite = d["invite_code"]
        print(f"  ✓ estate #{eid} created · invite {invite}")

    people = [
        ("Officer Bola",  "bola@sigil.demo",  True),
        ("Chidi Okafor",  "chidi@sigil.demo", False),
        ("Ngozi Adeyemi", "ngozi@sigil.demo", False),
        ("Tunde Bakare",  "tunde@sigil.demo", False),
        ("Femi Adeleke",  "femi@sigil.demo",  False),
    ]
    for name, email, _ in people:
        s, _ = register_or_login(name, email)
        jr = s.post(f"{BASE}/api/estates/{eid}/join", json={"invite_code": invite}, timeout=15)
        if jr.status_code in (200, 409):
            print(f"  ✓ {name} joined" if jr.status_code == 200 else f"  • {name} already member")
        else:
            print(f"  ⚠ {name} join failed: {jr.status_code} {jr.text[:120]}")

    detail = ada.get(f"{BASE}/api/estates/{eid}", timeout=15).json()
    for m in detail.get("members", []):
        if m["name"] == "Officer Bola" and m["role"] != "officer":
            pr = ada.post(f"{BASE}/api/estates/{eid}/promote", json={"member_id": m["id"]}, timeout=15)
            if pr.status_code == 200:
                print(f"  ✓ Bola promoted to officer")
        if m["kyc_status"] != "approved":
            ada.post(f"{BASE}/api/estates/{eid}/kyc-approve", json={"member_id": m["id"]}, timeout=15)
    print(f"  ✓ all KYC approved")

    detail = ada.get(f"{BASE}/api/estates/{eid}", timeout=15).json()
    if not detail.get("vendors"):
        vr = ada.post(f"{BASE}/api/estates/{eid}/vendors", json={
            "name": "Total Diesel Ltd", "category": "diesel",
            "wallet": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        }, timeout=15)
        if vr.status_code == 200:
            print(f"  ✓ vendor added")
        detail = ada.get(f"{BASE}/api/estates/{eid}", timeout=15).json()

    for email in ("ada@sigil.demo", "bola@sigil.demo", "chidi@sigil.demo", "ngozi@sigil.demo"):
        if seed_paid(eid, email, 500, month):
            print(f"  ✓ {email.split('@')[0]} marked paid")

    if detail.get("vendors") and not any(p["purpose"] == "Diesel — demo" for p in detail.get("proposals", [])):
        r = ada.post(f"{BASE}/api/estates/{eid}/proposals", json={
            "vendor_id": detail["vendors"][0]["id"],
            "amount_usd": 1000, "purpose": "Diesel — demo",
        }, timeout=15)
        if r.status_code == 200:
            pid = r.json().get("proposal_id")
            if pid:
                ada.post(f"{BASE}/api/proposals/{pid}/sign", timeout=15)
                print(f"  ✓ proposal #{pid} created · Ada signed (1/2)")

    print(f"\n  ═══════════════════════════════════════════")
    print(f"  ESTATE #{eid} · INVITE {invite}")
    print(f"  ═══════════════════════════════════════════")
    print(f"  Logins (password: demo1234)")
    print(f"    ada@sigil.demo    officer · created proposal")
    print(f"    bola@sigil.demo   officer · will complete 2/2")
    print(f"    tunde@sigil.demo  resident · WILL PAY LIVE")
    print(f"\n  Live demo (2 browsers):")
    print(f"    1. Browser 1: login ada → see 4/6 paid")
    print(f"    2. Browser 2 (incognito): login tunde → connect Pollar → Pay $5 → 5/6")
    print(f"    3. Browser 1: Proposals → proposal 1/2 pending")
    print(f"    4. Browser 2: logout → login bola → Proposals → Sign → 2/2")
    print(f"    5. Browser 1: Execute → vendor paid on-chain\n")

if __name__ == "__main__":
    main()
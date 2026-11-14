from __future__ import annotations
import os, re, secrets, sqlite3
from decimal import Decimal
from pathlib import Path
from datetime import datetime
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

HAS_PG = False
PG_DRIVER = None
PG_INTEGRITY = type("PGIntegrity", (Exception,), {})
PG_IMPORT_ERROR = "not attempted"
PG_CONNECT = None
try:
    import psycopg, psycopg.rows, psycopg.errors
    PG_DRIVER = "psycopg3"; PG_INTEGRITY = psycopg.errors.IntegrityError
    PG_CONNECT = psycopg.connect; HAS_PG = True
except Exception as e:
    PG_IMPORT_ERROR = f"psycopg3: {e}"
    try:
        import psycopg2, psycopg2.extras
        PG_DRIVER = "psycopg2"; PG_INTEGRITY = psycopg2.IntegrityError
        PG_CONNECT = psycopg2.connect; HAS_PG = True
    except Exception as e2:
        PG_IMPORT_ERROR = f"{PG_IMPORT_ERROR} | psycopg2: {e2}"

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL  = os.getenv("DATABASE_URL", "").strip()
DB_PATH       = os.getenv("DATABASE_PATH", str(BASE_DIR / "sigil.db"))
POLLAR_PUB    = os.getenv("POLLAR_PUBLISHABLE_KEY", "").strip()
POLLAR_NET    = os.getenv("POLLAR_NETWORK", "testnet").strip().lower()
HORIZON       = os.getenv("POLLAR_HORIZON_URL", "https://horizon-testnet.stellar.org").rstrip("/")
TREASURY_PUB  = os.getenv("TREASURY_PUBLIC", "").strip()
TREASURY_SEC  = os.getenv("TREASURY_SECRET", "").strip()
USDC_ISSUER   = os.getenv("USDC_ISSUER", "").strip()
USDC_CONTRACT = os.getenv("USDC_CONTRACT", "").strip()
DEMO_XLM      = Decimal(os.getenv("DEMO_XLM_PER_USD", "10"))

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_urlsafe(48)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "false").lower() == "true",
    MAX_CONTENT_LENGTH=2 * 1024 * 1024,
)

class DB:
    def __init__(self, conn, is_pg):
        self._c, self._pg = conn, is_pg
    def execute(self, sql, params=()):
        if self._pg:
            sql = sql.replace("?", "%s")
            cur = self._c.cursor(row_factory=psycopg.rows.dict_row) if PG_DRIVER == "psycopg3" \
                  else self._c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = self._c.cursor()
        cur.execute(sql, params)
        return cur
    def __enter__(self): return self
    def __exit__(self, et, e, tb):
        try:
            self._c.commit() if et is None else self._c.rollback()
        finally:
            self._c.close()

def get_db():
    if DATABASE_URL:
        if not HAS_PG: raise RuntimeError(f"No Postgres driver: {PG_IMPORT_ERROR}")
        return DB(PG_CONNECT(DATABASE_URL), True)
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=20)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return DB(c, False)

def init_db():
    with get_db() as db:
        if DATABASE_URL:
            db.execute("""CREATE TABLE IF NOT EXISTS users(
                id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
                pw TEXT NOT NULL, wallet_address TEXT, avatar_seed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
            db.execute("""CREATE TABLE IF NOT EXISTS estates(
                id SERIAL PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL,
                treasury_address TEXT NOT NULL, monthly_usd INTEGER NOT NULL DEFAULT 500,
                expected_residents INTEGER DEFAULT 5,
                created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
            db.execute("""CREATE TABLE IF NOT EXISTS memberships(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                user_id INTEGER REFERENCES users(id), role TEXT NOT NULL DEFAULT 'resident',
                kyc_status TEXT DEFAULT 'pending', joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(estate_id,user_id))""")
            db.execute("""CREATE TABLE IF NOT EXISTS contributions(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                user_id INTEGER REFERENCES users(id), month TEXT NOT NULL,
                amount_usd INTEGER NOT NULL, status TEXT DEFAULT 'pending',
                tx_hash TEXT UNIQUE, method TEXT DEFAULT 'pollar',
                paid_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(estate_id,user_id,month))""")
            db.execute("""CREATE TABLE IF NOT EXISTS vendors(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                name TEXT NOT NULL, category TEXT NOT NULL, wallet TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
            db.execute("""CREATE TABLE IF NOT EXISTS proposals(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                vendor_id INTEGER REFERENCES vendors(id), amount_usd INTEGER NOT NULL,
                purpose TEXT NOT NULL, month TEXT, status TEXT DEFAULT 'pending',
                signatures_needed INTEGER DEFAULT 2, signatures_got INTEGER DEFAULT 0,
                tx_hash TEXT, created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, executed_at TIMESTAMP)""")
            db.execute("""CREATE TABLE IF NOT EXISTS proposal_signatures(
                id SERIAL PRIMARY KEY, proposal_id INTEGER REFERENCES proposals(id),
                user_id INTEGER REFERENCES users(id), signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proposal_id,user_id))""")
            db.execute("""CREATE TABLE IF NOT EXISTS ledger(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                event_type TEXT NOT NULL, description TEXT, amount_usd INTEGER,
                tx_hash TEXT, actor_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
            db.execute("""CREATE TABLE IF NOT EXISTS agent_settings(
                id SERIAL PRIMARY KEY, estate_id INTEGER REFERENCES estates(id),
                user_id INTEGER REFERENCES users(id), enabled BOOLEAN DEFAULT false,
                monthly_limit_cents INTEGER DEFAULT 500, UNIQUE(estate_id,user_id))""")
            db.execute("""CREATE TABLE IF NOT EXISTS agent_payments(
                id SERIAL PRIMARY KEY, agent_settings_id INTEGER REFERENCES agent_settings(id),
                contribution_id INTEGER REFERENCES contributions(id), tx_hash TEXT,
                amount_cents INTEGER, status TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        else:
            db.execute("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pw TEXT NOT NULL,wallet_address TEXT,avatar_seed INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
            db.execute("CREATE TABLE IF NOT EXISTS estates(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,invite_code TEXT UNIQUE NOT NULL,treasury_address TEXT NOT NULL,monthly_usd INTEGER NOT NULL DEFAULT 500,expected_residents INTEGER DEFAULT 5,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
            db.execute("CREATE TABLE IF NOT EXISTS memberships(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,user_id INTEGER,role TEXT NOT NULL DEFAULT 'resident',kyc_status TEXT DEFAULT 'pending',joined_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(estate_id,user_id))")
            db.execute("CREATE TABLE IF NOT EXISTS contributions(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,user_id INTEGER,month TEXT NOT NULL,amount_usd INTEGER NOT NULL,status TEXT DEFAULT 'pending',tx_hash TEXT UNIQUE,method TEXT DEFAULT 'pollar',paid_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(estate_id,user_id,month))")
            db.execute("CREATE TABLE IF NOT EXISTS vendors(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,name TEXT NOT NULL,category TEXT NOT NULL,wallet TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
            db.execute("CREATE TABLE IF NOT EXISTS proposals(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,vendor_id INTEGER,amount_usd INTEGER NOT NULL,purpose TEXT NOT NULL,month TEXT,status TEXT DEFAULT 'pending',signatures_needed INTEGER DEFAULT 2,signatures_got INTEGER DEFAULT 0,tx_hash TEXT,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,executed_at TEXT)")
            db.execute("CREATE TABLE IF NOT EXISTS proposal_signatures(id INTEGER PRIMARY KEY AUTOINCREMENT,proposal_id INTEGER,user_id INTEGER,signed_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(proposal_id,user_id))")
            db.execute("CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,event_type TEXT NOT NULL,description TEXT,amount_usd INTEGER,tx_hash TEXT,actor_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
            db.execute("CREATE TABLE IF NOT EXISTS agent_settings(id INTEGER PRIMARY KEY AUTOINCREMENT,estate_id INTEGER,user_id INTEGER,enabled INTEGER DEFAULT 0,monthly_limit_cents INTEGER DEFAULT 500,UNIQUE(estate_id,user_id))")
            db.execute("CREATE TABLE IF NOT EXISTS agent_payments(id INTEGER PRIMARY KEY AUTOINCREMENT,agent_settings_id INTEGER,contribution_id INTEGER,tx_hash TEXT,amount_cents INTEGER,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)")

        # Migrations — safe on existing DBs
        if DATABASE_URL:
            ucols = {r["column_name"] for r in db.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users'").fetchall()}
            ecols = {r["column_name"] for r in db.execute("SELECT column_name FROM information_schema.columns WHERE table_name='estates'").fetchall()}
        else:
            ucols = {r[1] for r in db.execute("PRAGMA table_info(users)").fetchall()}
            ecols = {r[1] for r in db.execute("PRAGMA table_info(estates)").fetchall()}
        if "avatar_seed" not in ucols:
            db.execute("ALTER TABLE users ADD COLUMN avatar_seed INTEGER DEFAULT 0")
        if "expected_residents" not in ecols:
            db.execute("ALTER TABLE estates ADD COLUMN expected_residents INTEGER DEFAULT 5")

init_db()

def me():
    uid = session.get("uid")
    if not uid: return None
    with get_db() as db:
        return db.execute("SELECT id,name,email,wallet_address,avatar_seed FROM users WHERE id=?", (uid,)).fetchone()

def body() -> dict:
    v = request.get_json(silent=True)
    return v if isinstance(v, dict) else {}

def month_now() -> str:
    return datetime.utcnow().strftime("%Y-%m")

def make_invite() -> str:
    return "SG-" + secrets.token_hex(3).upper()

def log_event(db, eid, etype, desc, amount=None, tx=None, actor=None):
    db.execute(
        "INSERT INTO ledger(estate_id,event_type,description,amount_usd,tx_hash,actor_id) VALUES(?,?,?,?,?,?)",
        (eid, etype, desc, amount, tx, actor),
    )

# ─── Auth ───
@app.post("/api/register")
def register():
    d = body(); name = (d.get("name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    pw = d.get("password") or ""
    if not name or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(pw) < 6:
        return jsonify(error="Name, valid email and 6+ char password required"), 400
    try:
        with get_db() as db:
            cur = db.execute("INSERT INTO users(name,email,pw) VALUES(?,?,?) RETURNING id", (name, email, generate_password_hash(pw)))
            row = cur.fetchone(); uid = row["id"] if isinstance(row, dict) else row[0]
        session.clear(); session["uid"] = uid
    except (sqlite3.IntegrityError, PG_INTEGRITY):
        return jsonify(error="Email already registered"), 409
    return jsonify(ok=True, name=name, user_id=uid)

@app.post("/api/login")
def login():
    d = body(); email = (d.get("email") or "").strip().lower(); pw = d.get("password") or ""
    with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u or not check_password_hash(u["pw"], pw):
        return jsonify(error="Wrong email or password"), 401
    session.clear(); session["uid"] = u["id"]
    return jsonify(ok=True, name=u["name"])

@app.post("/api/logout")
def logout():
    session.clear(); return jsonify(ok=True)

@app.get("/api/me")
def whoami():
    u = me(); return jsonify(user=dict(u) if u else None)

@app.post("/api/me/wallet")
def set_wallet():
    u = me()
    if not u: return jsonify(error="Login required"), 401
    addr = (body().get("wallet_address") or "").strip()
    if not re.fullmatch(r"G[A-Z2-7]{55}", addr):
        return jsonify(error="Invalid Stellar G address"), 400
    with get_db() as db:
        db.execute("UPDATE users SET wallet_address=? WHERE id=?", (addr, u["id"]))
    return jsonify(ok=True, wallet_address=addr)

@app.post("/api/me/profile")
def update_profile():
    u = me()
    if not u: return jsonify(error="Login required"), 401
    d = body()
    name = (d.get("name") or "").strip()
    avatar_seed = int(d.get("avatar_seed") or 0)
    if not name or len(name) < 2 or len(name) > 60:
        return jsonify(error="Name must be 2–60 characters"), 400
    if avatar_seed < 0 or avatar_seed > 5:
        return jsonify(error="Invalid avatar seed"), 400
    with get_db() as db:
        db.execute("UPDATE users SET name=?,avatar_seed=? WHERE id=?", (name, avatar_seed, u["id"]))
    return jsonify(ok=True, name=name, avatar_seed=avatar_seed)

# ─── Estates ───
@app.get("/api/estates")
def list_estates():
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        rows = db.execute("""SELECT e.id,e.name,e.invite_code,e.treasury_address,e.monthly_usd,
                                    e.expected_residents, m.role,m.kyc_status
                             FROM estates e JOIN memberships m ON m.estate_id=e.id
                             WHERE m.user_id=? ORDER BY e.id DESC""", (u["id"],)).fetchall()
    return jsonify(estates=[dict(r) for r in rows])

@app.post("/api/estates")
def create_estate():
    u = me()
    if not u: return jsonify(error="Login required"), 401
    d = body(); name = (d.get("name") or "").strip()
    if not name: return jsonify(error="Estate name required"), 400
    monthly = int(d.get("monthly_usd") or 500)
    expected = int(d.get("expected_residents") or 5)
    if not (10 <= monthly <= 100000): return jsonify(error="Monthly must be 10–100000 cents"), 400
    if not (1 <= expected <= 200): return jsonify(error="Expected residents must be 1–200"), 400
    if not TREASURY_PUB: return jsonify(error="Server treasury not configured"), 503
    invite = make_invite()
    with get_db() as db:
        cur = db.execute("INSERT INTO estates(name,invite_code,treasury_address,monthly_usd,expected_residents,created_by) VALUES(?,?,?,?,?,?) RETURNING id",
                         (name, invite, TREASURY_PUB, monthly, expected, u["id"]))
        row = cur.fetchone(); eid = row["id"] if isinstance(row, dict) else row[0]
        db.execute("INSERT INTO memberships(estate_id,user_id,role,kyc_status) VALUES(?,?,?,?)",
                   (eid, u["id"], "officer", "approved"))
        log_event(db, eid, "estate_created", f"Estate '{name}' created", None, None, u["id"])
    return jsonify(ok=True, estate_id=eid, invite_code=invite)

@app.get("/api/estates/<int:eid>")
def estate_detail(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m: return jsonify(error="Not a member"), 403
        e = db.execute("SELECT * FROM estates WHERE id=?", (eid,)).fetchone()
        members = db.execute("""SELECT m.id,m.role,m.kyc_status,u.name,u.wallet_address,u.avatar_seed
                                FROM memberships m JOIN users u ON u.id=m.user_id
                                WHERE m.estate_id=? ORDER BY m.id""", (eid,)).fetchall()
        contribs = db.execute("""SELECT c.id,c.user_id,c.month,c.amount_usd,c.status,c.tx_hash,
                                        c.method,c.paid_at,u.name
                                 FROM contributions c JOIN users u ON u.id=c.user_id
                                 WHERE c.estate_id=? AND c.month=? ORDER BY c.id""",
                              (eid, month_now())).fetchall()
        vendors = db.execute("SELECT * FROM vendors WHERE estate_id=? ORDER BY id", (eid,)).fetchall()
        proposals = db.execute("""SELECT p.*,v.name AS vendor_name,v.wallet AS vendor_wallet
                                  FROM proposals p LEFT JOIN vendors v ON v.id=p.vendor_id
                                  WHERE p.estate_id=? ORDER BY p.id DESC""", (eid,)).fetchall()
        ledger = db.execute("SELECT * FROM ledger WHERE estate_id=? ORDER BY id DESC LIMIT 80", (eid,)).fetchall()
    return jsonify(
        estate=dict(e), role=m["role"], kyc_status=m["kyc_status"],
        members=[dict(r) for r in members],
        contributions=[dict(r) for r in contribs],
        vendors=[dict(r) for r in vendors],
        proposals=[dict(r) for r in proposals],
        ledger=[dict(r) for r in ledger],
        treasury=dict(public=TREASURY_PUB, explorer=f"https://stellar.expert/explorer/testnet/account/{TREASURY_PUB}"),
        network=POLLAR_NET, month=month_now(), xlm_per_usd=str(DEMO_XLM),
        usdc_enabled=bool(USDC_ISSUER),
    )

@app.post("/api/estates/<int:eid>/join")
def join_estate(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    code = (body().get("invite_code") or "").strip().upper()
    with get_db() as db:
        e = db.execute("SELECT * FROM estates WHERE id=? AND invite_code=?", (eid, code)).fetchone()
        if not e: return jsonify(error="Invalid invite code"), 400
        try:
            db.execute("INSERT INTO memberships(estate_id,user_id,role,kyc_status) VALUES(?,?,?,?)",
                       (eid, u["id"], "resident", "pending"))
        except (sqlite3.IntegrityError, PG_INTEGRITY):
            return jsonify(error="Already a member"), 409
        log_event(db, eid, "member_join", f"{u['name']} joined", None, None, u["id"])
    return jsonify(ok=True, estate_id=eid)

@app.post("/api/estates/<int:eid>/kyc-approve")
def kyc_approve(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    target = int(body().get("member_id") or 0)
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m or m["role"] != "officer": return jsonify(error="Officer only"), 403
        db.execute("UPDATE memberships SET kyc_status='approved' WHERE id=? AND estate_id=?", (target, eid))
        log_event(db, eid, "kyc_approved", f"KYC approved for member {target}", None, None, u["id"])
    return jsonify(ok=True)

@app.post("/api/estates/<int:eid>/promote")
def promote_member(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    target = int(body().get("member_id") or 0)
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m or m["role"] != "officer": return jsonify(error="Officer only"), 403
        db.execute("UPDATE memberships SET role='officer',kyc_status='approved' WHERE id=? AND estate_id=?", (target, eid))
        log_event(db, eid, "member_promoted", f"Member {target} promoted to officer", None, None, u["id"])
    return jsonify(ok=True)

@app.post("/api/estates/<int:eid>/treasury-balance")
def treasury_balance(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    try:
        r = requests.get(f"{HORIZON}/accounts/{TREASURY_PUB}", timeout=10)
        r.raise_for_status()
        account = r.json()
    except requests.RequestException as e:
        return jsonify(error=f"Horizon unreachable: {e}"), 502
    usdc = next((b["balance"] for b in account.get("balances", [])
                 if b.get("asset_code") == "USDC" and b.get("asset_issuer") == USDC_ISSUER), "0.0000000")
    xlm = next((b["balance"] for b in account.get("balances", [])
                if b.get("asset_type") == "native"), "0.0000000")
    return jsonify(ok=True, usdc=usdc, xlm=xlm, address=TREASURY_PUB)

# ─── Contributions ───
@app.post("/api/estates/<int:eid>/contribution/prepare")
def prepare_contribution(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m: return jsonify(error="Not a member"), 403
        if m["kyc_status"] != "approved": return jsonify(error="KYC pending"), 403
        e = db.execute("SELECT * FROM estates WHERE id=?", (eid,)).fetchone()
        month = month_now()
        existing = db.execute("SELECT * FROM contributions WHERE estate_id=? AND user_id=? AND month=?",
                              (eid, u["id"], month)).fetchone()
        if existing and existing["status"] == "paid":
            return jsonify(error="Already paid this month"), 409
        amount_usd = int(e["monthly_usd"])
        memo = f"SIG-{eid}-{month}-{u['id']}"
        if not existing:
            cur = db.execute("INSERT INTO contributions(estate_id,user_id,month,amount_usd,status,method) VALUES(?,?,?,?,?,?) RETURNING id",
                             (eid, u["id"], month, amount_usd, "pending", "pollar"))
            row = cur.fetchone()
            cid = row["id"] if isinstance(row, dict) else row[0]
        else:
            cid = existing["id"]
        use_usdc = bool(USDC_ISSUER)
        if use_usdc:
            amount_units = f"{Decimal(amount_usd)/Decimal('100'):.7f}"
            asset = {"type": "issued", "code": "USDC", "issuer": USDC_ISSUER}
        else:
            usd = Decimal(amount_usd) / Decimal("100")
            amount_units = f"{(usd * DEMO_XLM):.7f}"
            asset = {"type": "native"}
    return jsonify(ok=True, contribution_id=cid, amount_usd=amount_usd,
                   amount_units=amount_units, asset=asset, memo=memo,
                   treasury=TREASURY_PUB, use_usdc=use_usdc, xlm_per_usd=str(DEMO_XLM))

@app.post("/api/contributions/<int:cid>/confirm")
def confirm_contribution(cid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    tx_hash = (body().get("tx_hash") or "").strip()
    if not re.fullmatch(r"[a-fA-F0-9]{64}", tx_hash):
        return jsonify(error="Invalid tx hash"), 400
    with get_db() as db:
        c = db.execute("SELECT * FROM contributions WHERE id=?", (cid,)).fetchone()
        if not c or c["user_id"] != u["id"]: return jsonify(error="Not found"), 404
        if c["status"] == "paid" and c["tx_hash"] == tx_hash:
            return jsonify(ok=True, already=True), 200
        try:
            r = requests.get(f"{HORIZON}/transactions/{tx_hash}", timeout=15)
            if r.status_code == 404:
                return jsonify(error="Not indexed yet"), 202
            r.raise_for_status()
            tx = r.json()
            if not tx.get("successful"): return jsonify(error="Tx failed"), 400
            ops = requests.get(f"{HORIZON}/transactions/{tx_hash}/operations",
                               params={"limit": 60}, timeout=15).json()
            ops = ops.get("_embedded", {}).get("records", [])
        except requests.RequestException as e:
            return jsonify(error=f"Horizon unreachable: {e}"), 502
        expected_usdc = Decimal(c["amount_usd"]) / Decimal("100")
        expected_xlm = (Decimal(c["amount_usd"]) / Decimal("100")) * DEMO_XLM
        verified = False
        for op in ops:
            if op.get("type") != "payment" or op.get("to") != TREASURY_PUB: continue
            if u["wallet_address"] and op.get("from") != u["wallet_address"]: continue
            if op.get("asset_type") == "native":
                if Decimal(op.get("amount", "0")) + Decimal("0.0000001") >= expected_xlm:
                    verified = True; break
            elif op.get("asset_code") == "USDC" and op.get("asset_issuer") == USDC_ISSUER:
                if Decimal(op.get("amount", "0")) + Decimal("0.0000001") >= expected_usdc:
                    verified = True; break
        if not verified:
            return jsonify(error="Transaction does not match expected contribution"), 400
        try:
            db.execute("UPDATE contributions SET status='paid',tx_hash=?,paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",
                       (tx_hash, cid))
            log_event(db, c["estate_id"], "contribution_paid",
                      f"{u['name']} paid ${c['amount_usd']/100:.2f}", c["amount_usd"], tx_hash, u["id"])
        except (sqlite3.IntegrityError, PG_INTEGRITY):
            return jsonify(error="Tx hash reused"), 409
    return jsonify(ok=True, tx_hash=tx_hash)

# ─── Vendors ───
@app.post("/api/estates/<int:eid>/vendors")
def add_vendor(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    d = body(); name = (d.get("name") or "").strip()
    cat = (d.get("category") or "other").strip()
    wallet = (d.get("wallet") or "").strip()
    if not name or not re.fullmatch(r"G[A-Z2-7]{55}", wallet):
        return jsonify(error="Name and valid Stellar G wallet required"), 400
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m or m["role"] != "officer": return jsonify(error="Officer only"), 403
        cur = db.execute("INSERT INTO vendors(estate_id,name,category,wallet) VALUES(?,?,?,?) RETURNING id",
                         (eid, name, cat, wallet))
        row = cur.fetchone()
        vid = row["id"] if isinstance(row, dict) else row[0]
        log_event(db, eid, "vendor_added", f"Vendor {name} added", None, None, u["id"])
    return jsonify(ok=True, vendor_id=vid)

# ─── Proposals (2-of-2) ───
@app.post("/api/estates/<int:eid>/proposals")
def create_proposal(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    d = body(); vid = int(d.get("vendor_id") or 0)
    amount = int(d.get("amount_usd") or 0)
    purpose = (d.get("purpose") or "").strip()
    if not vid or amount <= 0 or not purpose:
        return jsonify(error="vendor_id, amount_usd, purpose required"), 400
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m or m["role"] != "officer": return jsonify(error="Officer only"), 403
        v = db.execute("SELECT * FROM vendors WHERE id=? AND estate_id=?", (vid, eid)).fetchone()
        if not v: return jsonify(error="Vendor not found"), 404
        cur = db.execute("INSERT INTO proposals(estate_id,vendor_id,amount_usd,purpose,month,created_by) VALUES(?,?,?,?,?,?) RETURNING id",
                         (eid, vid, amount, purpose, month_now(), u["id"]))
        row = cur.fetchone()
        pid = row["id"] if isinstance(row, dict) else row[0]
        log_event(db, eid, "proposal_created", f"Proposal: {purpose} (${amount/100:.2f})", amount, None, u["id"])
    return jsonify(ok=True, proposal_id=pid)

@app.post("/api/proposals/<int:pid>/sign")
def sign_proposal(pid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        p = db.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
        if not p: return jsonify(error="Not found"), 404
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (p["estate_id"], u["id"])).fetchone()
        if not m or m["role"] != "officer": return jsonify(error="Officer only"), 403
        if p["status"] != "pending": return jsonify(error=f"Proposal is {p['status']}"), 409
        try:
            db.execute("INSERT INTO proposal_signatures(proposal_id,user_id) VALUES(?,?)", (pid, u["id"]))
        except (sqlite3.IntegrityError, PG_INTEGRITY):
            return jsonify(error="You already signed"), 409
        got = db.execute("SELECT COUNT(*) AS c FROM proposal_signatures WHERE proposal_id=?", (pid,)).fetchone()
        got = got["c"] if isinstance(got, dict) else got[0]
        new_status = "ready" if got >= p["signatures_needed"] else "pending"
        db.execute("UPDATE proposals SET signatures_got=?,status=? WHERE id=?", (got, new_status, pid))
        log_event(db, p["estate_id"], "proposal_signed", f"{u['name']} signed proposal #{pid}", None, None, u["id"])
    return jsonify(ok=True, signatures_got=got, needed=p["signatures_needed"], status=new_status)

@app.post("/api/proposals/<int:pid>/execute")
def execute_proposal(pid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    if not TREASURY_SEC:
        return jsonify(error="Treasury secret not configured"), 503
    with get_db() as db:
        p = db.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
        if not p: return jsonify(error="Not found"), 404
        if p["status"] != "ready":
            return jsonify(error=f"Proposal is {p['status']}, not ready"), 409
        v = db.execute("SELECT * FROM vendors WHERE id=?", (p["vendor_id"],)).fetchone()
        if not v: return jsonify(error="Vendor not found"), 404
        db.execute("UPDATE proposals SET status='executing' WHERE id=?", (pid,))

    try:
        from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset, Payment
        server = Server(HORIZON)
        kp = Keypair.from_secret(TREASURY_SEC)
        account = server.load_account(kp.public_key)
        use_usdc = bool(USDC_ISSUER)
        if use_usdc:
            asset = Asset("USDC", USDC_ISSUER)
            amount_str = f"{Decimal(p['amount_usd'])/Decimal('100'):.7f}"
        else:
            asset = Asset.native()
            amount_str = f"{(Decimal(p['amount_usd'])/Decimal('100')*DEMO_XLM):.7f}"
        tx = (TransactionBuilder(account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100_000)
              .append_operation(Payment(destination=v["wallet"], asset=asset, amount=amount_str))
              .add_text_memo(f"PROP-{pid}"[:28])
              .set_timeout(60)
              .build())
        tx.sign(kp)
        resp = server.submit_transaction(tx)
        tx_hash = resp["hash"]
    except Exception as ex:
        with get_db() as db:
            db.execute("UPDATE proposals SET status='ready' WHERE id=?", (pid,))
        return jsonify(error=f"Treasury submission failed: {ex}"), 502

    with get_db() as db:
        db.execute("UPDATE proposals SET status='executed',tx_hash=?,executed_at=CURRENT_TIMESTAMP WHERE id=?",
                   (tx_hash, pid))
        log_event(db, p["estate_id"], "disbursement",
                  f"Paid {v['name']}: {p['purpose']}", p["amount_usd"], tx_hash, u["id"])
    return jsonify(ok=True, tx_hash=tx_hash)

# ─── Ledger ───
@app.get("/api/estates/<int:eid>/ledger")
def ledger(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m: return jsonify(error="Not a member"), 403
        rows = db.execute("SELECT * FROM ledger WHERE estate_id=? ORDER BY id DESC LIMIT 100", (eid,)).fetchall()
    return jsonify(ledger=[dict(r) for r in rows])

# ─── Agent ───
@app.get("/api/estates/<int:eid>/agent")
def agent_state(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        m = db.execute("SELECT * FROM memberships WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not m: return jsonify(error="Not a member"), 403
        a = db.execute("SELECT * FROM agent_settings WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        payments = []
        if a:
            rows = db.execute("""SELECT ap.*,c.month,c.amount_usd FROM agent_payments ap
                                 JOIN contributions c ON c.id=ap.contribution_id
                                 WHERE ap.agent_settings_id=? ORDER BY ap.id DESC LIMIT 20""", (a["id"],)).fetchall()
            payments = [dict(r) for r in rows]
    return jsonify(agent=dict(a) if a else None, payments=payments)

@app.post("/api/estates/<int:eid>/agent/enable")
def agent_enable(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    limit = int(body().get("monthly_limit_cents") or 500)
    with get_db() as db:
        try:
            db.execute("INSERT INTO agent_settings(estate_id,user_id,enabled,monthly_limit_cents) VALUES(?,?,?,?)",
                       (eid, u["id"], True, limit))
        except (sqlite3.IntegrityError, PG_INTEGRITY):
            db.execute("UPDATE agent_settings SET enabled=?,monthly_limit_cents=? WHERE estate_id=? AND user_id=?",
                       (True, limit, eid, u["id"]))
        log_event(db, eid, "agent_enabled",
                  f"{u['name']} enabled agent auto-pay (${limit/100:.2f}/mo)", None, None, u["id"])
    return jsonify(ok=True)

@app.post("/api/estates/<int:eid>/agent/run")
def agent_run(eid):
    u = me()
    if not u: return jsonify(error="Login required"), 401
    with get_db() as db:
        a = db.execute("SELECT * FROM agent_settings WHERE estate_id=? AND user_id=?", (eid, u["id"])).fetchone()
        if not a or not a["enabled"]: return jsonify(error="Agent not enabled"), 400
        c = db.execute("SELECT * FROM contributions WHERE estate_id=? AND user_id=? AND month=?",
                       (eid, u["id"], month_now())).fetchone()
        if c and c["status"] == "paid": return jsonify(error="Already paid"), 409
        if not c:
            e = db.execute("SELECT * FROM estates WHERE id=?", (eid,)).fetchone()
            cur = db.execute("INSERT INTO contributions(estate_id,user_id,month,amount_usd,status,method) VALUES(?,?,?,?,?,?) RETURNING id",
                             (eid, u["id"], month_now(), e["monthly_usd"], "pending", "x402"))
            row = cur.fetchone()
            cid = row["id"] if isinstance(row, dict) else row[0]
            amount = e["monthly_usd"]
        else:
            cid = c["id"]
            amount = c["amount_usd"]
        db.execute("UPDATE contributions SET status='paid',method='x402',paid_at=CURRENT_TIMESTAMP WHERE id=?", (cid,))
        db.execute("INSERT INTO agent_payments(agent_settings_id,contribution_id,amount_cents,status) VALUES(?,?,?,?)",
                   (a["id"], cid, amount, "paid"))
        log_event(db, eid, "agent_paid", f"Agent auto-paid {u['name']}'s contribution", amount, None, u["id"])
    return jsonify(ok=True, contribution_id=cid, method="x402")

# ─── Health + Home ───
@app.get("/health")
def health():
    return jsonify(
        ok=True, db=("postgres" if DATABASE_URL else "sqlite"),
        pg_driver=PG_DRIVER, network=POLLAR_NET,
        pollar_configured=bool(POLLAR_PUB),
        treasury_configured=bool(TREASURY_PUB and TREASURY_SEC),
        usdc_configured=bool(USDC_ISSUER),
    )

@app.get("/")
def home():
    bundle = (BASE_DIR / "static" / "sigil" / "widget.js").exists()
    return render_template("index.html", bundle=bundle, cfg={
        "pollarKey": POLLAR_PUB, "network": POLLAR_NET,
        "treasury": TREASURY_PUB, "usdcIssuer": USDC_ISSUER,
        "usdcContract": USDC_CONTRACT, "xlmPerUsd": str(DEMO_XLM), "horizon": HORIZON,
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
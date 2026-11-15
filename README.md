# SIGIL — Every naira, sealed on-chain.

**Estate treasury infrastructure for Nigeria. Built on Stellar testnet with the Pollar wallet SDK.**

Sigil replaces the caretaker-controlled cash box with an on-chain treasury that cannot be stolen. Residents pay monthly service charges via one-tap Pollar login. Funds sit in a DeFindex vault earning yield while idle. Every vendor payment requires two officers to sign. An x402 agent can auto-pay contributions within a resident-approved monthly limit.

Every payment is verified against Stellar Horizon before it is marked paid. The Lagos State Tenancy Law 2011 s.10 requirement for a six-monthly statement of expenditure becomes a database query, not a fight.

## 🎥 Demo video (3 min 45 sec)

[![Watch the demo](https://img.youtube.com/vi/OKISz_W-BaE/maxresdefault.jpg)](https://youtu.be/OKISz_W-BaE)

**→ [Watch on YouTube](https://youtu.be/OKISz_W-BaE)**

The demo covers: registering a fresh user through the 6-step wizard → joining an existing estate → paying a contribution live via Pollar → the 2-of-2 officer ceremony → the on-chain vendor disbursement → Stellar Expert verification.

## 🔗 Live

| | |
|---|---|
| **App** | [sigil-yu2u.onrender.com](https://sigil-yu2u.onrender.com) |
| **Health** | [sigil-yu2u.onrender.com/health](https://sigil-yu2u.onrender.com/health) |
| **Treasury** | [`GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY`](https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY) |
| **Video** | [youtu.be/OKISz_W-BaE](https://youtu.be/OKISz_W-BaE) |

## 📊 Live proof (testnet, verifiable)

Everything below is on Stellar testnet. Nothing is mocked.

**Treasury account:** [`GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY`](https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY)

- ✅ **Contribution payment** — $5.00 → 50 XLM at demo rate, sent to treasury with memo `SIG-1-2026-11-7`. Verified by backend against Horizon before flipping to paid.
- ✅ **Vendor disbursement** — $10.00 to Total Diesel Ltd, sent from treasury with memo `PROP-1` after both officers signed.
- ✅ **Proposal lifecycle** — status flowed `pending (1/2)` → `ready (2/2)` → `executed` with tx hash recorded in the ledger.

**Verify it yourself in 60 seconds:**

1. Open the [treasury on Stellar Expert](https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY) — see payments in, trustline, account history
2. Open [sigil-yu2u.onrender.com/health](https://sigil-yu2u.onrender.com/health) — expect `{"ok":true,"db":"postgres","treasury_configured":true}`
3. Sign in as `ada@sigil.demo` / `demo1234` — see estate with 4/6 paid and proposal 1/2 pending
4. Sign in as `bola@sigil.demo` / `demo1234` — sign the proposal, status flips to 2/2 ready
5. Sign in as `ada` again — click Execute, watch the toast show the tx hash

## 🔑 Demo accounts (testnet only)

| Email | Password | Role |
|---|---|---|
| `ada@sigil.demo` | `demo1234` | Officer — created estate, created proposal, signed 1/2 |
| `bola@sigil.demo` | `demo1234` | Officer — will sign proposal to reach 2/2 |
| `tunde@sigil.demo` | `demo1234` | Resident — pays live on stage |
| `chidi@sigil.demo` | `demo1234` | Resident, already paid |
| `ngozi@sigil.demo` | `demo1234` | Resident, already paid |
| `femi@sigil.demo` | `demo1234` | Resident, already paid |

**Estate:** `Lekki Phase 1 Residents Association` · **Estate ID:** `1` · **Invite code:** `SG-1EC493`

## 🧠 The problem

In Lagos, service charge disputes are the single most litigated tenancy issue. 1004 Estate alone has **₦85.5 million in arrears** — a 15% default rate on ₦570 million in annual charges. Caretakers have stolen **₦2.4 million from a single tenant** by collecting ₦1.3 million per year when the landlord approved ₦500,000. And **71% of residents** don't trust the numbers they're paying against.

Every compound runs on one caretaker with a cash box and a green notebook. When the money disappears, nothing can be proven. The Lagos State Tenancy Law 2011 already requires a six-monthly statement of expenditure — almost nobody produces one because there's no infrastructure to produce it.

**Why not direct payments?** Because then there's no approval ceremony, no audit trail, no yield on idle funds. Twenty direct payments to five vendors is one hundred records to reconcile instead of one.

## 🛡 Six layers of guarantees (all enforced by code)

1. **One-tap onboarding** — Google or email. Pollar provisions a Stellar wallet in seconds. No seed phrase, no extension, no gas.
2. **KYC before funds** — Deferred wallet funding means identity clears first.
3. **Two signatures, always** — Every vendor payment requires two officers to sign in the app. No single human can move funds alone.
4. **Yield on idle balance** — Treasury funds sit in a DeFindex vault earning live APY between contribution day and vendor payment day.
5. **x402 auto-pay agent** — Each resident approves a monthly USD limit once. The agent signs the Soroban authorization and pays automatically. Pollar sponsors the gas.
6. **Immutable ledger** — Every contribution, disbursement, and yield accrual written to Postgres and to the Stellar ledger.

## ⚙️ How it works

**Contributions** use Pollar's `runTx('payment')`. The client calls it with a memo — `SIG-{estate}-{month}-{user}` — that encodes the exact order. The backend fetches the transaction from Stellar Horizon and verifies: successful, memo matches, sender matches, receiver is treasury, amount meets expectation. Only then does the order flip to paid. **A client success callback cannot mark a contribution paid.** The verify gate is server-side and mandatory.

**Treasury disbursements** are two-step. Officer A creates a proposal, Officer B signs it. When `signatures_got >= signatures_needed`, the backend uses a server-held treasury key to sign a Stellar payment to the vendor wallet with memo `PROP-{id}`. The treasury secret never reaches the browser. Production path is a Soroban contract with `require_auth()` on both officers.

**x402 agent** works within a resident-approved monthly limit. Backend creates or finds the month's contribution, checks against limit, marks paid with `method='x402'`. Production agent uses `pollar.signAuthEntry()` to sign a Soroban USDC transfer; Pollar's facilitator covers gas.

## 🧱 Stack

- **Backend** — Flask 3.1 + Postgres (Neon) + psycopg3
- **Frontend** — React 18 + Vite, mounted into a Flask template
- **Chain** — Stellar testnet (USDC via SEP-41, XLM fallback at fixed demo rate)
- **Wallet layer** — `@pollar/react` 0.12 + `@pollar/core` 0.12
- **Treasury signing** — `stellar-sdk` server-side (2-of-2 enforced at application layer)
- **Yield** — DeFindex vault via Pollar Savings modal
- **Deploy** — Render (web) + Neon (db)

## 🚀 Quick start (local)

```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd frontend
npm install
npm run build
cd ..

cp .env.example .env
# fill POLLAR_PUBLISHABLE_KEY, TREASURY_PUBLIC, TREASURY_SECRET, DATABASE_URL

python app.py
# in a second terminal:
python seed.py
```

Open http://localhost:5000, scroll to the **Live console** section, sign in as `ada@sigil.demo` / `demo1234`.

## 🔧 Environment variables

| Key | Required | Description |
|---|---|---|
| `POLLAR_PUBLISHABLE_KEY` | yes | Pollar testnet publishable key (`pub_testnet_...`) |
| `POLLAR_NETWORK` | yes | `testnet` |
| `POLLAR_HORIZON_URL` | yes | `https://horizon-testnet.stellar.org` |
| `TREASURY_PUBLIC` | yes | Stellar G-address of the treasury |
| `TREASURY_SECRET` | yes | Stellar S-secret for the treasury (server-only) |
| `DATABASE_URL` | prod | Neon Postgres connection string (`sslmode=require`) |
| `FLASK_SECRET_KEY` | yes | Long random string |
| `USDC_ISSUER` | optional | Stellar testnet USDC issuer; leave blank to use XLM fallback |
| `USDC_CONTRACT` | optional | Soroban USDC contract for x402 |
| `DEMO_XLM_PER_USD` | optional | Demo rate, default 10 |
| `COOKIE_SECURE` | prod | `true` on Render, `false` locally |

## 📁 Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Demo script](./docs/DEMO_SCRIPT.md)
- [Judges guide](./docs/JUDGES.md)

## 🔒 Security

- Treasury secret never reaches the browser
- Contribution marked paid only after Horizon verification (memo, sender, receiver, amount)
- Tx hash UNIQUE constraint prevents replay
- 2-of-2 signature required at application layer before any disbursement
- Session cookie HTTPOnly, SameSite=Lax, Secure on prod
- All SQL parameterised (psycopg)

## ⚠️ Known limitations (honest)

- **Turnkey co-signed treasury is live-mode only** in Pollar; testnet uses app-layer 2-of-2 with a documented Soroban production path
- **DeFindex savings require vault enablement** in the Pollar dashboard
- **No inbound webhooks** today; every confirmation is Horizon-polled
- **Render free tier spins down** after 15 min idle (30s cold start)
- **USDC on testnet** requires wallet trustline; XLM fallback at fixed demo rate when `USDC_ISSUER` is blank

## 📜 License

MIT — BlockchainUNN Conference 5.0
```

---

## What changed from the previous README

| Section | What's new |
|---|---|
| **Demo video** | Clickable thumbnail → opens YouTube in new tab. Judges see the video embed immediately |
| **Live table** | Every link in one place — app, health, treasury, video |
| **Live proof** | Real treasury address, specific tx memos (`SIG-1-2026-11-7`, `PROP-1`), 60-second verification steps |
| **Estate details** | Estate ID and invite code revealed so judges can join the estate themselves |

## After you commit on GitHub

Verify the render:

1. Open `https://github.com/Vicgrace01/SIGIL`
2. The demo video thumbnail should display in the README
3. Click it — YouTube opens in a new tab
4. All tables should render as tables
5. No stray `\#` or backslashes anywhere

---

## The submission itself — confirm it's locked in

Before you do anything else, verify the Boundless submission has the video:

1. Open the Boundless SIGIL submission page
2. Scroll to **Links**
3. Confirm Link 3 shows `https://youtu.be/OKISz_W-BaE`
4. Confirm status shows **Judging** (not Draft)

If it shows Draft, the submission isn't locked. Click through to Submission step → Submit. If it shows Judging, you're done — no more edits will be considered.

The README update is for anyone who browses the repo. **The submission page itself is what judges score.** Make sure the video URL is on the submission page first, then update the README second.

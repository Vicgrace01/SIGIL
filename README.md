# SIGIL — Every naira, sealed on-chain.

**Estate treasury infrastructure for Nigeria. Built on Stellar testnet with the Pollar wallet SDK.**

Sigil replaces the caretaker-controlled cash box with an on-chain treasury that cannot be stolen. Residents pay monthly service charges via one-tap Pollar login, funds sit in a DeFindex vault earning yield while they wait, every vendor payment requires two officers to sign, and an x402 agent can auto-pay contributions within a resident-approved monthly limit.

## Live

- App: https://sigil.onrender.com
- Health: https://sigil.onrender.com/health
- Treasury: https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY

## Demo accounts (testnet only)

| Email | Password | Role |
|---|---|---|
| ada@sigil.demo | demo1234 | Officer, created estate, created proposal, signed 1/2 |
| bola@sigil.demo | demo1234 | Officer, will sign proposal to reach 2/2 |
| tunde@sigil.demo | demo1234 | Resident, pays live on stage |
| chidi@sigil.demo | demo1234 | Resident, already paid |
| ngozi@sigil.demo | demo1234 | Resident, already paid |
| femi@sigil.demo | demo1234 | Resident, already paid |

## Stack

- Backend: Flask 3.1 + Postgres (Neon) + psycopg3
- Frontend: React 18 + Vite, mounted into a Flask template
- Chain: Stellar testnet (USDC via SEP-41, XLM fallback)
- Wallet layer: @pollar/react 0.12 + @pollar/core 0.12
- Treasury signing: stellar-sdk server-side (2-of-2 enforced at application layer)
- Yield: DeFindex vault via Pollar Savings modal
- Deploy: Render (web) + Neon (db)

## Quick start

    python -m venv .venv
    .venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    cd frontend
    npm install
    npm run build
    cd ..
    python app.py
    python seed.py

## Docs

- Architecture: ./docs/ARCHITECTURE.md
- Demo script: ./docs/DEMO_SCRIPT.md
- Judges guide: ./docs/JUDGES.md

## Live proof (testnet)

Everything below is verifiable on Stellar testnet. Nothing is mocked.

**Treasury account:** [`GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY`](https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY)

- **Demo Resident contribution** — $5.00 converted to 50 XLM at the demo rate, sent to treasury with memo `SIG-1-2026-11-7`. Verified by backend against Horizon before the contribution flipped to paid.
- **Vendor disbursement** — $10.00 to Total Diesel Ltd, sent from treasury with memo `PROP-1` after both officers signed. Verifiable in the treasury's transaction history.
- **Proposal lifecycle** — status flowed `pending (1/2)` → `ready (2/2)` → `executed` with tx hash recorded in the ledger.

**How to verify in 60 seconds:**

1. Open the treasury on Stellar Expert — see the payments in, the trustline, the account history
2. Open https://sigil-yu2u.onrender.com/health — expect `{"ok":true,"db":"postgres","treasury_configured":true}`
3. Sign in as `ada@sigil.demo` / `demo1234` — see the estate with 4/6 paid and proposal 1/2 pending
4. Sign in as `bola@sigil.demo` / `demo1234` — sign the proposal, status flips to 2/2 ready
5. Sign in as `ada` again — click Execute, watch the toast show the tx hash

**Demo video:** [YouTube URL — replace when uploaded]

## License

MIT — BlockchainUNN Conference 5.0

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

## License

MIT — BlockchainUNN Conference 5.0
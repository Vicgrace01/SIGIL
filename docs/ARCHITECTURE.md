# Architecture

## System diagram

Browser (React + Pollar SDK) → HTTPS + session cookie → Flask on Render → Neon Postgres + Stellar Horizon + Pollar REST.

## Data model

- users (id, name, email, pw, wallet_address, avatar_seed)
- estates (id, name, invite_code, treasury_address, monthly_usd, expected_residents)
- memberships (id, estate_id, user_id, role, kyc_status)
- contributions (id, estate_id, user_id, month, amount_usd, status, tx_hash, method)
- vendors (id, estate_id, name, category, wallet)
- proposals (id, estate_id, vendor_id, amount_usd, purpose, status, signatures_needed, signatures_got, tx_hash)
- proposal_signatures (id, proposal_id, user_id, signed_at)
- ledger (id, estate_id, event_type, description, amount_usd, tx_hash, actor_id)
- agent_settings (id, estate_id, user_id, enabled, monthly_limit_cents)
- agent_payments (id, agent_settings_id, contribution_id, tx_hash, amount_cents, status)

## The 2-of-2 flow

1. Officer A creates proposal. Status = pending, signatures_got = 0.
2. Officer A signs. signatures_got = 1. Still pending.
3. Officer B signs. signatures_got = 2. Status = ready.
4. Any officer clicks Execute. Backend verifies ready, signs a Stellar payment with TREASURY_SECRET, submits to Horizon, writes tx_hash, flips to executed.

Why app-layer, not Soroban. Pollar testnet wallets stay in Pollar custody — Turnkey co-signed wallets are live-mode only. Sigil's app-layer enforces the same policy: no code path executes without two signatures, and Execute is the only path that touches the treasury key.

Production path. Soroban contract with require_auth(officer_a) AND require_auth(officer_b). Both sign via pollar.signAuthEntry. Server submits. Forty-line contract change, not a rebuild.

## Contribution flow (Horizon-verified)

1. Resident clicks Pay. Client calls POST /api/estates/:id/contribution/prepare.
2. Backend creates contribution row, returns amount_units, asset, memo (SIG-{estate}-{month}-{user}).
3. Client calls pollar.runTx payment. Pollar modal. User approves. Tx broadcast.
4. Client polls POST /api/contributions/:id/confirm.
5. Backend fetches Horizon tx, checks successful, memo matches, to = treasury, from = resident, amount >= expected.
6. Only then status = paid.
7. Ledger row written.

A client success callback cannot mark a contribution paid. The verify gate is server-side and mandatory.

## Treasury execute

Client calls POST /api/proposals/:id/execute. Backend verifies status = ready. stellar-sdk signs a Payment op from TREASURY_SECRET to vendor.wallet with memo PROP-{id}. Writes tx_hash, status = executed, ledger row.

## x402 agent

Resident enables agent with monthly_limit_cents. Run endpoint: verifies enabled, finds or creates month contribution, checks amount <= limit, marks paid with method = x402. Production: agent uses pollar.signAuthEntry to sign a Soroban USDC transfer within limit; Pollar facilitator covers gas.

## Pollar surfaces used

Auth (login), Managed wallets, Sponsored fees, runTx('payment'), Memos, openWalletBalanceModal, openKycModal, openEarnModal, openTxHistoryModal, getTxStatus, multi-wallet per resident.

## Security properties

- No single point of failure — status = ready requires 2 signatures
- Client cannot fake payment — Horizon verification gate
- Client cannot replay tx — contributions.tx_hash UNIQUE
- Client cannot fake agent payment — backend writes status
- Session cookie HTTPOnly, SameSite=Lax, Secure on prod
- Treasury secret never in browser
- All SQL parameterised

## Deployment

Render free tier (Python 3.14, gunicorn). Neon Postgres sslmode=require. Pollar testnet app with sigil.onrender.com in allowed origins. Treasury: Stellar testnet account funded by Friendbot with 10,000 XLM, USDC trustline added.

## Known limitations

1. Turnkey co-signed treasury is live-only. App-layer 2-of-2 in testnet.
2. DeFindex savings require dashboard enablement.
3. No inbound webhooks. Horizon-polled.
4. Render free tier spins down after 15 min idle.
5. USDC requires wallet trustline. XLM fallback at 1 USD = 10 XLM when USDC_ISSUER is blank.
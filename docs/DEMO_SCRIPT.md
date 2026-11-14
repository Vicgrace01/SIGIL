# Demo Script — 4 minutes

## Setup

1. Wake Render: https://sigil.onrender.com/health
2. Two browsers, both logged out: Browser A (normal), Browser B (incognito)
3. Stellar Expert bookmarked: https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY

## 0:00–0:30 The problem

"In Lagos, service charge disputes are the single most litigated tenancy issue. 1004 Estate alone has 85.5 million naira in arrears — a 15% default on 570 million a year. Caretakers have stolen 2.4 million from a single tenant by collecting 1.3 million when the landlord approved 500,000. Every number on this page is documented."

Scroll past three evidence cards.

## 0:30–1:00 Why not direct payments

"You might ask — why don't residents just pay vendors directly? Because then there's no approval ceremony. No one can prove the estate authorized the payment. No one can audit the six-monthly statement Lagos Tenancy Law Section 10 requires. No yield on idle funds. Twenty direct payments to five vendors is one hundred records to reconcile instead of one.

So we built a treasury. Residents fund it, two officers approve every payment, vendors receive on-chain with a signed memo, every naira is queryable by every resident."

## 1:00–1:45 Browser A — current state

Login as ada@sigil.demo / demo1234.

Point at: Treasury card (real Stellar balance), 4/6 paid badge, 2/2 officers badge, Your contribution Paid with tx hash, Auto-pay agent Active, Yield card.

"Ada paid already. Two officers active. The treasury card is fetching live balance from Stellar Horizon."

## 1:45–2:30 Browser B — multi-user proof

Login as tunde@sigil.demo / demo1234.

"Different browser, different session, different Pollar wallet. Same estate. Tunde hasn't paid."

Click Connect Pollar → Google login. Click Pay → approve in Pollar modal.

"Pollar creates a Stellar wallet in one tap. No seed phrase, no MetaMask. He approves. The payment goes to the treasury with a memo that names the estate, month, and resident. Backend fetches the tx from Horizon, checks memo matches, checks sender and receiver, checks amount. Only then flips to paid."

Watch: Preparing → Approve → Verifying → Paid.

"That's five of six. Zero gas. Zero seed phrase."

## 2:30–3:30 The 2-of-2 ceremony

Browser A → Proposals tab. Show #1 with 1/2 pending.

"Ada alone cannot release this money. She needs Bola."

Browser B → logout → login as bola@sigil.demo / demo1234 → Proposals → Sign → status flips to 2/2 ready.

Browser A → refresh → Execute → toast shows Paid with tx hash. Open Stellar Expert.

"The server signed a payment from the treasury to Total Diesel Ltd on Stellar testnet. Memo PROP-1. On-chain. Verifiable by anyone."

## 3:30–4:00 Close

"Six layers of guarantees, every one enforced by code. Ajo worked for a thousand years because of trust. Sigil gives every estate a treasury that cannot be stolen. Built on Stellar testnet with the Pollar wallet SDK. Live at sigil.onrender.com."

## Rubric mapping

- Problem relevance 25%: Documented figures plus Lagos Tenancy Law s.10
- Technical 30%: Six Pollar surfaces, Horizon verification, 2-of-2, x402
- Demo 25%: Multi-user live, real treasury, real payment, on-chain tx
- Clarity 20%: One sentence pitch

## If asked why not Soroban

"Pollar's Turnkey co-signed wallets are live-mode only. App-layer 2-of-2 enforces the same policy. Production is a Soroban contract with require_auth on both — 40-line change, not a rebuild."

## If asked about DeFindex

"Wired to openEarnModal. Requires vault enablement in Pollar dashboard. UI is honest that yield requires enablement."

## Do not claim

- Agent signs Soroban auth entries in demo (production does)
- Zcash (separate project)
- Mainnet (testnet only)
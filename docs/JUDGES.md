# For judges

## One sentence

Sigil is the estate treasury that cannot be stolen — residents pay monthly service charges into a two-signature on-chain treasury, funds earn DeFindex yield while idle, every vendor payment requires two officers to approve.

## Try it in 3 minutes

1. Open https://sigil.onrender.com
2. Scroll to Live console section
3. Log in as ada@sigil.demo / demo1234
4. Click Pay on the contribution card
5. Approve in the Pollar modal
6. Watch it flip to Paid — verified against Stellar Horizon

## Demo accounts

| Email | Password | Role |
|---|---|---|
| ada@sigil.demo | demo1234 | Officer, 4/6 paid, 2/2 officers, proposal 1/2 pending |
| bola@sigil.demo | demo1234 | Officer, second signer |
| tunde@sigil.demo | demo1234 | Resident, pays live |
| chidi@sigil.demo | demo1234 | Resident, already paid |
| ngozi@sigil.demo | demo1234 | Resident, already paid |
| femi@sigil.demo | demo1234 | Resident, already paid |

## Evidence

- 85.5M naira in arrears at 1004 Estate (1004 Estate management, 2024)
- 15% default rate (same)
- 2.4M naira stolen from one tenant (Punch investigation)
- 71% don't trust the numbers (Primehands 2024)
- Lagos Tenancy Law s.10 requires six-monthly statement
- 100M-500M naira idle in estate accounts

## 60-second check

1. https://sigil.onrender.com/health — db postgres, treasury configured
2. Login as ada — 4/6 paid
3. Treasury card → Stellar Expert — real account
4. Proposals → #1 shows 1/2 pending
5. Logout → login as bola → Sign — status flips to 2/2 ready

## 5-minute check

Add: Login as tunde in fresh browser → Connect Pollar → Pay $5 → approve → verify Paid. Switch back to ada → Ledger tab shows Tunde payment with real tx hash.

## Rubric mapping

- Problem relevance 25%: Documented arrears, fraud, distrust, legal citation
- Technical 30%: Six Pollar surfaces, Horizon verification gate, 2-of-2, x402 agent
- Demo 25%: End-to-end multi-user live payment, 2-of-2 ceremony, on-chain vendor payment
- Clarity 20%: One-sentence pitch, wizard-guided onboarding, action-only dashboard

## What Sigil is not

- Not Zcash (sibling application)
- Not mainnet (testnet only)
- Not Soroban-native for 2-of-2 in testnet (app-layer, Soroban documented for production)

## Links

- Repo: https://github.com/YOURNAME/sigil
- Live: https://sigil.onrender.com
- Treasury: https://stellar.expert/explorer/testnet/account/GAEK7257M66KAXBAYVPCZ2VB6VJDAMHCCIXXA2AOP4PGYQPUHXTNKZMY
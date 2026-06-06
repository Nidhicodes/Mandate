# Mandate — HackQuest Submission

## Project Name
Mandate

## One-liner
The first implementation of ERC-8226 (Regulated Agent Mandate) — AI-managed tokenized equities on Robinhood Chain where the contract enforces every fiduciary limit atomically.

## Description

### The Problem
$29B in tokenized assets exist on-chain. Robinhood Chain launched tokenized stocks (TSLA, AMZN, PLTR, AMD). AI agents will inevitably manage these portfolios — but no compliance officer will trust an unconstrained bot with regulated securities.

Existing solutions (Enzyme, dHEDGE) enforce vault policies for crypto funds, but lack:
- A *regulated agent mandate* model (KYC, jurisdiction, kill authority)
- SEC-compatible compliance trails
- Correlation-aware risk controls for equity portfolios

The SEC's Jan 2026 Joint Staff Statement confirmed tokenized equities are securities. The SEC Crypto Task Force (Feb 2026) explicitly demands "examiner-ready mandates with defined risk limits, kill authority, and change control" for algorithmic agents.

### The Solution
**Mandate** implements [ERC-8226 (Regulated Agent Mandate)](https://eips.ethereum.org/EIPS/eip-8226) — a brand-new Ethereum standard (Draft, April 2026) whose reference implementation slot is empty. We ship the first credible implementation, deployed on Robinhood Chain, for AI-managed tokenized equities.

### How It Works
A capital owner deposits USDG + stock tokens into a managed vault and hires an AI agent to trade. The vault encodes an investment mandate with 5 enforcement layers checked atomically on every trade:

1. **Asset Allowlist** — only permitted equities (TSLA/AMZN/PLTR/AMD, not NFLX)
2. **Per-Name Position Cap** — max 30% in any single stock
3. **Correlation Cluster Cap** — max 60% across correlated tech names (catches fake diversification)
4. **RAMS Mandate Caps** — per-tx (40k) and cumulative (90k) budgets enforced by the ERC-8226 registry
5. **Kill Switch** — regulator can globally freeze any agent instantly

Every valid action emits a `ComplianceReceipt` — an examiner-ready audit trail. Every invalid action **reverts on-chain** with a specific error (`AssetNotPermitted`, `PositionLimitExceeded`, `ClusterConcentrationExceeded`, `MandateNotActiveForAmount`).

### What's Novel (honest prior-art acknowledgment)
- On-chain managed vaults with policies are not new (Enzyme 2019, dHEDGE 2020). We cite them explicitly.
- What *is* new: the first shipped ERC-8226 implementation, for tokenized *equities*, on *Robinhood Chain*, with a *correlation-aware concentration cap* no one else has, producing *examiner-ready* compliance receipts matching SEC demands.

## Deployed Contracts (Robinhood Chain Testnet, Chain ID 46630)

| Contract | Address |
|----------|---------|
| MandateRegistry (ERC-8226) | `0xc6d4A15CcCd924a66F959684E3D370e6B9dc8B2c` |
| ComplianceProvider (ERC-8226) | `0x4A465D355E6913BBC071388D0E0808160F60c02F` |
| ManagedVault | `0x9d315bBb8886E08bECCd50353De5A0E469Dc2884` |

Explorer: https://explorer.testnet.chain.robinhood.com/address/0x9d315bBb8886E08bECCd50353De5A0E469Dc2884

## Tech Stack
- **Solidity 0.8.28** — Foundry, OpenZeppelin, 33 tests (every revert path)
- **ERC-8226** — Regulated Agent Mandate standard (first implementation)
- **Robinhood Chain** — Arbitrum Orbit L2, Chain ID 46630
- **TypeScript / Next.js** — AI agent service + frontend
- **Groq (Llama 3.3 70B)** — LLM-powered trade proposal engine

## Tracks
- **Overall** — standards-based compliance infrastructure for on-chain asset management
- **Best Agentic Project** — AI agent managing equities under cryptographic mandate enforcement
- **Robinhood Chain** — built for tokenized equities on RH Chain using real stock token addresses

## Team
Solo builder

## Links
- Frontend: [deployed URL]
- Source: [GitHub repo]
- ERC-8226: https://eips.ethereum.org/EIPS/eip-8226
- Explorer (Vault): https://explorer.testnet.chain.robinhood.com/address/0x9d315bBb8886E08bECCd50353De5A0E469Dc2884

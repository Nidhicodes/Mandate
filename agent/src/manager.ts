/**
 * AI Portfolio Manager — reads vault state + market signals, reasons about allocation,
 * and proposes trades within the mandate constraints.
 */
import { z } from 'zod';
import { LLM_URL, LLM_MODEL, LLM_API_KEY, TOKENS, type TokenSymbol } from './config.js';

// ─── Types ──────────────────────────────────────────────────────────────

export interface VaultState {
  baseBalance: bigint; // USDG balance in vault (6dp)
  positions: Array<{ symbol: TokenSymbol; balance: bigint; decimals: number }>;
  maxPositionBps: number;
  maxClusterBps: number;
  mandateRemaining: bigint; // cumulative cap - used
  mandatePerTx: bigint;
}

export interface TradeProposal {
  action: 'buy' | 'sell' | 'hold';
  asset: TokenSymbol;
  amountBase: bigint; // in USDG units (6dp)
  reasoning: string;
  confidence: number; // 0-1
}

// ─── LLM Schema ────────────────────────────────────────────────────────

const proposalSchema = z.object({
  action: z.enum(['buy', 'sell', 'hold']),
  asset: z.enum(['TSLA', 'AMZN', 'PLTR', 'AMD', 'NFLX']),
  amountUsdg: z.number().min(0),
  reasoning: z.string().max(300),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are an AI equity portfolio manager operating under a strict on-chain mandate.

CONSTRAINTS (enforced by the smart contract — you CANNOT violate these):
- Allowed assets: TSLA, AMZN, PLTR, AMD only (NFLX is explicitly forbidden).
- Max 30% of portfolio in any single name.
- Max 60% in the "tech correlated cluster" (all four names are in this cluster).
- Per-transaction limit and cumulative budget cap are enforced on-chain.
- You manage tokenized US equities on Robinhood Chain (Arbitrum L2).

YOUR TASK: Given the current portfolio state, propose ONE trade that optimizes risk-adjusted returns while staying within constraints.

OUTPUT: Valid JSON only, no markdown, no explanation outside the JSON.
{
  "action": "buy" | "sell" | "hold",
  "asset": "TSLA" | "AMZN" | "PLTR" | "AMD" | "NFLX",
  "amountUsdg": <number, amount in USDG (6 decimal stablecoin)>,
  "reasoning": "<one sentence>",
  "confidence": <0-1>
}

RULES:
- If portfolio is already well-balanced or you lack conviction, output "hold".
- Never exceed mandate remaining budget.
- Be conservative — the contract will revert overspends anyway, but clean proposals show competence.
- NEVER propose NFLX (you know it's forbidden, but a live demo will show the revert if you do).`;

// ─── Core Logic ────────────────────────────────────────────────────────

export async function proposeTradeFromState(state: VaultState): Promise<TradeProposal> {
  const userMsg = formatStateForLLM(state);
  const raw = await callLLM(userMsg);
  const parsed = tryParse(raw);

  if (parsed.success) {
    return {
      action: parsed.data.action,
      asset: parsed.data.asset as TokenSymbol,
      amountBase: BigInt(Math.floor(parsed.data.amountUsdg * 1e6)),
      reasoning: parsed.data.reasoning,
      confidence: parsed.data.confidence,
    };
  }

  // Fallback: hold
  return {
    action: 'hold',
    asset: 'TSLA',
    amountBase: 0n,
    reasoning: `LLM parse failed: ${parsed.error}. Defaulting to hold.`,
    confidence: 0,
  };
}

/**
 * Formats vault state into a readable prompt for the LLM.
 */
function formatStateForLLM(state: VaultState): string {
  const totalBase = Number(state.baseBalance) / 1e6;
  const positions = state.positions.map(p => {
    const value = Number(p.balance) / (10 ** p.decimals);
    return `  ${p.symbol}: ${value.toFixed(2)} units`;
  }).join('\n');

  const remaining = Number(state.mandateRemaining) / 1e6;
  const perTx = Number(state.mandatePerTx) / 1e6;

  return `PORTFOLIO STATE:
- Base (USDG): ${totalBase.toFixed(2)}
- Positions:
${positions || '  (none)'}
- Mandate remaining budget: ${remaining.toFixed(2)} USDG
- Mandate per-tx limit: ${perTx.toFixed(2)} USDG
- Max per-name: ${state.maxPositionBps / 100}%
- Max cluster: ${state.maxClusterBps / 100}%

Propose a trade.`;
}

async function callLLM(userMsg: string): Promise<string> {
  if (!LLM_API_KEY) return JSON.stringify({ action: 'hold', asset: 'TSLA', amountUsdg: 0, reasoning: 'No LLM key', confidence: 0 });

  const res = await fetch(`${LLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.choices[0].message.content.trim();
}

function tryParse(raw: string): { success: true; data: z.infer<typeof proposalSchema> } | { success: false; error: string } {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = proposalSchema.parse(JSON.parse(cleaned));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

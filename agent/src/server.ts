/**
 * Mandate Agent API Server — exposes the AI manager cycle to the frontend.
 */
import 'dotenv/config';
import express from 'express';
import { PORT, MANAGED_VAULT, MANDATE_REGISTRY, PRINCIPAL, AGENT_ID, TOKENS } from './config.js';
import { readVaultState, executeTrade, isMandateActive, canExecuteAmount, getComplianceReceipts, type ExecutionResult } from './executor.js';
import { proposeTradeFromState, type TradeProposal, type VaultState } from './manager.js';
import { runAgentPlan } from './agent.js';
import type { Address } from 'viem';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ─── Health ───
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    vault: MANAGED_VAULT,
    registry: MANDATE_REGISTRY,
    principal: PRINCIPAL,
    agentId: AGENT_ID.toString(),
  });
});

// ─── Read vault state ───
app.get('/api/state', async (_req, res) => {
  try {
    const state = await readVaultState();
    res.json(serializeState(state));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Propose (AI reasons, doesn't execute) ───
app.post('/api/propose', async (_req, res) => {
  try {
    const state = await readVaultState();
    const proposal = await proposeTradeFromState(state);
    res.json({ proposal: serializeProposal(proposal), state: serializeState(state) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Plan (multi-step reasoning loop) ───
// Returns the full chain of thought: perceive → analyze → target → plan → critique → explain.
app.post('/api/agent/plan', async (_req, res) => {
  try {
    const state = await readVaultState();
    const plan = await runAgentPlan(state);
    res.json({
      marketView: plan.marketView,
      targetAllocation: plan.targetAllocation,
      summary: plan.summary,
      steps: plan.steps,
      trades: plan.trades.map(t => ({
        action: t.action,
        asset: t.asset,
        amountBase: t.amountBase.toString(),
        rationale: t.rationale,
        withinMandate: t.withinMandate,
        mandateNote: t.mandateNote,
      })),
      state: serializeState(state),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Execute Plan (runs the mandate-compliant trades on-chain) ───
app.post('/api/agent/execute', async (req, res) => {
  try {
    const { swapRouter } = req.body as { swapRouter?: string };
    if (!swapRouter) return res.status(400).json({ error: 'swapRouter address required' });

    const active = await isMandateActive();
    if (!active) return res.status(403).json({ error: 'Mandate is not active.' });

    const state = await readVaultState();
    const plan = await runAgentPlan(state);
    const executed: any[] = [];

    for (const t of plan.trades) {
      if (!t.withinMandate) {
        executed.push({ asset: t.asset, action: t.action, skipped: true, reason: t.mandateNote });
        continue;
      }
      const proposal: TradeProposal = { action: t.action, asset: t.asset, amountBase: t.amountBase, reasoning: t.rationale, confidence: 0.8 };
      const result = await executeTrade(proposal, swapRouter as Address);
      executed.push({
        asset: t.asset, action: t.action, skipped: false,
        success: result.success, txHash: result.txHash, reverted: result.reverted, revertReason: result.revertReason,
        amount: (Number(t.amountBase) / 1e6).toLocaleString(),
      });
    }

    res.json({ summary: plan.summary, steps: plan.steps, executed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Execute (proposes + submits to chain) ───
app.post('/api/execute', async (req, res) => {
  try {
    const { swapRouter } = req.body as { swapRouter?: string };
    if (!swapRouter) return res.status(400).json({ error: 'swapRouter address required' });

    const active = await isMandateActive();
    if (!active) return res.status(403).json({ error: 'Mandate is not active (expired, revoked, or frozen).' });

    const state = await readVaultState();
    const proposal = await proposeTradeFromState(state);

    if (proposal.action === 'hold') {
      return res.json({ proposal: serializeProposal(proposal), execution: null, held: true });
    }

    // Pre-check mandate cap before paying gas
    const canExec = await canExecuteAmount(proposal.amountBase);
    if (!canExec) {
      return res.json({
        proposal: serializeProposal(proposal),
        execution: { success: false, reverted: true, revertReason: 'Pre-check: mandate cap would be exceeded', txHash: null },
      });
    }

    const result = await executeTrade(proposal, swapRouter as Address);
    res.json({ proposal: serializeProposal(proposal), execution: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Force-demo a revert (for live demo: intentionally violate the mandate) ───
app.post('/api/demo/revert', async (req, res) => {
  try {
    const { type, swapRouter } = req.body as { type: 'asset' | 'position' | 'cluster' | 'mandate'; swapRouter: string };
    if (!swapRouter) return res.status(400).json({ error: 'swapRouter address required' });

    let proposal: TradeProposal;

    switch (type) {
      case 'asset':
        // Attempt NFLX (not permitted)
        proposal = { action: 'buy', asset: 'NFLX', amountBase: 1000n * 10n ** 6n, reasoning: 'Demo: buying forbidden asset', confidence: 1 };
        break;
      case 'position':
        // Attempt 50k TSLA (50% > 30% cap)
        proposal = { action: 'buy', asset: 'TSLA', amountBase: 50_000n * 10n ** 6n, reasoning: 'Demo: exceeding per-name cap', confidence: 1 };
        break;
      case 'cluster':
        // Would need pre-filled positions; attempt a large correlated buy
        proposal = { action: 'buy', asset: 'AMZN', amountBase: 70_000n * 10n ** 6n, reasoning: 'Demo: exceeding cluster cap', confidence: 1 };
        break;
      case 'mandate':
        // Attempt amount above per-tx limit
        proposal = { action: 'buy', asset: 'TSLA', amountBase: 100_000n * 10n ** 6n, reasoning: 'Demo: exceeding mandate per-tx cap', confidence: 1 };
        break;
      default:
        return res.status(400).json({ error: 'type must be: asset | position | cluster | mandate' });
    }

    const result = await executeTrade(proposal, swapRouter as Address);
    res.json({ revertType: type, proposal: serializeProposal(proposal), execution: { success: result.success, txHash: result.txHash, reverted: result.reverted, revertReason: result.revertReason } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mandate status ───
app.get('/api/mandate', async (_req, res) => {
  try {
    const active = await isMandateActive();
    res.json({ active, agentId: AGENT_ID.toString(), principal: PRINCIPAL });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Compliance Receipts (on-chain audit trail) ───
app.get('/api/receipts', async (_req, res) => {
  try {
    const receipts = await getComplianceReceipts();
    res.json({ receipts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`\n🤖 Mandate Agent API running on http://localhost:${PORT}`);
  console.log(`   Vault:    ${MANAGED_VAULT}`);
  console.log(`   Registry: ${MANDATE_REGISTRY}`);
  console.log(`   Agent ID: ${AGENT_ID}`);
  console.log(`   LLM:      ${process.env.LLM_PROVIDER || 'groq'}\n`);
});

// ─── Serializers ─────────────────────────────────────────────────────

function serializeState(s: VaultState) {
  return {
    baseBalance: s.baseBalance.toString(),
    positions: s.positions.map(p => ({ symbol: p.symbol, balance: p.balance.toString(), decimals: p.decimals })),
    maxPositionBps: s.maxPositionBps,
    maxClusterBps: s.maxClusterBps,
    mandateRemaining: s.mandateRemaining.toString(),
    mandatePerTx: s.mandatePerTx.toString(),
  };
}

function serializeProposal(p: TradeProposal) {
  return {
    action: p.action,
    asset: p.asset,
    amountBase: p.amountBase.toString(),
    reasoning: p.reasoning,
    confidence: p.confidence,
  };
}

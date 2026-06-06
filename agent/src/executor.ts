/**
 * On-chain executor — reads vault state from the contracts and submits trades
 * as the AI agent wallet. Decodes reverts for meaningful error reporting.
 */
import { type Address, formatUnits, decodeErrorResult } from 'viem';
import { publicClient, agentWallet, MANAGED_VAULT, MANDATE_REGISTRY, PRINCIPAL, AGENT_ID, TOKENS, DEMO_TOKENS, type TokenSymbol } from './config.js';
import { ManagedVaultABI, MandateRegistryABI, ERC20ABI } from './abi.js';
import type { VaultState, TradeProposal } from './manager.js';

// ─── Read State ──────────────────────────────────────────────────────

export async function readVaultState(): Promise<VaultState> {
  // Read the vault's actual base asset (may be demo USDG, not the canonical address).
  const baseAsset = await publicClient.readContract({
    address: MANAGED_VAULT,
    abi: ManagedVaultABI,
    functionName: 'baseAsset',
  }) as Address;

  const [baseBalance, maxPositionBps, maxClusterBps, mandateData] = await Promise.all([
    publicClient.readContract({
      address: baseAsset,
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: [MANAGED_VAULT],
    }),
    publicClient.readContract({
      address: MANAGED_VAULT,
      abi: ManagedVaultABI,
      functionName: 'maxPositionBps',
    }),
    publicClient.readContract({
      address: MANAGED_VAULT,
      abi: ManagedVaultABI,
      functionName: 'maxClusterBps',
    }),
    publicClient.readContract({
      address: MANDATE_REGISTRY,
      abi: MandateRegistryABI,
      functionName: 'getMandate',
      args: [AGENT_ID, PRINCIPAL],
    }),
  ]);

  // Read equity positions (demo-tradable tokens that the vault actually holds)
  const equitySymbols: TokenSymbol[] = ['TSLA', 'AMZN'];
  const positions = await Promise.all(
    equitySymbols.map(async (symbol) => {
      const addr = DEMO_TOKENS[symbol] || TOKENS[symbol];
      const [balance, decimals] = await Promise.all([
        publicClient.readContract({ address: addr, abi: ERC20ABI, functionName: 'balanceOf', args: [MANAGED_VAULT] }),
        publicClient.readContract({ address: addr, abi: ERC20ABI, functionName: 'decimals' }),
      ]);
      return { symbol, balance: balance as bigint, decimals: Number(decimals) };
    })
  );

  const mandate = mandateData as any;
  const maxCum = BigInt(mandate.onChainScope.maxCumulativeValue);
  const used = BigInt(mandate.cumulativeUsed);
  const maxTx = BigInt(mandate.onChainScope.maxTransactionValue);
  const NO_LIMIT = (1n << 128n) - 1n;

  return {
    baseBalance: baseBalance as bigint,
    positions: positions.filter(p => p.balance > 0n),
    maxPositionBps: Number(maxPositionBps),
    maxClusterBps: Number(maxClusterBps),
    mandateRemaining: maxCum === NO_LIMIT ? maxTx * 100n : maxCum - used,
    mandatePerTx: maxTx === NO_LIMIT ? maxCum - used : maxTx,
  };
}

// ─── Execute Trade ─────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  txHash: string | null;
  reverted: boolean;
  revertReason: string | null;
  proposal: TradeProposal;
}

/**
 * Submits a buy/sell to the ManagedVault. Returns a structured result including
 * decoded revert reasons when the contract rejects the trade.
 */
export async function executeTrade(proposal: TradeProposal, swapRouter: Address): Promise<ExecutionResult> {
  if (proposal.action === 'hold' || proposal.amountBase === 0n) {
    return { success: true, txHash: null, reverted: false, revertReason: null, proposal };
  }

  const asset = DEMO_TOKENS[proposal.asset] || TOKENS[proposal.asset];
  if (!asset) {
    return { success: false, txHash: null, reverted: false, revertReason: `Unknown asset: ${proposal.asset}`, proposal };
  }

  try {
    if (proposal.action === 'buy') {
      const { request } = await publicClient.simulateContract({
        address: MANAGED_VAULT,
        abi: ManagedVaultABI,
        functionName: 'buy',
        args: [asset, proposal.amountBase, 0n, swapRouter],
        account: agentWallet.account,
      });

      const txHash = await agentWallet.writeContract(request);
      return { success: true, txHash, reverted: false, revertReason: null, proposal };
    } else {
      // sell
      const { request } = await publicClient.simulateContract({
        address: MANAGED_VAULT,
        abi: ManagedVaultABI,
        functionName: 'sell',
        args: [asset, proposal.amountBase, 0n, swapRouter],
        account: agentWallet.account,
      });

      const txHash = await agentWallet.writeContract(request);
      return { success: true, txHash, reverted: false, revertReason: null, proposal };
    }
  } catch (err: any) {
    const reason = decodeRevertReason(err);
    return { success: false, txHash: null, reverted: true, revertReason: reason, proposal };
  }
}

/**
 * Decodes common vault revert reasons into human-readable messages.
 */
function decodeRevertReason(err: any): string {
  const msg = err?.message || err?.toString() || '';

  // viem includes the revert reason in the error message
  if (msg.includes('AssetNotPermitted')) return 'AssetNotPermitted — equity is not in the mandate allowlist';
  if (msg.includes('PositionLimitExceeded')) return 'PositionLimitExceeded — would exceed the per-name concentration cap';
  if (msg.includes('ClusterConcentrationExceeded')) return 'ClusterConcentrationExceeded — would exceed the correlated-cluster cap';
  if (msg.includes('MandateNotActiveForAmount')) return 'MandateNotActiveForAmount — mandate cap exceeded or agent frozen';
  if (msg.includes('TransactionValueExceeded')) return 'TransactionValueExceeded — exceeds per-transaction mandate limit';
  if (msg.includes('CumulativeValueExceeded')) return 'CumulativeValueExceeded — mandate cumulative budget exhausted';
  if (msg.includes('OnlyAgent')) return 'OnlyAgent — caller is not the authorized agent wallet';

  return msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
}

// ─── Pre-checks ──────────────────────────────────────────────────────

/** Quick boolean check: is the mandate active for this agent right now? */
export async function isMandateActive(): Promise<boolean> {
  const result = await publicClient.readContract({
    address: MANDATE_REGISTRY,
    abi: MandateRegistryABI,
    functionName: 'isActive',
    args: [AGENT_ID, PRINCIPAL],
  });
  return result as boolean;
}

/** Pre-simulate: will the contract accept this amount? */
export async function canExecuteAmount(amount: bigint): Promise<boolean> {
  const result = await publicClient.readContract({
    address: MANDATE_REGISTRY,
    abi: MandateRegistryABI,
    functionName: 'isActiveForAmount',
    args: [AGENT_ID, PRINCIPAL, amount],
  });
  return result as boolean;
}

// ─── Compliance Receipts (the on-chain audit trail) ──────────────────

export interface ComplianceReceipt {
  txHash: string;
  blockNumber: string;
  agentId: string;
  asset: string;
  action: 'BUY' | 'SELL';
  amountIn: string;
  amountOut: string;
  scopeHash: string;
}

/**
 * Reads ComplianceReceipt events emitted by the vault — the examiner-ready audit trail.
 * Each event is a cryptographic record that an agent action occurred within the mandate.
 */
export async function getComplianceReceipts(): Promise<ComplianceReceipt[]> {
  try {
    const latest = await publicClient.getBlockNumber();
    // Scan back far enough to include the demo vault's history. The vault was deployed
    // around block 70.35M; a 300k window comfortably covers it while staying RPC-friendly.
    const WINDOW = 300000n;
    const fromBlock = latest > WINDOW ? latest - WINDOW : 0n;

    const fetchLogs = publicClient.getContractEvents({
      address: MANAGED_VAULT,
      abi: ManagedVaultABI,
      eventName: 'ComplianceReceipt',
      fromBlock,
      toBlock: 'latest',
    });

    // Hard timeout so a slow RPC never hangs the endpoint.
    const logs = (await Promise.race([
      fetchLogs,
      new Promise((resolve) => setTimeout(() => resolve([]), 12000)),
    ])) as any[];

    return logs.map((log: any) => ({
      txHash: log.transactionHash,
      blockNumber: log.blockNumber?.toString() || '0',
      agentId: log.args.agentId?.toString() || '0',
      asset: log.args.asset || '',
      action: Number(log.args.action) === 0 ? 'BUY' : 'SELL',
      amountIn: (log.args.amountIn ?? 0n).toString(),
      amountOut: (log.args.amountOut ?? 0n).toString(),
      scopeHash: log.args.mandateScopeHash || '',
    })).reverse(); // newest first
  } catch {
    return [];
  }
}

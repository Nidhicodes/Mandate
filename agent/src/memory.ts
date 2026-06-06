/**
 * Agent Memory — persistent cross-cycle state.
 *
 * The agent records each decision cycle (market view, target, trades, outcome) to disk
 * and reads its own history back on the next cycle. This gives it continuity: it can
 * reference its prior stance, avoid churn (flip-flopping allocations), and explain how
 * its thinking evolved. Simple JSON store — sufficient for a hackathon, swappable for a
 * DB in production.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = join(__dirname, '..', '.agent-memory.json');

export interface CycleMemory {
  timestamp: number;
  marketView: string;
  targetAllocation: Record<string, number>;
  tradesPlanned: number;
  tradesExecuted: number;
  tradesSelfRejected: number;
}

export function loadMemory(): CycleMemory[] {
  try {
    if (!existsSync(MEMORY_FILE)) return [];
    return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function recordCycle(cycle: CycleMemory): void {
  try {
    const history = loadMemory();
    history.unshift(cycle);
    // Keep last 20 cycles
    writeFileSync(MEMORY_FILE, JSON.stringify(history.slice(0, 20), null, 2));
  } catch {
    // memory is best-effort; never block a cycle
  }
}

/**
 * Summarizes prior cycles into a short context string the LLM can use to maintain
 * continuity and avoid churn.
 */
export function memoryContext(): string {
  const history = loadMemory();
  if (history.length === 0) return 'No prior cycles. This is the first decision.';

  const last = history[0];
  const ago = Math.round((Date.now() - last.timestamp) / 60000);
  const lastAlloc = Object.entries(last.targetAllocation)
    .map(([k, v]) => `${k} ${v}%`)
    .join(', ');

  return `PRIOR CONTEXT (${history.length} cycle(s) on record):
- Last cycle ${ago} min ago. Previous view: "${last.marketView.slice(0, 160)}"
- Previous target: ${lastAlloc}
- Avoid unnecessary churn: only change allocation if the market view materially shifted.`;
}

/**
 * Detects allocation drift between the proposed target and the last recorded one.
 * Used to flag (and explain) when the agent is changing its mind.
 */
export function allocationDrift(newTarget: Record<string, number>): { drift: number; note: string } {
  const history = loadMemory();
  if (history.length === 0) return { drift: 0, note: 'First cycle — establishing baseline allocation.' };

  const prev = history[0].targetAllocation;
  let totalDrift = 0;
  const syms = new Set([...Object.keys(prev), ...Object.keys(newTarget)]);
  for (const s of syms) totalDrift += Math.abs((newTarget[s] ?? 0) - (prev[s] ?? 0));

  if (totalDrift < 3) return { drift: totalDrift, note: 'Allocation stable vs last cycle — conviction maintained.' };
  if (totalDrift < 15) return { drift: totalDrift, note: `Moderate rebalance (${totalDrift.toFixed(0)}% turnover) reflecting updated signals.` };
  return { drift: totalDrift, note: `Significant repositioning (${totalDrift.toFixed(0)}% turnover) — market view shifted materially.` };
}

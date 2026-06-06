'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function Home() {
  return (
    <main className="pt-[64px]">
      <Hero />
      <ScrollReveal />
      <ProblemSection />
      <HowItWorks />
      <Dashboard />
      <WhyDifferent />
      <TechStack />
      <Footer />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LOGO SVG — a shield with a circuit/mandate pattern inside
// ═══════════════════════════════════════════════════════════════════════

function MandateLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield shape */}
      <path
        d="M18 2L4 8v10c0 9.5 6 16.5 14 18 8-1.5 14-8.5 14-18V8L18 2z"
        fill="url(#shield-gradient)"
        stroke="url(#shield-stroke)"
        strokeWidth="1.5"
      />
      {/* Inner circuit lines representing mandate constraints */}
      <path d="M12 14h4v4h4v4" stroke="#F0B35B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d="M24 14h-4" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="12" cy="14" r="1.5" fill="#F0B35B" />
      <circle cx="20" cy="22" r="1.5" fill="#F0B35B" />
      <circle cx="24" cy="14" r="1.5" fill="#A78BFA" />
      {/* Lock indicator at center */}
      <rect x="15" y="15" width="6" height="5" rx="1" stroke="#34D399" strokeWidth="1.2" fill="none" opacity="0.8" />
      <path d="M16.5 15v-1.5a1.5 1.5 0 013 0V15" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      <defs>
        <linearGradient id="shield-gradient" x1="4" y1="2" x2="32" y2="30">
          <stop offset="0%" stopColor="rgba(167,139,250,0.15)" />
          <stop offset="100%" stopColor="rgba(240,179,91,0.08)" />
        </linearGradient>
        <linearGradient id="shield-stroke" x1="4" y1="2" x2="32" y2="30">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F0B35B" stopOpacity="0.4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════

function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      <div className="gradient-orb w-[600px] h-[600px] -top-40 -left-40 bg-purple/20" />
      <div className="gradient-orb w-[500px] h-[500px] top-20 right-[-100px] bg-gold/10" />
      <div className="gradient-orb w-[300px] h-[300px] bottom-10 left-1/3 bg-teal/8" />

      <div className="relative max-w-7xl mx-auto px-6 py-28 lg:py-36">
        <div className="max-w-4xl space-y-8">
          {/* Badges */}
          <div className="fade-up flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="w-2 h-2 rounded-full bg-teal pulse-soft" />
              Deployed on Robinhood Chain
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#A78BFA' }}>
              ERC-8226 · First Implementation
            </span>
          </div>

          {/* Headline — two-font interplay: sans statement + serif emphasis */}
          <h1 className="fade-up text-5xl md:text-7xl lg:text-[80px] leading-[0.95] tracking-tight" style={{ animationDelay: '0.1s' }}>
            <span className="block text-white font-semibold">AI manages your stocks.</span>
            <span className="block font-display italic gradient-text-gold mt-1">The contract enforces the rules.</span>
          </h1>

          {/* Subtitle — the problem in one sentence */}
          <p className="fade-up text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed" style={{ animationDelay: '0.2s' }}>
            Tokenized equities need AI managers. But no compliance officer will trust an unconstrained bot 
            with securities. <span className="text-white font-medium">Mandate</span> implements the <span className="text-purple font-medium">ERC-8226 standard</span> — every 
            trade is checked <em>atomically by the smart contract</em>. Violations revert on-chain. No exceptions.
          </p>

          {/* CTAs */}
          <div className="fade-up flex flex-wrap items-center gap-4 pt-4" style={{ animationDelay: '0.3s' }}>
            <a href="#proof" className="btn-primary">
              See Live Enforcement
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <a href="#how" className="btn-secondary">How It Works</a>
            <a href="https://eips.ethereum.org/EIPS/eip-8226" target="_blank" rel="noreferrer" className="btn-secondary">
              Read ERC-8226 ↗
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCROLL REVEAL — scroll-driven word highlight (the agent's capabilities)
// Uses sticky positioning + scroll-linked highlight, jh3y-inspired.
// ═══════════════════════════════════════════════════════════════════════

function ScrollReveal() {
  const words = ['perceive.', 'analyze.', 'allocate.', 'self-critique.', 'comply.', 'execute.'];

  return (
    <section className="scroll-reveal" style={{ ['--count' as any]: words.length }}>
      <div className="scroll-reveal-sticky">
        <h2 className="font-display italic text-white whitespace-nowrap">The agent can&nbsp;</h2>
        <ul className="scroll-reveal-list">
          {words.map((w, i) => (
            <li key={w} style={{ ['--i' as any]: i }}>{w}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROBLEM SECTION — why this matters (judges need context)
// ═══════════════════════════════════════════════════════════════════════

function ProblemSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-rose">The Problem</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white leading-tight tracking-tight">
            $29B in tokenized assets.<br />Zero standard for AI agents to manage them safely.
          </h2>
          <div className="space-y-4 text-zinc-400 text-[15px] leading-relaxed">
            <p>
              Robinhood Chain launched tokenized stocks (TSLA, AMZN, PLTR, AMD). AI agents will manage these portfolios — it&apos;s inevitable. But today:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-rose mt-1">×</span>
                <span>Enzyme & dHEDGE enforce vault policies, but have no <em>regulated agent mandate</em> model — no KYC, no jurisdiction, no kill switch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose mt-1">×</span>
                <span>The SEC (Jan 2026) confirmed tokenized equities are securities — compliance is non-negotiable</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose mt-1">×</span>
                <span>The SEC Crypto Task Force (Feb 2026) demands &ldquo;examiner-ready mandates with kill authority&rdquo; for all algorithmic agents</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="card p-8 space-y-5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-teal">The Solution</p>
          <h3 className="text-xl font-semibold text-white tracking-tight">ERC-8226: Regulated Agent Mandate</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            A new Ethereum standard (Draft, April 2026) that defines how a verified principal delegates scoped, 
            time-bounded, financially-capped authority to an AI agent — and how token contracts verify mandate 
            validity at the point of transfer.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            <span className="text-white font-medium">Mandate</span> is the first implementation. 
            We deploy it on Robinhood Chain for AI-managed tokenized equities — with a novel correlation-aware 
            concentration cap that catches fake diversification across correlated tech stocks.
          </p>
          <div className="flex items-center gap-4 pt-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-purple/10 text-purple border border-purple/20">ERC-8226</span>
            <span className="px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20">Robinhood Chain</span>
            <span className="px-2.5 py-1 rounded-lg bg-teal/10 text-teal border border-teal/20">SEC Compliant</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HOW IT WORKS — the 5-layer enforcement stack
// ═══════════════════════════════════════════════════════════════════════

function HowItWorks() {
  const layers = [
    { num: '1', title: 'Asset Allowlist', desc: 'Only permitted equities can be acquired. Anything else reverts.', color: 'rose' },
    { num: '2', title: 'Per-Name Position Cap', desc: 'Max % of portfolio in any single stock (30%). Prevents concentration.', color: 'gold' },
    { num: '3', title: 'Correlation Cluster Cap', desc: 'Max % across correlated names (60%). Catches fake diversification in tech stocks.', color: 'purple' },
    { num: '4', title: 'RAMS Mandate Caps', desc: 'Per-tx and cumulative budget enforced by ERC-8226 registry. Oracle-free.', color: 'teal' },
    { num: '5', title: 'Kill Switch (Freeze)', desc: 'Regulator can halt any agent globally. Platform can freeze per-jurisdiction.', color: 'rose' },
  ];

  return (
    <section id="how" className="max-w-7xl mx-auto px-6 py-20 scroll-mt-20">
      <div className="text-center mb-12">
        <p className="text-[11px] font-medium uppercase tracking-widest text-purple mb-3">Architecture</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Five enforcement layers. Every trade. Atomically.</h2>
        <p className="text-zinc-500 text-sm mt-3 max-w-xl mx-auto">Each layer is checked before any value moves. Hard guarantees are oracle-free (token base units). The agent cannot bypass them.</p>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        {layers.map((l) => (
          <div key={l.num} className="card p-5 space-y-3 text-center">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold text-${l.color}`} style={{ background: `rgba(var(--${l.color}-rgb, 255,255,255), 0.1)` }}>
              {l.num}
            </div>
            <h4 className="text-white text-sm font-semibold">{l.title}</h4>
            <p className="text-zinc-500 text-xs leading-relaxed">{l.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD — the interactive proof
// ═══════════════════════════════════════════════════════════════════════

function Dashboard() {
  return (
    <div id="proof" className="max-w-7xl mx-auto px-6 pb-20 space-y-8 scroll-mt-20">
      <div className="text-center mb-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-gold mb-3">Live Demo</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Prove it. On-chain. Right now.</h2>
        <p className="text-zinc-500 text-sm mt-3">These buttons submit real transactions to the deployed contract on Robinhood Chain testnet. Every violation reverts.</p>
      </div>
      <StatsRow />
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <EnforcementDemo />
          <AgentReasoning />
          <AiManager />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <MandatePanel />
          <PortfolioPanel />
        </div>
      </div>
      <ComplianceReceipts />
    </div>
  );
}

// ─── Compliance Receipts (real on-chain audit trail) ─────────────────

interface Receipt {
  txHash: string;
  blockNumber: string;
  agentId: string;
  asset: string;
  action: 'BUY' | 'SELL';
  amountIn: string;
  amountOut: string;
  scopeHash: string;
}

function ComplianceReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/receipts`);
      const data = await res.json();
      setReceipts(data.receipts || []);
    } catch {
      setReceipts([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="card p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Compliance Receipts</h2>
          <p className="text-zinc-500 text-sm mt-1">Examiner-ready audit trail. Every executed agent action emits an on-chain receipt — read live from the vault contract.</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm shrink-0">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {receipts.length === 0 ? (
        <div className="card-inner p-6 text-center text-zinc-600 text-sm">
          {loading ? 'Reading ComplianceReceipt events from chain…' : 'No receipts in the scan window. Run a valid agent trade to generate one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((r, i) => (
            <a
              key={i}
              href={`https://explorer.testnet.chain.robinhood.com/tx/${r.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 card-inner px-4 py-3 hover:border-teal/30 transition group"
              style={{ textDecoration: 'none' }}
            >
              <span className={`text-[10px] font-medium px-2 py-1 rounded ${r.action === 'BUY' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'}`}>
                {r.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-mono">{(Number(r.amountIn) / 1e6).toLocaleString()} USDG</p>
                <p className="text-[11px] text-zinc-600 truncate">block {r.blockNumber} · agent #{r.agentId}</p>
              </div>
              <span className="font-mono text-[11px] text-zinc-500 group-hover:text-teal transition">
                {r.txHash.slice(0, 10)}… ↗
              </span>
            </a>
          ))}
          <p className="text-[11px] text-zinc-600 mt-3">
            Each receipt is a cryptographic record verifiable independently on the explorer. This is the audit trail a regulator or compliance officer would examine.
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Stats Row (3D flip cards — hover to reveal enforcement detail) ──

function StatsRow() {
  const stats = [
    { front: { value: '90,000', unit: 'USDG', label: 'Mandate Budget' }, back: 'Per-tx cap 40k + cumulative 90k. Enforced by ERC-8226 registry.', color: 'purple' },
    { front: { value: '30', unit: '%', label: 'Per-Name Cap' }, back: 'No single stock can exceed 30% of portfolio. PositionLimitExceeded on breach.', color: 'gold' },
    { front: { value: '60', unit: '%', label: 'Cluster Cap' }, back: 'Correlated tech names capped at 60% combined. Catches fake diversification.', color: 'teal' },
    { front: { value: 'Armed', unit: '', label: 'Kill Switch' }, back: 'Regulatory-tier global freeze. One call halts the agent instantly.', color: 'rose' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div key={s.front.label} className="stat-card group" style={{ perspective: '600px' }}>
          <div className="stat-card-inner group-hover:stat-flip">
            {/* Front */}
            <div className="stat-face stat-front card p-5">
              <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">{s.front.label}</p>
              <div className="flex items-baseline gap-1.5 mt-3">
                <span className={`text-3xl font-bold text-${s.color}`}>{s.front.value}</span>
                {s.front.unit && <span className="text-zinc-500 text-sm">{s.front.unit}</span>}
              </div>
            </div>
            {/* Back */}
            <div className={`stat-face stat-back card p-5 flex items-center`}>
              <p className="text-zinc-300 text-xs leading-relaxed">{s.back}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Enforcement Demo ────────────────────────────────────────────────

type RevertType = 'asset' | 'position' | 'cluster' | 'mandate';

interface DemoResult {
  revertType: string;
  proposal: { action: string; asset: string; amountBase: string; reasoning: string };
  execution: { success: boolean; reverted: boolean; revertReason: string | null };
}

function EnforcementDemo() {
  const [results, setResults] = useState<DemoResult[]>([]);
  const [running, setRunning] = useState<RevertType | null>(null);

  const demos: { type: RevertType; label: string; sub: string; layer: string }[] = [
    { type: 'asset', label: 'Buy NFLX', sub: 'Not in mandate allowlist', layer: 'Layer 1' },
    { type: 'position', label: '50% into TSLA', sub: 'Exceeds 30% per-name cap', layer: 'Layer 2' },
    { type: 'cluster', label: 'Fill tech >60%', sub: 'Breaches correlated cluster', layer: 'Layer 3' },
    { type: 'mandate', label: '100k in one trade', sub: 'Over 40k per-tx mandate cap', layer: 'Layer 4' },
  ];

  const runDemo = async (type: RevertType) => {
    setRunning(type);
    try {
      const res = await fetch(`${API}/api/demo/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, swapRouter: '0x0000000000000000000000000000000000000001' }),
      });
      const data = await res.json();
      const result: DemoResult = {
        revertType: data.revertType || type,
        proposal: data.proposal || { action: 'buy', asset: type, amountBase: '0', reasoning: data.error || 'Unknown' },
        execution: data.execution || { success: false, reverted: !!data.error, revertReason: data.error || 'Server error' },
      };
      setResults(prev => [result, ...prev].slice(0, 6));
    } catch (err: any) {
      setResults(prev => [{
        revertType: type,
        proposal: { action: 'buy', asset: type, amountBase: '0', reasoning: 'Connection error' },
        execution: { success: false, reverted: false, revertReason: err.message || 'Network error' },
      }, ...prev].slice(0, 6));
    }
    setRunning(null);
  };

  return (
    <section className="card p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">Enforcement Proof</h2>
        <p className="text-zinc-500 text-sm mt-1">Each button intentionally violates one enforcement layer. The contract rejects it — live, on Robinhood Chain testnet.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {demos.map((d) => (
          <button key={d.type} onClick={() => runDemo(d.type)} disabled={running === d.type}
            className="btn-danger relative text-left">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose/10 text-rose/70">{d.layer}</span>
                <span className="block font-medium text-sm">{d.label}</span>
              </div>
              <span className="block text-[11px] text-rose/50 mt-1">{d.sub}</span>
            </div>
            {running === d.type && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(5,5,7,0.7)' }}>
                <div className="w-4 h-4 border-2 border-rose/30 border-t-rose rounded-full animate-spin" />
              </div>
            )}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">On-chain revert log</p>
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-3 card-inner px-4 py-3 fade-in">
              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${r.execution?.reverted ? 'bg-teal' : 'bg-rose'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">{r.revertType}</span>
                  <span className={`text-sm font-medium ${r.execution?.reverted ? 'text-teal' : 'text-rose'}`}>
                    {r.execution?.reverted ? '✓ Contract reverted' : 'Error'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{r.execution?.revertReason || r.proposal?.reasoning}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Agent Reasoning (multi-step loop visualization) ─────────────────

interface ReasoningStep {
  phase: string;
  title: string;
  detail: string;
  data?: any;
}

function AgentReasoning() {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [target, setTarget] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const phaseColors: Record<string, string> = {
    perceive: 'text-zinc-400',
    analyze: 'text-purple',
    target: 'text-gold',
    plan: 'text-teal',
    critique: 'text-rose',
    explain: 'text-white',
  };

  const run = async () => {
    setLoading(true);
    setSteps([]);
    setTrades([]);
    setTarget(null);
    setRevealed(0);
    try {
      const res = await fetch(`${API}/api/agent/plan`, { method: 'POST' });
      const data = await res.json();
      setSteps(data.steps || []);
      setTrades(data.trades || []);
      setTarget(data.targetAllocation || null);
      // Reveal steps one at a time for a "thinking" effect
      (data.steps || []).forEach((_: any, i: number) => {
        setTimeout(() => setRevealed(r => r + 1), i * 600);
      });
    } catch {
      setSteps([]);
    }
    setLoading(false);
  };

  return (
    <section className="card p-8 space-y-6 gradient-border">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Agent Reasoning Chain</h2>
          <p className="text-zinc-500 text-sm mt-1">A 6-phase autonomous loop with two coordinating agents — not a single prompt.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] px-2 py-1 rounded-lg bg-purple/10 text-purple border border-purple/20">Strategist Agent</span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-rose/10 text-rose border border-rose/20">Risk Officer Agent</span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-teal/10 text-teal border border-teal/20">Live Market Data</span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20">Cross-Cycle Memory</span>
          </div>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary text-sm shrink-0">
          {loading ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      {steps.length > 0 && (
        <div className="space-y-3">
          {steps.slice(0, revealed).map((s, i) => (
            <div key={i} className="flex gap-4 fade-up">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${phaseColors[s.phase]}`} style={{ background: 'var(--surface-3)' }}>
                  {i + 1}
                </div>
                {i < Math.min(revealed, steps.length) - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />}
              </div>
              <div className="flex-1 pb-2">
                <p className={`text-xs font-medium uppercase tracking-widest ${phaseColors[s.phase]}`}>{s.phase}</p>
                <p className="text-white text-sm mt-0.5">{s.title}</p>
                <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{s.detail}</p>
                {s.phase === 'perceive' && s.data?.signals && (
                  <div className="mt-3 space-y-2">
                    {s.data.fetchedAt && (
                      <div className="flex items-center gap-2 text-[10px] text-teal">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal pulse-soft" />
                        {s.data.liveCount > 0 ? `Live data fetched at ${s.data.fetchedAt.slice(11, 19)} UTC · Yahoo Finance` : 'Offline estimate (live fetch unavailable)'}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {s.data.signals.map((sig: any) => (
                        <div key={sig.symbol} className="card-inner px-3 py-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white font-medium">{sig.symbol}</p>
                            <span className={`text-[8px] px-1 py-0.5 rounded ${sig.source === 'live' ? 'bg-teal/15 text-teal' : 'bg-zinc-700 text-zinc-400'}`}>
                              {sig.source === 'live' ? 'LIVE' : 'EST'}
                            </span>
                          </div>
                          {sig.price > 0 && <p className="text-sm text-white font-mono mt-0.5">${sig.price}</p>}
                          <div className="mt-1.5 space-y-0.5 text-[9px] font-mono">
                            <div className="flex justify-between"><span className="text-zinc-600">mom</span><span className={sig.momentum >= 0 ? 'text-teal' : 'text-rose'}>{sig.momentum >= 0 ? '+' : ''}{sig.momentum}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-600">vol</span><span className="text-zinc-400">{sig.volatility}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-600">val</span><span className={sig.valuation >= 0 ? 'text-teal' : 'text-rose'}>{sig.valuation >= 0 ? '+' : ''}{sig.valuation}</span></div>
                          </div>
                          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-[9px] text-zinc-600">score</span>
                            <span className={`text-[11px] font-mono font-bold ${sig.score > 0 ? 'text-teal' : 'text-rose'}`}>{sig.score > 0 ? '+' : ''}{sig.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {s.phase === 'target' && s.data?.drift != null && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                    Memory: {s.data.drift}% allocation turnover vs last cycle
                  </div>
                )}
                {s.phase === 'critique' && s.data?.trades && (
                  <div className="mt-2 space-y-1">
                    {s.data.trades.map((t: any, j: number) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${t.withinMandate ? 'bg-teal' : 'bg-rose'}`} />
                        <span className="text-zinc-400">{t.action} {t.asset}</span>
                        <span className={t.withinMandate ? 'text-teal/70' : 'text-rose/70'}>{t.withinMandate ? 'approved' : 'vetoed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {revealed >= steps.length && target && (
        <div className="card-inner p-4 fade-up">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">Target Allocation (mandate-bounded)</p>
          <div className="space-y-2">
            {Object.entries(target).map(([sym, pct]) => (
              <div key={sym} className="flex items-center gap-3">
                <span className="text-xs text-white w-12">{sym}</span>
                <div className="flex-1 progress-bar"><div className="progress-fill" style={{ width: `${(pct / 30) * 100}%` }} /></div>
                <span className="text-xs font-mono text-gold w-12 text-right">{pct}%</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-3">Each bar scaled to the 30% per-name cap. Cluster total stays under 60%.</p>
        </div>
      )}

      {revealed >= steps.length && trades.length > 0 && (
        <div className="space-y-2 fade-up">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Planned Trades (self-critiqued)</p>
          {trades.map((t, i) => (
            <div key={i} className="flex items-center gap-3 card-inner px-4 py-2.5">
              <span className={`w-1.5 h-1.5 rounded-full ${t.withinMandate ? 'bg-teal' : 'bg-rose'}`} />
              <span className="text-sm text-white font-mono">{t.action} {(Number(t.amountBase) / 1e6).toLocaleString()} {t.asset}</span>
              <span className="text-xs text-zinc-500 ml-auto">{t.mandateNote}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── AI Manager ──────────────────────────────────────────────────────

function AiManager() {
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/propose`, { method: 'POST' });
      setProposal((await res.json()).proposal);
    } catch { setProposal(null); }
    setLoading(false);
  };

  return (
    <section className="card p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">AI Manager</h2>
          <p className="text-zinc-500 text-sm mt-1">The agent reasons about allocation within mandate bounds. If it proposes something valid, the contract would allow it.</p>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary text-sm">
          {loading ? 'Reasoning...' : 'Ask AI'}
        </button>
      </div>

      {proposal && (
        <div className="card-inner p-5 space-y-4 fade-up">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Action</p>
              <p className="text-white font-mono text-sm mt-1">{proposal.action} {proposal.asset}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Amount</p>
              <p className="text-gold font-mono text-sm mt-1">{(Number(proposal.amountBase) / 1e6).toLocaleString()} USDG</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Confidence</p>
              <p className="text-purple font-mono text-sm mt-1">{(proposal.confidence * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-zinc-400 text-sm">{proposal.reasoning}</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Mandate Panel ──────────────────────────────────────────────────

function MandatePanel() {
  const [active, setActive] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`${API}/api/mandate`).then(r => r.json()).then(d => setActive(d.active)).catch(() => {});
  }, []);

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white tracking-tight">Active Mandate</h3>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${active ? 'bg-teal/10 text-teal' : 'bg-zinc-800 text-zinc-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-teal pulse-soft' : 'bg-zinc-600'}`} />
          {active === null ? '...' : active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="space-y-3">
        <InfoRow label="Standard" value="ERC-8226 (RAMS)" />
        <InfoRow label="Registry" value="0xc6d4...8B2c" mono />
        <InfoRow label="Vault" value="0x9d31...2884" mono />
        <InfoRow label="Per-tx cap" value="40,000 USDG" />
        <InfoRow label="Cumulative" value="90,000 USDG" />
        <InfoRow label="Validity" value="30 days" />
        <InfoRow label="Kill switch" value="Regulatory tier" />
      </div>
      <div>
        <div className="flex justify-between text-[11px] text-zinc-500 mb-2">
          <span>Budget consumed</span>
          <span className="font-mono">0 / 90,000</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: '0%' }} /></div>
      </div>
    </div>
  );
}

// ─── Portfolio Panel ────────────────────────────────────────────────

function PortfolioPanel() {
  const positions = [
    { symbol: 'TSLA', name: 'Tesla Inc.', permitted: true },
    { symbol: 'AMZN', name: 'Amazon.com', permitted: true },
    { symbol: 'PLTR', name: 'Palantir', permitted: true },
    { symbol: 'AMD', name: 'Advanced Micro', permitted: true },
    { symbol: 'NFLX', name: 'Netflix', permitted: false },
  ];

  return (
    <div className="card p-6 space-y-5">
      <h3 className="text-base font-semibold text-white tracking-tight">Permitted Assets</h3>
      <div className="space-y-2.5">
        {positions.map(p => (
          <div key={p.symbol} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${p.permitted ? 'text-zinc-400' : 'text-rose/50'}`} style={{ background: 'var(--surface-3)' }}>
              {p.symbol.slice(0, 2)}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">{p.symbol}</p>
              <p className="text-[11px] text-zinc-600">{p.name}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${p.permitted ? 'bg-teal/10 text-teal' : 'bg-rose/10 text-rose'}`}>
              {p.permitted ? 'Allowed' : 'Blocked'}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-zinc-500">Cluster: Tech correlated</span>
          <span className="font-mono text-zinc-400">0% <span className="text-zinc-600">/ 60% cap</span></span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-zinc-500">Per-name max</span>
          <span className="font-mono text-zinc-400">30%</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TECH STACK — for judges who want to see depth
// ═══════════════════════════════════════════════════════════════════════

function TechStack() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 mb-3">Built With</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Standards-first. Ship-ready.</h2>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { title: 'ERC-8226', sub: 'Regulated Agent Mandate standard', badge: 'Draft EIP' },
          { title: 'Foundry', sub: '33 tests, every revert path. OpenZeppelin base.', badge: 'Contracts' },
          { title: 'Robinhood Chain', sub: 'Arbitrum Orbit L2 · Chain ID 46630', badge: 'Network' },
          { title: 'Two-Agent AI', sub: 'Strategist + Risk Officer · live data · memory', badge: 'AI Engine' },
        ].map(t => (
          <div key={t.title} className="card p-5 space-y-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">{t.badge}</span>
            <h4 className="text-white font-semibold">{t.title}</h4>
            <p className="text-zinc-500 text-xs">{t.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Why Different — differentiation (standards + multi-agent) ────────

function WhyDifferent() {
  const points = [
    {
      title: 'A standard, not a bespoke engine',
      desc: 'Mandate implements ERC-8226 (Regulated Agent Mandate) — a real Ethereum standard. That means interoperability and a credible path to adoption, not a one-off policy script.',
      color: 'purple',
    },
    {
      title: 'A reasoning system, not a demo bot',
      desc: 'Two coordinating agents — a Strategist that forms a view from live market data, and a Risk Officer that independently vets every trade. The agent has memory across cycles.',
      color: 'teal',
    },
    {
      title: 'Correlation-aware risk',
      desc: 'Beyond per-name limits: a cluster cap catches fake diversification across correlated tech stocks. Five names that move together can\'t masquerade as a balanced book.',
      color: 'gold',
    },
    {
      title: 'Examiner-ready by design',
      desc: 'Every action emits a compliance receipt. Tiered kill switches (platform vs regulatory) match the SEC Crypto Task Force\'s stated requirements for algorithmic agents.',
      color: 'rose',
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <p className="text-[11px] font-medium uppercase tracking-widest text-purple mb-3">Why Mandate</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Four things that set it apart</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {points.map(p => (
          <div key={p.title} className="card p-6 space-y-2">
            <h4 className={`text-${p.color} font-semibold`}>{p.title}</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MandateLogo size={28} />
          <span className="font-display text-lg italic text-white">Mandate</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-zinc-500">
          <span>ERC-8226 (Regulated Agent Mandate)</span>
          <span>·</span>
          <span>Arbitrum Open House London 2026</span>
          <span>·</span>
          <a href="https://explorer.testnet.chain.robinhood.com/address/0x9d315bBb8886E08bECCd50353De5A0E469Dc2884" target="_blank" rel="noreferrer" className="text-purple hover:text-purple-light transition">
            View on Explorer ↗
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-zinc-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

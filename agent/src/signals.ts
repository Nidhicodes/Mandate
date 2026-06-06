/**
 * Market Signals — REAL market data the AI manager reasons over.
 *
 * Pulls live price history from Yahoo Finance's public chart endpoint (no API key),
 * then computes momentum (recent trend), volatility (annualized stddev of returns),
 * and a valuation proxy (position within the 1y range). Falls back to synthetic
 * signals only if the network is unavailable, so the demo never breaks.
 */
import type { TokenSymbol } from './config.js';

export interface AssetSignal {
  symbol: TokenSymbol;
  price: number; // latest price (USD)
  momentum: number; // -1..1, recent trend
  volatility: number; // 0..1, annualized vol proxy
  valuation: number; // -1..1, cheap(+) to expensive(-) within 1y range
  cluster: string;
  note: string;
  source: 'live' | 'synthetic';
}

const TICKERS: TokenSymbol[] = ['TSLA', 'AMZN', 'PLTR', 'AMD'];

/**
 * Fetches real market signals for all tradable equities. Concurrent, with per-asset
 * fallback so one failed fetch doesn't sink the batch. Each fetch is hard-capped by a
 * Promise.race so a stuck socket can never hang the agent loop.
 */
export async function getMarketSignals(): Promise<AssetSignal[]> {
  const results = await Promise.all(
    TICKERS.map(symbol =>
      Promise.race([
        fetchSignal(symbol),
        new Promise<AssetSignal>(resolve => setTimeout(() => resolve(syntheticSignal(symbol)), 7000)),
      ])
    )
  );
  return results;
}

async function fetchSignal(symbol: TokenSymbol): Promise<AssetSignal> {
  try {
    // Yahoo Finance public chart endpoint — 6 months of daily closes, no key required.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Mandate-Agent)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = (await res.json()) as any;

    const result = data?.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close || []).filter((x: number | null) => x != null);
    if (closes.length < 20) throw new Error('insufficient data');

    const price = closes[closes.length - 1];
    const momentum = computeMomentum(closes);
    const volatility = computeVolatility(closes);
    const valuation = computeValuation(closes);

    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      momentum,
      volatility,
      valuation,
      cluster: 'tech-growth',
      note: describeSignal(symbol, momentum, volatility, valuation),
      source: 'live',
    };
  } catch {
    return syntheticSignal(symbol);
  }
}

/** Momentum: 20-day return, scaled to -1..1. */
function computeMomentum(closes: number[]): number {
  const recent = closes[closes.length - 1];
  const past = closes[Math.max(0, closes.length - 21)];
  const ret = (recent - past) / past;
  // ±25% monthly move maps to ±1
  return clamp(ret / 0.25);
}

/** Volatility: annualized stddev of daily log returns, scaled to 0..1. */
function computeVolatility(closes: number[]): number {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const annualized = Math.sqrt(variance) * Math.sqrt(252);
  // 0% -> 0, 100% annualized vol -> 1
  return parseFloat(Math.min(1, annualized).toFixed(2));
}

/** Valuation proxy: position within the 6-month range. Near low = cheap (+), near high = expensive (-). */
function computeValuation(closes: number[]): number {
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const cur = closes[closes.length - 1];
  if (hi === lo) return 0;
  const pos = (cur - lo) / (hi - lo); // 0 = at low, 1 = at high
  return parseFloat((1 - 2 * pos).toFixed(2)); // 0 -> +1 (cheap), 1 -> -1 (expensive)
}

function describeSignal(symbol: TokenSymbol, m: number, v: number, val: number): string {
  const mom = m > 0.3 ? 'strong momentum' : m > 0 ? 'mild uptrend' : m > -0.3 ? 'flat' : 'downtrend';
  const vol = v > 0.6 ? 'high volatility' : v > 0.4 ? 'moderate volatility' : 'low volatility';
  const va = val > 0.2 ? 'near range lows (cheap)' : val < -0.2 ? 'near range highs (rich)' : 'mid-range';
  return `${mom}, ${vol}, ${va}.`;
}

// ─── Synthetic fallback (only if the live fetch fails) ───────────────────

function syntheticSignal(symbol: TokenSymbol): AssetSignal {
  const seed = new Date().getUTCHours();
  const key = symbol.charCodeAt(0);
  const wobble = (base: number, k: number) => clamp(base + Math.sin((seed + k) * 1.3) * 0.25);
  const m = wobble(0.35, key);
  const v = 0.5 + (key % 3) * 0.1;
  const val = wobble(-0.1, key + 1);
  return {
    symbol, price: 0, momentum: m, volatility: parseFloat(v.toFixed(2)), valuation: val,
    cluster: 'tech-growth', note: `${describeSignal(symbol, m, v, val)} (offline estimate)`, source: 'synthetic',
  };
}

function clamp(v: number): number {
  return parseFloat(Math.max(-1, Math.min(1, v)).toFixed(2));
}

/** Risk-adjusted score: reward momentum + cheapness, penalize volatility. */
export function scoreAsset(s: AssetSignal): number {
  return s.momentum * 0.5 + s.valuation * 0.3 - s.volatility * 0.4;
}

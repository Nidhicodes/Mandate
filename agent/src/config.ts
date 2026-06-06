import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// --- Chain ---
const chainId = parseInt(process.env.CHAIN_ID || '46630');
export const robinhoodTestnet = defineChain({
  id: chainId,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || 'https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
});

// --- Clients ---
const rpcUrl = process.env.RPC_URL || 'https://rpc.testnet.chain.robinhood.com';

export const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(rpcUrl),
});

export const agentAccount = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

export const agentWallet = createWalletClient({
  account: agentAccount,
  chain: robinhoodTestnet,
  transport: http(rpcUrl),
});

// --- Addresses ---
export const MANDATE_REGISTRY: Address = (process.env.MANDATE_REGISTRY || '0x') as Address;
export const MANAGED_VAULT: Address = (process.env.MANAGED_VAULT || '0x') as Address;
export const COMPLIANCE_PROVIDER: Address = (process.env.COMPLIANCE_PROVIDER || '0x') as Address;
export const PRINCIPAL: Address = (process.env.PRINCIPAL_ADDRESS || '0x') as Address;
export const AGENT_ID = BigInt(process.env.AGENT_ID || '1');

// --- Robinhood Chain token addresses ---
export const TOKENS = {
  USDG: '0x7E955252E15c84f5768B83c41a71F9eba181802F' as Address,
  TSLA: '0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E' as Address,
  AMZN: '0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02' as Address,
  PLTR: '0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0' as Address,
  NFLX: '0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93' as Address,
  AMD: '0x71178BAc73cBeb415514eB542a8995b82669778d' as Address,
} as const;

export type TokenSymbol = keyof typeof TOKENS;

// --- Demo token addresses (the funded demo vault holds these mintable tokens) ---
// Falls back to canonical addresses if not set. The agent reads positions for the
// symbols it can actually trade against the demo vault.
export const DEMO_TOKENS: Partial<Record<TokenSymbol, Address>> = {
  USDG: (process.env.DEMO_USDG as Address) || TOKENS.USDG,
  TSLA: (process.env.DEMO_TSLA as Address) || TOKENS.TSLA,
  AMZN: (process.env.DEMO_AMZN as Address) || TOKENS.AMZN,
};

export const DEMO_ROUTER: Address = (process.env.DEMO_ROUTER as Address) || '0x0000000000000000000000000000000000000001';

// --- LLM ---
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';

export const LLM_URL = LLM_PROVIDER === 'venice'
  ? 'https://api.venice.ai/api/v1'
  : 'https://api.groq.com/openai/v1';

export const LLM_MODEL = LLM_PROVIDER === 'venice'
  ? 'llama-3.3-70b'
  : 'llama-3.3-70b-versatile';

export const LLM_API_KEY = LLM_PROVIDER === 'venice'
  ? process.env.VENICE_API_KEY || ''
  : process.env.GROQ_API_KEY || '';

export const PORT = parseInt(process.env.PORT || '3002');

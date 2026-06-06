/// Minimal ABIs for the AI manager to interact with the deployed contracts.
/// Only functions the agent actually calls or reads.

export const ManagedVaultABI = [
  // Agent actions
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'equity', type: 'address' },
      { name: 'baseInAmount', type: 'uint256' },
      { name: 'minEquityOut', type: 'uint256' },
      { name: 'router', type: 'address' },
    ],
    outputs: [{ name: 'equityOut', type: 'uint256' }],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'equity', type: 'address' },
      { name: 'equityInAmount', type: 'uint256' },
      { name: 'minBaseOut', type: 'uint256' },
      { name: 'router', type: 'address' },
    ],
    outputs: [{ name: 'baseOut', type: 'uint256' }],
  },
  // Read views
  {
    name: 'isPermittedAsset',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'baseAsset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'maxPositionBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxClusterBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'trackedAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'trackedAssetsLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'checkDrawdown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [],
  },
  // Events (for compliance-receipt verification)
  {
    name: 'ComplianceReceipt',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'principal', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'mandateScopeHash', type: 'bytes32', indexed: false },
    ],
  },
  // Errors (for decoding reverts in the UI)
  { name: 'AssetNotPermitted', type: 'error', inputs: [{ name: 'asset', type: 'address' }] },
  { name: 'PositionLimitExceeded', type: 'error', inputs: [{ name: 'asset', type: 'address' }, { name: 'wouldBeBps', type: 'uint256' }, { name: 'capBps', type: 'uint256' }] },
  { name: 'ClusterConcentrationExceeded', type: 'error', inputs: [{ name: 'cluster', type: 'uint16' }, { name: 'wouldBeBps', type: 'uint256' }, { name: 'capBps', type: 'uint256' }] },
  { name: 'MandateNotActiveForAmount', type: 'error', inputs: [{ name: 'amount', type: 'uint256' }] },
] as const;

export const MandateRegistryABI = [
  {
    name: 'isActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'principal', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isActiveForAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'principal', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getMandate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'principal', type: 'address' }],
    outputs: [{
      name: '', type: 'tuple',
      components: [
        { name: 'principal', type: 'address' },
        { name: 'identityRef', type: 'bytes32' },
        { name: 'scopeHash', type: 'bytes32' },
        { name: 'complianceProvider', type: 'address' },
        { name: 'onChainScope', type: 'tuple', components: [
          { name: 'maxTransactionValue', type: 'uint128' },
          { name: 'maxCumulativeValue', type: 'uint128' },
          { name: 'assetAddress', type: 'address' },
          { name: 'jurisdictionHash', type: 'bytes32' },
        ]},
        { name: 'validFrom', type: 'uint48' },
        { name: 'validUntil', type: 'uint48' },
        { name: 'cumulativeUsed', type: 'uint128' },
        { name: 'revoked', type: 'bool' },
      ],
    }],
  },
  {
    name: 'isFrozen',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'jurisdictionHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'ExecutionRecorded',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'principal', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'cumulativeUsed', type: 'uint128', indexed: false },
    ],
  },
] as const;

export const ERC20ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

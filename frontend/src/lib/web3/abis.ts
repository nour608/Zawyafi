// ─── ProductBatchFactory ───────────────────────────────────────────────────
// Matches ProductBatchFactory.sol @ smart-contracts/src/core/ProductBatchFactory.sol
export const productBatchFactoryAbi = [
  // ── State variable getters ──────────────────────────────────────────────
  {
    type: 'function',
    name: 'nextBatchId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // ── Read ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getBatch',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'merchantIdHash', type: 'bytes32' },
          { name: 'issuer', type: 'address' },
          { name: 'founder', type: 'address' },
          { name: 'purchaseToken', type: 'address' },
          { name: 'unitToken', type: 'address' },
          { name: 'profitBps', type: 'uint16' },
          { name: 'principalSoldTotal', type: 'uint256' },
          { name: 'targetPayoutTotal', type: 'uint256' },
          { name: 'settledRevenueTotal', type: 'uint256' },
          { name: 'totalUnitsForSale', type: 'uint256' },
          { name: 'totalUnitsSold', type: 'uint256' },
          { name: 'proceedsWithdrawn', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'closed', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getBatchCategoryHashes',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'getCategoryState',
    stateMutability: 'view',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'categoryIdHash', type: 'bytes32' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'categoryIdHash', type: 'bytes32' },
          { name: 'unitsForSale', type: 'uint256' },
          { name: 'unitsSold', type: 'uint256' },
          { name: 'unitCost', type: 'uint256' },
          { name: 'principalSold', type: 'uint256' },
          { name: 'tokenized', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isBatchClosed',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ── Write ───────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantIdHash', type: 'bytes32' },
      {
        name: 'categories',
        type: 'tuple[]',
        components: [
          { name: 'categoryIdHash', type: 'bytes32' },
          { name: 'unitsForSale', type: 'uint256' },
          { name: 'unitCost', type: 'uint256' },
        ],
      },
      { name: 'purchaseToken', type: 'address' },
      { name: 'profitBps', type: 'uint16' },
      { name: 'tokenName', type: 'string' },
      { name: 'tokenSymbol', type: 'string' },
      { name: 'issuer', type: 'address' },
      { name: 'founder', type: 'address' },
    ],
    outputs: [{ name: 'batchId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'buyUnits',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'categoryIdHash', type: 'bytes32' },
      { name: 'units', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawProceeds',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setBatchActive',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'closeBatch',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [],
  },

  // ── Events ───────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'BatchCreated',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'merchantIdHash', type: 'bytes32', indexed: true },
      { name: 'unitToken', type: 'address', indexed: false },
      { name: 'profitBps', type: 'uint16', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'UnitsPurchased',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'categoryIdHash', type: 'bytes32', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'units', type: 'uint256', indexed: false },
      { name: 'cost', type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── SettlementVault ───────────────────────────────────────────────────────
export const settlementVaultAbi = [
  {
    type: 'function',
    name: 'factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isBatchFinished',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'fundBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'unitsToRedeem', type: 'uint256' },
    ],
    outputs: [{ name: 'payoutAmount', type: 'uint256' }],
  },
] as const

// ─── RevenueRegistry ──────────────────────────────────────────────────────
export const revenueRegistryAbi = [
  {
    type: 'function',
    name: 'isPeriodRecorded',
    stateMutability: 'view',
    inputs: [{ name: 'periodId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getPeriod',
    stateMutability: 'view',
    inputs: [{ name: 'periodId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'periodId', type: 'bytes32' },
          { name: 'merchantIdHash', type: 'bytes32' },
          { name: 'productIdHash', type: 'bytes32' },
          { name: 'periodStart', type: 'uint64' },
          { name: 'periodEnd', type: 'uint64' },
          { name: 'grossSales', type: 'uint256' },
          { name: 'refunds', type: 'uint256' },
          { name: 'netSales', type: 'uint256' },
          { name: 'unitsSold', type: 'uint256' },
          { name: 'refundUnits', type: 'uint256' },
          { name: 'netUnitsSold', type: 'uint256' },
          { name: 'eventCount', type: 'uint256' },
          { name: 'batchHash', type: 'bytes32' },
          { name: 'generatedAt', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'riskScore', type: 'uint16' },
          { name: 'reasonCode', type: 'bytes32' },
        ],
      },
    ],
  },
] as const

// ─── OracleCoordinator ────────────────────────────────────────────────────
export const oracleCoordinatorAbi = [
  {
    type: 'function',
    name: 'getForwarderAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getExpectedAuthor',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getExpectedWorkflowName',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes10' }],
  },
  {
    type: 'function',
    name: 'getExpectedWorkflowId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setExpectedAuthor',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'author', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExpectedWorkflowId',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'workflowId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExpectedWorkflowName',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [],
  },
] as const

// ─── ERC20 (purchase token) ───────────────────────────────────────────────
export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Keep legacy alias for existing imports
export const unitTokenAbi = erc20Abi

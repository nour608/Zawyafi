export const productBatchFactoryAbi = [
  {
    type: 'function',
    name: 'createBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantIdHash', type: 'bytes32' },
      { name: 'productIdHash', type: 'bytes32' },
      { name: 'purchaseToken', type: 'address' },
      { name: 'unitCost', type: 'uint256' },
      { name: 'unitPayout', type: 'uint256' },
      { name: 'unitsForSale', type: 'uint256' },
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
          { name: 'productIdHash', type: 'bytes32' },
          { name: 'issuer', type: 'address' },
          { name: 'founder', type: 'address' },
          { name: 'purchaseToken', type: 'address' },
          { name: 'unitToken', type: 'address' },
          { name: 'unitCost', type: 'uint256' },
          { name: 'unitPayout', type: 'uint256' },
          { name: 'unitsForSale', type: 'uint256' },
          { name: 'unitsSoldToInvestors', type: 'uint256' },
          { name: 'fundsRaised', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
] as const

export const settlementVaultAbi = [
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
  {
    type: 'function',
    name: 'claimableGlobalUnits',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

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

export const unitTokenAbi = [
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
] as const

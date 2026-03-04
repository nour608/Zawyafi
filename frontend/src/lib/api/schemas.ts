import { z } from 'zod'

const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/)

export const overviewSchema = z.object({
  apiVersion: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pipeline: z.object({
    backendHealth: z.enum(['ok', 'degraded']),
    latestPeriodId: z.string().nullable(),
    latestStatus: z.enum(['VERIFIED', 'UNVERIFIED']).nullable(),
    latestGeneratedAt: z.string().datetime().nullable(),
  }),
  metrics: z.object({
    grossSalesMinor: z.string(),
    refundsMinor: z.string(),
    netSalesMinor: z.string(),
    verifiedPeriods: z.number().int(),
    unverifiedPeriods: z.number().int(),
    unitsSettled: z.string(),
  }),
})

export const batchViewSchema = z.object({
  batchId: z.number().int().positive(),
  merchantIdHash: hexString,
  productIdHash: hexString,
  tokenSymbol: z.string(),
  unitCostMinor: z.string(),
  unitPayoutMinor: z.string(),
  unitsForSale: z.string(),
  unitsSoldToInvestors: z.string(),
  unitsSettled: z.string(),
  unitsClaimed: z.string(),
  active: z.boolean(),
  riskTier: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  fundingLiquidityMinor: z.string(),
})

export const batchesResponseSchema = z.object({
  apiVersion: z.string(),
  batches: z.array(batchViewSchema),
})

export const periodViewSchema = z.object({
  periodId: hexString,
  batchId: z.number().int().positive(),
  merchantIdHash: hexString,
  productIdHash: hexString,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  generatedAt: z.string().datetime(),
  grossSalesMinor: z.string(),
  refundsMinor: z.string(),
  netSalesMinor: z.string(),
  unitsSold: z.string(),
  refundUnits: z.string(),
  netUnitsSold: z.string(),
  eventCount: z.number().int().nonnegative(),
  status: z.enum(['VERIFIED', 'UNVERIFIED']),
  riskScore: z.number().int().min(0).max(1000),
  reasonCode: z.enum(['OK', 'REFUND_RATIO', 'SUDDEN_SPIKE', 'REFUND_AND_SPIKE']),
  batchHash: hexString,
})

export const periodsResponseSchema = z.object({
  apiVersion: z.string(),
  nextCursor: z.string().nullable(),
  periods: z.array(periodViewSchema),
})

export const portfolioResponseSchema = z.object({
  apiVersion: z.string(),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  claimableGlobalUnitsByBatch: z.record(z.string()),
  positions: z.array(
    z.object({
      batchId: z.number().int().positive(),
      unitToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      symbol: z.string(),
      unitsOwned: z.string(),
      unitsClaimableNow: z.string(),
      costBasisMinor: z.string(),
    }),
  ),
  claims: z.array(
    z.object({
      txHash: hexString,
      batchId: z.number().int().positive(),
      unitsRedeemed: z.string(),
      payoutMinor: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
})

export const txResponseSchema = z.object({
  apiVersion: z.string(),
  txHash: hexString,
  status: z.enum(['pending', 'confirmed', 'failed']),
  chainId: z.number().int(),
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  summary: z.string(),
})

export const createComplianceReportResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
  createdAt: z.string().datetime(),
  pollAfterMs: z.number().int().positive(),
})

const kycStatusSchema = z.enum([
  'PENDING_CRE_BIND',
  'PENDING_USER_SUBMISSION',
  'IN_REVIEW',
  'APPROVED_READY',
  'APPROVED_ONCHAIN_PENDING',
  'ONCHAIN_APPROVED',
  'REJECTED',
  'REVIEW_REQUIRED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
])

const reviewAnswerSchema = z.enum(['GREEN', 'RED', 'YELLOW', 'UNKNOWN'])

export const complianceReportPeriodSchema = z.object({
  periodId: hexString,
  merchantIdHash: hexString,
  productIdHash: hexString,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  generatedAt: z.string().datetime(),
  grossSalesMinor: z.string(),
  refundsMinor: z.string(),
  netSalesMinor: z.string(),
  unitsSold: z.string(),
  refundUnits: z.string(),
  netUnitsSold: z.string(),
  eventCount: z.number().int().nonnegative(),
  status: z.enum(['VERIFIED', 'UNVERIFIED']),
  riskScore: z.number().int().min(0).max(1000),
  reasonCode: z.enum(['OK', 'REFUND_RATIO', 'SUDDEN_SPIKE', 'REFUND_AND_SPIKE', 'UNKNOWN']),
  batchHash: hexString,
  txHash: hexString,
  blockNumber: z.string(),
  logIndex: z.number().int().nonnegative(),
})

export const complianceReportStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
  merchantIdHash: hexString,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  attemptCount: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  report: z
    .object({
      generatedAt: z.string().datetime(),
      merchantIdHash: hexString,
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      chainSelectorName: z.string(),
      revenueRegistryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      scanFromBlock: z.string(),
      scanToBlock: z.string(),
      reportHash: hexString,
      periodMerkleRoot: hexString,
      totals: z.object({
        periodCount: z.number().int().nonnegative(),
        grossSalesMinor: z.string(),
        refundsMinor: z.string(),
        netSalesMinor: z.string(),
        unitsSold: z.string(),
        refundUnits: z.string(),
        netUnitsSold: z.string(),
        verifiedCount: z.number().int().nonnegative(),
        unverifiedCount: z.number().int().nonnegative(),
      }),
      periods: z.array(complianceReportPeriodSchema),
    })
    .nullable(),
})

export const complianceKycRequestSchema = z.object({
  requestId: z.string().uuid(),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive(),
  status: kycStatusSchema,
  sumsubReviewAnswer: reviewAnswerSchema.nullable(),
  attemptCount: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().nullable(),
  processingLockUntil: z.string().datetime().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  onchainTxHash: hexString.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const complianceKycRequestsResponseSchema = z.object({
  records: z.array(complianceKycRequestSchema),
  nextCursor: z.string().nullable(),
})

export const complianceReportRequestSummarySchema = z.object({
  requestId: z.string().uuid(),
  merchantIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
  attemptCount: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const complianceReportRequestListResponseSchema = z.object({
  records: z.array(complianceReportRequestSummarySchema),
  nextCursor: z.string().nullable(),
})

export const complianceInvestorWalletSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  latestKycStatus: kycStatusSchema,
  latestKycUpdatedAt: z.string().datetime(),
  latestRequestId: z.string().uuid(),
  hasInvested: z.boolean(),
  investedBatchCount: z.number().int().nonnegative(),
  totalUnitsOwned: z.string(),
  totalCostBasisMinor: z.string(),
  portfolioStatus: z.enum(['ok', 'unavailable']),
})

export const complianceInvestorWalletsResponseSchema = z.object({
  records: z.array(complianceInvestorWalletSchema),
  nextCursor: z.string().nullable(),
})

export const walletCapabilitiesResponseSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  capabilities: z.object({
    canUseMerchant: z.boolean(),
    canUseCompliance: z.boolean(),
    canUseAdmin: z.boolean(),
  }),
})

export const backendHealthSchema = z.object({
  status: z.string(),
  mode: z.string(),
  timestamp: z.string().datetime(),
})

export const paymentsResponseSchema = z.object({
  source: z.string(),
  merchantId: z.string(),
  date: z.string(),
  count: z.number().int(),
  payments: z.array(
    z.object({
      id: z.string(),
      amountMinor: z.string(),
      categoryName: z.string().optional(),
      itemName: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
})

export const refundsResponseSchema = z.object({
  source: z.string(),
  merchantId: z.string(),
  date: z.string(),
  count: z.number().int(),
  refunds: z.array(
    z.object({
      id: z.string(),
      amountMinor: z.string(),
      createdAt: z.string(),
    }),
  ),
})

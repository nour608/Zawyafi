export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED'
export type ReasonCode = 'OK' | 'REFUND_RATIO' | 'SUDDEN_SPIKE' | 'REFUND_AND_SPIKE'

export interface FrontendBatchView {
  batchId: number
  merchantIdHash: string
  productIdHash: string
  tokenSymbol: string
  unitCostMinor: string
  unitPayoutMinor: string
  unitsForSale: string
  unitsSoldToInvestors: string
  unitsSettled: string
  unitsClaimed: string
  active: boolean
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH'
  fundingLiquidityMinor: string
  unitToken: string
}

export interface FrontendPeriodView {
  periodId: string
  batchId: number
  merchantIdHash: string
  productIdHash: string
  periodStart: string
  periodEnd: string
  generatedAt: string
  grossSalesMinor: string
  refundsMinor: string
  netSalesMinor: string
  unitsSold: string
  refundUnits: string
  netUnitsSold: string
  eventCount: number
  status: VerificationStatus
  riskScore: number
  reasonCode: ReasonCode
  batchHash: string
}

export interface FrontendPortfolioView {
  apiVersion: string
  wallet: string
  claimableGlobalUnitsByBatch: Record<string, string>
  positions: Array<{
    batchId: number
    unitToken: string
    symbol: string
    unitsOwned: string
    unitsClaimableNow: string
    costBasisMinor: string
  }>
  claims: Array<{
    txHash: string
    batchId: number
    unitsRedeemed: string
    payoutMinor: string
    createdAt: string
  }>
}

export interface FrontendOverviewView {
  apiVersion: string
  date: string
  pipeline: {
    backendHealth: 'ok' | 'degraded'
    latestPeriodId: string | null
    latestStatus: VerificationStatus | null
    latestGeneratedAt: string | null
  }
  metrics: {
    grossSalesMinor: string
    refundsMinor: string
    netSalesMinor: string
    verifiedPeriods: number
    unverifiedPeriods: number
    unitsSettled: string
  }
}

export interface FrontendTxView {
  apiVersion: string
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  chainId: number
  submittedAt: string
  updatedAt: string
  summary: string
}

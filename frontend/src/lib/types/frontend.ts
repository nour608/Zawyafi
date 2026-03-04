export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED'
export type ReasonCode = 'OK' | 'REFUND_RATIO' | 'SUDDEN_SPIKE' | 'REFUND_AND_SPIKE' | 'UNKNOWN'

export interface OverviewView {
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

export interface BatchView {
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
}

export type MarketplaceFilter = 'ALL' | 'LIVE' | 'PAUSED' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK'

export interface MarketplaceCardView {
  batchId: number
  title: string
  symbol: string
  riskTier: BatchView['riskTier']
  active: boolean
  soldPercent: number
  unitCostMinor: string
  unitPayoutMinor: string
  availableUnits: string
  fundingLiquidityMinor: string
}

export interface PeriodView {
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

export interface PortfolioView {
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

export interface TxView {
  apiVersion: string
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  chainId: number
  submittedAt: string
  updatedAt: string
  summary: string
}

export type ComplianceReportStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
export type KycStatus =
  | 'PENDING_CRE_BIND'
  | 'PENDING_USER_SUBMISSION'
  | 'IN_REVIEW'
  | 'APPROVED_READY'
  | 'APPROVED_ONCHAIN_PENDING'
  | 'ONCHAIN_APPROVED'
  | 'REJECTED'
  | 'REVIEW_REQUIRED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL'

export type ReviewAnswer = 'GREEN' | 'RED' | 'YELLOW' | 'UNKNOWN'

export interface ComplianceReportPeriod {
  periodId: string
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
  txHash: string
  blockNumber: string
  logIndex: number
}

export interface ComplianceReportPacket {
  generatedAt: string
  merchantIdHash: string
  startDate: string
  endDate: string
  chainSelectorName: string
  revenueRegistryAddress: string
  scanFromBlock: string
  scanToBlock: string
  reportHash: string
  periodMerkleRoot: string
  totals: {
    periodCount: number
    grossSalesMinor: string
    refundsMinor: string
    netSalesMinor: string
    unitsSold: string
    refundUnits: string
    netUnitsSold: string
    verifiedCount: number
    unverifiedCount: number
  }
  periods: ComplianceReportPeriod[]
}

export interface ComplianceReportView {
  requestId: string
  status: ComplianceReportStatus
  merchantIdHash: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  attemptCount: number
  nextRetryAt: string | null
  errorCode: string | null
  errorMessage: string | null
  report: ComplianceReportPacket | null
}

export interface CreateComplianceReportResponse {
  requestId: string
  status: ComplianceReportStatus
  createdAt: string
  pollAfterMs: number
}

export interface ComplianceKycRequestView {
  requestId: string
  wallet: string
  chainId: number
  status: KycStatus
  sumsubReviewAnswer: ReviewAnswer | null
  attemptCount: number
  nextRetryAt: string | null
  processingLockUntil: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  onchainTxHash: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplianceKycRequestsResponse {
  records: ComplianceKycRequestView[]
  nextCursor: string | null
}

export interface ComplianceReportRequestSummaryView {
  requestId: string
  merchantIdHash: string
  startDate: string
  endDate: string
  status: ComplianceReportStatus
  attemptCount: number
  nextRetryAt: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplianceReportRequestListResponse {
  records: ComplianceReportRequestSummaryView[]
  nextCursor: string | null
}

export interface ComplianceInvestorWalletView {
  wallet: string
  latestKycStatus: KycStatus
  latestKycUpdatedAt: string
  latestRequestId: string
  hasInvested: boolean
  investedBatchCount: number
  totalUnitsOwned: string
  totalCostBasisMinor: string
  portfolioStatus: 'ok' | 'unavailable'
}

export interface ComplianceInvestorWalletsResponse {
  records: ComplianceInvestorWalletView[]
  nextCursor: string | null
}

export type RoleCapability = {
  canUseMerchant: boolean
  canUseCompliance: boolean
  canUseAdmin: boolean
}

export interface WalletCapabilitiesResponse {
  address: string
  capabilities: RoleCapability
}

export type TxLifecycleState = 'idle' | 'signing' | 'pending' | 'confirmed' | 'failed'

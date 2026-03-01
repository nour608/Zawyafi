export const KYC_STATUSES = [
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
] as const

export type KycStatus = (typeof KYC_STATUSES)[number]

export const REVIEW_ANSWERS = ['GREEN', 'RED', 'YELLOW', 'UNKNOWN'] as const
export type ReviewAnswer = (typeof REVIEW_ANSWERS)[number]

export interface KycRequestRecord {
  requestId: string
  wallet: string
  chainId: number
  nonce: string
  commit: string | null
  commitKeyVersion: string | null
  sumsubApplicantId: string | null
  sumsubSdkToken: string | null
  sumsubReviewAnswer: ReviewAnswer | null
  status: KycStatus
  attemptCount: number
  nextRetryAt: string | null
  processingLockUntil: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  onchainTxHash: string | null
  createdAt: string
  updatedAt: string
}

export interface WebhookEventRecord {
  eventId: string
  applicantId: string
  receivedAt: string
  payloadHash: string
}

export type OnchainOutcome = 'SUCCESS' | 'RETRYABLE' | 'TERMINAL'

export const COMPLIANCE_REPORT_STATUSES = ['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'] as const
export type ComplianceReportStatus = (typeof COMPLIANCE_REPORT_STATUSES)[number]

export type ComplianceProcessingOutcome = 'SUCCESS' | 'RETRYABLE' | 'TERMINAL'

export type ComplianceVerificationStatus = 'VERIFIED' | 'UNVERIFIED'
export type ComplianceReasonCode = 'OK' | 'REFUND_RATIO' | 'SUDDEN_SPIKE' | 'REFUND_AND_SPIKE' | 'UNKNOWN'

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
  status: ComplianceVerificationStatus
  riskScore: number
  reasonCode: ComplianceReasonCode
  batchHash: string
  txHash: string
  blockNumber: string
  logIndex: number
}

export interface ComplianceReportTotals {
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
  totals: ComplianceReportTotals
  periods: ComplianceReportPeriod[]
}

export interface ComplianceReportRequestRecord {
  requestId: string
  merchantIdHash: string
  startDate: string
  endDate: string
  status: ComplianceReportStatus
  attemptCount: number
  nextRetryAt: string | null
  processingLockUntil: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdAt: string
  updatedAt: string
}

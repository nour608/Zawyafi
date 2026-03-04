import type { ComplianceReportStatus, KycStatus, ReasonCode, ReviewAnswer, VerificationStatus } from '@/lib/types/frontend'

export const formatUsdMinor = (value: string | bigint): string => {
  const minor = typeof value === 'bigint' ? value : BigInt(value)
  const sign = minor < 0n ? '-' : ''
  const absolute = minor < 0n ? -minor : minor
  const dollars = absolute / 100n
  const cents = (absolute % 100n).toString().padStart(2, '0')
  return `${sign}$${dollars.toString()}.${cents}`
}

export const formatUnits = (value: string | bigint): string => {
  const units = typeof value === 'bigint' ? value : BigInt(value)
  return units.toLocaleString('en-US')
}

export const formatShortHash = (value: string, head = 8, tail = 6): string => {
  if (value.length <= head + tail + 3) {
    return value
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

export const formatRiskLabel = (score: number): string => {
  if (score >= 700) {
    return 'High Risk'
  }

  if (score >= 350) {
    return 'Medium Risk'
  }

  return 'Low Risk'
}

export const statusTone = (status: VerificationStatus): 'success' | 'danger' =>
  status === 'VERIFIED' ? 'success' : 'danger'

export const reasonLabel = (reasonCode: ReasonCode): string => {
  switch (reasonCode) {
    case 'OK':
      return 'OK'
    case 'REFUND_RATIO':
      return 'Refund Ratio'
    case 'SUDDEN_SPIKE':
      return 'Sudden Spike'
    case 'REFUND_AND_SPIKE':
      return 'Refund + Spike'
    case 'UNKNOWN':
      return 'Unknown'
    default:
      return reasonCode
  }
}

export const kycStatusTone = (status: KycStatus): 'success' | 'warning' | 'danger' | 'signal' | 'default' => {
  switch (status) {
    case 'ONCHAIN_APPROVED':
    case 'APPROVED_READY':
      return 'success'
    case 'APPROVED_ONCHAIN_PENDING':
    case 'PENDING_USER_SUBMISSION':
    case 'PENDING_CRE_BIND':
    case 'IN_REVIEW':
      return 'signal'
    case 'REVIEW_REQUIRED':
      return 'warning'
    case 'FAILED_RETRYABLE':
    case 'FAILED_TERMINAL':
    case 'REJECTED':
      return 'danger'
    default:
      return 'default'
  }
}

export const kycStatusLabel = (status: KycStatus): string => {
  switch (status) {
    case 'PENDING_CRE_BIND':
      return 'Pending CRE Bind'
    case 'PENDING_USER_SUBMISSION':
      return 'Pending User Submission'
    case 'IN_REVIEW':
      return 'In Review'
    case 'APPROVED_READY':
      return 'Approved Ready'
    case 'APPROVED_ONCHAIN_PENDING':
      return 'Onchain Pending'
    case 'ONCHAIN_APPROVED':
      return 'Onchain Approved'
    case 'REJECTED':
      return 'Rejected'
    case 'REVIEW_REQUIRED':
      return 'Review Required'
    case 'FAILED_RETRYABLE':
      return 'Failed Retryable'
    case 'FAILED_TERMINAL':
      return 'Failed Terminal'
    default:
      return status
  }
}

export const reviewAnswerLabel = (answer: ReviewAnswer | null): string => {
  if (!answer) {
    return 'N/A'
  }

  switch (answer) {
    case 'GREEN':
      return 'Green'
    case 'RED':
      return 'Red'
    case 'YELLOW':
      return 'Yellow'
    case 'UNKNOWN':
      return 'Unknown'
    default:
      return answer
  }
}

export const complianceReportStatusTone = (
  status: ComplianceReportStatus,
): 'success' | 'warning' | 'danger' | 'signal' | 'default' => {
  switch (status) {
    case 'SUCCEEDED':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'PROCESSING':
      return 'signal'
    case 'QUEUED':
      return 'warning'
    default:
      return 'default'
  }
}

export const toIsoDate = (date: Date = new Date()): string => date.toISOString().slice(0, 10)

import type { ReasonCode, VerificationStatus } from '@/lib/types/frontend'

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

export const toIsoDate = (date: Date = new Date()): string => date.toISOString().slice(0, 10)

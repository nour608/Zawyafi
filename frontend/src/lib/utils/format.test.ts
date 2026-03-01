import { describe, expect, it } from 'vitest'
import { formatShortHash, formatUsdMinor, formatUnits, reasonLabel, statusTone } from '@/lib/utils/format'

describe('format utils', () => {
  it('formats minor USD values', () => {
    expect(formatUsdMinor('12345')).toBe('$123.45')
    expect(formatUsdMinor('-600')).toBe('-$6.00')
  })

  it('formats units and hashes', () => {
    expect(formatUnits('10000')).toBe('10,000')
    expect(formatShortHash('0x01234567890123456789012345678901234567890123456789')).toContain('...')
  })

  it('maps reason labels and status tones', () => {
    expect(reasonLabel('REFUND_RATIO')).toBe('Refund Ratio')
    expect(statusTone('VERIFIED')).toBe('success')
    expect(statusTone('UNVERIFIED')).toBe('danger')
  })
})

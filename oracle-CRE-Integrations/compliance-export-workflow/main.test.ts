import { describe, expect, it } from 'bun:test'

import { __test__ } from './main'

describe('ReadyRecord validation', () => {
  it('accepts a valid record', () => {
    const parsed = __test__.ReadyRecordSchema.safeParse({
      requestId: 'req-1',
      merchantIdHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      startDate: '2026-02-01',
      endDate: '2026-02-15',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects malformed hash and empty requestId', () => {
    const parsed = __test__.ReadyRecordSchema.safeParse({
      requestId: ' ',
      merchantIdHash: '0x1234',
      startDate: '2026-02-01',
      endDate: '2026-02-15',
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects invalid dates and reversed windows', () => {
    const invalidDate = __test__.ReadyRecordSchema.safeParse({
      requestId: 'req-2',
      merchantIdHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      startDate: '2026-02-31',
      endDate: '2026-02-15',
    })

    const reversedWindow = __test__.ReadyRecordSchema.safeParse({
      requestId: 'req-3',
      merchantIdHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      startDate: '2026-02-20',
      endDate: '2026-02-15',
    })

    expect(invalidDate.success).toBe(false)
    expect(reversedWindow.success).toBe(false)
  })
})

describe('Date window filtering', () => {
  it('keeps periods that intersect the requested day window', () => {
    const included = __test__.withinDateWindow(1735689600n, 1735775999n, '2025-01-01', '2025-01-01')
    const excluded = __test__.withinDateWindow(1735603200n, 1735689599n, '2025-01-01', '2025-01-01')

    expect(included).toBe(true)
    expect(excluded).toBe(false)
  })
})

describe('Scan bounds', () => {
  it('applies lookback and confirmations while respecting deploy block', () => {
    const bounds = __test__.computeScanBounds(1_000_000n, 900_000n, 150_000n, 3)

    expect(bounds.toBlock).toBe(999_997n)
    expect(bounds.fromBlock).toBe(900_000n)
  })

  it('uses lookback floor when deploy block is older', () => {
    const bounds = __test__.computeScanBounds(250_000n, 1_000n, 10_000n, 3)

    expect(bounds.toBlock).toBe(249_997n)
    expect(bounds.fromBlock).toBe(239_998n)
  })
})

describe('Deterministic hashing', () => {
  it('returns the same hash for identical payloads', () => {
    const payload = {
      generatedAt: '2026-02-15T23:59:59.999Z',
      merchantIdHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      startDate: '2026-02-01',
      endDate: '2026-02-15',
      chainSelectorName: 'ethereum-testnet-sepolia',
      revenueRegistryAddress: '0x179f312e78d66ac8d1a0be97f0c44913b393655d',
      scanFromBlock: '100',
      scanToBlock: '200',
      periodMerkleRoot: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
      totals: {
        periodCount: 1,
        grossSalesMinor: '1000',
        refundsMinor: '100',
        netSalesMinor: '900',
        unitsSold: '5',
        refundUnits: '1',
        netUnitsSold: '4',
        verifiedCount: 1,
        unverifiedCount: 0,
      },
      periods: [],
    }

    const hashA = __test__.computeReportHash(payload)
    const hashB = __test__.computeReportHash({ ...payload })

    expect(hashA).toBe(hashB)
  })

  it('uses end-of-day timestamp when there are no periods', () => {
    const generatedAt = __test__.getDeterministicGeneratedAt([], '2026-02-15')
    expect(generatedAt).toBe('2026-02-15T23:59:59.999Z')
  })
})

describe('Reason code decoding', () => {
  it('decodes known and unknown reason codes', () => {
    const known = __test__.decodeReasonCode(
      '0x524546554e445f524154494f0000000000000000000000000000000000000000',
    )
    const unknown = __test__.decodeReasonCode(
      '0x534f4d455f4e45575f434f444500000000000000000000000000000000000000',
    )

    expect(known).toBe('REFUND_RATIO')
    expect(unknown).toBe('UNKNOWN')
  })
})

describe('Backend URL protocol parsing', () => {
  it('parses http and https without URL runtime dependency', () => {
    expect(__test__.getUrlProtocol('https://api.zawyafi.com')).toBe('https:')
    expect(__test__.getUrlProtocol('http://127.0.0.1:3100')).toBe('http:')
  })

  it('throws for invalid base urls', () => {
    expect(() => __test__.getUrlProtocol('api.zawyafi.com')).toThrow()
  })
})

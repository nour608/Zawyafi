import { describe, expect, it } from 'vitest'
import { complianceReportStatusSchema, overviewSchema, periodsResponseSchema } from '@/lib/api/schemas'

describe('api schemas', () => {
  it('parses overview response', () => {
    const parsed = overviewSchema.parse({
      apiVersion: 'v1',
      date: '2026-02-21',
      pipeline: {
        backendHealth: 'ok',
        latestPeriodId: '0x1234',
        latestStatus: 'VERIFIED',
        latestGeneratedAt: '2026-02-21T12:00:00.000Z',
      },
      metrics: {
        grossSalesMinor: '1000',
        refundsMinor: '100',
        netSalesMinor: '900',
        verifiedPeriods: 3,
        unverifiedPeriods: 1,
        unitsSettled: '44',
      },
    })

    expect(parsed.metrics.netSalesMinor).toBe('900')
  })

  it('rejects malformed period payload', () => {
    expect(() =>
      periodsResponseSchema.parse({
        apiVersion: 'v1',
        nextCursor: null,
        periods: [{ periodId: 'x' }],
      }),
    ).toThrowError()
  })

  it('parses compliance report payload', () => {
    const parsed = complianceReportStatusSchema.parse({
      requestId: '5de8b30e-6d4d-4fad-bfd1-fd2f4f605f62',
      status: 'SUCCEEDED',
      merchantIdHash: `0x${'11'.repeat(32)}`,
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      createdAt: '2026-02-28T12:00:00.000Z',
      updatedAt: '2026-02-28T12:01:00.000Z',
      attemptCount: 0,
      nextRetryAt: null,
      errorCode: null,
      errorMessage: null,
      report: {
        generatedAt: '2026-02-28T12:01:00.000Z',
        merchantIdHash: `0x${'11'.repeat(32)}`,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        chainSelectorName: 'ethereum-testnet-sepolia',
        revenueRegistryAddress: `0x${'22'.repeat(20)}`,
        scanFromBlock: '1',
        scanToBlock: '99',
        reportHash: `0x${'33'.repeat(32)}`,
        periodMerkleRoot: `0x${'44'.repeat(32)}`,
        totals: {
          periodCount: 1,
          grossSalesMinor: '1000',
          refundsMinor: '100',
          netSalesMinor: '900',
          unitsSold: '20',
          refundUnits: '2',
          netUnitsSold: '18',
          verifiedCount: 1,
          unverifiedCount: 0,
        },
        periods: [
          {
            periodId: `0x${'55'.repeat(32)}`,
            merchantIdHash: `0x${'11'.repeat(32)}`,
            productIdHash: `0x${'66'.repeat(32)}`,
            periodStart: '2026-02-27T00:00:00.000Z',
            periodEnd: '2026-02-27T23:59:59.000Z',
            generatedAt: '2026-02-28T00:15:00.000Z',
            grossSalesMinor: '1000',
            refundsMinor: '100',
            netSalesMinor: '900',
            unitsSold: '20',
            refundUnits: '2',
            netUnitsSold: '18',
            eventCount: 22,
            status: 'VERIFIED',
            riskScore: 10,
            reasonCode: 'OK',
            batchHash: `0x${'77'.repeat(32)}`,
            txHash: `0x${'88'.repeat(32)}`,
            blockNumber: '111',
            logIndex: 3,
          },
        ],
      },
    })

    expect(parsed.report?.totals.periodCount).toBe(1)
  })
})

import { createHash } from 'node:crypto'
import type {
  FrontendBatchView,
  FrontendOverviewView,
  FrontendPeriodView,
  FrontendPortfolioView,
  FrontendTxView,
  ReasonCode,
  VerificationStatus,
} from './frontend-types'

export const FRONTEND_API_VERSION = 'v1'

const hash32 = (input: string): string => `0x${createHash('sha256').update(input).digest('hex')}`

const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10)

const dayWindow = (date: Date): { startIso: string; endIso: string } => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999))

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

const merchantHash = hash32('merchant-1')

const batches: FrontendBatchView[] = [
  {
    batchId: 1,
    merchantIdHash: merchantHash,
    productIdHash: hash32('Coffee'),
    tokenSymbol: 'CUP1',
    unitCostMinor: '2000000',
    unitPayoutMinor: '2200000',
    unitsForSale: '1000',
    unitsSoldToInvestors: '320',
    unitsSettled: '205',
    unitsClaimed: '172',
    active: true,
    riskTier: 'LOW',
    fundingLiquidityMinor: '325000000',
    unitToken: '0x2f3f6ee30bc02470052273fd1a246e85df3c3f31',
  },
  {
    batchId: 2,
    merchantIdHash: merchantHash,
    productIdHash: hash32('Bakery'),
    tokenSymbol: 'BKR1',
    unitCostMinor: '1800000',
    unitPayoutMinor: '2050000',
    unitsForSale: '1200',
    unitsSoldToInvestors: '410',
    unitsSettled: '255',
    unitsClaimed: '199',
    active: true,
    riskTier: 'MEDIUM',
    fundingLiquidityMinor: '298500000',
    unitToken: '0x8d36b90240f19ee2f656f886c5abf65df1577f89',
  },
  {
    batchId: 3,
    merchantIdHash: merchantHash,
    productIdHash: hash32('Sandwiches'),
    tokenSymbol: 'SND1',
    unitCostMinor: '2500000',
    unitPayoutMinor: '2800000',
    unitsForSale: '800',
    unitsSoldToInvestors: '225',
    unitsSettled: '89',
    unitsClaimed: '21',
    active: false,
    riskTier: 'HIGH',
    fundingLiquidityMinor: '165000000',
    unitToken: '0x9f25620f7348a4f1f998fbe0e9896ce4dc0af9d4',
  },
]

const buildReasonCode = (status: VerificationStatus, dayIndex: number): ReasonCode => {
  if (status === 'VERIFIED') {
    return 'OK'
  }

  if (dayIndex % 3 === 0) {
    return 'REFUND_RATIO'
  }

  if (dayIndex % 3 === 1) {
    return 'SUDDEN_SPIKE'
  }

  return 'REFUND_AND_SPIKE'
}

const periods: FrontendPeriodView[] = (() => {
  const rows: FrontendPeriodView[] = []
  const now = new Date()

  for (let dayIndex = 0; dayIndex < 21; dayIndex += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayIndex))
    const dayKey = toIsoDay(date)
    const { startIso, endIso } = dayWindow(date)

    for (const batch of batches.slice(0, 2)) {
      const baseUnits = BigInt(10 + ((dayIndex + batch.batchId) % 8) * 3)
      const refundUnits = BigInt(dayIndex % 5 === 0 ? 2 : dayIndex % 4 === 0 ? 1 : 0)
      const netUnits = baseUnits - refundUnits

      const grossMinor = baseUnits * BigInt(batch.unitPayoutMinor)
      const refundMinor = refundUnits * BigInt(batch.unitPayoutMinor)
      const netMinor = grossMinor - refundMinor

      const status: VerificationStatus = dayIndex % 6 === 0 && batch.batchId === 2 ? 'UNVERIFIED' : 'VERIFIED'
      const reasonCode = buildReasonCode(status, dayIndex)
      const riskScore =
        reasonCode === 'OK'
          ? 120
          : reasonCode === 'REFUND_RATIO'
            ? 620
            : reasonCode === 'SUDDEN_SPIKE'
              ? 540
              : 790

      rows.push({
        periodId: hash32(`${batch.batchId}:${dayKey}`),
        batchId: batch.batchId,
        merchantIdHash: batch.merchantIdHash,
        productIdHash: batch.productIdHash,
        periodStart: startIso,
        periodEnd: endIso,
        generatedAt: new Date(new Date(endIso).getTime() + 15 * 60 * 1000).toISOString(),
        grossSalesMinor: grossMinor.toString(),
        refundsMinor: refundMinor.toString(),
        netSalesMinor: netMinor.toString(),
        unitsSold: baseUnits.toString(),
        refundUnits: refundUnits.toString(),
        netUnitsSold: netUnits.toString(),
        eventCount: Number(baseUnits + refundUnits + 6n),
        status,
        riskScore,
        reasonCode,
        batchHash: hash32(String(batch.batchId)),
      })
    }
  }

  return rows.sort((left, right) => (left.generatedAt > right.generatedAt ? -1 : 1))
})()

const txs: FrontendTxView[] = [
  {
    apiVersion: FRONTEND_API_VERSION,
    txHash: '0x4e32f9e15b9ab1dc0b07b1ff578da675f2f9d18c220b09f7cad2721e3f40b90f',
    status: 'confirmed',
    chainId: 11155111,
    submittedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 36 * 60 * 1000).toISOString(),
    summary: 'Investor buyUnits for batch 1',
  },
  {
    apiVersion: FRONTEND_API_VERSION,
    txHash: '0x0a16b603bf0ad6d9f7a3e9c0ccb9d9ef5ec5fb26195461e74a84dd57fbf5ded2',
    status: 'pending',
    chainId: 11155111,
    submittedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    summary: 'Merchant fundBatch for batch 2',
  },
  {
    apiVersion: FRONTEND_API_VERSION,
    txHash: '0xa6a0d1f5d8b7e8f8d7786e3fc86529f26196dbdbf7fbac430f5cad56a05d3a6d',
    status: 'failed',
    chainId: 11155111,
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
    summary: 'Admin setExpectedWorkflowId reverted',
  },
]

const clampPositive = (raw?: string): number => {
  if (!raw) {
    return 0
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
}

export const getOverview = (date: string): FrontendOverviewView => {
  const periodRows = periods.filter((period) => period.periodStart.slice(0, 10) === date)

  const gross = periodRows.reduce((acc, period) => acc + BigInt(period.grossSalesMinor), 0n)
  const refunds = periodRows.reduce((acc, period) => acc + BigInt(period.refundsMinor), 0n)
  const net = gross - refunds
  const unitsSettled = periodRows.reduce((acc, period) => acc + BigInt(period.netUnitsSold), 0n)

  const latest = periods[0]

  return {
    apiVersion: FRONTEND_API_VERSION,
    date,
    pipeline: {
      backendHealth: 'ok',
      latestPeriodId: latest?.periodId ?? null,
      latestStatus: latest?.status ?? null,
      latestGeneratedAt: latest?.generatedAt ?? null,
    },
    metrics: {
      grossSalesMinor: gross.toString(),
      refundsMinor: refunds.toString(),
      netSalesMinor: net.toString(),
      verifiedPeriods: periodRows.filter((period) => period.status === 'VERIFIED').length,
      unverifiedPeriods: periodRows.filter((period) => period.status === 'UNVERIFIED').length,
      unitsSettled: unitsSettled.toString(),
    },
  }
}

export const listBatches = (): FrontendBatchView[] => batches

export const getBatch = (batchId: number): FrontendBatchView | undefined =>
  batches.find((batch) => batch.batchId === batchId)

export const listPeriods = (params: {
  batchId?: number
  status?: VerificationStatus
  cursor?: string
  limit?: number
}): { periods: FrontendPeriodView[]; nextCursor: string | null } => {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)
  const offset = clampPositive(params.cursor)

  const filtered = periods.filter((period) => {
    if (params.batchId !== undefined && period.batchId !== params.batchId) {
      return false
    }

    if (params.status !== undefined && period.status !== params.status) {
      return false
    }

    return true
  })

  const slice = filtered.slice(offset, offset + limit)
  const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null

  return { periods: slice, nextCursor }
}

export const getPortfolio = (wallet: string): FrontendPortfolioView => {
  const seed = parseInt(wallet.slice(-2), 16)
  const positions = batches.slice(0, 2).map((batch, index) => {
    const unitsOwned = BigInt((seed % (35 + index * 8)) + 10 + index * 5)
    const globalClaimable = BigInt(batch.unitsSettled) - BigInt(batch.unitsClaimed)
    const unitsClaimableNow = unitsOwned > globalClaimable ? globalClaimable : unitsOwned

    return {
      batchId: batch.batchId,
      unitToken: batch.unitToken,
      symbol: batch.tokenSymbol,
      unitsOwned: unitsOwned.toString(),
      unitsClaimableNow: unitsClaimableNow.toString(),
      costBasisMinor: (unitsOwned * BigInt(batch.unitCostMinor)).toString(),
    }
  })

  return {
    apiVersion: FRONTEND_API_VERSION,
    wallet,
    claimableGlobalUnitsByBatch: Object.fromEntries(
      batches.map((batch) => [String(batch.batchId), (BigInt(batch.unitsSettled) - BigInt(batch.unitsClaimed)).toString()]),
    ),
    positions,
    claims: [
      {
        txHash: txs[0].txHash,
        batchId: 1,
        unitsRedeemed: '8',
        payoutMinor: (8n * BigInt(batches[0].unitPayoutMinor)).toString(),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }
}

export const getTx = (txHash: string): FrontendTxView | undefined =>
  txs.find((tx) => tx.txHash.toLowerCase() === txHash.toLowerCase())

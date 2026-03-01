'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataState } from '@/components/ui/data-state'
import { useBatches } from '@/lib/api/hooks'
import { formatUsdMinor, formatUnits } from '@/lib/utils/format'

const InvestorPortfolioPanel = dynamic(
  () => import('@/features/investor/investor-portfolio-panel').then((module) => module.InvestorPortfolioPanel),
  {
    ssr: false,
    loading: () => (
      <Card>
        <h2 className="font-heading text-lg font-semibold">Portfolio Snapshot</h2>
        <p className="mt-3 text-sm text-textMuted">Loading wallet portfolio module...</p>
      </Card>
    ),
  },
)

const InvestorTransactionsPanel = dynamic(
  () => import('@/features/investor/investor-transactions-panel').then((module) => module.InvestorTransactionsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="text-sm text-textMuted">Loading buy/claim module...</p>
        </Card>
        <Card>
          <p className="text-sm text-textMuted">Loading buy/claim module...</p>
        </Card>
      </div>
    ),
  },
)

export const InvestorDashboard = () => {
  const batchesQuery = useBatches()

  const activeBatches = useMemo(
    () => (batchesQuery.data?.batches ?? []).filter((batch) => batch.active),
    [batchesQuery.data?.batches],
  )

  const totals = useMemo(() => {
    const available = activeBatches.reduce(
      (sum, batch) => sum + (BigInt(batch.unitsForSale) - BigInt(batch.unitsSoldToInvestors)),
      0n,
    )

    const totalLiquidity = activeBatches.reduce((sum, batch) => sum + BigInt(batch.fundingLiquidityMinor), 0n)

    return {
      activeCount: activeBatches.length,
      available,
      totalLiquidity,
    }
  }, [activeBatches])

  return (
    <main className="space-y-6">
      <PageHeader
        title="Investor Portal"
        subtitle="Discover active batches, evaluate risk tiers, and execute buy/claim actions through onchain settlement flows."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Active batches</p>
          <p className="mt-2 font-heading text-3xl text-text">{totals.activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Available units</p>
          <p className="mt-2 font-heading text-3xl text-text">{formatUnits(totals.available)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Total liquidity</p>
          <p className="mt-2 font-heading text-3xl text-text">{formatUsdMinor(totals.totalLiquidity)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Active Offerings</h2>
        <DataState
          isLoading={batchesQuery.isLoading}
          error={batchesQuery.error instanceof Error ? batchesQuery.error.message : null}
          empty={activeBatches.length === 0}
          emptyLabel="No active batches available."
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeBatches.map((batch) => (
              <Card key={batch.batchId} className="bg-panelMuted">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-text">Batch #{batch.batchId}</p>
                  <Badge tone="signal" label={batch.riskTier} />
                </div>
                <dl className="mt-3 space-y-1 text-sm text-textMuted">
                  <div className="flex justify-between">
                    <dt>Cost / Unit</dt>
                    <dd>{formatUsdMinor(batch.unitCostMinor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Payout / Unit</dt>
                    <dd>{formatUsdMinor(batch.unitPayoutMinor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Available Units</dt>
                    <dd>{formatUnits(BigInt(batch.unitsForSale) - BigInt(batch.unitsSoldToInvestors))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Liquidity</dt>
                    <dd>{formatUsdMinor(batch.fundingLiquidityMinor)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </DataState>
      </Card>

      <InvestorPortfolioPanel />

      <InvestorTransactionsPanel batches={batchesQuery.data?.batches ?? []} />
    </main>
  )
}

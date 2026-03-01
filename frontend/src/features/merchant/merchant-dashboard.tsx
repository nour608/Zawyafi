'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataState } from '@/components/ui/data-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useBatches, usePaymentsDaily, useRefundsDaily } from '@/lib/api/hooks'
import { formatUsdMinor, formatUnits, statusTone, toIsoDate } from '@/lib/utils/format'

const merchantId = 'merchant-1'

const MerchantActionsPanel = dynamic(
  () => import('@/features/merchant/merchant-actions-panel').then((module) => module.MerchantActionsPanel),
  {
    ssr: false,
    loading: () => (
      <Card>
        <p className="text-sm text-textMuted">Loading merchant transaction controls...</p>
      </Card>
    ),
  },
)

export const MerchantDashboard = () => {
  const [date, setDate] = useState(toIsoDate())
  const [category, setCategory] = useState('Coffee')

  const batchesQuery = useBatches()
  const paymentsQuery = usePaymentsDaily({ merchantId, date, category })
  const refundsQuery = useRefundsDaily({ merchantId, date })

  const totals = useMemo(() => {
    const gross = paymentsQuery.data?.payments.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n) ?? 0n
    const refunds = refundsQuery.data?.refunds.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n) ?? 0n
    const net = gross - refunds
    return { gross, refunds, net }
  }, [paymentsQuery.data?.payments, refundsQuery.data?.refunds])

  return (
    <main className="space-y-6">
      <PageHeader
        title="Merchant Operations"
        subtitle="Manage product batches, liquidity funding, and daily Square-backed revenue monitoring for attestation windows."
      />

      <Card>
        <h2 className="font-heading text-lg font-semibold">Daily Revenue Monitor</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm text-textMuted">
            Date (UTC)
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            Category
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="Coffee">Coffee</option>
              <option value="Bakery">Bakery</option>
              <option value="Sandwiches">Sandwiches</option>
            </Select>
          </label>
          <div className="space-y-2 text-sm text-textMuted">
            Merchant
            <Input value={merchantId} disabled />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Card className="bg-panelMuted">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Gross</p>
            <p className="mt-2 text-2xl font-semibold text-text">{formatUsdMinor(totals.gross)}</p>
          </Card>
          <Card className="bg-panelMuted">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Refunds</p>
            <p className="mt-2 text-2xl font-semibold text-text">{formatUsdMinor(totals.refunds)}</p>
          </Card>
          <Card className="bg-panelMuted">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Net</p>
            <p className="mt-2 text-2xl font-semibold text-text">{formatUsdMinor(totals.net)}</p>
          </Card>
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Batch Management</h2>
        <DataState
          isLoading={batchesQuery.isLoading}
          error={batchesQuery.error instanceof Error ? batchesQuery.error.message : null}
          empty={!batchesQuery.data?.batches.length}
          emptyLabel="No batches indexed yet."
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batchesQuery.data?.batches.map((batch) => (
              <Card className="bg-panelMuted" key={batch.batchId}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-text">Batch #{batch.batchId}</p>
                  <Badge tone={batch.active ? statusTone('VERIFIED') : 'warning'} label={batch.active ? 'Active' : 'Paused'} />
                </div>
                <p className="mt-2 text-sm text-textMuted">{batch.tokenSymbol}</p>
                <dl className="mt-3 space-y-1 text-sm text-textMuted">
                  <div className="flex justify-between">
                    <dt>Unit Cost</dt>
                    <dd>{formatUsdMinor(batch.unitCostMinor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sold / Supply</dt>
                    <dd>
                      {formatUnits(batch.unitsSoldToInvestors)} / {formatUnits(batch.unitsForSale)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Settled</dt>
                    <dd>{formatUnits(batch.unitsSettled)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </DataState>
      </Card>

      <MerchantActionsPanel />
    </main>
  )
}

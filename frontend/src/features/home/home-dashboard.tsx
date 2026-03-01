'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/shared/kpi-card'
import { PipelineStrip } from '@/components/shared/pipeline-strip'
import { PageHeader } from '@/components/layout/page-header'
import { DataState } from '@/components/ui/data-state'
import { useBackendHealth, useOverview } from '@/lib/api/hooks'
import { formatShortHash, formatUnits, formatUsdMinor, toIsoDate } from '@/lib/utils/format'

export const HomeDashboard = () => {
  const [date, setDate] = useState(toIsoDate())
  const overviewQuery = useOverview(date)
  const healthQuery = useBackendHealth()

  const overview = overviewQuery.data

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Revenue Attestation Control Room"
        subtitle="Track live cashflow attestation from Square through CRE into onchain settlement, optimized for demo execution and operational readiness."
      />

      <Card className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="w-full max-w-xs space-y-2 text-sm text-textMuted" htmlFor="overview-date">
          Period Date (UTC)
          <Input id="overview-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-canvas" href="/merchant">
            Merchant Portal
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-panelMuted px-4 py-2 text-sm font-semibold text-text" href="/investor">
            Investor Portal
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-panelMuted px-4 py-2 text-sm font-semibold text-text" href="/compliance">
            Compliance Portal
          </Link>
        </div>
      </Card>

      <DataState
        isLoading={overviewQuery.isLoading || healthQuery.isLoading}
        error={overviewQuery.error instanceof Error ? overviewQuery.error.message : healthQuery.error instanceof Error ? healthQuery.error.message : null}
      >
        {overview ? (
          <>
            <PipelineStrip
              backendState={healthQuery.data?.status === 'ok' ? 'ok' : overview.pipeline.backendHealth}
              latestStatus={overview.pipeline.latestStatus}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Gross Sales" value={formatUsdMinor(overview.metrics.grossSalesMinor)} hint="Square filtered period gross" />
              <KpiCard label="Refunds" value={formatUsdMinor(overview.metrics.refundsMinor)} hint="Refund deductions for period" />
              <KpiCard label="Net Sales" value={formatUsdMinor(overview.metrics.netSalesMinor)} hint="Net attested sales" />
              <KpiCard label="Verified Periods" value={String(overview.metrics.verifiedPeriods)} hint="Workflow status = VERIFIED" />
              <KpiCard label="Units Settled" value={formatUnits(overview.metrics.unitsSettled)} hint="SettlementVault settled units" />
            </div>

            <Card>
              <h2 className="font-heading text-lg font-semibold">Demo Mode Checklist</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-textMuted">
                <li>Show pipeline status and current period totals.</li>
                <li>Open Merchant to monitor daily Square category revenue.</li>
                <li>Open Investor to buy units and claim payouts.</li>
                <li>Open Compliance to inspect risk flags and reason codes.</li>
                <li>Open Admin to review workflow trust settings.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-textMuted">
                <p>Latest period: {overview.pipeline.latestPeriodId ? formatShortHash(overview.pipeline.latestPeriodId) : 'None'}</p>
                <p>Generated at: {overview.pipeline.latestGeneratedAt ?? 'N/A'}</p>
              </div>
            </Card>
          </>
        ) : null}
      </DataState>
    </main>
  )
}

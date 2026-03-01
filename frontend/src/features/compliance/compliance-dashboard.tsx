'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataState } from '@/components/ui/data-state'
import { Input } from '@/components/ui/input'
import { useComplianceReport, useCreateComplianceReport } from '@/lib/api/hooks'
import type { ComplianceReportPeriod } from '@/lib/types/frontend'
import { formatShortHash, formatUnits, formatUsdMinor, reasonLabel, statusTone, toIsoDate } from '@/lib/utils/format'

const toCsv = (periods: ComplianceReportPeriod[]): string => {
  const headers = [
    'periodId',
    'batchHash',
    'status',
    'riskScore',
    'reasonCode',
    'grossSalesMinor',
    'refundsMinor',
    'netSalesMinor',
    'unitsSold',
    'refundUnits',
    'netUnitsSold',
    'txHash',
    'blockNumber',
    'logIndex',
    'generatedAt',
  ]

  const rows = periods.map((period) =>
    [
      period.periodId,
      period.batchHash,
      period.status,
      String(period.riskScore),
      period.reasonCode,
      period.grossSalesMinor,
      period.refundsMinor,
      period.netSalesMinor,
      period.unitsSold,
      period.refundUnits,
      period.netUnitsSold,
      period.txHash,
      period.blockNumber,
      String(period.logIndex),
      period.generatedAt,
    ].join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}

const triggerDownload = (filename: string, content: string, type: string): void => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const EMPTY_PERIODS: ComplianceReportPeriod[] = []
const merchantHashPattern = /^0x[a-fA-F0-9]{64}$/

export const ComplianceDashboard = () => {
  const [merchantIdHash, setMerchantIdHash] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - 6)
    return toIsoDate(date)
  })
  const [endDate, setEndDate] = useState(() => toIsoDate())
  const [requestId, setRequestId] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ComplianceReportPeriod | null>(null)

  const createReport = useCreateComplianceReport()
  const reportQuery = useComplianceReport(requestId ?? undefined)

  const report = reportQuery.data?.report ?? null
  const periods = report?.periods ?? EMPTY_PERIODS

  const riskSummary = useMemo(() => {
    return periods.reduce(
      (acc, period) => {
        if (period.reasonCode === 'REFUND_RATIO') acc.refundRatio += 1
        if (period.reasonCode === 'SUDDEN_SPIKE') acc.suddenSpike += 1
        if (period.reasonCode === 'REFUND_AND_SPIKE') acc.both += 1
        return acc
      },
      { refundRatio: 0, suddenSpike: 0, both: 0 },
    )
  }, [periods])

  const handleGenerate = async (): Promise<void> => {
    if (!merchantHashPattern.test(merchantIdHash)) {
      return
    }

    const created = await createReport.mutateAsync({ merchantIdHash, startDate, endDate })
    setRequestId(created.requestId)
    setSelectedPeriod(null)
  }

  const handleExportJson = (): void => {
    if (!report) return
    triggerDownload('compliance-report.json', JSON.stringify(report, null, 2), 'application/json')
  }

  const handleExportCsv = (): void => {
    triggerDownload('compliance-periods.csv', toCsv(periods), 'text/csv')
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Compliance and Risk"
        subtitle="Review attested period reports, anomaly reasons, and export regulator-ready snapshots for audit flows."
      />

      <Card className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-2 text-sm text-textMuted">
            Merchant Hash
            <Input value={merchantIdHash} onChange={(event) => setMerchantIdHash(event.target.value)} placeholder="0x..." />
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            Start Date
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            End Date
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <div className="flex items-end justify-end gap-2 md:col-span-2">
            <Button onClick={handleGenerate} disabled={!merchantHashPattern.test(merchantIdHash) || createReport.isPending}>
              {createReport.isPending ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button variant="secondary" onClick={handleExportJson} disabled={periods.length === 0}>
              Export JSON
            </Button>
            <Button variant="secondary" onClick={handleExportCsv} disabled={periods.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Refund Ratio Flags</p>
          <p className="mt-2 text-3xl font-semibold text-text">{riskSummary.refundRatio}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Sudden Spike Flags</p>
          <p className="mt-2 text-3xl font-semibold text-text">{riskSummary.suddenSpike}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Combined Flags</p>
          <p className="mt-2 text-3xl font-semibold text-text">{riskSummary.both}</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Request Status</h2>
        {requestId ? (
          <div className="mt-3 space-y-2 text-sm text-textMuted">
            <p>Request ID: {requestId}</p>
            <p>
              Status:{' '}
              <Badge
                tone={
                  reportQuery.data?.status === 'SUCCEEDED' ? 'success' : reportQuery.data?.status === 'FAILED' ? 'danger' : 'warning'
                }
                label={reportQuery.data?.status ?? 'PROCESSING'}
              />
            </p>
            {reportQuery.data?.errorMessage ? <p className="text-danger">{reportQuery.data.errorMessage}</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-textMuted">Generate a report to start compliance processing.</p>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Period Timeline</h2>
        <DataState
          isLoading={reportQuery.isLoading}
          error={
            createReport.error instanceof Error
              ? createReport.error.message
              : reportQuery.error instanceof Error
                ? reportQuery.error.message
                : null
          }
          empty={periods.length === 0}
          emptyLabel="No periods found for this request."
        >
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="pb-3">Period</th>
                  <th className="pb-3">Batch Hash</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Risk</th>
                  <th className="pb-3">Reason</th>
                  <th className="pb-3">Net Sales</th>
                  <th className="pb-3">Units</th>
                  <th className="pb-3">Trace</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {periods.map((period) => (
                  <tr key={period.periodId}>
                    <td className="py-3 text-textMuted">{formatShortHash(period.periodId)}</td>
                    <td className="py-3 text-textMuted">{formatShortHash(period.batchHash)}</td>
                    <td className="py-3">
                      <Badge tone={statusTone(period.status)} label={period.status} />
                    </td>
                    <td className="py-3 text-textMuted">{period.riskScore}</td>
                    <td className="py-3 text-textMuted">{reasonLabel(period.reasonCode)}</td>
                    <td className="py-3 text-textMuted">{formatUsdMinor(period.netSalesMinor)}</td>
                    <td className="py-3 text-textMuted">{formatUnits(period.netUnitsSold)}</td>
                    <td className="py-3 text-textMuted">
                      {formatShortHash(period.txHash)} · {period.blockNumber}:{period.logIndex}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" onClick={() => setSelectedPeriod(period)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      {selectedPeriod ? (
        <Card>
          <h3 className="font-heading text-base font-semibold">Period Detail · {formatShortHash(selectedPeriod.periodId)}</h3>
          <dl className="mt-4 grid gap-3 text-sm text-textMuted md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Batch Hash</dt>
              <dd className="mt-1 break-all">{selectedPeriod.batchHash}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Status</dt>
              <dd className="mt-1">{selectedPeriod.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Gross</dt>
              <dd className="mt-1">{formatUsdMinor(selectedPeriod.grossSalesMinor)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Refunds</dt>
              <dd className="mt-1">{formatUsdMinor(selectedPeriod.refundsMinor)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Net</dt>
              <dd className="mt-1">{formatUsdMinor(selectedPeriod.netSalesMinor)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em]">Reason</dt>
              <dd className="mt-1">{reasonLabel(selectedPeriod.reasonCode)}</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </main>
  )
}

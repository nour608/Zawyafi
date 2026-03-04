'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataState } from '@/components/ui/data-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useComplianceInvestors, useComplianceKycRequests, useComplianceReports } from '@/lib/api/hooks'
import type { ComplianceReportStatus, KycStatus } from '@/lib/types/frontend'
import {
  complianceReportStatusTone,
  formatShortHash,
  formatUnits,
  formatUsdMinor,
  kycStatusLabel,
  kycStatusTone,
  reviewAnswerLabel,
} from '@/lib/utils/format'

const walletPattern = /^0x[a-fA-F0-9]{40}$/
const hashPattern = /^0x[a-fA-F0-9]{64}$/

const kycStatusOptions: Array<{ label: string; value: 'ALL' | KycStatus }> = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Pending CRE Bind', value: 'PENDING_CRE_BIND' },
  { label: 'Pending User Submission', value: 'PENDING_USER_SUBMISSION' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved Ready', value: 'APPROVED_READY' },
  { label: 'Onchain Pending', value: 'APPROVED_ONCHAIN_PENDING' },
  { label: 'Onchain Approved', value: 'ONCHAIN_APPROVED' },
  { label: 'Review Required', value: 'REVIEW_REQUIRED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Failed Retryable', value: 'FAILED_RETRYABLE' },
  { label: 'Failed Terminal', value: 'FAILED_TERMINAL' },
]

const reportStatusOptions: Array<{ label: string; value: 'ALL' | ComplianceReportStatus }> = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Queued', value: 'QUEUED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Succeeded', value: 'SUCCEEDED' },
  { label: 'Failed', value: 'FAILED' },
]

const toDateTime = (value: string | null): string => {
  if (!value) return 'N/A'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString()
}

export const ComplianceOperationsPanel = () => {
  const [kycStatus, setKycStatus] = useState<'ALL' | KycStatus>('ALL')
  const [kycWallet, setKycWallet] = useState('')
  const [reportStatus, setReportStatus] = useState<'ALL' | ComplianceReportStatus>('ALL')
  const [merchantHash, setMerchantHash] = useState('')
  const [investorStatus, setInvestorStatus] = useState<'ALL' | KycStatus>('ALL')

  const normalizedWallet = walletPattern.test(kycWallet) ? kycWallet : undefined
  const normalizedMerchantHash = hashPattern.test(merchantHash) ? merchantHash : undefined

  const kycQuery = useComplianceKycRequests({
    status: kycStatus === 'ALL' ? undefined : kycStatus,
    wallet: normalizedWallet,
    limit: 25,
  })
  const reportsQuery = useComplianceReports({
    status: reportStatus === 'ALL' ? undefined : reportStatus,
    merchantIdHash: normalizedMerchantHash,
    limit: 25,
  })
  const investorsQuery = useComplianceInvestors({
    status: investorStatus === 'ALL' ? undefined : investorStatus,
    limit: 25,
  })

  const kycRecords = useMemo(() => kycQuery.data?.records ?? [], [kycQuery.data?.records])
  const reportRecords = useMemo(() => reportsQuery.data?.records ?? [], [reportsQuery.data?.records])
  const investorRecords = useMemo(() => investorsQuery.data?.records ?? [], [investorsQuery.data?.records])

  const kycSummary = useMemo(() => {
    return kycRecords.reduce(
      (acc, record) => {
        if (record.status === 'ONCHAIN_APPROVED') {
          acc.onchainApproved += 1
        }

        if (record.status === 'APPROVED_READY' || record.status === 'APPROVED_ONCHAIN_PENDING' || record.status === 'ONCHAIN_APPROVED') {
          acc.approved += 1
        }

        if (record.status === 'PENDING_CRE_BIND' || record.status === 'PENDING_USER_SUBMISSION' || record.status === 'IN_REVIEW') {
          acc.pending += 1
        }

        if (
          record.status === 'REVIEW_REQUIRED' ||
          record.status === 'REJECTED' ||
          record.status === 'FAILED_RETRYABLE' ||
          record.status === 'FAILED_TERMINAL'
        ) {
          acc.reviewOrFailed += 1
        }

        return acc
      },
      {
        pending: 0,
        approved: 0,
        reviewOrFailed: 0,
        onchainApproved: 0,
      },
    )
  }, [kycRecords])

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Pending</p>
          <p className="mt-2 text-3xl font-semibold text-text">{kycSummary.pending}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Approved Pipeline</p>
          <p className="mt-2 text-3xl font-semibold text-text">{kycSummary.approved}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Review / Failed</p>
          <p className="mt-2 text-3xl font-semibold text-text">{kycSummary.reviewOrFailed}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Onchain Approved</p>
          <p className="mt-2 text-3xl font-semibold text-text">{kycSummary.onchainApproved}</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">KYC Request Queue</h2>
          <p className="text-xs text-textMuted">Showing latest {kycRecords.length} requests</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm text-textMuted">
            Status
            <Select value={kycStatus} onChange={(event) => setKycStatus(event.target.value as 'ALL' | KycStatus)}>
              {kycStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm text-textMuted md:col-span-2">
            Wallet (optional)
            <Input value={kycWallet} onChange={(event) => setKycWallet(event.target.value)} placeholder="0x...40-char wallet" />
          </label>
        </div>

        <DataState
          isLoading={kycQuery.isLoading}
          error={kycQuery.error instanceof Error ? kycQuery.error.message : null}
          empty={kycRecords.length === 0}
          emptyLabel="No KYC requests for current filters."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="pb-3">Request</th>
                  <th className="pb-3">Wallet</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Review</th>
                  <th className="pb-3">Issue</th>
                  <th className="pb-3">Onchain Tx</th>
                  <th className="pb-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kycRecords.map((record) => (
                  <tr key={record.requestId}>
                    <td className="py-3 text-textMuted">{formatShortHash(record.requestId)}</td>
                    <td className="py-3 text-textMuted">{formatShortHash(record.wallet)}</td>
                    <td className="py-3">
                      <Badge tone={kycStatusTone(record.status)} label={kycStatusLabel(record.status)} />
                    </td>
                    <td className="py-3 text-textMuted">{reviewAnswerLabel(record.sumsubReviewAnswer)}</td>
                    <td className="py-3 text-textMuted">{record.lastErrorCode ?? record.lastErrorMessage ?? 'None'}</td>
                    <td className="py-3 text-textMuted">{record.onchainTxHash ? formatShortHash(record.onchainTxHash) : 'N/A'}</td>
                    <td className="py-3 text-textMuted">{toDateTime(record.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Compliance Report Queue</h2>
          <p className="text-xs text-textMuted">Showing latest {reportRecords.length} requests</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm text-textMuted">
            Status
            <Select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as 'ALL' | ComplianceReportStatus)}>
              {reportStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm text-textMuted md:col-span-2">
            Merchant Hash (optional)
            <Input value={merchantHash} onChange={(event) => setMerchantHash(event.target.value)} placeholder="0x...64-char hash" />
          </label>
        </div>

        <DataState
          isLoading={reportsQuery.isLoading}
          error={reportsQuery.error instanceof Error ? reportsQuery.error.message : null}
          empty={reportRecords.length === 0}
          emptyLabel="No compliance report requests for current filters."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="pb-3">Request</th>
                  <th className="pb-3">Merchant</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Window</th>
                  <th className="pb-3">Attempts</th>
                  <th className="pb-3">Issue</th>
                  <th className="pb-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reportRecords.map((record) => (
                  <tr key={record.requestId}>
                    <td className="py-3 text-textMuted">{formatShortHash(record.requestId)}</td>
                    <td className="py-3 text-textMuted">{formatShortHash(record.merchantIdHash)}</td>
                    <td className="py-3">
                      <Badge tone={complianceReportStatusTone(record.status)} label={record.status} />
                    </td>
                    <td className="py-3 text-textMuted">
                      {record.startDate} to {record.endDate}
                    </td>
                    <td className="py-3 text-textMuted">{record.attemptCount}</td>
                    <td className="py-3 text-textMuted">{record.errorCode ?? record.errorMessage ?? 'None'}</td>
                    <td className="py-3 text-textMuted">{toDateTime(record.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Investor Wallet Exposure</h2>
          <p className="text-xs text-textMuted">Showing latest {investorRecords.length} wallets</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm text-textMuted">
            Latest KYC Status
            <Select value={investorStatus} onChange={(event) => setInvestorStatus(event.target.value as 'ALL' | KycStatus)}>
              {kycStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <DataState
          isLoading={investorsQuery.isLoading}
          error={investorsQuery.error instanceof Error ? investorsQuery.error.message : null}
          empty={investorRecords.length === 0}
          emptyLabel="No investor wallets found for current filters."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="pb-3">Wallet</th>
                  <th className="pb-3">Latest KYC</th>
                  <th className="pb-3">Invested</th>
                  <th className="pb-3">Batches</th>
                  <th className="pb-3">Units</th>
                  <th className="pb-3">Cost Basis</th>
                  <th className="pb-3">Portfolio Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {investorRecords.map((record) => (
                  <tr key={`${record.wallet}-${record.latestRequestId}`}>
                    <td className="py-3 text-textMuted">{formatShortHash(record.wallet)}</td>
                    <td className="py-3">
                      <Badge tone={kycStatusTone(record.latestKycStatus)} label={kycStatusLabel(record.latestKycStatus)} />
                    </td>
                    <td className="py-3 text-textMuted">{record.hasInvested ? 'Yes' : 'No'}</td>
                    <td className="py-3 text-textMuted">{record.investedBatchCount}</td>
                    <td className="py-3 text-textMuted">{formatUnits(record.totalUnitsOwned)}</td>
                    <td className="py-3 text-textMuted">{formatUsdMinor(record.totalCostBasisMinor)}</td>
                    <td className="py-3">
                      <Badge tone={record.portfolioStatus === 'ok' ? 'success' : 'warning'} label={record.portfolioStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
    </section>
  )
}

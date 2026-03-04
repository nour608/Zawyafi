import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComplianceOperationsPanel } from '@/features/compliance/compliance-operations-panel'
import type {
  ComplianceInvestorWalletsResponse,
  ComplianceKycRequestsResponse,
  ComplianceReportRequestListResponse,
} from '@/lib/types/frontend'

const state: {
  kyc: {
    data?: ComplianceKycRequestsResponse
    isLoading: boolean
    error: Error | null
  }
  reports: {
    data?: ComplianceReportRequestListResponse
    isLoading: boolean
    error: Error | null
  }
  investors: {
    data?: ComplianceInvestorWalletsResponse
    isLoading: boolean
    error: Error | null
  }
} = {
  kyc: {
    data: undefined,
    isLoading: false,
    error: null,
  },
  reports: {
    data: undefined,
    isLoading: false,
    error: null,
  },
  investors: {
    data: undefined,
    isLoading: false,
    error: null,
  },
}

vi.mock('@/lib/api/hooks', () => ({
  useComplianceKycRequests: () => state.kyc,
  useComplianceReports: () => state.reports,
  useComplianceInvestors: () => state.investors,
}))

describe('ComplianceOperationsPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    state.kyc = {
      isLoading: false,
      error: null,
      data: {
        records: [
          {
            requestId: 'd65cb8fc-186a-47cc-b8ca-005f8a989134',
            wallet: '0x1234567890abcdef1234567890abcdef12345678',
            chainId: 11155111,
            status: 'ONCHAIN_APPROVED',
            sumsubReviewAnswer: 'GREEN',
            attemptCount: 0,
            nextRetryAt: null,
            processingLockUntil: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            onchainTxHash: `0x${'11'.repeat(32)}`,
            createdAt: '2026-03-01T10:00:00.000Z',
            updatedAt: '2026-03-01T10:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    }
    state.reports = {
      isLoading: false,
      error: null,
      data: {
        records: [
          {
            requestId: 'd4b7799c-e2f5-4c02-b4b9-e4ef9d369d6a',
            merchantIdHash: `0x${'22'.repeat(32)}`,
            startDate: '2026-02-01',
            endDate: '2026-02-28',
            status: 'SUCCEEDED',
            attemptCount: 1,
            nextRetryAt: null,
            errorCode: null,
            errorMessage: null,
            createdAt: '2026-03-01T11:00:00.000Z',
            updatedAt: '2026-03-01T11:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    }
    state.investors = {
      isLoading: false,
      error: null,
      data: {
        records: [
          {
            wallet: '0x1234567890abcdef1234567890abcdef12345678',
            latestKycStatus: 'ONCHAIN_APPROVED',
            latestKycUpdatedAt: '2026-03-01T10:00:00.000Z',
            latestRequestId: 'd65cb8fc-186a-47cc-b8ca-005f8a989134',
            hasInvested: true,
            investedBatchCount: 2,
            totalUnitsOwned: '150',
            totalCostBasisMinor: '25500000',
            portfolioStatus: 'ok',
          },
        ],
        nextCursor: null,
      },
    }
  })

  it('renders KYC, report, and investor rows', () => {
    render(<ComplianceOperationsPanel />)

    expect(screen.getByText('KYC Request Queue')).toBeInTheDocument()
    expect(screen.getByText('Compliance Report Queue')).toBeInTheDocument()
    expect(screen.getByText('Investor Wallet Exposure')).toBeInTheDocument()
    expect(screen.getAllByText('Onchain Approved').length).toBeGreaterThan(0)
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('$255000.00')).toBeInTheDocument()
  })

  it('shows empty states when data is missing', () => {
    state.kyc.data = { records: [], nextCursor: null }
    state.reports.data = { records: [], nextCursor: null }
    state.investors.data = { records: [], nextCursor: null }

    render(<ComplianceOperationsPanel />)

    expect(screen.getByText('No KYC requests for current filters.')).toBeInTheDocument()
    expect(screen.getByText('No compliance report requests for current filters.')).toBeInTheDocument()
    expect(screen.getByText('No investor wallets found for current filters.')).toBeInTheDocument()
  })

  it('shows query errors', () => {
    state.kyc.error = new Error('KYC endpoint failed')
    state.reports.error = new Error('Report endpoint failed')
    state.investors.error = new Error('Investor endpoint failed')

    render(<ComplianceOperationsPanel />)

    expect(screen.getByText('KYC endpoint failed')).toBeInTheDocument()
    expect(screen.getByText('Report endpoint failed')).toBeInTheDocument()
    expect(screen.getByText('Investor endpoint failed')).toBeInTheDocument()
  })
})

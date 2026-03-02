import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvestorPortfolioPanel } from '@/features/investor/investor-portfolio-panel'

const state: { account: { address: `0x${string}` } | undefined } = {
  account: undefined,
}

const usePortfolioMock = vi.fn()

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => state.account,
}))

vi.mock('@/lib/api/hooks', () => ({
  usePortfolio: (wallet?: string) => usePortfolioMock(wallet),
}))

describe('InvestorPortfolioPanel', () => {
  beforeEach(() => {
    state.account = undefined
    usePortfolioMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: undefined,
    })
  })

  it('hides KYC button while disconnected', () => {
    render(<InvestorPortfolioPanel />)

    expect(screen.queryByRole('button', { name: 'Start KYC' })).not.toBeInTheDocument()
  })

  it('shows KYC button in portfolio header while connected', () => {
    state.account = { address: '0x1234567890abcdef1234567890abcdef12345678' }
    usePortfolioMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        positions: [],
      },
    })

    render(<InvestorPortfolioPanel />)

    const kycButton = screen.getByRole('button', { name: 'Start KYC' })
    expect(kycButton).toBeInTheDocument()
    expect(kycButton.closest('a')).toHaveAttribute('href', '/compliance/kyc')
  })
})

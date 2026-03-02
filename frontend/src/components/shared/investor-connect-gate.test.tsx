import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvestorConnectGate } from '@/components/shared/investor-connect-gate'

const state: { account: { address: `0x${string}` } | undefined } = {
  account: undefined,
}

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => state.account,
}))

vi.mock('@/components/shared/wallet-action-button', () => ({
  WalletActionButton: ({ labelDisconnected }: { labelDisconnected: string }) => <button>{labelDisconnected}</button>,
}))

describe('InvestorConnectGate', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    state.account = undefined
  })

  it('renders the gate message and hides children while disconnected', () => {
    render(
      <InvestorConnectGate title="Access Locked" description="Please connect first.">
        <div>Protected Content</div>
      </InvestorConnectGate>,
    )

    expect(screen.getByText('Access Locked')).toBeInTheDocument()
    expect(screen.getByText('Please connect first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children while connected', () => {
    state.account = { address: '0x1234567890abcdef1234567890abcdef12345678' }

    render(
      <InvestorConnectGate>
        <div>Protected Content</div>
      </InvestorConnectGate>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Wallet' })).not.toBeInTheDocument()
  })
})

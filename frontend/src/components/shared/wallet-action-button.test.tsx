import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletActionButton } from '@/components/shared/wallet-action-button'

const connectMock = vi.fn(async () => ({}))
const disconnectMock = vi.fn()

const state: {
  account: { address: `0x${string}` } | undefined
  wallet: { id: string } | undefined
} = {
  account: undefined,
  wallet: undefined,
}

vi.mock('thirdweb/chains', () => ({
  sepolia: { id: 11155111 },
}))

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => state.account,
  useActiveWallet: () => state.wallet,
  useConnectModal: () => ({ connect: connectMock, isConnecting: false }),
  useDisconnect: () => ({ disconnect: disconnectMock }),
}))

describe('WalletActionButton', () => {
  beforeEach(() => {
    state.account = undefined
    state.wallet = undefined
    connectMock.mockClear()
    disconnectMock.mockClear()
  })

  it('opens connect modal while disconnected', async () => {
    render(<WalletActionButton labelDisconnected="Log in" />)

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(connectMock).toHaveBeenCalledTimes(1)
  })

  it('shows connected address and allows disconnect', () => {
    state.account = { address: '0x1234567890abcdef1234567890abcdef12345678' }
    state.wallet = { id: 'mock-wallet' }

    render(<WalletActionButton labelDisconnected="Connect" />)

    expect(screen.getByText('0x12345...45678')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }))

    expect(disconnectMock).toHaveBeenCalledWith(state.wallet)
  })
})

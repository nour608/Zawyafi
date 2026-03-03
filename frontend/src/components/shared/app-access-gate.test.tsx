import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppAccessGate } from '@/components/shared/app-access-gate'
import type { RoleCapability } from '@/lib/types/frontend'

const defaultCapabilities: RoleCapability = {
  canUseMerchant: false,
  canUseCompliance: false,
  canUseAdmin: false,
}

const state: {
  pathname: string
  connectionStatus: 'unknown' | 'connecting' | 'connected' | 'disconnected'
  isConnected: boolean
  capabilities: RoleCapability
} = {
  pathname: '/investor/marketplace',
  connectionStatus: 'disconnected',
  isConnected: false,
  capabilities: defaultCapabilities,
}

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}))

vi.mock('thirdweb/react', () => ({
  useActiveWalletConnectionStatus: () => state.connectionStatus,
}))

vi.mock('@/hooks/use-capabilities', () => ({
  useCapabilities: () => ({
    address: state.isConnected ? '0x1234567890abcdef1234567890abcdef12345678' : undefined,
    isConnected: state.isConnected,
    capabilities: state.capabilities,
  }),
}))

vi.mock('@/components/shared/wallet-action-button', () => ({
  WalletActionButton: ({ labelDisconnected }: { labelDisconnected: string }) => <button>{labelDisconnected}</button>,
}))

describe('AppAccessGate', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    state.pathname = '/investor/marketplace'
    state.connectionStatus = 'disconnected'
    state.isConnected = false
    state.capabilities = { ...defaultCapabilities }
  })

  it('blocks disconnected users across app routes', () => {
    render(
      <AppAccessGate>
        <div>Protected Content</div>
      </AppAccessGate>,
    )

    expect(screen.getByText('Authentication required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('blocks non-admin users on /admin routes', () => {
    state.pathname = '/admin'
    state.connectionStatus = 'connected'
    state.isConnected = true

    render(
      <AppAccessGate>
        <div>Protected Content</div>
      </AppAccessGate>,
    )

    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(screen.getByText('This section requires an admin wallet.')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('allows admin users on /admin routes', () => {
    state.pathname = '/admin'
    state.connectionStatus = 'connected'
    state.isConnected = true
    state.capabilities = { ...defaultCapabilities, canUseAdmin: true }

    render(
      <AppAccessGate>
        <div>Protected Content</div>
      </AppAccessGate>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('allows connected users on /compliance/kyc', () => {
    state.pathname = '/compliance/kyc'
    state.connectionStatus = 'connected'
    state.isConnected = true

    render(
      <AppAccessGate>
        <div>KYC Content</div>
      </AppAccessGate>,
    )

    expect(screen.getByText('KYC Content')).toBeInTheDocument()
  })

  it('shows connect option while wallet status is unknown', () => {
    state.connectionStatus = 'unknown'

    render(
      <AppAccessGate>
        <div>Protected Content</div>
      </AppAccessGate>,
    )

    expect(screen.getByText('Authentication required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/components/layout/sidebar'
import type { RoleCapability } from '@/lib/types/frontend'

const state: {
  pathname: string
  address: `0x${string}` | undefined
  isConnected: boolean
  capabilities: RoleCapability
} = {
  pathname: '/investor/marketplace',
  address: undefined,
  isConnected: false,
  capabilities: {
    canUseMerchant: false,
    canUseCompliance: false,
    canUseAdmin: false,
  },
}

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/hooks/use-capabilities', () => ({
  useCapabilities: () => ({
    address: state.address,
    isConnected: state.isConnected,
    capabilities: state.capabilities,
    isCapabilitiesLoading: false,
  }),
}))

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    state.pathname = '/investor/marketplace'
    state.address = undefined
    state.isConnected = false
    state.capabilities = {
      canUseMerchant: false,
      canUseCompliance: false,
      canUseAdmin: false,
    }
  })

  it('hides portfolio, wallet, and profile while disconnected', () => {
    render(<Sidebar />)

    expect(screen.getByText('Marketplace')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.queryByText('Portfolio')).not.toBeInTheDocument()
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.queryByText('Connected Investor')).not.toBeInTheDocument()
  })

  it('shows portfolio, wallet, and short-hash profile while connected', () => {
    state.pathname = '/investor/portfolio'
    state.address = '0x1234567890abcdef1234567890abcdef12345678'
    state.isConnected = true

    render(<Sidebar />)

    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Connected Investor')).toBeInTheDocument()
    expect(screen.getByText('0x123456...345678')).toBeInTheDocument()
  })

  it('shows compliance portal links and role label on /compliance', () => {
    state.pathname = '/compliance'
    state.address = '0x1234567890abcdef1234567890abcdef12345678'
    state.isConnected = true
    state.capabilities = {
      canUseMerchant: false,
      canUseCompliance: true,
      canUseAdmin: false,
    }

    render(<Sidebar />)

    expect(screen.getByText('Compliance Ops')).toBeInTheDocument()
    expect(screen.queryByText('Marketplace')).not.toBeInTheDocument()
    expect(screen.getByText('Connected Compliance')).toBeInTheDocument()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
  })

  it('uses investor menu on /compliance/kyc onboarding path', () => {
    state.pathname = '/compliance/kyc'
    state.address = '0x1234567890abcdef1234567890abcdef12345678'
    state.isConnected = true

    render(<Sidebar />)

    expect(screen.getByText('Marketplace')).toBeInTheDocument()
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Connected Investor')).toBeInTheDocument()
  })

  it('keeps admin navigation on /compliance for admin wallets', () => {
    state.pathname = '/compliance'
    state.address = '0x1234567890abcdef1234567890abcdef12345678'
    state.isConnected = true
    state.capabilities = {
      canUseMerchant: true,
      canUseCompliance: true,
      canUseAdmin: true,
    }

    render(<Sidebar />)

    expect(screen.getByText('Admin Controls')).toBeInTheDocument()
    expect(screen.getByText('Compliance Ops')).toBeInTheDocument()
    expect(screen.getByText('Merchant Ops')).toBeInTheDocument()
    expect(screen.getByText('Connected Admin')).toBeInTheDocument()
  })
})

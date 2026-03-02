import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/components/layout/sidebar'

const state: {
  pathname: string
  account: { address: `0x${string}` } | undefined
} = {
  pathname: '/investor/marketplace',
  account: undefined,
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

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => state.account,
}))

describe('Sidebar', () => {
  beforeEach(() => {
    state.pathname = '/investor/marketplace'
    state.account = undefined
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
    state.account = { address: '0x1234567890abcdef1234567890abcdef12345678' }

    render(<Sidebar />)

    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Connected Investor')).toBeInTheDocument()
    expect(screen.getByText('0x123456...345678')).toBeInTheDocument()
  })
})

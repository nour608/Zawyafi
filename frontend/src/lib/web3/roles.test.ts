import { describe, expect, it } from 'vitest'
import { resolveCapabilities } from '@/lib/web3/roles'
import { env } from '@/lib/env'

describe('role resolver', () => {
  it('returns false capabilities for undefined wallet', () => {
    const result = resolveCapabilities(undefined)
    expect(result.canUseAdmin).toBe(false)
    expect(result.canUseMerchant).toBe(false)
    expect(result.canUseCompliance).toBe(false)
  })

  it('matches allowlist values', () => {
    const wallet = env.adminAllowlist[0]

    if (!wallet) {
      expect(resolveCapabilities('0x0000000000000000000000000000000000000000').canUseAdmin).toBe(false)
      return
    }

    const result = resolveCapabilities(wallet)
    expect(result.canUseAdmin).toBe(true)
    expect(result.canUseMerchant).toBe(true)
    expect(result.canUseCompliance).toBe(true)
  })
})
